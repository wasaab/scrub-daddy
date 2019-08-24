var tinycolor = require('tinycolor2');
var inspect = require('util-inspect');
var Fuse = require('fuse.js');
var get = require('lodash.get');

var logger = require('../logger.js').botLogger;
var bot = require('../bot.js');
var c = require('../const.js');

const { getNick, getTargetFromArgs, getIdFromMention,
	exportJson, mentionUser, mentionChannel, getRand, capitalizeFirstLetter, lock, isLocked } = require('./baseUtil.js');
const { sendDynamicMessage, sendEmbedMessage, log, getUserIDToColor } = require('./messagingUtil.js');

var config = require('../../resources/data/config.json');
var groups = require('../../resources/data/groups.json');
var lists = require('../../resources/data/lists.json');
var catFacts = require('../../resources/data/catfacts.json');
var userIDToAliases = require('../../resources/data/aliases.json');

var inviterToUses = {};

function getCurrServerInvites() {
	return bot.getServer().fetchInvites();
}

function updateServerInvites() {
	getCurrServerInvites()
		.then((currInvites) => {
			currInvites.array().forEach((invite) => {
				inviterToUses[invite.inviter.id] = invite.uses;
			});
		})
		.catch(log);
}

function addInvitedByRole(newMember) {
	getCurrServerInvites()
		.then((currInvites) => {
			var inviter;
			var updatedInviterToUses = {};

			currInvites.array().forEach((invite) => {
				var currInviterID = invite.inviter.id;
				updatedInviterToUses[currInviterID] = invite.uses;

				if (inviter) { return; }

				const prevUses = inviterToUses[currInviterID];

				if ((prevUses && prevUses < invite.uses) || (!prevUses && invite.uses > 0)) {
					inviter = getNick(currInviterID);
				}
			});

			inviterToUses = updatedInviterToUses;

			const server = bot.getServer();
			var invitedByRole = server.roles.find('name', `${inviter}'s Pleb`);

			if (!invitedByRole) {
				server.createRole({
					name: `${inviter}'s Pleb`
				})
				.then((role) => {
					newMember.addRole(role);
				});
			} else {
				newMember.addRole(invitedByRole);
			}
		});
}

/**
 * Adds an item to a list.
 *
 * @param {String[]} args - arguments passed to command
 * @param {String} userID - id of the user
 */
function addToList(args, userID) {
	const listName = args[1];
	const entry = getTargetFromArgs(args, 2);
	const listIdx = lists.map((list) => list.name).indexOf(listName);
	if (listIdx === -1) {
		sendEmbedMessage('404 List Not Found',
			`There is no list under the name "${listName}". Create it yourself by calling \`.create-list ${listName}\``, userID);
		return;
	}
	sendEmbedMessage(`Entry Added to ${listName}`, 'You can view all of the entries by calling `.list`', userID);
	lists[listIdx].entries.push(entry);
	exportJson(lists, 'lists');
}

/**
 * Creates a list.
 *
 * @param {String[]} args - arguments passed to command
 * @param {String} userID - id of the user
 */
function createList(args, userID) {
	var listName = getTargetFromArgs(args, 1).split(' ').join('-');
	lists.push({name: listName, entries: []});
	sendEmbedMessage('List Successfully Created', `You can now add entries by calling \`.list ${listName} <your new entry>\``, userID);
}

/**
 * Adds the provided target to the review role.
 */
function addToReviewRole(target, roles) {
	target.addRole(roles.find('id', c.REVIEW_ROLE_ID));
	sendEmbedMessage(null, `Welcome to the team ${mentionUser(target.id)}!`, target.id);
}

/**
 * Removes the review role from the provided target.
 */
function removeFromReviewRole(target, roles) {
	target.removeRole(roles.find('id', c.REVIEW_ROLE_ID));
	sendEmbedMessage(null, `Good riddance. You were never there to review with us anyways, ${mentionUser(target.id)}!`, target.id);
}

/**
 * Subscribes the user to recurring Cat Facts updates.
 *
 * @param {String} userID - id of user to subscribe
 */
function subscribeToCatFacts(userID) {
	catFacts.subscribers.push(userID);
	sendEmbedMessage('➕ You are now subscribed to Cat Facts!', 'Luckily for you, subscription is permanent.', userID);
	exportJson(catFacts, 'catfacts');
}

/**
 * Replaces first letter of all Scrub's nicknames.
 */
function shuffleScrubs(scrubs, caller, args) {
	if (!caller.roles.find('id', c.BEYOND_ROLE_ID) || (args[1] && args[1].length > 1)) { return; }
	var randLetter = args[1] || c.ALPHABET.substr(getRand(0, 26), 1);
	randLetter = randLetter.toUpperCase();

	scrubs.forEach((scrub) => {
		if (scrub.highestRole.id === c.SCRUBS_ROLE_ID) {
			scrub.setNickname(`:${randLetter}${scrub.displayName.slice(2)}`);
		}
	});
}

/**
 * Creates an alias for a command, that only works for the provided user.
 *
 * @param {String} userID - ID of the user to create the cmd alias for
 * @param {String} user - name of the user to create the cmd alias for
 * @param {String[]} args - command args passed in by user
 */
function createAlias(userID, user, args) {
	const command = args[1].replace('.', '');
	var aliases = userIDToAliases[userID] || {};
	aliases[command] = getTargetFromArgs(args, 2).replace('.', '');
	userIDToAliases[userID] = aliases;
	const msg = `Calling \`.${command}\` will now trigger a call to \`.${aliases[command]}\``;
	sendEmbedMessage(`Alias Created for ${user}`, msg, userID);
	exportJson(userIDToAliases, 'aliases');
}

/**
 * Gets the alias if it exists for the provided command and user
 *
 * @param {String} command - the command to check for an alias value
 * @param {String} userID - the ID of the user calling the command
 */
function maybeGetAlias(command, userID) {
	const aliases = userIDToAliases[userID];

	if (!aliases) { return; }

	return aliases[command];
}

/**
 * Outputs all of the provided user's command aliases
 *
 * @param {String} userID - the ID of the user to output aliases for
 * @param {String} user - the name of the user to output aliases for
 */
function outputAliases(userID, user) {
	const aliases = userIDToAliases[userID];
	var msg = 'None. Call `.help alias` for more info.';
	if (aliases) {
		msg = '';
		Object.keys(aliases).sort().forEach((alias) => {
			msg += `**.${alias}** = \`.${aliases[alias]}\`\n`;
		});
	}
	sendEmbedMessage(`Aliases Created by ${user}`, msg, userID);
}

/**
 * Removes an alias created by a user.
 *
 * @param {String} alias - alias to remove
 * @param {String} userID - user id alias belongs to
 */
function unalias(alias, userID) {
	const aliases = userIDToAliases[userID];
	if (!aliases) { return; }
	delete aliases[alias];
	sendEmbedMessage(`Alias Removed for ${getNick(userID)}`, `calling \`.${alias}\` will no longer do anything.`, userID);
	exportJson(userIDToAliases, 'aliases');
}

/**
 * Creates a channel in a category, specified by the command provided.
 * For submitting issues/features and creating temporary voice/text channels.
 *
 * @param {String} command - command called
 * @param {String} channelType - type of channel to create 'voice' or 'text'
 * @param {String} channelName - name of channel to create
 * @param {Object} message - full message object
 * @param {String} createdByMsg - msg to send to channel upon creation
 * @param {String} feedback - optional feedback provided if an issue/feature
 */
function createChannelInCategory(command, channelType, channelName, message, createdByMsg, userID, feedback) {
	if (!channelName || (channelType !== 'voice' && channelType !== 'text')) { return; }

	if (channelName.includes(' ')) {
		//remove the leading/trailing whitespace and replace other spaces with '-'
		channelName = channelName.trim().split(' ').join('-');
	}

	const description = feedback || ' ';
	const channelCategoryName = capitalizeFirstLetter(command);
	var overwrites = [
		{
			allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES'],
			id: userID
		},
		{
			allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_MESSAGES', 'VIEW_CHANNEL', 'SEND_MESSAGES'],
			id: c.SCRUB_DADDY_ID
		}
	];

	if (c.BOTS_ROLE_ID) {
		overwrites.push({
			deny: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
			id: c.BOTS_ROLE_ID
		});
	}

	logger.info(`Perm Overwrites: ${inspect(overwrites)}`);
	message.guild.createChannel(channelName, channelType, overwrites)
	.then((channel) => {
		channel.setParent(c.CATEGORY_ID[channelCategoryName]);

		if ('text' === channelType) {
			sendEmbedMessage(channelCategoryName + createdByMsg, description,
				userID, c.SETTINGS_IMG, null, null, channel.id);
		}

		sendEmbedMessage(`➕ ${channelCategoryName} Channel Created`,
			`You can find your channel, ${mentionChannel(channel.id)}, under the \`${channelCategoryName}\` category.`, userID);
		logger.info(`${channelCategoryName}${createdByMsg}  ${description}`);
	})
	.catch((error) => {
		logger.error(`Create Channel Error: ${error}`);
	});
}

/**
 * Removes view channel permission for the provided user.
 *
 * @param {Object} channel - channel to leave
 * @param {String} userID - user to remove
 */
function leaveTempChannel(channel, userID) {
	if (channel.parentID !== c.CATEGORY_ID.Temp && channel.parentID !== c.CATEGORY_ID.Topics) { return; }

	channel.overwritePermissions(userID, {
		VIEW_CHANNEL: false,
		VIEW_AUDIT_LOG: false
	})
	.then(() => {
		sendEmbedMessage(`${getNick(userID)} has left the channel`, null,
			userID, c.LEAVE_IMAGES[getRand(0, c.LEAVE_IMAGES.length)], null, null, channel.id);
		logger.info(`${getNick(userID)} has left ${channel.name}`);
	})
	.catch((err) => {
		logger.error(`Leave ${channel.name} - Overwrite Permissions Error: ${err}`);
	});
}

function determineChannelsLeftByUser(userID) {
	return bot.getClient().channels.filter((channel) => {
		const permissionOverwrites = channel.permissionOverwrites.find('id', userID);

		return c.LEFT_CHANNEL_PERMISSION === get(permissionOverwrites, 'deny');
	});
}

function outputTempChannelsLeftByUser(userID) {
	const channelsLeft = determineChannelsLeftByUser(userID).map((channel) => channel.name);
	const channelsLeftMsg = 0 !== channelsLeft.length
		? channelsLeft.toString().split(',').join('\n')
		: `You have not left any channels by calling \`${config.prefix}leave-temp\``;

	sendEmbedMessage(`Channels Left by ${getNick(userID)}`, channelsLeftMsg, userID);
}

function rejoinTempChannel(userID, channelName) {
	const targetChannel = determineChannelsLeftByUser(userID).find('name', channelName);

	if (!targetChannel) {
		sendEmbedMessage('Unable to Rejoin Channel',
			`${mentionUser(userID)}, you have not left that channel, so there is no need to rejoin.`, userID);
	} else {
		targetChannel.permissionOverwrites.find('id', userID).delete();
		sendEmbedMessage(`${getNick(userID)} is back in town!`, null,
			userID, c.REJOIN_IMAGES[getRand(0, c.REJOIN_IMAGES.length)], null, null, targetChannel.id);
		logger.info(`${getNick(userID)} has rejoined ${channelName}`);
	}
}

/**
 * Creates a group of users that can be mentioned.
 *
 * @param {String} groupName - name of the group to create
 * @param {String[]} args - arguments passed to command
 * @param {String} userID - id of the user
 */
function createGroup(groupName, args, userID) {
	var group = [];

	if (args[2].startsWith('<@!')) {	//create a mentionable group of users
		args.slice(2).forEach((userMention) => {
			group.push(getIdFromMention(userMention));
		});
	} else {	//create a mentionable group of users who play a specific game
		const gameName = getTargetFromArgs(args, 2);
		group = gameName;
	}

	groups[groupName] = group;
	sendEmbedMessage('Group Created', `You can now call \`${config.prefix}@${groupName} message to send to group\` ` +
		`from ${mentionChannel(c.BOT_SPAM_CHANNEL_ID)} or ${mentionChannel(c.SCRUBS_CHANNEL_ID)}`, userID);
	exportJson(groups, 'groups');
}

/**
 * Gets an array of the keys, sorted by their values (descending).
 *
 * @param {Object} obj - object to sort keys by values on
 */
function getKeysSortedByValues(obj) {
	return Object.keys(obj).sort((a,b) => obj[b]-obj[a]);
}

/**
 * Determines the power users based on number of posts.
 *
 * @param {Object[]} messages - messages to count with
 */
function determinePowerUsers(messages) {
	var userIDToPostCount = {};

	messages.forEach((message) => {
		if (message.author.bot) { return; }

		if (!userIDToPostCount[message.author.id]) {
			userIDToPostCount[message.author.id] = 1;
		} else {
			userIDToPostCount[message.author.id]++;
		}
	});

	return getKeysSortedByValues(userIDToPostCount);
}

/**
 * Mentions the power users of the channel with a custom message.
 *
 * @param {Object} channel - channel to mention power users of
 * @param {String} nickName - nickname of calling user
 * @param {String} customMessage - message to send to power users
 */
function mentionChannelsPowerUsers(channel, nickName, customMessage) {
	var msg = `↪️ **${nickName}**: @${channel} ${customMessage}`;

	channel.fetchMessages({limit: 100})
	.then((firstHundredMessages) => {
		const lastMsgID = firstHundredMessages.get(firstHundredMessages.lastKey()).id;
		channel.fetchMessages({limit: 100, before: lastMsgID})
		.then((secondHundredMessages) => {
			const messages = firstHundredMessages.array().concat(secondHundredMessages.array());
			const powerUsers = determinePowerUsers(messages);

			if (!powerUsers) { return; }
			powerUsers.splice(5);	// Only include the 5 top posters

			powerUsers.forEach((powerUserID) => {
				msg += ` ${mentionUser(powerUserID)}`;
			});

			channel.send(msg);
		});
	});
}

/**
 * Gets the group matching the target name.
 *
 * @param {String} targetGroupName - group to find
 */
function getGroup(targetGroupName) {
	if (!targetGroupName) { return; }

	const groupNames = Object.keys(groups);
	var groupFuzzyOptions = c.WHO_PLAYS_FUZZY_OPTIONS;
	delete groupFuzzyOptions.keys;

	const fuse = new Fuse(groupNames, groupFuzzyOptions);
	const fuzzyResults = fuse.search(targetGroupName);
	if (fuzzyResults.length === 0) { return { group: null, name: null }; }

	const groupName = groupNames[fuzzyResults[0]];
	return { group: groups[groupName], name: groupName };
}

/**
 * Shows all user created lists.
 *
 * @param {String} userID - id of user calling command
 */
function showLists(userID) {
	if (lists.length === 0) { return; }

	var results = [];
	var legendMsg = '`Click the numbered reaction associated with the list you wish to view.`\n';
	const correction = lists.length > 9 ? 0 : 1;
	lists.forEach((list, listIdx) => {
		legendMsg += `**${listIdx + correction}.**  ${list.name}\n`;

		var description = '';
		list.entries.forEach((entry, entryIdx) => {
			description += `**${entryIdx + 1}.**  ${entry}\n`;
		});
		results.push({
			name: list.name,
			description: description
		});
	});
	results = results.slice(-10);
	const homePage = {
		name: 'Lists Index',
		description: legendMsg
	};

	sendDynamicMessage(userID, 'list', results, homePage);
}

/**
 * Determines if the provided user owns the provided channel.
 *
 * @param {Object} channel - the channel to check ownership of
 * @param {String} user - the user to check
 */
function isChannelOwner(channel, user) {
	const permissionOverwrites = channel.permissionOverwrites.find('id', user.id);

	return permissionOverwrites
		&& permissionOverwrites.allow !== 0
		&& permissionOverwrites.deny === 0;
}

function updateRainbowRoleColor() {
    var rainbowRole = bot.getServer().roles.find('name', 'rainbow');

	if (!rainbowRole || isLocked() || rainbowRole.members.array().length === 0) { return; }

	lock();
	setInterval(() => {
		rainbowRole.setColor(getIntFromTinyColor(tinycolor.random()))
			.catch((err) => {
				logger.error(`Update Rainbow Role Color Error:${err}`);
			});
	}, 2000);
}

function replaceOrAddColorRole(color, hex, targetUser) {
	const colorRoleName = color.toName() || color.toHexString();
	var roleEdited = false;

	targetUser.roles.array().forEach((role) => {
		const roleColor = tinycolor(role.name);
		if (!roleColor.isValid() || role.hexColor !== tinycolor(role.name).toHexString()) { return; }

		//If an old color role has already been edited, delete remaining color roles.
		if (roleEdited) {
			return role.delete();
		}

		roleEdited = true;
		role.edit({
			name: colorRoleName,
			color: hex
		})
		.catch((err) => {
			logger.error(`Edit Role Error: ${err}`);
		});
	});

	if (roleEdited) { return; }

	bot.getServer().createRole({
		name: colorRoleName,
		color: hex,
		position: bot.getServer().roles.array().length - 4
	})
	.then((role) => {
		targetUser.addRole(role);
	})
	.catch((err) => {
		logger.error(`Add Role Error: ${err}`);
	});
}

/**
 * exports the user color preferences to a json file.
 */
function exportColors(description, user, hex, color) {
	sendEmbedMessage( '🏳️‍🌈 User Color Preference Set!', description, user.id);
	exportJson(getUserIDToColor(), 'colors');

	if (user.roles.find('id', c.BEYOND_ROLE_ID)) {
		replaceOrAddColorRole(color, hex, user);
	}
}

function parseIntFromHex(hex) {
	return parseInt(hex.replace(/^#/, ''), 16);
}

function getIntFromTinyColor(color) {
	return parseIntFromHex(color.toHexString());
}

/**
 * Sets the user's message response color to the provided color.
 */
function setUserColor(targetColor, user) {
	const userID = user.id;
	const colorChoicesMsg = `${mentionUser(userID)} You may use any of the colors on this list: ${c.COLOR_OPTIONS_URL}`;
	const color = tinycolor(targetColor);
	const userIDToColor = getUserIDToColor();

	if (!color.isValid()) {
		return sendEmbedMessage('Invalid Color', colorChoicesMsg);
	}

	const hex = color.toHexString();

	if (Object.values(userIDToColor).includes(hex)) {
		return sendEmbedMessage('Color already taken 😛', colorChoicesMsg);
	} else {
		userIDToColor[userID] = parseIntFromHex(hex);
	}

	const description = 'If the color on the left is not what you chose, then you typed'
		+ ' something wrong or did not choose from the provided colors.\n' + colorChoicesMsg;

	exportColors(description, user, hex, color);
}

exports.addInvitedByRole = addInvitedByRole;
exports.addToList = addToList;
exports.addToReviewRole = addToReviewRole;
exports.createAlias = createAlias;
exports.createChannelInCategory = createChannelInCategory;
exports.createGroup = createGroup;
exports.createList = createList;
exports.getGroup = getGroup;
exports.isChannelOwner = isChannelOwner;
exports.leaveTempChannel = leaveTempChannel;
exports.maybeGetAlias = maybeGetAlias;
exports.mentionChannelsPowerUsers = mentionChannelsPowerUsers;
exports.outputAliases = outputAliases;
exports.outputTempChannelsLeftByUser = outputTempChannelsLeftByUser;
exports.rejoinTempChannel = rejoinTempChannel;
exports.removeFromReviewRole = removeFromReviewRole;
exports.setUserColor = setUserColor;
exports.subscribeToCatFacts = subscribeToCatFacts;
exports.showLists = showLists;
exports.shuffleScrubs = shuffleScrubs;
exports.unalias = unalias;
exports.updateRainbowRoleColor = updateRainbowRoleColor;
exports.updateServerInvites = updateServerInvites;