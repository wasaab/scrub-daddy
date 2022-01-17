
var Discord = require('discord.js');
var inspect = require('util-inspect');
var moment = require('moment');

const cmdHandler = require('../handlers/cmdHandler.js');
const { logger } = require('../logger.js');
var bot = require('../bot.js');
var c = require('../const.js');

const { getNick, getMembers, getAvatar, exportJson, capitalizeFirstLetter,
	lock, isLocked, isMention, unLock, getIdFromMention, buildField } = require('./baseUtil.js');

var userIDToColor = require('../../resources/data/colors.json');
var quotes = require('../../resources/data/quotes.json');

var quotingUserIDToQuotes = {};
var quoteTipMsg = {};

/**
 * Gets an author object for the provided userID.
 *
 * @param {String} userID - id of the user to get author object for
 * @param {boolean} isWebhook - whether or not author will be used in a webhook msg
 */
function getAuthor(userID, isWebhook) {
	if (!userID) { return; }

	const nameProp = isWebhook ? 'username' : 'name';
	const avatarProp = isWebhook ? 'avatarURL' : 'icon_url';
	var author = {};

	author[nameProp] = getNick(userID);
	author[avatarProp] = getAvatar(userID);

	return author;
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
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendEmbedFieldsMessage(title, fields, userID, footer, channelID) {
	if (fields.length === 1 && fields[0].name === '') { return; }

	const message = {
		color: getUserColor(userID),
		title: title,
		fields: fields,
		footer: footer
	};

	return sendMessageToChannel(message, channelID);
}

/**
 * Sends a message with the provided user as the author via a webhook.
 *
 * @param {String} description description of the message
 * @param {String} userID id of authoring user
 * @param {String} channelID id of channel to send the message to
 * @param {Object} file file to attach to the message
 * @returns {Promise<Message|Error>} a promise of the message that was sent
 */
async function sendAuthoredMessage(description, userID, channelID, file) {
	const channel = bot.getServer().channels.find('id', channelID);
	const author = getAuthor(userID, true);

	if (!channel || !author) { return; }

	if (author.username.length === 1) {
		author.username = `.${author.username}`;
	}

	let webhook;

	try {
		webhook = await channel.createWebhook('AuthoredMsg', author.avatarURL);

		const msgOptions = {
			...author,
			file
		};

		await webhook.send(description, msgOptions);

		return webhook.delete().catch(log);
	} catch (err) {
		logger.error(`Unable to send authored msg: ${err}`);

		if (webhook) {
			webhook.delete().catch(log);
		}

		return err;
	}
}

/**
 * Sends an embed message with the provided user as the author.
 *
 * @param {String} description description of the message
 * @param {String} userID id of authoring user
 * @param {String} channelID id of channel to send the message to
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendAuthoredEmbed(description, userID, channelID) {
	const message = {
		color: getUserColor(userID),
		description: description,
		author: getAuthor(userID)
	};

	return sendMessageToChannel(message, channelID);
}

/**
 * Sends an embed message to the channel specified.
 *
 * @param {String=} title title of the message
 * @param {String=} description description of the message
 * @param {String} channelID id of the channel to send the message to
 * @param {String} userID id of the user message is for
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendEmbedMessageToChannel(title = '', description = '', channelID, userID) {
	return sendEmbed({ title, description, channelID, userID });
}

/**
 * Sends an embed message to the channel specified or default channel.
 *
 * @param {Object} options the embed message options
 * @param {String=} options.title title of the message
 * @param {String=} options.description description of the message
 * @param {String} options.userID id of the user message is for
 * @param {String=} options.image url of the image to embed in the message
 * @param {Boolean} options.isThumbnail whether or no the image should be thumbnail size
 * @param {String} options.footer footer of the message
 * @param {String} options.channelID id of the channel to send the message to
 * @param {Object} options.file file stream to attach to the message
 * @param {String} options.url url of the message
 * @param {String} options.timestamp timestamp to include in the footer
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendEmbed({ title, description, userID, image, isThumbnail, footer, channelID, file, url, timestamp }) {
	return sendEmbedMessage(title, description, userID, image, isThumbnail, footer, channelID, file, url, timestamp);
}

/**
 * Sends an embed message to the channel specified or default channel.
 *
 * @param {String=} title title of the message
 * @param {String=} description description of the message
 * @param {String} userID id of the user message is for
 * @param {String=} image url of the image to embed in the message
 * @param {Boolean} isThumbnail whether or no the image should be thumbnail size
 * @param {String} footer footer of the message
 * @param {String} channelID id of the channel to send the message to
 * @param {Object} file file stream to attach to the message
 * @param {String} url url of the message
 * @param {String} timestamp timestamp to include in the footer
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendEmbedMessage(title = '', description = '', userID, image = '', isThumbnail, footer, channelID, file = '', url, timestamp) {
	const picType = isThumbnail ? 'thumbnail' : 'image';
	const message = {
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

/**
 * Sends the provided message to the specified channel.
 *
 * @param {Object} message the message to send
 * @param {String} channelID id of the channel to send message to
 * @returns {Promise<Message>} a promise of the message that was sent
 */
function sendMessageToChannel(message, channelID) {
	const channel = channelID ? bot.getServer().channels.find('id', channelID) : bot.getBotSpam();

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
function sendReactionTimedOutMsg(userID, selectionType) {
	logger.info(`After 40 seconds, there were no reactions.`);
	sendEmbedMessage(
		`${capitalizeFirstLetter(selectionType)} Reponse Timed Out`,
		`${getNick(userID)}, you have not made a ${selectionType} selection, via reaction, so I'm not listening to you anymore 😛`,
		userID
	);
}

/**
 * Checks if the reaction is valid for selecting pages in a paginated embed.
 *
 * @param {Object} reaction reaction to validate
 * @param {Object} homeReaction home page reaction
 * @returns {Boolean} true iff the reaction is valid for page selection
 */
function isValidPageSelectionReaction(reaction, homeReaction) {
	return c.REACTION_NUMBERS.includes(reaction.emoji.name) || reaction.emoji.name === homeReaction;
}

/**
 * Builds a reaction filter for dynamic message page selections.
 *
 * @param {Object} homeResult the result for home selection
 * @param {String} userID id of the target user
 * @returns {function: Boolean} the reaction filter
 */
function buildReactionFilter(homeResult, userID) {
	const homeReaction = homeResult ? '🏠' : 'no home';

	return (reaction, user) => user.id === userID && isValidPageSelectionReaction(reaction, homeReaction);
}

/**
 * Waits for a reaction on the provided message and changes the message
 * when a reaction is found.
 *
 * @param {Object} msgSent - the help message
 * @param {String} userID - id of the target user
 * @param {*[]} results - results that can be displayed
 * @param {Object=} homeResult - the result for home selection
 */
function awaitAndHandleReaction(msgSent, userID, results, selectionType, homeResult) {
	msgSent.awaitReactions(buildReactionFilter(homeResult, userID), { time: 40000, max: 1 })
		.then((collected) => {
			if (collected.size === 0) {
				sendReactionTimedOutMsg(userID, selectionType);
			} else {
				maybeUpdateDynamicMessage(collected, msgSent, userID, results, selectionType, homeResult);
			}
		})
		.catch(() => {
			sendReactionTimedOutMsg(userID, selectionType);
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

	const reaction = selectedReactions.first();
	const numberSelected = c.REACTION_NUMBERS.indexOf(reaction.emoji.name);
	const correction = results.length > 9 ? 0 : 1;
	const selection = numberSelected === -1 ? homeResult : results[numberSelected - correction];

	const newMsg = new Discord.RichEmbed({
		color: getUserColor(userID),
		title: selection.name
	});
	const contentType = selection.fields ? 'fields' : 'description';
	const { footer } = msg.embeds[0];

	newMsg[contentType] = selection[contentType];

	if (footer) {
		newMsg.footer = {
			icon_url: footer.iconURL, //eslint-disable-line
			text: footer.text
		};
	}

	const user = getMembers().find('id', userID);

	reaction.remove(user).catch(log);
	msg.edit('', newMsg)
		.then((updatedMsg) => {
			awaitAndHandleReaction(updatedMsg, userID, results, selectionType, homeResult);
		})
		.catch(log);
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
		icon_url: c.INFO_IMG, //eslint-disable-line
		text: `Click a reaction below to select a ${selectionType}.`
	};
	const isFieldsEmbed = results[0].fields;
	const contentType = isFieldsEmbed ? 'fields' : 'description';
	const title = homePage ? homePage.name : results[0].name;
	const content = homePage ? homePage[contentType] : results[0][contentType];
	var msg;

	if (isFieldsEmbed) {
		msg = sendEmbedFieldsMessage(title, content, userID, footer);
	} else {
		msg = sendEmbed({ title, description: content, userID, footer });
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

function finalizeQuoteAfterTimeout() {
	setTimeout(() => {
		deleteQuoteTipMsg();
		unLock('quoteUser');
		exportQuotes();
	}, 15500);
}

function hasQuoteReaction(quotingUserID) {
	return (reaction, user) => (reaction.emoji.name === 'quoteReply' || reaction.emoji.name === 'quoteSave')
		&& user.id === quotingUserID;
}

function outputQuoteTip(cmdMessage) {
	cmdMessage.channel.send('**Add Reaction(s) to The Desired Messages**\n' +
		'Use <:quoteReply:425051478986719233> to include their quote at the top of your next message.\n' +
		'Use <:quoteSave:425051557952749569> to save the quote to the quote list for that user.')
		.then((msgSent) => {
			quoteTipMsg = msgSent;
		});
}

/**
 * Quotes a user.
 *
 * @param {Object} cmdMessage	message that called quote command
 * @param {String[]} args	the arguments passed by the user
 */
function quoteUser(cmdMessage, args) {
	var quotedUserID = args[1];

	if (quotedUserID && !isMention(quotedUserID)) { return; }

	const quotingUserID = cmdMessage.member.id;

	if (isLocked()) { return; }

	lock();
	finalizeQuoteAfterTimeout();
	outputQuoteTip(cmdMessage);

	const { channel } = cmdMessage;
	var quoteableMessages = channel.messages.last(50);

	if (quotedUserID) {
		quotedUserID = getIdFromMention(quotedUserID);

		if (!getNick(quotedUserID)) { return; }

		quoteableMessages = quoteableMessages.filter((message) => message.member.id === quotedUserID)
			.reverse()
			.slice(0, 20);
	}

	awaitQuoteReactions(quoteableMessages, quotingUserID);
}

function awaitQuoteReactions(quoteableMessages, quotingUserID) {
	const filter = hasQuoteReaction(quotingUserID);

	quoteableMessages.forEach((message) => {
		message.awaitReactions(filter, { time: 15000, max: 2 })
			.then((collected) => {
				saveQuote(collected, quotingUserID, message);
			})
			.catch((err) => {
				logger.error(`Add Quote Error: ${err}`);
			});
	});
}

function saveQuote(collected, quotingUserID, message) {
	var replyQuotes = quotingUserIDToQuotes[quotingUserID] || [];
	const quote = {
		quotedUserID: message.member.id,
		message: message.content,
		time: message.createdTimestamp
	};

	logger.info(`Collected ${collected.size} reactions: ${inspect(collected)}`);

	collected.forEach((reaction) => {
		if (reaction.emoji.name === 'quoteReply') {
			replyQuotes.push(quote);
			quotingUserIDToQuotes[quotingUserID] = replyQuotes;
		} else {
			quotes.push(quote);
		}
	});
}

/**
 * Outputs quotes.
 *
 * @param {Object} message	message that called get quotes command
 * @param {String[]} args	the arguments passed by the user
 */
function getQuotes(message, args) {
	const quoteTarget = args[1];
	var targetName = 'Everyone';
	var targetQuotes = quotes;
	var fields = [];

	if (isMention(quoteTarget)) {
		const targetID = getIdFromMention(quoteTarget);

		targetName = getNick(targetID);
		targetQuotes = quotes.filter((quote) => quote.quotedUserID === targetID);
		targetQuotes.forEach((quote) => {
			fields.push(buildField(
				moment(quote.time).format(c.SHORT_DATE_FORMAT),
				quote.message,
				'false'
			));
		});
	} else {
		targetQuotes.forEach((quote) => {
			fields.push(buildField(
				getNick(quote.quotedUserID),
				`${quote.message}\n	— ${moment(quote.time).format(c.SHORT_DATE_FORMAT)}`,
				'false'
			));
		});
	}

	const userID = message.member.id;

	if (fields.length > 0) {
		sendEmbedFieldsMessage(`Quotes From ${targetName}`, fields, userID);
	} else {
		sendEmbedMessage('404 Quotes Not Found', `I guess ${targetName} isn't very quoteworthy.`, userID);
	}
}

function replaceRoleMentionsWithNames(quote) {
	const roleMentions = quote.message.match(/<@&[0-9]*>/g);

	if (!roleMentions) { return; }

	roleMentions.forEach((mention) => {
		const role = bot.getServer().roles.find('id', getIdFromMention(mention)).name;
		quote.message = quote.message.replace(mention, role);
	});
}

function replaceUserMentionsWithNames(quote) {
	const userMentions = quote.message.match(/<@![0-9]*>/g);

	if (!userMentions) { return; }

	userMentions.forEach((mention) => {
		quote.message = quote.message.replace(mention, getNick(getIdFromMention(mention)));
	});
}

/**
 * Inserts quotes into the provided message if the user has recently called quoteReply.
 *
 * @param {Object} message - the message to add the quote to
 */
function maybeInsertQuotes(message) {
	const block = '```';
	const replyQuotes = quotingUserIDToQuotes[message.author.id];
	var quoteBlocks = '';

	if (!replyQuotes) { return; }

	replyQuotes.forEach((quote) => {
		const author = getNick(quote.quotedUserID);
		const time = moment(quote.time).format(c.SHORT_DATE_FORMAT);

		replaceUserMentionsWithNames(quote);
		replaceRoleMentionsWithNames(quote);
		quoteBlocks += `${block} ${quote.message}\n	— ${author}, ${time}${block}\n`;
	});

	message.delete();
	sendAuthoredMessage(`${quoteBlocks}${message.content}`, message.member.id, message.channel.id);
	quotingUserIDToQuotes[message.author.id] = null;
}

function maybeReplicateLol(message) {
	if (!(/^l(ol)+$/i).test(message.content) || message.channel.id === c.LOL_CHANNEL_ID) { return; }

	sendAuthoredMessage(message.content, message.author.id, c.LOL_CHANNEL_ID);
}

/**
 * Checks if the reactions include the delete reactions.
 *
 * @param {Object} reactions - the reactions to check
 */
function hasDeleteReactions(reactions) {
	return reactions.has(c.DELETE_REACTION) ||
		(reactions.has(c.TRASH_REACTION) && reactions.has('⚫'));
}


/**
 * Builds a column for an ascii table.
 *
 * @param {String} text column's text content
 * @param {Number} columnLength column length
 * @param {Boolean} isLastColumn whether or not it is the last column being built
 */
function buildColumn(text, columnLength, isLastColumn) {
	var padding = '';

	if (text.length > columnLength) {
		text = text.slice(0, columnLength);
	} else {
		padding = ' '.repeat(columnLength - text.length);
	}


	return isLastColumn ? `${text}\n` : `${text}${padding}${c.TABLE_COL_SEPARATOR}`;
}

/**
 * Builds an ascii table header.
 *
 * @param {String[]} columnHeaders column headers of the table
 */
function buildTableHeader(columnHeaders) {
	const header = columnHeaders.join(c.TABLE_COL_SEPARATOR);
	const columnLengths = columnHeaders.map((currHeader) => currHeader.length);
	const underline = columnLengths.map((length) => '═'.repeat(length)).join('═╬═');
	const output = `**\`\`\`${header}\n${underline}\n`;

	return { output, columnLengths };
}

/**
 * Deletes messages if the delete reactions are found.
 *
 * @param {Object} message - the message that triggered the command
 */
function deleteMessages(message) {
	var messagesToDelete = [];

	function addMessageToDelete(msg) {
		logger.info(`Deleting message with content: "${msg.content}"`);
		messagesToDelete.push(msg);
	}

	message.channel.fetchMessages({limit: 50})
		.then((foundMessages) => {
			var deleteReactionsFound = false;

			message.delete();
			foundMessages.array().some((msg) => {
				if (deleteReactionsFound) {
					addMessageToDelete(msg);

					if (hasDeleteReactions(msg.reactions)) { return true; }
				} else if (hasDeleteReactions(msg.reactions)) {
					deleteReactionsFound = true;
					addMessageToDelete(msg);
				}

				return false;
			});
			message.channel.bulkDelete(messagesToDelete)
				.catch(log);
		})
		.catch(log);
}

/**
 * Logs the response of an API request for Add Role or Move User.
 *
 * @param {String} error - error returned from API request
 * @param {Object} response - response returned from API request
 */
function log(error, response) {
	if (error) {
		const uri = error.options ? error.options.uri : error.path;
		const formattedUri = uri ? ` (${uri})` : '';

		logger.error(`API ERROR${formattedUri}: `, error);
	} else if (response) {
		logger.info(`API RESPONSE: ${inspect(response)}`);
	}
}

exports.buildColumn = buildColumn;
exports.buildTableHeader = buildTableHeader;
exports.deleteMessages = deleteMessages;
exports.getUserIDToColor = () => userIDToColor;
exports.log = log;
exports.maybeInsertQuotes = maybeInsertQuotes;
exports.maybeReplicateLol = maybeReplicateLol;
exports.sendAuthoredEmbed = sendAuthoredEmbed;
exports.sendAuthoredMessage = sendAuthoredMessage;
exports.sendDynamicMessage = sendDynamicMessage;
exports.sendEmbedFieldsMessage = sendEmbedFieldsMessage;
exports.sendEmbedMessage = sendEmbedMessage;
exports.sendEmbed = sendEmbed;
exports.sendEmbedMessageToChannel = sendEmbedMessageToChannel;
exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('quote', quoteUser);
	cmdHandler.registerCommandHandler('quotes', getQuotes);
};