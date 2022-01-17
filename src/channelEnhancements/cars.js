const rp = require('request-promise');
const moment = require('moment');
const c = require('../const.js');
const util = require('../utilities/utilities.js');
const cmdHandler = require('../handlers/cmdHandler.js');
const mergeImg = require('merge-img');
const Jimp = require('jimp');
const { jsdom } = require('jsdom');
const { logger } = require('../logger.js');
const forumData = require('../../resources/data/carForum.json');
const updatedForumIdToLastCrawlTime = {};
const dateFormat = 'MM-DD-YYYY';
const baseUrl = 'https://www.2addicts.com';
const baseForumPath = `${baseUrl}/forums/forumdisplay.php?f=`;
const forumIdToName = {
    '551': 'Engine / Drivetrain / Exhaust / Bolt-ons',
    '547': 'Wheels and Tires Items',
    '549': 'Exterior Parts',
    '550': 'Interior Parts',
    '548': 'Suspension / Brakes / Chassis / Spacers'
};
var channel;

/**
 * Notifies the user via DM of a part for sale matching one of their keywords.
 *
 * @param {String} userID - id of the user to notify
 * @param {String[]} keywords - keywords that were specified by user
 * @param {String} match - the words that matched the keywords
 * @param {String} url - url of matching classified listing
 */
function notify(userID, keywords, match, url) { //eslint-disable-line
    util.getMembers()
        .find('id', userID)
        .createDM()
        .then((dm) => {
            dm.send('I heard you might be looking for this: ' +
                `${url}\nKeywords: ${keywords}, match: ${match}`);
        });
}

/**
 * Ignores a post if it has a trash reaction.
 *
 * @param {Object} message - the message to potentially ignore
 */
function maybeIgnorePost(message) {
    if (!message.reactions.has(c.TRASH_REACTION)) { return; }

    const post = message.embeds[0];

    forumData.ignoredPosts.push(post.url.split('/')[4]);
    util.sendEmbed({
        title: 'Post Ignored',
        description: `You will no longer see updates for the following post:\n${post.title}`,
        userID: message.member.id,
        channelID: channel.id,
        url: post.url
    });
    message.delete();
    util.exportJson(forumData, 'carForum');
}

/**
 * Ignores all posts that have trash reactions.
 * 
 * @package {Object} message - the message calling the command
 */
async function ignorePosts(message) {
    if (message.channel.id !== c.CAR_PARTS_CHANNEL_ID) { return; }

	const recentMessages = await channel.fetchMessages({ limit: 50 });

    recentMessages.array().forEach(maybeIgnorePost);
}

/**
 * Outputs the forum header.
 *
 * @param {String} forumID - id of the forum the post is in
 * @param {Object} postMoment - the moment object representing post time
 */
function outputForumHeader(forumID, postMoment) {
    updatedForumIdToLastCrawlTime[forumID] = postMoment.valueOf();
    channel.send(`**${forumIdToName[forumID]}**\n\`\`\`${'-'.repeat(61)}\`\`\``);
}

/**
 * Determines tags to react to the post with, representing the contents.
 *
 * @param {String} postText - text of the post to determine tags of
 */
function determineTags(postText) {
    var tags = [];

    for (var tag in c.TAG_TO_TEXT) {
        if (new RegExp(c.TAG_TO_TEXT[tag].join('|'), 'gi').test(postText)) {
            tags.push(tag);
        }
    }

    return tags;
}

/**
 * Outputs the post.
 *
 * @param {String} title - the title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Object} postMoment - the moment object representing post time
 * @param {boolean} textOnly - true iff the post has no attachments
 */
async function outputPost(title, postDoc, postMoment, textOnly) {
    const formattedTitle = title.text;
    const priceEle = postDoc.querySelector('div.bpitemprice');
    const descriptionEle = postDoc.querySelector('.bpclassmain') || postDoc.querySelector('.thePostItself');
    const description = descriptionEle.textContent.slice(0, 2047);
    const tags = determineTags(`${formattedTitle} ${description}`);
    const attachPath = textOnly ? null : 'attachment://postCollage.png';
    const imgPath = textOnly ? null : './resources/images/postCollage.png';
    var price = priceEle ? priceEle.getAttribute('raw') : 'N/A';

    price = '-2' === price ? 'SOLD' : `$${price}`;

    const msgSent = await util.sendEmbed({
        title:`\n\`${price}\`    **${formattedTitle}**`,
        description: description,
        image: attachPath,
        channelID: channel.id,
        file: imgPath,
        url: `${baseUrl}/forums/${title.getAttribute('href')}`,
        timestamp: postMoment.toDate()
    });
    
    tags.forEach(msgSent.react);
}

/**
 * Merges all images in the post into a collage, then outputs the post.
 *
 * @param {Promise[]} imgResponses - image buffers
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Object} postMoment - the moment object representing post time
 */
async function mergeAndOutput(imgResponses, title, postDoc, postMoment) {
    var images = [];

    imgResponses.forEach((imgResponse) => {
        if (!imgResponse.success) { return; }

        images.push(imgResponse.result);
    });

    if (!images) { return outputPost(title, postDoc, postMoment, true); }

    try {
        const { bitmap } = await mergeImg(images, { direction: false });
        
        await new Jimp(bitmap).writeAsync('./resources/images/postCollage.png');
        outputPost(title, postDoc, postMoment);
    } catch (err) {
        logger.error('Unable to merge images: ', err);
    }
}


/**
 * Scales the image, so it can fit in the collage.
 *
 * @param {Object} response - reponse from image download request
 * @param {Promise[]} imgPromises - image buffers
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Object} postMoment - the moment object representing post time
 */
async function scaleImage(response, imgPromises, imageUrls, title, postDoc, postMoment) {
    const resizedImg = response.result
        .scaleToFit(500, Jimp.AUTO, null)
        .getBufferAsync(Jimp.MIME_JPEG);
    
    imgPromises.push(resizedImg);

    if (imgPromises.length !== imageUrls.length) { return; }

    const responses = await util.handleAllPromises(imgPromises);

    mergeAndOutput(responses, title, postDoc, postMoment);
}

/**
 * Scales all images in the post, so they can fit in the collage.
 *
 * @param {Object[]} responses - reponses from image download requests
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Object} postMoment - the moment object representing post time
 */
function scaleImages(responses, imageUrls, title, postDoc, postMoment) {
    var imgPromises = [];

    responses.forEach((response) => {
        if (!response.success) { return; }

        scaleImage(response, imgPromises, imageUrls, title, postDoc, postMoment);
    });
}

/**
 * Downloads all of the images in the post.
 *
 * @param {String[]} imageUrls - urls of all images in the post
 * @returns {Promise} the image buffers
 */
function downloadImages(imageUrls) {
	return util.handleAllPromises(imageUrls.map(Jimp.read));
}

/**
 * Builds a post as a discord message.
 *
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {Object} postMoment - the moment object representing post time
 */
async function buildPost(title, postDoc, imageUrls, postMoment) {
    if (imageUrls.length === 0) {
        return outputPost(title, postDoc, postMoment, true);
    }

    const responses = await downloadImages(imageUrls);

    scaleImages(responses, imageUrls, title, postDoc, postMoment);
}

/**
 * Gets the urls of every image in the post, attached or linked.
 *
 * @param {Object} postDoc - the document of the post
 */
function getImageUrls(postDoc) {
    const attachedImages = [...postDoc.querySelectorAll('img.attach')]
        .map((img) => `${baseUrl}/forums/${img.getAttribute('src')}`);
    const hostedImages = [...postDoc.querySelectorAll('.bpclassmain img')]
        .map((img) => img.getAttribute('src'));

    return attachedImages.concat(hostedImages);
}

/**
 * Determines the moment the post was last updated.
 *
 * @param {Object} time - post updated time element from the page
 */
function determinePostMoment(time) {
    var date = time.previousSibling.wholeText.trim();

    if ('Yesterday' === date) {
        date = moment().subtract(1, 'days')
            .format(dateFormat);
    } else if ('Today' === date) {
        date = moment().format(dateFormat);
    }

    return moment(`${date} ${time.textContent}`, `${dateFormat} hh:mm A`);
}

/**
 * Builds discord posts from the car forum posts.
 *
 * @param {String[]} titles - titles of posts in the forum
 * @param {Object[]} times - post updated time elements from the page
 * @param {Number} postIdx - the index of the current post
 * @param {String} forumID - the id of the forum the post was made in
 */
function buildPosts(titles, times, postIdx, forumID) {
    if (titles.length < 1) { return; }

    const title = titles.pop();
    const time = times.pop();
    var isFinished = false;

    return rp(`${baseUrl}/forums/${title.getAttribute('href')}`)
        .then((postHtml) => {
            const postDoc = jsdom(postHtml, { url: baseUrl });

            if (!postDoc || postIdx > 14) { return; }

            const postMoment = determinePostMoment(time);

            if (postMoment.isSameOrBefore(moment(forumData.forumIdToLastCrawlTime[forumID]))) {
                isFinished = true;
                return;
            }

            if (postIdx === 0) {
                outputForumHeader(postIdx, forumID, postMoment);
            }

            buildPost(title, postDoc, getImageUrls(postDoc), postMoment);
        })
        .catch(util.log)
        .finally(() => {
            if (isFinished) { return; }

            return buildPosts(titles, times, postIdx + 1, forumID);
        });
}

/**
 * Converts the target node list to an array.
 *
 * @param {Object} document - the document of the page being scraped
 * @param {String} selector - selector to find element with
 */
function getNodeListAsReversedArray(document, selector) {
    return [...document.querySelectorAll(selector)].reverse();
}

/**
 * Scrapes titles and post updated timestamps from the page.
 *
 * @param {Object} document - the document of the page being scraped
 * @param {String} forumID - the id of the forum to scrape posts in
 */
function scrapeTitlesAndTimestamps(document, forumID) {
    const lastPostTimes = getNodeListAsReversedArray(document, `#threadbits_forum_${forumID} .time`);
    const titles = getNodeListAsReversedArray(document, `#threadbits_forum_${forumID} a[id^='thread_title']`)
        .filter((title, i) => {
            if (forumData.ignoredPosts.includes(title.getAttribute('href'))) {
                lastPostTimes.splice(i, 1);
                return false;
            }

            return true;
        });

    return { titles, lastPostTimes };
}

/**
 * Scrapes posts in the specified forum.
 *
 * @param {String} forumID - Id of the forum to scrape posts in
 */
function scrapePostsInForum(forumID) {
    return rp(`${baseForumPath}${forumID}`)
        .then((html) => {
            const document = jsdom(html, { url: 'https://www.2addicts.com' });
            const { titles, lastPostTimes } = scrapeTitlesAndTimestamps(document, forumID);

            return buildPosts(titles, lastPostTimes, 0, forumID);
        })
        .catch(util.log);
}

/**
 * Scrapes posts in the specified forums.
 *
 * @param {String[]} forumIds - Ids of the forums to scrape posts in
 */
async function scrapePostsInForums(forumIds) {
    const forumID = forumIds.pop();

    await scrapePostsInForum(forumID);

    if (forumIds.length !== 0) { return scrapePostsInForums(forumIds); }

    setTimeout(() => {
        forumData.forumIdToLastCrawlTime = { ...forumData.forumIdToLastCrawlTime, updatedForumIdToLastCrawlTime };
        util.exportJson(forumData, 'carForum');
    }, 3000);
}

/**
 * Crawls the car forum looking for posts of interest.
 * 
 * @package {Object=} message - the message calling the command
 */
exports.crawlCarForum = (message) => {
    if (message && !util.isAdmin(message.member?.id)) { return; }

    channel.send(`**${moment().format('ddd MMM Do   hh:mm A')}** \`\`\` \`\`\``);
    scrapePostsInForums(Object.keys(forumIdToName));
};

/**
 * Sets the car parts channel.
 *
 * @param {Object} carPartsChannel - channel where car parts are posted
 */
exports.setCarPartsChannel = (carPartsChannel) => {
    channel = carPartsChannel;
};

exports.registerCommandHandlers = () => {
    cmdHandler.registerCommandHandler('cars', exports.crawlCarForum);
    cmdHandler.registerCommandHandler('ignore-posts', ignorePosts);
};