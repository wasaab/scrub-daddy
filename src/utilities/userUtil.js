var tinycolor = require('tinycolor2');
var inspect = require('util-inspect');
var moment = require('moment');
var Fuse = require('fuse.js');

const { logger } = require('../logger.js');
var bot = require('../bot.js');
var c = require('../const.js');
const cmdHandler = require('../handlers/cmdHandler.js');

const { isAdmin } = require('./adminUtil.js');
const { getNick, getTargetFromArgs, getIdFromMention, exportJson, mentionUser, mentionChannel,
	getRand, capitalizeFirstLetter, lock, isLocked, shuffleArray, formatAsBoldCodeBlock} = require('./baseUtil.js');
const { sendAuthoredMessage, sendDynamicMessage, sendEmbedMessage, sendEmbed, log, getUserIDToColor, deleteMessages } = require('./messagingUtil.js');

var config = require('../../resources/data/config.json');
var groups = require('../../resources/data/groups.json');
var lists = require('../../resources/data/lists.json');
var catFacts = require('../../resources/data/catfacts.json');
var userIdToAliases = require('../../resources/data/aliases.json');
var userIdToMetadata = require('../../resources/data/userMetadata.json');

var inviterToUses = {};
var updateRainbowRoleInterval;

/**
 * Gets all of the server invites that are still valid.
 */
function getCurrServerInvites() {
	return bot.getServer().fetchInvites();
}

/**
 * Updates map of inviter to invite uses.
 */
function updateServerInvites() {
	getCurrServerInvites()
		.then((currInvites) => {
			currInvites.array().forEach((invite) => {
				inviterToUses[invite.inviter.id] = invite.uses;
			});
		})
		.catch(log);
}

/**
 * Adds the invited by role to members when they join the server.
 *
 * @param {Object} newMember member that joined the server
 */
function addInvitedByRole(newMember) {
	getCurrServerInvites()
		.then((currInvites) => {
			const inviter = determineInviterAndUpdateUsageCount(currInvites.array());
			const server = bot.getServer();
			const invitedByRole = server.roles.find('name', `${inviter}'s Pleb`);

			if (invitedByRole) {
				newMember.addRole(invitedByRole);
			} else {
				server.createRole({ name: `${inviter}'s Pleb` })
					.then((role) => {
						newMember.addRole(role);
					});
			}
		});
}

/**
 * Determines the inviter of the newly joined member and updates the invite usage count.
 *
 * @param {Object[]} currInvites server invites that are currently valid
 */
function determineInviterAndUpdateUsageCount(currInvites) {
	var inviter;
	var updatedInviterToUses = {};

	currInvites.forEach((invite) => {
		const currInviterID = invite.inviter.id;

		updatedInviterToUses[currInviterID] = invite.uses;

		if (inviter) { return; }

		const prevUses = inviterToUses[currInviterID];

		if ((prevUses && prevUses < invite.uses) || (!prevUses && invite.uses > 0)) {
			inviter = getNick(currInviterID);
		}
	});

	inviterToUses = updatedInviterToUses;

	return inviter;
}

/**
 * Adds to an existing list or shows all lists.
 *
 * @param {Object} message	message that called the list command
 * @param {String[]} args	the arguments passed by the user
 */
function addToListOrShowLists(message, args) {
    if (args.length > 2) {
        addToList(args, message.member.id);
    } else {
        showLists(message.member.id);
    }
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
		sendEmbedMessage(
			'404 List Not Found',
			`There is no list under the name "${listName}". Create it yourself by calling \`.create-list ${listName}\``,
			userID
		);
		return;
	}

	sendEmbedMessage(`Entry Added to ${listName}`, 'You can view all of the entries by calling `.list`', userID);
	lists[listIdx].entries.push(entry);
	exportJson(lists, 'lists');
}

/**
 * Creates a list.
 *
 * @param {Object} message	message that called the create list command
 * @param {String[]} args	the arguments passed by the user
 */
function createList(message, args) {
	if (!args[1]) { return; }

	const listName = getTargetFromArgs(args, 1).split(' ').join('-');

	lists.push({name: listName, entries: []});
	sendEmbedMessage(
		'List Successfully Created',
		`You can now add entries by calling \`.list ${listName} <your new entry>\``,
		message.member.id
	);
}

/**
 * Adds the provided target to the review role.
 *
 * @param {Object} message	message that called the join review team command
 */
function addToReviewRole(message) {
	const target = message.member;

	target.addRole(message.guild.roles.find('id', c.REVIEW_ROLE_ID));
	sendEmbed({
		description: `Welcome to the team ${mentionUser(target.id)}!`,
		userID: target.id
	});
}

/**
 * Removes the review role from the provided target.
 *
 * @param {Object} message	message that called the leave review team command
 */
function removeFromReviewRole(message) {
	const target = message.member;

	target.removeRole(message.guild.roles.find('id', c.REVIEW_ROLE_ID));
	sendEmbedMessage(
		null,
		`Good riddance. You were never there to review with us anyways, ${mentionUser(target.id)}!`,
		target.id
	);
}

/**
 * Subscribes the user to recurring Cat Facts updates.
 *
 * @param {Object} message	message that called the subscribe to catfacts command
 */
function subscribeToCatFacts(message) {
	const userID = message.member.id;

	catFacts.subscribers.push(userID);
	sendEmbedMessage(
		'➕ You are now subscribed to Cat Facts!',
		'Luckily for you, subscription is permanent.',
		userID
	);
	exportJson(catFacts, 'catfacts');
}

/**
 * Replaces first letter of all Scrub's nicknames.
 *
 * @param {Object} message	message that called the shuffle scrubs command
 * @param {String[]} args	the arguments passed by the user
 */
function shuffleScrubs(message, args) {
	const scrubs = message.guild.members.array();
	const caller = message.member;

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
	var aliases = userIdToAliases[userID] || {};

	aliases[command] = getTargetFromArgs(args, 2).replace('.', '');
	userIdToAliases[userID] = aliases;

	const msg = `Calling \`.${command}\` will now trigger a call to \`.${aliases[command]}\``;

	sendEmbedMessage(`Alias Created for ${user}`, msg, userID);
	exportJson(userIdToAliases, 'aliases');
	cmdHandler.setUserIdToAliases(userIdToAliases);
}

/**
 * Outputs all of the provided user's command aliases
 *
 * @param {String} userID - the ID of the user to output aliases for
 * @param {String} user - the name of the user to output aliases for
 */
function outputAliases(userID, user) {
	const aliases = userIdToAliases[userID];
	var msg = 'None. Call `.help alias` for more info.';

	if (aliases) {
		msg = '';
		Object.keys(aliases)
			.sort()
			.forEach((alias) => {
				msg += `**.${alias}** = \`.${aliases[alias]}\`\n`;
			});
	}

	sendEmbedMessage(`Aliases Created by ${user}`, msg, userID);
}

/**
 * Outputs all of the user's aliases or creates an alias if one is provided.
 *
 * @param {Object} message	message that called the alias command
 * @param {String[]} args	the arguments passed by the user
 */
function outputOrCreateAlias(message, args) {
	const userID = message.member.id;
	const userName = getNick(userID);

    if (args.length > 1) {
        createAlias(userID, userName, args);
    } else {
        outputAliases(userID, userName);
    }
}

/**
 * Removes an alias created by a user.
 *
 * @param {Object} message	message that called the unalias command
 * @param {String[]} args	the arguments passed by the user
 */
function unalias(message, args) {
	const userID = message.member.id;
	const alias = args[1];

	if (!alias) { return; }

	const aliases = userIdToAliases[userID];

	if (!aliases) { return; }

	delete aliases[alias];
	sendEmbedMessage(
		`Alias Removed for ${getNick(userID)}`,
		`calling \`.${alias}\` will no longer do anything.`,
		userID
	);
	exportJson(userIdToAliases, 'aliases');
	cmdHandler.setUserIdToAliases(userIdToAliases);
}

/**
 * Creates a temp channel with the provided name.
 *
 * @param {Object} message	message that called the create temp channel command
 * @param {String[]} args	the arguments passed by the user
 */
function createTempChannel(message, args) {
	const userID = message.member.id;
	const command = args[0];
    const channelType = args[1] || 'text';
    const channelName = getTargetFromArgs(args, 2) || 'temp-channel';

	createChannelInCategory(command, channelType, channelName, message,
		` Channel Created By ${getNick(userID)}`, userID);
}

/**
 * Creates an issue or feature channel.
 *
 * @param {Object} message	message that called the issue or feature command
 * @param {String[]} args	the arguments passed by the user
 */
function createIssueOrFeatureChannel(message, args) {
    const [ command, channelName ] = args;
	const feedback = args.slice(2).join(' ');
	const userID = message.member.id;

	createChannelInCategory(
    command,
    'text',
    channelName,
    message,
		` Submitted By ${getNick(userID)}`,
    userID,
    feedback
  );
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
			allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_MESSAGES'],
			id: userID
		},
		{
			allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_MESSAGES', 'VIEW_CHANNEL', 'SEND_MESSAGES'],
			id: c.SCRUB_DADDY_ROLE_ID
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

			sendEmbedMessage(
				`➕ ${channelCategoryName} Channel Created`,
				`You can find your channel, ${mentionChannel(channel.id)}, under the \`${channelCategoryName}\` category.`,
				userID
			);
			logger.info(`${channelCategoryName}${createdByMsg}  ${description}`);
		})
		.catch((error) => {
			logger.error(`Create Channel Error: ${error}`);
		});
}

/**
 * Removes view channel permission for the provided user.
 *
 * @param {Object} message	message that called the leave channel command
 */
function leaveTempChannel(message) {
	const { channel } = message;
	const userID = message.member.id;

	if (channel.parentID !== c.CATEGORY_ID.Temp && channel.parentID !== c.CATEGORY_ID.Topics) { return; }

	channel.overwritePermissions(userID, {
		VIEW_CHANNEL: false,
		VIEW_AUDIT_LOG: false
	})
		.then(() => {
			sendEmbed({
				title: `${getNick(userID)} has left the channel`,
				image: c.LEAVE_IMAGES[getRand(0, c.LEAVE_IMAGES.length)],
				channelID: channel.id,
				userID
			});
			logger.info(`${getNick(userID)} has left ${channel.name}`);
		})
		.catch((err) => {
			logger.error(`Leave ${channel.name} - Overwrite Permissions Error: ${err}`);
		});
}

/**
 * Determines what temp channels the user has left.
 *
 * @param {String} userID id of the user to check for
 */
function determineChannelsLeftByUser(userID) {
	return bot.getServer().channels.filter((channel) => {
		const permOverwrites = channel.permissionOverwrites;

		if (!permOverwrites) { return false; }

		return c.LEFT_CHANNEL_PERMISSION === permOverwrites.find('id', userID)?.deny;
	});
}

/**
 * Outputs the list of temp channels the user has left.
 *
 * @param {Object} message	message that called the channels left command
 */
function outputTempChannelsLeftByUser(message) {
	const userID = message.member.id;
	const channelsLeft = determineChannelsLeftByUser(userID).map((channel) => channel.name);
	const channelsLeftMsg = 0 !== channelsLeft.length
		? channelsLeft.toString().split(',').join('\n')
		: `You have not left any channels by calling \`${config.prefix}leave-temp\``;

	sendEmbedMessage(`Channels Left by ${getNick(userID)}`, channelsLeftMsg, userID);
}

/**
 * Rejoins a temp channel the user has left.
 *
 * @param {Object} message	message that called the rejoin temp command
 * @param {String[]} args	the arguments passed by the user
 */
function rejoinTempChannel(message, args) {
	const channelName = args[1];

	if (!channelName) { return; }

	const userID = message.member.id;
	const targetChannel = determineChannelsLeftByUser(userID).find('name', channelName);

	if (targetChannel) {
		targetChannel.permissionOverwrites.find('id', userID).delete();
		sendEmbed({
			title: `${getNick(userID)} is back in town!`,
			image: c.REJOIN_IMAGES[getRand(0, c.REJOIN_IMAGES.length)],
			channelID: targetChannel.id,
			userID
		});
		logger.info(`${getNick(userID)} has rejoined ${channelName}`);
	} else {
		sendEmbedMessage(
			'Unable to Rejoin Channel',
			`${mentionUser(userID)}, you have not left that channel, so there is no need to rejoin.`,
			userID
		);
	}
}

/**
 * Creates a group of users that can be mentioned.
 *
 * @param {Object} message	message that called the create group command
 * @param {String[]} args	the arguments passed by the user
 */
function createGroup(message, args) {
	if (args.length < 3) { return; }

	var group = [];

	if (args[2].startsWith('<@!')) {	//create a mentionable group of users
		args.slice(2).forEach((userMention) => {
			group.push(getIdFromMention(userMention));
		});
	} else {	//create a mentionable group of users who play a specific game
		const gameName = getTargetFromArgs(args, 2);

		group = gameName;
	}

	const groupName = args[1];
	const description = `You can now call \`${config.prefix}@${groupName} message to send to group\` `
		+ `from ${mentionChannel(c.BOT_SPAM_CHANNEL_ID)} or ${mentionChannel(c.SCRUBS_CHANNEL_ID)}`;

	groups[groupName] = group;
	sendEmbedMessage('Group Created', description, message.member.id);
	exportJson(groups, 'groups');
	message.delete();
}

/**
 * Modifies a user group.
 *
 * @param {String} groupName name of group to modify
 * @param {Object[]} group updated user group
 */
function modifyGroup(groupName, group) {
	groups[groupName] = group;
	exportJson(groups, 'groups');
}

/**
 * Gets an array of the keys, sorted by their values (descending).
 *
 * @param {Object} obj - object to sort keys by values on
 */
function getKeysSortedByValues(obj) {
	return Object.keys(obj).sort((a,b) => obj[b] - obj[a]);
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

		if (userIDToPostCount[message.author.id]) {
			userIDToPostCount[message.author.id]++;
		} else {
			userIDToPostCount[message.author.id] = 1;
		}
	});

	return getKeysSortedByValues(userIDToPostCount);
}

/**
 * Mentions the power users of the channel with a custom message.
 *
 * @param {Object} channel - channel to mention power users of
 * @param {String} customMessage - message to send to power users
 * @param {String} userID - the id of the user to send message as
 */
function mentionChannelsPowerUsers(channel, customMessage, userID) {
	var msg = `@${channel} ${customMessage}`;

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

					sendAuthoredMessage(msg, userID, channel.id);
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
		var description = '';

		legendMsg += `**${listIdx + correction}.**  ${list.name}\n`;
		list.entries.forEach((entry, entryIdx) => {
			description += `**${entryIdx + 1}.**  ${entry}\n`;
		});
		results.push({
			name: list.name,
			description: description
		});
	});

	const homePage = {
		name: 'Lists Index',
		description: legendMsg
	};

	results = results.slice(-10);
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

/**
 * Deletes messages in bulk for the channel owner.
 *
 * @param {Object} message	message that called the command
 */
function deleteMessagesForChannelOwner(message) {
    if (!isAdmin(message.member.id) && !isChannelOwner(message.channel, message.member)) { return; }

    deleteMessages(message);
}

function updateRainbowRoleColor() {
    var rainbowRole = bot.getServer().roles.find('name', 'rainbow');

	if (!rainbowRole || isLocked() || rainbowRole.members.array().length === 0) { return; }

	lock();
	updateRainbowRoleInterval = setInterval(() => {
		rainbowRole.setColor(getIntFromTinyColor(tinycolor.random()))
			.catch((err) => {
				logger.error(`Update Rainbow Role Color Error:${err}`);
			});
	}, 120000);
}

function clearRainbowRoleUpdateInterval() {
	if (!updateRainbowRoleInterval) { return; }

	logger.info('No users with rainbow role. Clearing color update interval.');
	clearInterval(updateRainbowRoleInterval);
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
	sendEmbedMessage('🏳️‍🌈 User Color Preference Set!', description, user.id);
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
 *
 * @param {Object} message	message that called the set color command
 * @param {String[]} args	the arguments passed by the user
 */
function setUserColor(message, args) {
	const targetColor = args[1];

	if (!targetColor) { return; }

	const userID = message.member.id;
	const colorChoicesMsg = `${mentionUser(userID)} You may use any of the colors on this list: ${c.COLOR_OPTIONS_URL}`;
	const color = tinycolor(targetColor);
	const userIDToColor = getUserIDToColor();

	if (!color.isValid()) {
		return sendEmbedMessage('Invalid Color', colorChoicesMsg);
	}

	const hex = color.toHexString();

	if (Object.values(userIDToColor).includes(hex)) {
		return sendEmbedMessage('Color already taken 😛', colorChoicesMsg);
	}

	const description = 'If the color on the left is not what you chose, then you typed'
		+ ` something wrong or did not choose from the provided colors.\n${colorChoicesMsg}`;

	userIDToColor[userID] = parseIntFromHex(hex);
	exportColors(description, message.member, hex, color);
}

/**
 * Sets the user's birthday.
 *
 * @param {Object} message	message that called the set birthday command
 * @param {String[]} args	the arguments passed by the user
 */
function setBirthday(message, args) {
	if (!args[1]) { return; }

	const userID = message.member.id;
	const birthday = moment(args[1], c.MD_DATE_FORMAT);

	if (!birthday.isValid()) {
		sendEmbedMessage(
			'🎂 Invalid Birthday',
			'Birthday must be in MM/DD format.\ne.g. `.set-birthday 05/17`',
			userID
		);
		return;
	}

	if (!userIdToMetadata[userID]) {
		userIdToMetadata[userID] = { birthday: {} };
	}

	populateBirthdayMetadata(birthday, userIdToMetadata[userID]);

	const formattedDay = formatAsBoldCodeBlock(birthday.format('MMMM Do'));

	sendEmbedMessage(
		'🎂 Birthday Set',
		`${mentionUser(userID)}, on ${formattedDay} your name will have cake!`,
		userID
	);
	exportJson(userIdToMetadata, 'userMetadata');
}

/**
 * Sets birthday and nickname to be given on that day in the user's metadata.
 *
 * @param {moment} birthday the user's birthday
 * @param {Object} userMetadata metadata on the user
 */
function populateBirthdayMetadata(birthday, userMetadata) {
	const birthdayEmojis = ['🎂', '🍰', '🎂', '🎉', '🎊', '🎈', '🎂'];

	shuffleArray(birthdayEmojis);

	const nicknames = ['Boy', 'Girl', 'Cake', 'Boi', 'Grill'];
	const nickname = `${birthdayEmojis[0]} Birthday ${nicknames[getRand(0, nicknames.length)]} ${birthdayEmojis[1]}`;

	userMetadata.birthday = birthday.valueOf();
	userMetadata.nickname = nickname;
}

exports.addInvitedByRole = addInvitedByRole;
exports.clearRainbowRoleUpdateInterval = clearRainbowRoleUpdateInterval;
exports.getGroup = getGroup;
exports.mentionChannelsPowerUsers = mentionChannelsPowerUsers;
exports.modifyGroup = modifyGroup;
exports.updateRainbowRoleColor = updateRainbowRoleColor;
exports.updateServerInvites = updateServerInvites;
exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('alias', outputOrCreateAlias);
	cmdHandler.registerCommandHandler('unalias', unalias);
	cmdHandler.registerCommandHandler('temp', createTempChannel);
	cmdHandler.registerCommandHandler('leave-temp', leaveTempChannel);
	cmdHandler.registerCommandHandler('rejoin-temp', rejoinTempChannel);
	cmdHandler.registerCommandHandler('channels-left', outputTempChannelsLeftByUser);
	cmdHandler.registerCommandHandler('color', setUserColor);
	cmdHandler.registerCommandHandler('create-group', createGroup);
	cmdHandler.registerCommandHandler('create-list', createList);
	cmdHandler.registerCommandHandler('list', addToListOrShowLists);
	cmdHandler.registerCommandHandler('issue', createIssueOrFeatureChannel);
	cmdHandler.registerCommandHandler('feature', createIssueOrFeatureChannel);
	cmdHandler.registerCommandHandler('join-review-team', addToReviewRole);
	cmdHandler.registerCommandHandler('leave-review-team', removeFromReviewRole);
	cmdHandler.registerCommandHandler('set-birthday', setBirthday);
	cmdHandler.registerCommandHandler('shuffle-scrubs', shuffleScrubs);
	cmdHandler.registerCommandHandler('subscribe-catfacts', subscribeToCatFacts);
	cmdHandler.registerCommandHandler('delete', deleteMessagesForChannelOwner);
};