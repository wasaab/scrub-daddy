// Todo: Refactor / finishing implementing

const c = require('../const.js');
const bot = require('../bot.js');
const util = require('../utilities/utilities.js');
const { logger } = require('../logger.js');
const natural = require('natural');
const emojiToName = require('gemoji/emoji-to-name');
const nameToEmoji = require('gemoji/name-to-emoji');
const inspect = require('util-inspect');
var reactionDataset = require('../../resources/data/reactionDataset.json');
const classifier = new natural.BayesClassifier();
// const classifier = new natural.LogisticRegressionClassifier();

const Analyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer;
const analyzer = new Analyzer("English", stemmer, "afinn");
const tokenizer = new natural.WordTokenizer();


// Object.keys(reactionToCount)
//     .sort((a, b) => reactionToCount[b] - reactionToCount[a])
//     .map((reaction) => { return { reaction: reaction, count: reactionToCount[reaction]};})

function getReaction(reactionData) {
    const serverEmojis = bot.getServer().emojis;
    const targetReaction = reactionData.reactions[0];
    const reaction = findEmoji(serverEmojis, targetReaction);

    return { targetReaction, reaction };
}

exports.train = function() {
    const reactionToCount = {};

    classifier.setOptions({ keepStops: true });
    reactionDataset.forEach((reactionData) => {
        const { targetReaction, reaction } = getReaction(reactionData);

        if (!reaction) { return; }

        var reactionCount = reactionToCount[targetReaction];

        if (reactionCount) {
            reactionCount++;
        } else {
            reactionCount = 1;
        }

        reactionToCount[targetReaction] = reactionCount;
    });


    reactionDataset.forEach((reactionData) => {
        const { targetReaction, reaction } = getReaction(reactionData);

        if (!reaction || reactionToCount[targetReaction] < 3) { return; }

        classifier.addDocument(reactionData.text.toLowerCase(), targetReaction);
    });


    const sortedCount = Object.keys(reactionToCount)
        .sort((a, b) => reactionToCount[b] - reactionToCount[a])
        .map((reaction) => {
            return { reaction: reaction, count: reactionToCount[reaction]};
        })
        .filter((reaction) => reaction.count > 2);

    classifier.train();
    logger.info('reaction training complete');
    // logger.info(`Reaction counts: ${inspect(sortedCount)}`);
};

function resolvePromisesSequentially(promises) {
    // return promises.reduce((promiseChain, currPromise) => { //eslint-disable-line
    //     return promiseChain.then((chainResults) => {
    //         return currPromise().then((currentResult) => {
    //             return [ ...chainResults, currentResult ];
    //         })
    //     });
    // }, Promise.resolve([]));

    promises.reduce(function(cur, next) {
        return cur.then(next);
    }, Promise.resolve()).then(function() {
        logger.info('--------------------- DONE COLLECTING REACTION DATA -------------------');
    });
}
function sleep(ms) {
    return () => new Promise((resolve) => {
        logger.info(`Sleeping for ${ms}ms`);

        return setTimeout(resolve, ms);
    });
}

exports.addRecentMessagesFromAllChannelsToDataset = function() {
    const textChannels = bot.getServer().channels.array()
        .filter((channel) => channel.type === 'text' && isChannelInTrainingCategory(channel));
    var addDataPromises = [];

    textChannels.forEach((channel) => {
        addDataPromises.push(createAddDataPromise(channel), sleep(40000));
    });

    resolvePromisesSequentially(addDataPromises);
        // .then((resolvedPromises) => {
        //     logger.info(`${resolvedPromises.length} promises resolved.`);
        // });
};

function isChannelInTrainingCategory(channel) {
    return channel.id !== c.BOT_SPAM_CHANNEL_ID && channel.parent && [c.CATEGORY_ID.Text, c.CATEGORY_ID.Topics, c.CATEGORY_ID.Temp].includes(channel.parent.id);
    // return channel.parent && [c.CATEGORY_ID.Text].includes(channel.parent.id);
}

function createAddDataPromise(channel) {
    return () => addAllMessagesInChannelToDataset(channel);
}

function addAllMessagesInChannelToDataset(channel, lastMsg) {
    const fetchOptions = { limit: 100 };

    if (lastMsg) {
        fetchOptions.before = lastMsg.id;
    }

    logger.info(`START Fetching 100 messages in channel "${channel.name}" before ${fetchOptions.before}`);
    return channel.fetchMessages(fetchOptions)
        .then((messages) => {
            logger.info(`   END fetching 100 message in channel "${channel.name}" before ${fetchOptions.before}`);
            if (0 === messages.size) {
                return new Promise((resolve) => resolve());
            }

            messages.array().forEach((message) => exports.maybeAddToDataset(message));
            return addAllMessagesInChannelToDataset(channel, messages.get(messages.lastKey()));
        })
        .catch((err) => {
            logger.error(`Failed to fetch messages in channel: ${channel.name}. Error: ${err}`);
            return new Promise((resolve) => resolve());
        });
}

function determineReactionCounts(responses, reactions) {
    const reactionToCount = {};
    var maxReactions = 1;

    responses.forEach((response, i) => {
        if (!response.success) { return; }

        const reactionCount = response.result.array().filter((user) => !user.bot).length;
        const reaction = reactions[i];

        if (['upvote', 'bet', '💹', '🐆'].includes(reaction.emoji.name)) { return; }

        reactionToCount[reaction.emoji.name] = reactionCount;

        if (reactionCount > maxReactions) {
            maxReactions = reactionCount;
        }
    });

    return { maxReactions, reactionToCount };
}

function buildReactionData(reactions, message, responses) {
    const { maxReactions, reactionToCount } = determineReactionCounts(responses, reactions);
    const topReactions = reactions
        .filter((reaction) => maxReactions === reactionToCount[reaction.emoji.name])
        .map((reaction) => {
            const emoji = reaction.emoji.name;
            const emojiName = emojiToName[emoji];

            return emojiName || emoji;
        });
    const wordMatchReaction = reactions.find((reaction) => message.content.includes(reaction.emoji.name));
    const wordMatchReactionName = wordMatchReaction?.emoji?.name;

    return {
        text: wordMatchReactionName || message.content,
        reactions: wordMatchReactionName ? [wordMatchReactionName] : topReactions
    };
}

function addToDataset(message) {
    var reactions = message.reactions.array();
    var reactingUsersPromises = reactions.map((reaction) => reaction.fetchUsers());

    util.handleAllPromises(reactingUsersPromises)
        .then((responses) => {
            const reactionData = buildReactionData(reactions, message, responses);

            if (0 === reactionData.reactions.length) { return; }

            logger.info(`   Adding reaction data: ${JSON.stringify(reactionData)}`);
            reactionDataset.push(reactionData);
            util.exportJson(reactionDataset, 'reactionDataset');
        })
        .catch(util.log);
}

exports.maybeAddToDataset = function(message) {
    if (0 === message.reactions.size || message.author.bot || null === message.content
        || '' === message.content || message.content.includes('http') || 50 < message.content.length) { return; }

    addToDataset(message);
};

exports.maybeReact = function(message) {
    if (util.getRand(1, 21) > 8) { return; }
    if (null === message.content || '' === message.content || message.author.bot || message.content.includes('http')) { return; }

    const reaction = determineReaction(message);

    logger.info(`Reacting with: ${reaction.name || reaction}`);
    message.react(reaction)
        .catch((err) => {
            const channel = util.mentionChannel(message.channel.id);

            logger.error(`Error reacting to message in ${channel}: ${message.content}. `, err);
        });
};

function determineReaction(message) {
    const emojis = bot.getServer().emojis.array();
    const wordMatchEmojis = tokenize(message.content)
        .map((word) => findEmoji(emojis, word))
        .filter((emoji) => emoji);

    if (0 !== wordMatchEmojis.length) {
        return wordMatchEmojis[0];
    }

    const reactionName = classifier.classify(message.content.toLowerCase());
    const reaction = emojis.find((emoji) => reactionName === emoji.name);

    return reaction || nameToEmoji[reactionName] || reactionName;
}

function tokenize(text) {
    text = text.toLowerCase();

    const tokens = tokenizer.tokenize(text);

    return 0 !== tokens.length ? tokens : text.split(' ');
}

function findEmoji(emojis, word) {
    if (emojiToName[word]) { return word; }
    if (word.length < 3 || c.NUMBER_TO_EMOJI[word]) { return; }

    const matchingEmoji = emojis.find((emoji) => word.toLowerCase() === emoji.name.toLowerCase()) || nameToEmoji[word];

    if (matchingEmoji) {
        return matchingEmoji;
    } else if (word.endsWith('s')) {
        return findEmoji(emojis, word.slice(0,-1));
    }
}

function determineSentimentReaction(message) {
    if (c.BOT_SPAM_CHANNEL_ID !== message.channel.id) { return; }

    const positiveReactions = ['bet', 'nice', 'whoa', 'gamersmirk', 'gamersmile', 'supahot'];
    const negativeReactions = ['ohboy', 'trash', 'respect', 'jesus', 'fu'];
    var sentiment = Math.round(analyzer.getSentiment(replaceEmojisWithNames(message.content)));

    if (sentiment < -5 || sentiment > 5) {
        sentiment -= sentiment % 5;
    }

    const reaction = sentiment < 0 ? negativeReactions[-sentiment - 1] : positiveReactions[sentiment];

    logger.info(`reacting with: ${reaction}`);
    message.reply(`sentiment: ${sentiment}, reaction: ${bot.getServer().emojis.find('name', reaction)}`);
}

function replaceEmojisWithNames(text) {
    return tokenize(text).map((token) => emojiToName[token] || token);
}