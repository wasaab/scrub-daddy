
var Discord = require('discord.js');
var inspect = require('util-inspect');
var moment = require('moment');

var logger = require('../logger.js').botLogger;
var bot = require('../bot.js');
var c = require('../const.js');

const { getNick, getAvatar, exportJson, capitalizeFirstLetter,
	lock, isLocked, unLock, getIdFromMention, buildField } = require('./baseUtil.js');

var userIDToColor = require('../../resources/data/colors.json');
var quotes = require('../../resources/data/quotes.json');

var quotingUserIDToQuotes = {};
var quoteTipMsg = {};

/**
 * Gets an author object for the provided userID.
 *
 * @param {String} userID - id of the user to get author object for
 */
function getAuthor(userID) {
	if (!userID) { return; }

	return {
		name: getNick(userID),
		icon_url: getAvatar(userID)
	};
}

/**
 * Gets the preferred color of the provided user.
 *
 * @param {String} userID - userid to get color preference of
 */
function getUserColor(userID) {
	return userIDToColor[userID] || 0xffff00;
}

/**
 * Send a message with fields to bot-spam.
 *
 * @param {String} title - the message title
 * @param {String[]} fields - fields of the message
 * @param {String} userID - id of sending user
 * @param {Object} footer - the footer for the message
 */
function sendEmbedFieldsMessage(title, fields, userID, footer, channelID) {
	if (fields.length === 1 && fields[0].name === '') {
		return;
	}

	const channel = channelID ? bot.getClient().channels.find('id', channelID) : bot.getBotSpam();
	return channel.send(new Discord.RichEmbed({
		color: getUserColor(userID),
		title: title,
		fields: fields,
		footer: footer
	}));
}

function sendAuthoredMessage(description, userID, channelID) {
	var message = {
		color: getUserColor(userID),
		description: description,
		author: getAuthor(userID)
	};

	return sendMessageToChannel(message, channelID);
}

/**
 * Sends an embed message to bot-spam with an optional title, description, image, thumbnail(true/false), and footer.
 */
function sendEmbedMessage(title, description, userID, image, thumbnail, footer, channelID, file, url, timestamp) {
	//these are all optional parameters
	title = title || '';
	description = description || '';
	image = image || '';
	file = file || '';

	const picType = thumbnail ? 'thumbnail' : 'image';
	var message = {
		color: getUserColor(userID),
		title: title,
		description: description,
		footer: footer,
		file: file,
		url: url,
		timestamp: timestamp
	};

	if (image) {
		message[picType] = { url: image };
	}

	return sendMessageToChannel(message, channelID);
}

function sendMessageToChannel(message, channelID) {
	const channel = channelID ? bot.getClient().channels.find('id', channelID) : bot.getBotSpam();

	return channel.send(new Discord.RichEmbed(message))
		.then((msgSent) => msgSent)
		.catch(log);
}

/**
 * Outputs the reaction timed out message.
 *
 * @param {String} userID - id of the user
 * @param {String} selectionType - type of selection that timed out
 */
function reactionTimedOut(userID, selectionType) {
	logger.info((`After 40 seconds, there were no reactions.`));
	sendEmbedMessage(`${capitalizeFirstLetter(selectionType)} Reponse Timed Out`,
		`${getNick(userID)}, you have not made a ${selectionType} selection, via reaction, so I'm not listening to you anymore 😛`, userID);
}

/**
 * Waits for a reaction on the provided message and changes the message
 * when a reaction is found.
 *
 * @param {Object} msgSent - the help message
 * @param {String} userID - id of the user requesting help
 * @param {*[]} results - results that can be displayed
 * @param {Object=} homeResult - the result for home selection
 */
function awaitAndHandleReaction(msgSent, userID, results, selectionType, homeResult) {
	const homeReaction = homeResult ? '🏠' : 'no home';
    const reactionFilter = (reaction, user) => (c.REACTION_NUMBERS.includes(reaction.emoji.name) || reaction.emoji.name === homeReaction) && user.id === userID;
    msgSent.awaitReactions(reactionFilter, { time: 40000, max: 1 })
    .then((collected) => {
		if (collected.size === 0) {
			reactionTimedOut(userID, selectionType);
		} else {
			maybeUpdateDynamicMessage(collected, msgSent, userID, results, selectionType, homeResult);
		}
	})
	.catch(() => {
		reactionTimedOut(userID, selectionType);
	});
}

/**
 * Updates the message to have the content associated with the selected reaction.
 *
 * @param {Object[]} selectedReactions - reaction selected in an array
 * @param {Object} msg - the help message
 * @param {String} userID - id of the user requesting help
 * @param {*[]} results - results that can be displayed
 * @param {Object=} homeResult - the result for home selection
 */
function maybeUpdateDynamicMessage(selectedReactions, msg, userID, results, selectionType, homeResult) {
	if (selectedReactions.size === 0) { return; }

	const numberSelected = c.REACTION_NUMBERS.indexOf(selectedReactions.first().emoji.name);
	const correction = results.length > 9 ? 0 : 1;
	const selection = numberSelected === -1 ? homeResult : results[numberSelected - correction];

	const newMsg = new Discord.RichEmbed({
		color: getUserColor(userID),
		title: selection.name
	});
	const contentType = selection.fields ? 'fields' : 'description';
	newMsg[contentType] = selection[contentType];
	const footer = msg.embeds[0].footer;
	if (footer) {
		newMsg.footer = {
			icon_url: footer.iconURL,
			text: footer.text
		};
	}

	msg.edit('', newMsg)
	.then((updatedMsg) => {
		awaitAndHandleReaction(updatedMsg, userID, results, selectionType, homeResult);
	});
}

/**
 * Adds the initial number selection reactions to the message.
 *
 * @param {Object} msg - the help message
 * @param {Number} number - the number reaction being added
 * @param {Number} max - the last number reaction to add
 */
function addInitialNumberReactions(msg, number, max) {
	setTimeout(() => {
		msg.react(c.REACTION_NUMBERS[number]);
		if (number < max) {
			addInitialNumberReactions(msg, number + 1, max);
		}
	}, 350);
}

/**
 * Sends a dynamic message, which changes content to the result matching the
 * reaction clicked.
 *
 * @param {String} userID - id of the user that can react to the msg
 * @param {String} selectionType - what is being selected
 * @param {Object[]} results - results to select from
 * @param {Object=} homePage - first page to show
 */
function sendDynamicMessage(userID, selectionType, results, homePage) {
    const footer = {
		icon_url: c.INFO_IMG,
		text: `Click a reaction below to select a ${selectionType}.`
	};
	var msg;
	const isFieldsEmbed = results[0].fields;
	const contentType = isFieldsEmbed ? 'fields' : 'description';
	const title = homePage ? homePage.name : results[0].name;
	const content = homePage ? homePage[contentType] : results[0][contentType];
	if (isFieldsEmbed) {
		msg = sendEmbedFieldsMessage(title, content, userID, footer);
	} else {
		msg = sendEmbedMessage(title, content, userID, null, null, footer);
	}

    msg.then((msgSent) => {
		if (homePage) {
			msgSent.react('🏠');
		}
		const firstReactionNum = results.length > 9 ? 0 : 1;
		const lastReactionNum = results.length > 9 ? results.length - 1 : results.length;
		addInitialNumberReactions(msgSent, firstReactionNum, lastReactionNum);
		awaitAndHandleReaction(msgSent, userID, results, selectionType, homePage);
	});
}

/**
 * Exports the quotes to json.
 */
function exportQuotes() {
	exportJson(quotes, 'quotes');
}

/**
 * Deletes the quote tip message.
 */
function deleteQuoteTipMsg() {
	quoteTipMsg.delete();
}

/**
 * Quotes a user.
 *
 * @param {Object} ogMessage - original message being quoted
 * @param {String} quotedUserID - id of user being quoted
 * @param {String} quotingUserID - id of user creating quote
 * @param {String} channelID - id of the channel quote was found in
 */
function quoteUser(ogMessage, quotedUserID, quotingUserID, channelID) {
	if (isLocked()) { return; }

	lock();
	setTimeout(() => {
		deleteQuoteTipMsg();
		unLock('quoteUser');
		exportQuotes();
	}, 15500);

	const numMessagesToCheck = quotedUserID ? 50 : 20;
	const channel = bot.getClient().channels.find('id', channelID);
	const quoteableMessages = channel.messages.last(numMessagesToCheck);
	ogMessage.channel.send('**Add Reaction(s) to The Desired Messages**\n' +
	'Use :quoteReply: to include their quote at the top of your next message.\n' +
	'Use :quoteSave: to save the quote to the quote list for that user.')
	.then((msgSent) => {
		quoteTipMsg = msgSent;
	});

	if (quotedUserID) {
		quotedUserID = getIdFromMention(quotedUserID);
		if (!getNick(quotedUserID)) { return; }
		quoteableMessages.filter((message) => {
			return message.member.id === quotedUserID;
		}).reverse().slice(0, 15);
	}

	const filter = (reaction, user) => (reaction.emoji.name === 'quoteReply' || reaction.emoji.name === 'quoteSave')
		&& user.id === quotingUserID;
	quoteableMessages.forEach((message) => {
		message.awaitReactions(filter, { time: 15000, max: 2})
		.then((collected) => {
			logger.info(`Collected ${collected.size} reactions: ${inspect(collected)}`);
			var replyQuotes = quotingUserIDToQuotes[quotingUserID] || [];
			collected.forEach((reaction) => {
				const quote = {
					quotedUserID: message.member.id,
					message: message.content,
					time: message.createdTimestamp
				};
				if (reaction.emoji.name === 'quoteReply') {
					replyQuotes.push(quote);
					quotingUserIDToQuotes[quotingUserID] = replyQuotes;
				} else {
					quotes.push(quote);
				}
			});
		})
		.catch((err) => {
			logger.error(`Add Role Error: ${err}`);
		});
	});
}

function maybeReplicateLol(message) {
	if (!(/^l(ol)+$/i).test(message.content) || message.channel.id === c.LOL_CHANNEL_ID) { return; }

	sendAuthoredMessage(message.content, message.author.id, c.LOL_CHANNEL_ID);
}

/**
 * Outputs quotes.
 *
 * @param {String} quoteTarget - person to get quotes by
 * @param {String} userID - id of user requesting quotes
 */
function getQuotes(quoteTarget, userID) {
	var targetName = 'Everyone';
	var targetQuotes = quotes;
	var fields = [];
	if (quoteTarget) {
		const targetID = getIdFromMention(quoteTarget);
		targetName = getNick(targetID);
		targetQuotes = quotes.filter((quote) => { return quote.quotedUserID === targetID; });
		targetQuotes.forEach((quote) => {
			fields.push(buildField(moment(quote.time).format(c.SHORT_DATE_FORMAT), quote.message, 'false'));
		});
	} else {
		targetQuotes.forEach((quote) => {
			fields.push(buildField(getNick(quote.quotedUserID), `${quote.message}\n	— ${moment(quote.time).format(c.SHORT_DATE_FORMAT)}`, 'false'));
		});
	}
	if (fields.length > 0) {
		sendEmbedFieldsMessage(`Quotes From ${targetName}`, fields, userID);
	} else {
		sendEmbedMessage('404 Quotes Not Found', `I guess ${targetName} isn't very quoteworthy.`, userID);
	}
}

/**
 * Inserts quotes into the provided message if the user has recently called quoteReply.
 *
 * @param {Object} message - the message to add the quote to
 */
function maybeInsertQuotes(message) {
	const block = '```';
	const replyQuotes = quotingUserIDToQuotes[message.author.id];
	if (!replyQuotes) { return; }
	var quoteBlocks = '';
	replyQuotes.forEach((quote) => {
		const author = getNick(quote.quotedUserID);
		const time = moment(quote.time).format(c.SHORT_DATE_FORMAT);
		const userMentions = quote.message.match(/<@![0-9]*>/g);
		if (userMentions) {
			userMentions.forEach((mention) => {
				quote.message = quote.message.replace(mention, getNick(getIdFromMention(mention)));
			});
		}
		const roleMentions = quote.message.match(/<@&[0-9]*>/g);
		if (roleMentions) {
			roleMentions.forEach((mention) => {
				const role = message.guild.roles.find('id', getIdFromMention(mention)).name;
				quote.message = quote.message.replace(mention, role);
			});
		}
		quoteBlocks += `${block} ${quote.message}\n	— ${author}, ${time}${block}\n`;
	});
	message.delete();
	message.channel.send(`${quoteBlocks}**${getNick(message.member.id)}** : ${message.content}`);
	quotingUserIDToQuotes[message.author.id] = null;
}

/**
 * Deletes a message.
 *
 * @param {Object} message - the message to delete
 */
function deleteMessage(message) {
	logger.info(`Deleting message with content: "${message.content}"`);
	message.delete();
}

/**
 * Checks if the message has the delete reactions.
 *
 * @param {Object} message - the message to check
 */
function hasDeleteReactions(message) {
	return message.reactions.has(c.TRASH_REACTION) && message.reactions.has('⚫');
}

/**
 * Deletes messages if the delete reactions are found.
 *
 * @param {Object} message - the message that triggered the command
 */
function deleteMessages(message) {
	message.channel.fetchMessages({limit: 50})
	.then((foundMessages) => {
		message.delete();
		var deleteReactionsFound = false;
		foundMessages.array().some((message) => {
			if (deleteReactionsFound) {
				deleteMessage(message);
				if (hasDeleteReactions(message)) { return true; }
			} else if (hasDeleteReactions(message)) {
				deleteReactionsFound = true;
				deleteMessage(message);
			}
		});
	});
}

/**
 * Logs the response of an API request for Add Role or Move User.
 *
 * @param {String} error - error returned from API request
 * @param {Object} response - response returned from API request
 */
function log(error, response) {
	if (error) {
		logger.error(`API ERROR: ${error}`);
	} else if (response) {
		logger.info(`API RESPONSE: ${inspect(response)}`);
	}
}

exports.addInitialNumberReactions = addInitialNumberReactions;
exports.awaitAndHandleReaction = awaitAndHandleReaction;
exports.deleteMessages = deleteMessages;
exports.deleteQuoteTipMsg = deleteQuoteTipMsg;
exports.exportQuotes = exportQuotes;
exports.getUserIDToColor = () => userIDToColor;
exports.getQuotes = getQuotes;
exports.log = log;
exports.maybeInsertQuotes = maybeInsertQuotes;
exports.maybeReplicateLol = maybeReplicateLol;
exports.maybeUpdateDynamicMessage = maybeUpdateDynamicMessage;
exports.quoteUser = quoteUser;
exports.sendAuthoredMessage = sendAuthoredMessage;
exports.sendDynamicMessage = sendDynamicMessage;
exports.sendEmbedFieldsMessage = sendEmbedFieldsMessage;
exports.sendEmbedMessage = sendEmbedMessage;