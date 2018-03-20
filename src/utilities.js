var tinycolor = require('tinycolor2');
var schedule = require('node-schedule');
var Discord = require('discord.js');
var inspect = require('util-inspect');
var moment = require('moment');
var backup = require('backup');
var get = require('lodash.get');
var fs = require('fs');

const winston = require('winston');
const Transport = require('winston-transport');
const request = require('request')
const co = require('co')

var gambling = require('./gambling.js');
var games = require('./games.js');
var bot = require('./bot.js');
var c = require('./const.js');
var config = require('../resources/data/config.json');
var bannedUserIDToBans = require('../resources/data/banned.json');
var userIDToColor = require('../resources/data/colors.json');
var userIDToAliases = require('../resources/data/aliases.json');
var soundBytes = require('../resources/data/soundbytes.json');
const catFacts = require('../resources/data/catfacts.json');
const private = require('../../private.json'); 
const quotes = require('../resources/data/quotes.json');

var previousTip = {};
var quotingUserIDToQuotes = {};
var locks = {};		//function locks
var muteAndDeafUserIDToTime = {};
var quoteTipMsg = {};

/**
 * Creates a channel in a category, specified by the command provided.
 * For submitting issues/features and creating temporary voice/text channels.
 * 
 * @param {String} command - command called
 * @param {String} channelType - type of channel to create 'voice' or 'text'
 * @param {String} channelName - name of channel to create
 * @param {String} message - full message object
 * @param {String} createdByMsg - msg to send to channel upon creation
 * @param {String} feedback - optional feedback provided if an issue/feature
 */
function createChannelInCategory(command, channelType, channelName, message, createdByMsg, userID, feedback) {
	if (channelName) {
		if (channelName.includes(' ')) {
			//remove the leading/trailing whitespace and replace other spaces with '-'
			channelName = channelName.trim().split(' ').join('-');
		}
		const description = feedback || ' ';		
		const channelCategoryName = command.charAt(0).toUpperCase() + command.slice(1);
		const color = userIDToColor[userID] || 0xffff00;

		//TODO: Update permissions to new 11.3.0 syntax.
		const overwrites = [{
			allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES'],
			id: userID
		}];
		message.guild.createChannel(channelName, channelType, overwrites)
		.then((channel) => {
			channel.setParent(c.CATEGORY_ID[channelCategoryName]);			
			channel.send(new Discord.RichEmbed({
				color: color,
				title: channelCategoryName + createdByMsg,
				description: description,
				image: {
					url: c.SETTINGS_IMG
				} 
			}));	
		})
		sendEmbedMessage(`➕ ${channelCategoryName} Channel Created`, 
			`You can find your channel, \`${channelName}\`, under the \`${channelCategoryName}\` category.`, userID);
		c.LOG.info(`<INFO> ${getTimestamp()}  ${channelCategoryName}${createdByMsg}  ${description}`);		
	}
};

/**
 * Discord server logger.
 * 
 * @param {Object[]} opts 
 */
const discordServerTransport = class DiscordServerTransport extends Transport {
	constructor(opts) {
		super(opts);
	}
	
	log(info, callback) {
		// setImmediate(function () {
		// 	self.emit('logged', info);
		// });
		
		bot.getLogChannel().send(info.message);
		callback();
	}
};

//TODO: strip timestamp and maybe info/error/apiReq logic out of the rest of my code. instead use this printf format combined with timestamp format.
//look at winstons documentation for an example
const logger = new winston.createLogger({
	level: 'info',
	format: winston.format.printf(info => {
		return `${info.message}`;
	}),
	transports: [ new winston.transports.Console() ]
})

/**
 * Toggles the logger redirect to discord text channel on or off.
 */
function toggleServerLogRedirect(userID) {
	if (c.LOG.transports.length === 2) {
		const discordTransport = c.LOG.transports.find(transport => {
			return transport.constructor.name === 'DiscordServerTransport';
		});
		c.LOG.remove(discordTransport);
		sendEmbedMessage('Server Log Redirection Disabled', 'Server logs will stay where they belong!', userID)		
	} else {
		c.LOG.add(new discordServerTransport());	
		sendEmbedMessage('Server Log Redirection Enabled', 'The server log will now be redirected to `#server-log`', userID)
	}
};

/**
 * Gets a random number between min and max.
 * The maximum is exclusive and the minimum is inclusive
 * 
 * @param {Number} min - the minimum
 * @param {Number} max - the maximum 
 */
function getRand(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; 
};

/**
 * Gets a timestamp representing the current time.
 * 
 * @return {String} properly formatted timestamp
 */
function getTimestamp() {
	function pad(n) {
			return (n < 10) ? `0${n}` : n;
	}

	const time = new Date();
	const day = c.DAYS[time.getDay()];
	var hours = time.getHours();
	var minutes = time.getMinutes();
	var meridiem = 'AM';

	if (hours > 12) {
		hours -= 12;
		meridiem = 'PM';
	} else if (hours === 0) {
		hours = 12;
	}

	return `${day} ${pad(hours)}:${pad(minutes)} ${meridiem}`;
};

/**
 * Logs the response of an API request for Add Role or Move User.
 * 
 * @param {String} error - error returned from API request
 * @param {Object} response - response returned from API request
 */
function log(error, response) {
	if (error) {
		c.LOG.error(`<API ERROR> ${getTimestamp()}  ERROR: ${error}`);			
	} else if (response) {
		c.LOG.info(`<API RESPONSE> ${getTimestamp()}  ${inspect(response)}`);
	}
};

/**
 * Builds an embed field object with name and value.
 * 
 * @param {String} name - the name
 * @param {Number} value - the value
 */
function buildField(name, value, inline) {
	inline = inline || 'true'
	return {
		name: name,
		value: value,
		inline: inline
	};
};

/**
 * Comparator for two field objects. Compares values.
 * 
 * @param {Object} a - first field
 * @param {Object} b - second field
 */
function compareFieldValues(a,b) {
	const aNum = Number(a.value);
	const bNum = Number(b.value);

	if ( aNum > bNum)
	  return -1;
	if (aNum < bNum)
	  return 1;
	return 0;
};

/**
 * Send a message with fields to bot-spam.
 * 
 * @param {String} title - the message title
 * @param {String[]} fields - fields of the message
 * @param {String} userID - id of sending user
 */
function sendEmbedFieldsMessage(title, fields, userID) {
	if (fields.length === 1 && fields[0].name === '') {
		return;
	}

	const color = userIDToColor[userID] || 0xffff00;	
	return bot.getBotSpam().send(new Discord.RichEmbed({
		color: color,
		title: title,
		fields: fields
	}));	
};

/**
 * Sends an embed message to bot-spam with an optional title, description, image and thumbnail(true/false)
 */
function sendEmbedMessage(title, description, userID, image, thumbnail) {
	//these are all optional parameters
	title = title || '';
	description = description || '';
	image = image || '';
	const picType = thumbnail ? 'thumbnail' : 'image';
	const color = userIDToColor[userID] || 0xffff00;
	var message = {
		color: color,
		title: title,
		description: description
	};
	message[picType] = { url: image };
	return bot.getBotSpam().send(new Discord.RichEmbed(message))
	.then((msgSent) => msgSent);	
};

/**
 * Gets a map of scrub's ids to nicknames.
 */
function getScrubIDToNick() {
	return bot.getScrubIDToNick();
};

/**
 * Updates README.md to have the up to date list of commands.
 */
function updateReadme() {
	var result = '# scrub-daddy\n\nDiscord bot with the following commands:\n';
	c.HELP_CATEGORIES.forEach((category) => {
		result += `\n1. ${category.name.split('\`').join('')}\n`;
		category.fields.forEach((field) => {
			result += `      + ${field.name} - ${field.value}\n`
		});
	});
	fs.writeFile('README.md', result, 'utf8', log);	
};

/**
 * Outputs the help message for the provided command.
 * 
 * @param {String} cmd - the command to get help for
 * @param {String} userID - the userID requesting help
 */
function outputHelpForCommand(cmd, userID) {
	if (!cmd) { return; }
	c.HELP_CATEGORIES.forEach((category) => {
		category.fields.forEach((command) => {
			if (command.name.substring(1).startsWith(cmd)) {
				sendEmbedMessage(command.name, command.value, userID);
			}
		});
	});
}

/**
 * Outputs the help category for the given selection.
 * 
 * @param {number} selection - the category selection
 * @param {String} userID - the ID of the user requesting help
 */
function outputHelpCategory(selection, userID) {
	const helpCategory = c.HELP_CATEGORIES[selection];
	sendEmbedFieldsMessage(helpCategory.name, helpCategory.fields, userID);
}

/**
 * Waits for a reaction on the help message and changes the message
 * when a reaction is found.
 * 
 * @param {Object} msgSent - the help message
 * @param {String} userID - id of the user requesting help
 */
function awaitAndHandleHelpReaction(msgSent, userID) {
    const reactionFilter = (reaction, user) => (c.REACTION_NUMBERS.includes(reaction.emoji.name) || reaction.emoji.name === '🏠') && user.id === userID;
    msgSent.awaitReactions(reactionFilter, { time: 40000, max: 1 })
    .then((collected) => {
    	maybeUpdateHelpMessage(collected, msgSent, userID);
	})
	.catch((collected) => {
		c.LOG.info((`<INFO> ${getTimestamp()}  After 40 seconds, there were no reactions for help.`));
		sendEmbedMessage('Reponse Timed Out', 
			`${bot.getScrubIDToNick()[userID]}, you have not selected a category, via reaction, so I\'m not listening to you anymore 😛`, userID);
	});
}

/**
 * Updates the help message to the content associated with the selected reaction.
 * 
 * @param {Object[]} selectedReactions - reaction selected in an array
 * @param {Object} msg - the help message
 * @param {String} userID - id of the user requesting help
 */
function maybeUpdateHelpMessage(selectedReactions, msg, userID) {
	if (selectedReactions.length === 0) { return; }

	const selection = c.REACTION_NUMBERS.indexOf(selectedReactions.first().emoji.name);
	var helpCategory;
	if (selection === -1) {
		helpCategory = {
			name: '`📖 Help Categories`',
			fields: c.HELP_CATEGORIES_PROMPT
		}
	} else {
		helpCategory = c.HELP_CATEGORIES[selection];
	}
	const color = userIDToColor[userID] || 0xffff00;	
	const newMsg = new Discord.RichEmbed({
		color: color,
		title: helpCategory.name,
		fields: helpCategory.fields
	});	
	msg.edit('', newMsg)
	.then((updatedMsg) => {
		awaitAndHandleHelpReaction(updatedMsg, userID);
	});
}

/**
 * Adds the initial category selection reactions to the message.
 * 
 * @param {Object} msg - the help message 
 * @param {Number} reactionIdx - index of the reaction being added
 */
function addInitialHelpReactions(msg, reactionIdx) {
	setTimeout(() => {
		msg.react(c.REACTION_NUMBERS[reactionIdx])
		if (reactionIdx < 7) {
			addInitialHelpReactions(msg, reactionIdx + 1)
		}
	}, 300);
}

/**
 * Outputs help dialog to explain command usage.
 */
function help(userID) {
	sendEmbedFieldsMessage('`📖 Help Categories`', c.HELP_CATEGORIES_PROMPT, userID)
	.then((msgSent) => {
		msgSent.react('🏠');
		addInitialHelpReactions(msgSent, 0);
        awaitAndHandleHelpReaction(msgSent, userID);
	});
};

/**
 * Outputs a cat fact.
 */
function catfacts(userID) {
	const factIdx = getRand(0,catFacts.length);
	const msg = `${catFacts[factIdx]}\n 🐈 Meeeeee-WOW!`;
	sendEmbedMessage('Did you know?', msg, userID);
};

function scheduleRecurringVoiceChannelScan() {
	(function(){
		var client = bot.getClient();
		games.maybeUpdateChannelNames();
		games.maybeChangeAudioQuality(client.channels);
		handleMuteAndDeaf(client.channels);
		setTimeout(arguments.callee, 60000);
	})();
}

function scheduleRecurringExport() {
	(function(){
		games.exportTimeSheetAndGameHistory();
		gambling.exportLedger();	
		setTimeout(arguments.callee, 70000);
	})();
}

/**
 * Schedules a recurring job.
 */
function scheduleRecurringJobs() {
	const job = private.job;
	if (!job) { return; }
	var reviewRule = new schedule.RecurrenceRule();
	
	reviewRule[job.key1] = job.val1;
	reviewRule[job.key2] = job.val2;
	reviewRule[job.key3] = job.val3;

	schedule.scheduleJob(reviewRule, function(){
		if (isDevEnv()) { return; }			
		bot.getBotSpam().send(c.REVIEW_ROLE);
		sendEmbedMessage(null, null, null, job.img);
	});

	reviewRule[job.key3] = job.val3 - 3;
	schedule.scheduleJob(reviewRule, function(){
		if (isDevEnv()) { return; }			
		bot.getBotSpam().send(`${c.REVIEW_ROLE} Upcoming Review. Reserve the room and fire up that projector.`);
	});

	var clearTimeSheetRule = new schedule.RecurrenceRule();
	clearTimeSheetRule.hour = 5;
	
	schedule.scheduleJob(clearTimeSheetRule, function(){
	  games.clearTimeSheet();
	});

	var updateMembersAndBansRule = new schedule.RecurrenceRule();
	updateMembersAndBansRule.hour = [8, 20]; // 8am and 8pm
	schedule.scheduleJob(updateMembersAndBansRule, function(){
		bot.updateMembers();
		maybeUnbanSpammers();
	});

	var heatMapRule = new schedule.RecurrenceRule();
	heatMapRule.minute = 0;

	schedule.scheduleJob(heatMapRule, function(){
		var members = bot.getClient().guilds.find('id', c.SERVER_ID).members;
		games.maybeOutputCountOfGamesBeingPlayed(members, c.SCRUB_DADDY_ID);
	});

	var tipRule = new schedule.RecurrenceRule();
	tipRule.hour = [10, 17, 23];
	tipRule.minute = 0;
	var firstRun = true;
	var outputTip = schedule.scheduleJob(tipRule, function(){	
		if (isDevEnv()) { return; }	
		if (!firstRun) { 
			previousTip.delete();						
		}
		firstRun = false;
		var tip = c.TIPS[getRand(0, c.TIPS.length)];		
		bot.getBotSpam().send(new Discord.RichEmbed(tip))
		.then((message) => {
			previousTip = message;
		});
	});

	if (config.lottoTime) {
		const lottoTime = config.lottoTime;
		const lottoRule = `0 ${lottoTime.hour} ${lottoTime.day} ${lottoTime.month} *`;
		var endLotto = schedule.scheduleJob(lottoRule, function() {
			c.LOG.info(`<INFO> ${getTimestamp()}  Beyond lotto ending`);		
			gambling.endLotto();
		});	

		var lottoCountdownRule = new schedule.RecurrenceRule();
		lottoCountdownRule.mintue = 0;
		var updateCountdown = schedule.scheduleJob(lottoCountdownRule, updateLottoCountdown);	
	}

	scheduleRecurringExport();
	scheduleRecurringVoiceChannelScan();
};

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
 * Adds the provided target to the review role.
 */
function addToReviewRole(target, roles) {
	target.addRole(roles.find('id', c.REVIEW_ROLE_ID));	
	sendEmbedMessage(null, `Welcome to the team ${mentionUser(target.id)}!`, target.id);
};

/**
 * Removes the review role from the provided target.
 */
function removeFromReviewRole(target, roles) {
	target.removeRole(roles.find('id', c.REVIEW_ROLE_ID));
	sendEmbedMessage(null, `Good riddance. You were never there to review with us anyways, ${mentionUser(target.id)}!`, target.id);	
};

/**
 * exports bans.
 */
function exportBanned() {
	const json = JSON.stringify(bannedUserIDToBans);
	fs.writeFile('./resources/data/banned.json', json, 'utf8', log);
}

/**
 * exports the user color preferences to a json file.
 */
function exportColors(title, description, userID, guild, hex, color) {
	sendEmbedMessage(title, description, userID);	
	//If color not taken, write to colors.json
	if (title.substring(0, 1) !== 'C') {
		var json = JSON.stringify(userIDToColor);		
		fs.writeFile('./resources/data/colors.json', json, 'utf8', log);	
		const target = guild.members.find('id', userID);
		
		if (target.roles.find('id', c.BEYOND_ROLE_ID)) {
			guild.createRole({
				name: color,
				color: hex,
				position: guild.roles.array().length - 3
			})
			.then((role) => {
				target.addRole(role);				
			})
			.catch((err) => {
				c.LOG.error(`<ERROR> ${getTimestamp()}  Add Role Error: ${err}`);			
			});
		}
	}
};

/**
 * Sets the user's message response color to the provided color.
 */
function setUserColor(targetColor, userID, guild) {
	var color = tinycolor(targetColor);
	var title = '🏳️‍🌈 User Color Preference Set!';
	var description = 'If the color on the left is not what you chose, then you typed something wrong or did not choose from the provided colors.\n' +
	'You may use any of the colors on this list: http://www.w3.org/TR/css3-color/#svg-color';
	
	if (color) {
		var hex = parseInt(color.toHexString().replace(/^#/, ''), 16);
		if (Object.values(userIDToColor).includes(hex)) {
			title = 'Color already taken 😛'
			description = description.split('\n')[1];
		}
		else {
			userIDToColor[userID] = hex;			
		}
	}
	exportColors(title, description, userID, guild, hex, targetColor);	
};

/**
 * Plays the target soundbyte in the command initiator's voice channel.
 */
function playSoundByte(channel, target, userID) {
	if (!target) {
		var list = '';
		soundBytes.forEach((sound) => {
			list += `\`${sound}\`	`;
		});
		sendEmbedMessage('🎶 Available Sound Bytes', list, userID);
		return;
	}
	if (soundBytes.includes(target.toLowerCase())) {
		channel.join()
		.then((connection) => {
			c.LOG.error(`<INFO> ${getTimestamp()}  Connected to channel!`);			
			const dispatcher = connection.playFile(`./resources/audio/${target}.mp3`);
			
			dispatcher.on('end', () => {
				channel.leave();
			});
		})
		.catch((err) => {
			c.LOG.error(`<ERROR> ${getTimestamp()}  Add Role Error: ${err}`);			
		});
	}
}

const retry = (f, n) => f().catch(err => {
	if (n > 0) return retry(f, n - 1)
	else throw err
})

var downloadAttachment = co.wrap(function *(msg, userID) {
	var fileName = 'none';
	try {
		if (msg.attachments.length == 0) return;
		const nameData = msg.attachments.array()[0].name.split('.');
		if (nameData[1] !== 'mp3') {
			sendEmbedMessage('🎶 Invalid File', 'You must attach a .mp3 file with the description set to `*add-sb`', userID);						
			return;
		}

		yield Promise.all(msg.attachments.map(co.wrap(function *(file) {
			yield retry(() => new Promise((finish, error) => {
				request(file.url)
				.pipe(fs.createWriteStream(`./resources/audio/${file.name.toLowerCase()}`))
				.on('finish', finish)
				.on('error', error)
			}), 3)
			fileName = nameData[0].toLowerCase();
		}.bind(this))))
	}
	catch (err) {
		sendEmbedMessage('🎶 Invalid File', 'You must attach a .mp3 file with the description set to `*add-sb`', userID);			
		return;
	}

	sendEmbedMessage('🎶 Sound Byte Successfully Added', `You may now hear the sound byte by calling \`*sb ${fileName}\` from within a voice channel.`, userID);
	soundBytes.push(fileName);				
	var json = JSON.stringify(soundBytes);
	fs.writeFile('./resources/data/soundbytes.json', json, 'utf8', log);
}.bind(this));

/**
 * Adds the attached soundbyte iff the attachment exists and is an mp3 file.
 */
function maybeAddSoundByte(message, userID) {
	downloadAttachment(message, userID);
};

/**
 * Builds a target which could be one word or multiple.
 * 
 * @param {String[]} args - command args passed in by user
 * @param {number} startIdx - the start index of your target within args
 */
function getTargetFromArgs(args, startIdx) {
	var target = args[startIdx];
	for (var i=startIdx+1; i < args.length; i++) {
		target += ` ${args[i]}`;
	}
	return target;
};

/**
 * Creates an alias for a command, that only works for the provided user.
 * 
 * @param {String} userID - ID of the user to create the cmd alias for
 * @param {String} user - name of the user to create the cmd alias for
 * @param {String[]} args - command args passed in by user
 */
function createAlias(userID, user, args) {
	const command = args[1];
	var aliases = userIDToAliases[userID] || {};
	aliases[command] = getTargetFromArgs(args, 2);
	userIDToAliases[userID] = aliases;
	const msg = `Calling \`.${command}\` will now trigger a call to \`.${aliases[command]}\``; 
	sendEmbedMessage(`Alias Created for ${user}`, msg, userID)

	var json = JSON.stringify(userIDToAliases);		
	fs.writeFile('./resources/data/aliases.json', json, 'utf8', log);	
};

/**
 * Gets the alias if it exists for the provided command and user
 * 
 * @param {String} command - the command to check for an alias value
 * @param {String} userID - the ID of the user calling the command
 */
function maybeGetAlias(command, userID) {
	const aliases = userIDToAliases[userID];
	if (aliases) {
		return aliases[command];
	} 
	return null;
};

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
		for (var alias in aliases) {
			msg += `\`.${alias}\` = \`.${aliases[alias]}\``
		}
	}
	sendEmbedMessage(`Aliases Created by ${user}`, msg, userID)	
};

/**
 * Outputs the list of server backups.
 */
function listBackups() {
	var timestamps = [];
	var filesMsg = '';
	fs.readdirSync('../jsonBackups/').forEach(file => {
		const time = moment(file.split('.')[0],'M[-]D[-]YY[@]h[-]mm[-]a')
		timestamps.push(time.valueOf());
	})
	timestamps.sort((a,b) => b - a);
	timestamps.forEach((timestamp) => {
		const time = moment(timestamp).format('M[-]D[-]YY[@]h[-]mm[-]a');
		filesMsg += `\`${time.toString()}\`\n`;
	});
	sendEmbedMessage('Available Backups', filesMsg, c.K_ID)
};

/**
 * Waits for the specified backup file to exist.
 * 
 * @param {String} time - backup timestamp 
 * @param {String} path - backup file path
 * @param {Number} timeout - number of seconds before timing out 
 * @param {Boolean} restart - whether or not the bot should restart on success
 */
function waitForFileToExist(time, path, timeout, restart) {
	const retriesLeft = 15;
	const interval = setInterval(function() {
		if (fs.existsSync(path)) {
			clearInterval(interval);
			sendEmbedMessage('Backup Successfully Created', `**${time}**`, c.K_ID);
			if (restart) {
				restartBot(restart);
			}
		} else if (retriesLeft === 0){
			clearInterval(interval);
			sendEmbedMessage('There Was An Issue Creating The Backup', `**${time}**`, c.K_ID);
		} else {
			retriesLeft--;
		}
	}, timeout);
};

/**
 * Backs the server up.
 * 
 * @param {Boolean} restart - whether or not the bot should restart on success
 */
function backupJson(restart) {
	const time = moment().format('M[-]D[-]YY[@]h[-]mm[-]a');
	config.lastBackup = time;		
	var json = JSON.stringify(config);
	fs.writeFile('./resources/data/config.json', json, 'utf8', log);	
	backup.backup('./resources/data', `../jsonBackups/${time}.backup`);

	const backupPath = `../jsonBackups/${time}.backup`
	waitForFileToExist(time, backupPath, 2000, restart);
};

/**
 * Restores all json files from the specified backup.
 * 
 * @param {String} backupTarget - the timestamp of the backup to restore from
 */
function restoreJsonFromBackup(backupTarget) {
	if (!backupTarget && config.lastBackup) {
		backupTarget = config.lastBackup
	}

	const backupPath = `../jsonBackups/${backupTarget}.backup`
	if (fs.existsSync(backupPath)) {
		const tempDir = './resources/resources';
		backup.restore(backupPath, './resources/');
		setTimeout(() => {
			var spawn = require('child_process').execSync,
				mv = spawn(`mv ${tempDir}/data/* ./resources/data/`);
			fs.rmdirSync(`${tempDir}/data`);
			fs.rmdirSync(tempDir);
			sendEmbedMessage('Data Restored From Backup', `All data files have been restored to the state they were in on ${backupTarget}.`);			
		}, 2000);
	} else {
		sendEmbedMessage('Invalid Backup Specified', `There is no backup for the provided time of ${backupTarget}.`);
	}
};

/**
 * Restarts the bot.
 * 
 * @param {Boolean} update - whether or not the bot should pull from github
 */
function restartBot(update) {
	const updateParam = update || '';
	require('child_process')
	.exec(`restart.sh ${updateParam}`, (error, stdout, stderr) => {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			console.log('exec error: ' + error);
		}
  	});
};

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
 * @param {*} quotedUserID - id of user being quoted
 * @param {*} quotingUserID - id of user creating quote
 * @param {*} channelID - id of the channel quote was found in
 */
function quoteUser(ogMessage, quotedUserID, quotingUserID, channelID) {
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
		if (!bot.getScrubIDToNick()[quotedUserID]) { return; }	
		quoteableMessages.filter((message) => {
			return message.member.id === quotedUserID;
		}).reverse().slice(0, 15);
	}

	const filter = (reaction, user) => (reaction.emoji.name === 'quoteReply' || reaction.emoji.name === 'quoteSave')
		&& user.id === quotingUserID;
	quoteableMessages.forEach((message) => {
		message.awaitReactions(filter, { time: 15000, max: 2})
		.then((collected) => {
			c.LOG.info(`<INFO> ${getTimestamp()}  Collected ${collected.size} reactions: ${inspect(collected)}`);
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
			c.LOG.error(`<ERROR> ${getTimestamp()}  Add Role Error: ${err}`);			
		});
	});
};

/**
 * Outputs quotes.
 * 
 * @param {String} quoteTarget - person to get quotes by
 * @param {String} userID - id of user requesting quotes
 */
function getQuotes(quoteTarget, userID) {
	const scrubIDToNick = bot.getScrubIDToNick();
	var targetName = 'Everyone';
	var targetQuotes = quotes;
	var fields = [];
	if (quoteTarget) {
		const targetID = getIdFromMention(quoteTarget);
		targetName = scrubIDToNick[targetID];
		targetQuotes = quotes.filter((quote) => { return quote.quotedUserID === targetID; });
		targetQuotes.forEach((quote) => {
			fields.push(buildField(moment(quote.time).format('l'), quote.message, 'false'));
		});
	} else {
		targetQuotes.forEach((quote) => {
			fields.push(buildField(scrubIDToNick[quote.quotedUserID], `${quote.message}\n	— ${moment(quote.time).format('l')}`, 'false'));
		});
	}
	if (fields.length > 0) {
		sendEmbedFieldsMessage(`Quotes From ${targetName}`, fields, userID);
	} else {
		sendEmbedMessage('404 Quotes Not Found', `I guess ${targetName} isn't very quoteworthy.`, userID);
	}
};

/**
 * Inserts quotes into the provided message if the user has recently called quoteReply.
 * 
 * @param {Object} message - the message to add the quote to
 */
function maybeInsertQuotes(message) {
	const block = '\`\`\`';
	const replyQuotes = quotingUserIDToQuotes[message.author.id];
	if (!replyQuotes) { return; }
	var quoteBlocks = '';
	const idToNick = bot.getScrubIDToNick();
	replyQuotes.forEach((quote) => {
		const author = idToNick[quote.quotedUserID];
		const time = moment(quote.time).format('l');
		const userMentions = quote.message.match(/<@![0-9]*>/g);
		if (userMentions) {
			userMentions.forEach((mention) => {
				quote.message = quote.message.replace(mention, idToNick[getIdFromMention(mention)]);
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
	message.channel.send(`${quoteBlocks}**${message.member.displayName}** : ${message.content}`);
	quotingUserIDToQuotes[message.author.id] = null;
}

/**
 * Exports the quotes to json.
 */
function exportQuotes() {
	var json = JSON.stringify(quotes);		
	fs.writeFile('./resources/data/quotes.json', json, 'utf8', log);	
}

/**
 * Updates the lotto countdown for use in playing status.
 */
function updateLottoCountdown() {
	if (!config.lottoTime || isDevEnv()) { return; }
	bot.getClient().user.setPresence({game: {name: `lotto ${gambling.getTimeUntilLottoEnd().timeUntil}`}});
}

/**
 * Gets a user's id from the provided mention.
 * 
 * @param {String} userMention - a mention of a user
 */
function getIdFromMention(userMention) {
	return userMention.match(/\d/g).join('');
}

/**
 * Creates a user mention with the provided ID.
 * 
 * @param {String} userID - the id of the user to mention
 */
function mentionUser(userID) {
	return `<@!${userID}>`;
}

/**
 * Creates a role mention with the provided ID.
 * 
 * @param {String} roleID - the id of the role to mention
 */
function mentionRole(roleID) {
	return `<@&${roleID}>`;	
}

/**
 * Creates a channel mention with the provided ID.
 * 
 * @param {String} channelID - the id of the channel to mention
 */
function mentionChannel(channelID) {
	return `<#${channelID}>`;
}

/**
 * Determines if the current environment is Development.
 */
function isDevEnv() {
	return config.env === c.DEV;
}

/**
 * Shows any tip that includes the provided keyword in its title.
 * 
 * @param {String} keyword - tip keyword 
 */
function showTips(keyword) {
	const matchingTips = c.TIPS.filter((tip) => {return tip.title.toLowerCase().includes(keyword);});
	const outputTips = matchingTips.length === 0 ? c.TIPS : matchingTips;
	outputTips.forEach((tip) => {
		bot.getBotSpam().send(new Discord.RichEmbed(tip));
	});		
}

/**
 * Gets the name of the calling function or the provided function.
 * 
 * @param {String} funcName - the name of the function 
 */
function getCallerOrProvided(funcName) {
	return funcName || arguments.callee.caller.caller.name;
}

/**
 * Locks the provided function, stopping it from being callable..
 * 
 * @param {String} funcName - the name of the function 
 */
function lock(funcName) {
	locks[getCallerOrProvided(funcName)] = true;
};

/**
 * Unlocks the provided function, allowing it to be called.
 * 
 * @param {String} funcName - the name of the function 
 */
function unLock(funcName) {
	locks[getCallerOrProvided(funcName)] = false;
};

/**
 * Checks if the provided function is currently locked from calls.
 * 
 * @param {String} funcName - the name of the function 
 */
function isLocked(funcName) {
	return locks[getCallerOrProvided(funcName)];
};

/**
 * Removes the provided element from the array if found.
 * 
 * @param {*[]} array - the array to remove an element from
 * @param {*} element - the element to remove
 */
function maybeRemoveFromArray(array, element) {
	var index = array.indexOf(element);
	
	if (index > -1) {
		array.splice(index, 1);
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
		if (channel.type !== "voice" || !get(channel, 'members.size')) { return; }

		channel.members.array().forEach((member) => {
			if (!member.selfMute || !member.selfDeaf) {
				if (muteAndDeafUserIDToTime[member.id]) {
					delete muteAndDeafUserIDToTime[member.id];
				}
			} else if (!muteAndDeafUserIDToTime[member.id] && !isInPurgatoryOrAFK(channel.id)) {
				muteAndDeafUserIDToTime[member.id] = moment();
				c.LOG.info(`<INFO> ${getTimestamp()}  Adding ${member.displayName} to mute & deaf list.`);				
			}
		});
	});
}

/**
 * Moves mute and deaf members to solitary iff they have been muted and deaf for at least 5 minutes.
 */
function maybeMoveMuteAndDeaf() {
	const members = bot.getMembers();
	const purgatoryVC = bot.getPurgatory();
	const now = moment();
	for (userID in muteAndDeafUserIDToTime) {
		if (now.diff(muteAndDeafUserIDToTime[userID], 'minutes') < 5) { continue; }	
		delete muteAndDeafUserIDToTime[userID];
		const deafMember = members.find('id', userID);
		if (!deafMember) { continue; }
		deafMember.setVoiceChannel(purgatoryVC);
		c.LOG.info(`<INFO> ${getTimestamp()}  Sending ${deafMember.displayName} to solitary for being mute & deaf.`);
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
};

/**
 * Returns true iff the user associated with the provided ID is an admin.
 * 
 * @param {String} userID - id of the user 
 */
function isAdmin(userID) {
	return userID === c.K_ID || userID === c.R_ID;
}

/**
 * Gets the member's actual display name, without playing status box-letters.
 * 
 * @param {Object} nickname - the nickname to strip playing status from
 */
function getTrueDisplayName(nickname) {
	return nickname.split(' ▫ ')[0];
}

/**
 * Bans the user from posting in the provided channel for 2 days.
 * 
 * @param {Object} user - the user to ban 
 * @param {Object} channel - the channel to ban the user from posting in
 */
function banSpammer(user, channel) {
	var usersBans = bannedUserIDToBans[user.id] || [];
	channel.overwritePermissions(user, {
		SEND_MESSAGES: false
	})
	.then(c.LOG.info(`<INFO> ${getTimestamp()}  Banning ${user.displayName} from ${channel.name} for spamming.`))
	.catch((err) => {
		c.LOG.error(`<ERROR> ${getTimestamp()}  Ban - Overwrite Permissions Error: ${err}`);			
	});
	usersBans.push({
		channelID: channel.id, 
		time: moment()
	})
	bannedUserIDToBans[user.id] = usersBans;
	exportBanned();
	channel.send(`🔨 ${mentionUser(user.id)} Enjoy the 2 day ban from ${mentionChannel(channel.id)}, you filthy spammer!`);
}

/**
 * Bans the author of the message from posting in that channel
 * if it was posted 3 times in a row.
 * 
 * @param {Object} message - the message sent in a channel
 */
function maybeBanSpammer(message) {
	if (message.channel.id === c.BOT_SPAM_CHANNEL_ID || message.author.bot) { return; }

	message.channel.fetchMessages({limit: 3})
	.then((oldMessages) => {
		var duplicateMessages = oldMessages.array().filter((oldMsg) => {
			return oldMsg.author.id === message.author.id && oldMsg.content === message.content;
		});
		if (duplicateMessages.length === 3) {
			banSpammer(message.member, message.channel);
		}
	});	
}

/**
 * Lifts the posting ban from the user in the provided channel.
 * 
 * @param {Object} userID - the id of the user to un-ban 
 * @param {Object} channelID - the id of the channel to allow the user to post in
 */
function unBanSpammer(userID, channelID) {
	const channel = bot.getClient().channels.find('id', channelID);
	channel.overwritePermissions(userID, {
		SEND_MESSAGES: true
	})
	.then(c.LOG.info(`<INFO> ${getTimestamp()}  Un-banning ${bot.getScrubIDToNick()[userID]} from ${channel.name} for spamming.`))
	.catch((err) => {
		c.LOG.error(`<ERROR> ${getTimestamp()}  Un-ban - Overwrite Permissions Error: ${err}`);			
	});
	delete bannedUserIDToBans[userID];
	exportBanned();	
	channel.send(`${mentionUser(userID)} Your ban has been lifted, and may now post in ${mentionChannel(channel.id)} again.`)
}

/**
 * Lifts any spamming ban that has been active for at least 2 days.
 */
function maybeUnbanSpammers() {
	for (var userID in bannedUserIDToBans) {
		const bans = bannedUserIDToBans[userID];
		const now = moment();
		bans.forEach((ban) => {
			if (now.diff(ban.time, 'days') >= 2) {
				unBanSpammer(userID, ban.channelID);
			}
		});
	}
}

//-------------------- Public Functions --------------------
exports.addToReviewRole = addToReviewRole;
exports.backupJson = backupJson;
exports.buildField = buildField;
exports.catfacts = catfacts;
exports.compareFieldValues = compareFieldValues;
exports.createAlias = createAlias;
exports.createChannelInCategory = createChannelInCategory;
exports.exportQuotes = exportQuotes;
exports.getIdFromMention = getIdFromMention;
exports.getQuotes = getQuotes;
exports.getRand = getRand;
exports.getScrubIDToNick = getScrubIDToNick;
exports.getTargetFromArgs = getTargetFromArgs;
exports.getTimestamp = getTimestamp;
exports.getTrueDisplayName = getTrueDisplayName;
exports.handleMuteAndDeaf = handleMuteAndDeaf;
exports.help = help;
exports.isAdmin = isAdmin;
exports.isDevEnv = isDevEnv;
exports.isLocked = isLocked;
exports.listBackups = listBackups;
exports.lock = lock;
exports.log = log;
exports.logger = logger;
exports.maybeAddSoundByte = maybeAddSoundByte;
exports.maybeBanSpammer = maybeBanSpammer;
exports.maybeGetAlias = maybeGetAlias;
exports.maybeInsertQuotes = maybeInsertQuotes;
exports.maybeRemoveFromArray = maybeRemoveFromArray;
exports.mentionChannel = mentionChannel;
exports.mentionRole = mentionRole;
exports.mentionUser = mentionUser;
exports.outputAliases = outputAliases;
exports.outputHelpForCommand = outputHelpForCommand;
exports.playSoundByte = playSoundByte;
exports.deleteQuoteTipMsg = deleteQuoteTipMsg;
exports.quoteUser = quoteUser;
exports.removeFromReviewRole = removeFromReviewRole;
exports.restartBot = restartBot;
exports.restoreJsonFromBackup = restoreJsonFromBackup;
exports.scheduleRecurringJobs = scheduleRecurringJobs;
exports.sendEmbedFieldsMessage = sendEmbedFieldsMessage;
exports.sendEmbedMessage = sendEmbedMessage;
exports.setUserColor = setUserColor;
exports.showTips = showTips;
exports.shuffleScrubs = shuffleScrubs;
exports.toggleServerLogRedirect = toggleServerLogRedirect;
exports.unLock = unLock;
exports.updateLottoCountdown = updateLottoCountdown;
exports.updateReadme = updateReadme;
//----------------------------------------------------------
