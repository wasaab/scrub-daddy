var { execSync } = require('child_process');
var backup = require('backup');
var moment = require('moment');
var fs = require('fs');

var { logger, DiscordServerTransport } = require('../logger.js');
var bot = require('../bot.js');
var c = require('../const.js');
const cmdHandler = require('../handlers/cmdHandler.js');

const { sendEmbedMessage, sendEmbed, log } = require('./messagingUtil.js');
const { getNick, exportJson, mentionUser, mentionChannel, getMembers, maybeGetPlural, getRand } = require('./baseUtil.js');

var bannedUserIDToBans = require('../../resources/data/banned.json');
var config = require('../../resources/data/config.json');

var reviewQueue = [];
var muteAndDeafUserIDToTime = {};
const backupBasePath = '../jsonBackups/';

/**
 * Bans the user from posting in the provided channel for 2 days.
 *
 * @param {Object} user - the user to ban
 * @param {Object} channel - the channel to ban the user from posting in
 * @param {Number} [days = 2] - number of days to ban the user for
 */
function banSpammer(user, channel, days = 2, isMagicWord, isSilent) {
	var usersBans = bannedUserIDToBans[user.id] || [];

	channel.overwritePermissions(user, { SEND_MESSAGES: false })
		.then(logger.info(`Banning ${getNick(user.id)} from ${channel.name} for spamming.`))
		.catch((err) => {
			logger.error(`Ban - Overwrite Permissions Error: ${err}`);
		});
	usersBans.push({
		channelID: channel.id,
		time: moment(),
		days: days
	});
	bannedUserIDToBans[user.id] = usersBans;
	exportBanned();

	var msg = `Enjoy the ${days} day ban from ${mentionChannel(channel.id)}, you filthy spammer!`;

	if (isMagicWord) {
		msg = `You said the magic word${maybeGetPlural(days)}! ${msg.split(',')[0]}.`;
	}

	if (isSilent) { return; }

	channel.send(`🔨 ${mentionUser(user.id)} ${msg}`);
	sendEmbed({
		image: c.BANNED_IMAGES[getRand(0, c.BANNED_IMAGES.length)],
		channelID: channel.id
	});
}

/**
 * Bans the author of the message from posting in that channel
 * if it was posted 3 times in a row.
 *
 * @param {Object} message - the message sent in a channel
 */
function maybeBanSpammer(message) {
	if (isNotSpam(message)) { return; }

	message.channel.fetchMessages({limit: 3})
	.then((oldMessages) => {
		const duplicateMessages = oldMessages.array()
			.filter((oldMsg) => isDuplicateMessage(oldMsg, message));

		if (duplicateMessages.length === 3) {
			banSpammer(message.member, message.channel);
		}
	});
}

/**
 * Determines if the current message is a duplicate of a prior message.
 *
 * @param {Object} oldMsg the old messages to compare against
 * @param {Object} message the current message to check for duplication
 */
function isDuplicateMessage(oldMsg, message) {
	return oldMsg.author.id === message.author.id && oldMsg.content === message.content;
}

/**
 * Determines if a message is not spam.
 *
 * @param {Object} message the message to check for spam
 */
function isNotSpam(message) {
	return message.channel.id === c.BOT_SPAM_CHANNEL_ID || message.author.bot
		|| message.attachments.size !== 0 || "PINS_ADD" === message.type;
}

/**
 * Lifts the posting ban from the user in the provided channel.
 *
 * @param {Object} userID - the id of the user to un-ban
 * @param {Object} channelID - the id of the channel to allow the user to post in
 */
function unBanSpammer(userID, channelID) {
	const channel = bot.getServer().channels.find('id', channelID);

	if (!channel) { return; }

	channel.overwritePermissions(userID, { SEND_MESSAGES: true })
		.then(() => {
			logger.info(`Un-banning ${getNick(userID)} from ${channel.name} for spamming.`);
			delete bannedUserIDToBans[userID];
			exportBanned();
			channel.send(`${mentionUser(userID)} Your ban has been lifted. You may now post in ${mentionChannel(channel.id)} again.`);
		})
		.catch((err) => {
			logger.error(`Un-ban - Overwrite Permissions Error: ${err}`);
		});
	}

/**
 * Lifts any spamming ban that has been active longer than its end time.
 */
function maybeUnbanSpammers() {
	for (var userID in bannedUserIDToBans) {
		const bans = bannedUserIDToBans[userID];
		const now = moment();

		bans.forEach((ban) => { //eslint-disable-line
			if (now.diff(ban.time, 'days') >= ban.days) {
				unBanSpammer(userID, ban.channelID);
			}
		});
	}
}

/**
 * Checks if the provided channel is Purgatory or the AFK channel.
 *
 * @param {String} channelID - id of the channel to check
 */
function isInPurgatoryOrAFK(channelID) {
	return channelID === c.PURGATORY_CHANNEL_ID || channelID === c.AFK_CHANNEL_ID;
}

/**
 * Updates the mute and deaf members array.
 *
 * @param {Object[]} channels - the server's channels
 */
function updateMuteAndDeaf(channels) {
	channels.forEach((channel) => {
		if (channel.type !== "voice" || !channel?.members?.size) { return; }

		channel.members.array().forEach((member) => {
			if (!member.selfMute || !member.selfDeaf) {
				if (muteAndDeafUserIDToTime[member.id]) {
					delete muteAndDeafUserIDToTime[member.id];
				}
			} else if (!muteAndDeafUserIDToTime[member.id] && !isInPurgatoryOrAFK(channel.id)) {
				muteAndDeafUserIDToTime[member.id] = moment();
				logger.info(`Adding ${getNick(member.id)} to mute & deaf list.`);
			}
		});
	});
}

/**
 * Moves mute and deaf members to solitary iff they have been muted and deaf for at least 5 minutes.
 */
function maybeMoveMuteAndDeaf() {
	const purgatoryVC = bot.getPurgatory();
	const now = moment();

	for (var userID in muteAndDeafUserIDToTime) {
		if (now.diff(muteAndDeafUserIDToTime[userID], 'minutes') < 5) { continue; }

		delete muteAndDeafUserIDToTime[userID];
		const deafMember = getMembers().find('id', userID);

		if (!deafMember) { continue; }

		deafMember.setVoiceChannel(purgatoryVC)
			.catch(log);
		logger.info(`Sending ${getNick(deafMember.id)} to solitary for being mute & deaf.`);
	}
}

/**
 * Checks for users who are both mute and deaf and moves them
 * to the solitary confinement channel if they have been that way
 * for at least 5 minutes.
 *
 * @param {Object[]} channels - the server's channels
 */
function handleMuteAndDeaf(channels) {
	updateMuteAndDeaf(channels);
	maybeMoveMuteAndDeaf();
}

/**
 * Returns true iff the user associated with the provided ID is an admin.
 *
 * @param {String} userID - id of the user
 */
function isAdmin(userID) {
	return userID === c.K_ID || userID === c.R_ID;
}

/**
 * Determines if the current environment is Development.
 */
function isDevEnv() {
	return config.env === c.DEV;
}

/**
 * Outputs the list of server backups.
 *
 * @param {Object} message	message that called the list backups command
 */
function listBackups(message) {
	if (!isAdmin(message.member.id)) { return; }

	var timestamps = [];
	var filesMsg = '';

	fs.readdirSync(backupBasePath).forEach((file) => {
		const time = moment(file.split('.')[0], c.BACKUP_DATE_FORMAT);

		timestamps.push(time.valueOf());
	});
	timestamps.sort((a,b) => b - a);
	timestamps = timestamps.slice(0, 5);
	timestamps.forEach((timestamp) => {
		const time = moment(timestamp).format(c.BACKUP_DATE_FORMAT);

		filesMsg += `\`${time.toString()}\`\n`;
	});
	sendEmbedMessage('Available Backups', filesMsg, c.K_ID);
}

/**
 * Updates README.md to have the up to date list of commands.
 *
 * @param {Object} message	message that called the update readme command
 */
function updateReadme(message) {
	if (!isAdmin(message.member.id)) { return; }

	var result = '';
	var cmdCount = c.ADMIN_COMMANDS.split('+').length;

	c.HELP_CATEGORIES.forEach((category) => {
		result += `\n1. ${category.name.split('`').join('')}\n`;
		category.fields.forEach((field) => {
			result += `      + ${field.name} - ${field.value}\n`;
			cmdCount++;
		});
	});

	result = `# scrub-daddy\n${c.CODACY_BADGE}\n\n` +
		`Personal Discord bot with the following ${cmdCount} commands:\n${result}\n\n${c.ADMIN_COMMANDS}`;
	fs.writeFile('README.md', result, 'utf8', log);
}

/**
 * Outputs a list of the commands that are missing help docs.
 *
 * @param {Object} message	message that called the missing help command
 */
function outputCmdsMissingHelpDocs(message) {
	if (!isAdmin(message.member.id)) { return; }

	const cmdsMissingDocs = c.COMMANDS.filter(isCommandUndocumented);
	const missingDocsOutput = cmdsMissingDocs.join('`, `');

	sendEmbedMessage(
		'Top Secret Commands',
		`I actually just need to document these ${cmdsMissingDocs.length} commands...\n\n\`${missingDocsOutput}\``
	);
}

/**
 * Outputs help for admin commands.
 *
 * @param {Object} message - the message calling the cmd
 * @param {Object} message.member - the calling member
 * @param {String} [message.id: userID] - ID of the caller
 * @returns 
 */
function outputAdminCmdHelp({ member: { id: userID } }) {
	if (!isAdmin(userID)) { return; }

	const adminCmdsOutput = c.ADMIN_COMMANDS.slice(c.ADMIN_COMMANDS.indexOf('+'));

	sendEmbedMessage('Admin Commands', adminCmdsOutput, userID);
}

/**
 * Determines if the command is undocumented by checking all help
 * categories, including admin commands.
 *
 * @param {String} cmd command to find docs of
 */
function isCommandUndocumented(cmd) {
	return !c.ADMIN_COMMANDS.includes(`\n+ ${cmd}`)
		&& !c.HELP_CATEGORIES.some((category) => isCommandInHelpCategory(category, cmd));
}

/**
 * Determines if the command is documented in the provided help category.
 *
 * @param {Object} category help category to search
 * @param {String} cmd command to find docs of
 */
function isCommandInHelpCategory(category, cmd) {
	return category.fields.some((command) => command.name.substring(1).startsWith(cmd));
}

/**
 * Outputs the updated help categories prompt.
 */
function outputUpdatedHelpCategoriesPrompt() {
	var result = '';

	c.HELP_CATEGORIES.forEach((category, i) => {
		var cmds = [];

		category.fields.forEach((cmd) => {
			if (!cmd.name.startsWith('.')) { return; }

			const cmdName = cmd.name.match('(@|[A-z0-9]+(-[A-z0-9]*)?)')[0];

			if (cmds[cmds.length - 1] === cmdName) { return; }

			cmds.push(cmdName);
		});

		const cmdsList = cmds.join('`	`');

		result += `{ name: '${i + 1}) ${category.name}', value: '\`${cmdsList}\`', inline: 'false'},\n`;
	});

	console.log(result); //eslint-disable-line
}

/**
 * Restarts the bot.
 *
 * @param {Object} message	message that called the restart command
 * @param {String[]} args	the arguments passed by the user
 * @param {Boolean} pullUpdatedCode whether or not the bot should pull from github
 */
function restartBot(message, args, pullUpdatedCode) {
	if (message && !isAdmin(message.member.id)) { return; }

	pullUpdatedCode = pullUpdatedCode || args[1];

  if (pullUpdatedCode) {
      execSync('git pull', { stdio: 'inherit' });
  }

	process.exit(0); //eslint-disable-line
}

/**
 * Waits for the specified backup file to exist.
 *
 * @param {String} time - backup timestamp
 * @param {String} path - backup file path
 * @param {Number} timeout - number of seconds before timing out
 * @param {Boolean} restart - whether or not the bot should restart on success
 */
function waitForFileToExist(time, path, timeout, restart) {
	var retriesLeft = 15;
	const interval = setInterval(function() {
		if (fs.existsSync(path)) {
			clearInterval(interval);
			sendEmbedMessage('Backup Successfully Created', `**${time}**`, c.K_ID);

			if (restart) {
				restartBot(null, null, restart);
			}
		} else if (retriesLeft === 0){
			clearInterval(interval);
			sendEmbedMessage('There Was An Issue Creating The Backup', `**${time}**`, c.K_ID);
		} else {
			retriesLeft--;
		}
	}, timeout);
}

/**
 * Restores all json files from the specified backup.
 *
 * @param {Object} message	message that called the restore command
 * @param {String[]} args	the arguments passed by the user
 */
function restoreJsonFromBackup(message, args) {
	if (!isAdmin(message.member.id)) { return; }

	var backupTarget = args[1];

	if (!backupTarget && config.lastBackup) {
		backupTarget = config.lastBackup;
	}

	const backupPath = `${backupBasePath}${backupTarget}.backup`;

	if (fs.existsSync(backupPath)) {
		const tempDir = './resources/resources';

		backup.restore(backupPath, './resources/');
		setTimeout(() => {
			execSync(`mv ${tempDir}/data/* ./resources/data/`);
			fs.rmdirSync(`${tempDir}/data`);
			fs.rmdirSync(tempDir);
			sendEmbedMessage(
				'Data Restored From Backup',
				`All data files have been restored to the state they were in on ${backupTarget}.`
			);
		}, 2000);
	} else {
		sendEmbedMessage(
			'Invalid Backup Specified',
			`There is no backup for the provided time of ${backupTarget}.`
		);
	}
}

/**
 * Backs the server up.
 *
 * @param {Object} message	message that called the backup json command
 * @param {String[]} args	the arguments passed by the user
 */
function backupJson(message, args) {
	if (!isAdmin(message.member.id)) { return; }

	const restartAfterBackup = args[1];
	const time = moment().format(c.BACKUP_DATE_FORMAT);
	const backupPath = `${backupBasePath}${time}.backup`;

	config.lastBackup = time;
	exportJson(config, 'config');

	if (!fs.existsSync(backupBasePath)) {
		fs.mkdirSync(backupBasePath);
	}

	backup.backup('./resources/data', backupPath);
	waitForFileToExist(time, backupPath, 2000, restartAfterBackup);
}

/**
 * Sends messages from the review queue to the reviewer.
 *
 * @param {Object} message	message that called the review command
 */
function reviewMessages(message) {
	const reviewer = message.author;

	reviewer.createDM()
		.then((dm) => {
			reviewQueue.forEach((reviewMessage) => {
				logger.info(`Message to review: ${reviewMessage}`);
				dm.send(reviewMessage);
			});
		});
}

/**
 * Adds a message to the queue for review.
 *
 * @param {Object} message - message to add to the queue
 */
function addMessageToReviewQueue(message) {
	reviewQueue.push(message.content);
	message.delete();
}

/**
 * exports bans.
 */
function exportBanned() {
	exportJson(bannedUserIDToBans, 'banned');
}

/**
 * Enables the server log redirect.
 */
function enableServerLogRedirect() {
    const logChannel = bot.getLogChannel();

	if (!logChannel || logger.transports.length === 3) { return; }

	logger.add(new DiscordServerTransport({ level: 'cmd', channel: logChannel }));
}

/**
 * Toggles the logger redirect to discord text channel on or off.
 *
 * @param {Object} message	message that called the log command
 */
function toggleServerLogRedirect(message) {
	const userID = message.member.id;

	if (!isAdmin(userID)) { return; }

	if (logger.transports.length === 3) {
		const discordTransport = logger.transports
			.find(({ constructor: { name } }) => name === 'DiscordServerTransport');

		logger.remove(discordTransport);
		sendEmbedMessage(
			'Server Log Redirection Disabled',
			'Server logs will stay where they belong!',
			userID
		);
	} else {
		exports.enableServerLogRedirect();
		sendEmbedMessage(
			'Server Log Redirection Enabled',
			`The server log will now be redirected to ${mentionChannel(c.LOG_CHANNEL_ID)}`,
			userID
		);
	}
}

exports.addMessageToReviewQueue = addMessageToReviewQueue;
exports.banSpammer = banSpammer;
exports.enableServerLogRedirect = enableServerLogRedirect;
exports.handleMuteAndDeaf = handleMuteAndDeaf;
exports.isAdmin = isAdmin;
exports.isDevEnv = isDevEnv;
exports.maybeBanSpammer = maybeBanSpammer;
exports.maybeUnbanSpammers = maybeUnbanSpammers;
exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('backup', backupJson);
	cmdHandler.registerCommandHandler('list-backups', listBackups);
	cmdHandler.registerCommandHandler('restore', restoreJsonFromBackup);
	cmdHandler.registerCommandHandler('log', toggleServerLogRedirect);
	cmdHandler.registerCommandHandler('admin-help', outputAdminCmdHelp);
	cmdHandler.registerCommandHandler('missing-help', outputCmdsMissingHelpDocs);
	cmdHandler.registerCommandHandler('review-messages', reviewMessages);
	cmdHandler.registerCommandHandler('update-readme', updateReadme);
	cmdHandler.registerCommandHandler('restart', restartBot);
};