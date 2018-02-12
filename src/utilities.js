var tinycolor = require("tinycolor2");
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
const mkdirp = require('mkdirp')
const pify = require('pify')
const co = require('co')

var gambling = require('./gambling.js');
var games = require('./games.js');
var bot = require('./bot.js');
var c = require('./const.js');
var public = require('../data/public.json');
var userIDToColor = require('../data/colors.json');
var userIDToAliases = require('../data/aliases.json');
var soundBytes = require('../data/soundbytes.json');
const catFacts = require('../data/catfacts.json');
const private = require('../../private.json'); 

var dropped = 0;
var previousTip = {};
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
exports.createChannelInCategory = function(command, channelType, channelName, message, createdByMsg, userID, feedback) {
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
		exports.sendEmbedMessage(`➕ ${channelCategoryName} Channel Created`, 
			`You can find your channel, \`${channelName}\`, under the \`${channelCategoryName}\` category.`, userID);
		c.LOG.info(`<INFO> ${exports.getTimestamp()}  ${channelCategoryName}${createdByMsg}  ${description}`);		
	}
};

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
exports.logger = new winston.createLogger({
	level: 'info',
	format: winston.format.printf(info => {
		return `${info.message}`;
	}),
	transports: [ new winston.transports.Console() ]
})

/**
 * Toggles the logger redirect to discord text channel on or off.
 */
exports.toggleServerLogRedirect = function(userID) {
	if (c.LOG.transports.length === 2) {
		const discordTransport = c.LOG.transports.find(transport => {
			return transport.constructor.name === 'DiscordServerTransport';
		});
		c.LOG.remove(discordTransport);
		exports.sendEmbedMessage('Server Log Redirection Disabled', 'Server logs will stay where they belong!', userID)		
	} else {
		c.LOG.add(new discordServerTransport());	
		exports.sendEmbedMessage('Server Log Redirection Enabled', 'The server log will now be redirected to `#server-log`', userID)
	}
};

/**
 * Gets a random number between min and max.
 * The maximum is exclusive and the minimum is inclusive
 * 
 * @param {Number} min - the minimum
 * @param {Number} max - the maximum 
 */
exports.getRand = function(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; 
};

/**
 * Gets a timestamp representing the current time.
 * 
 * @return {String} properly formatted timestamp
 */
exports.getTimestamp = function() {
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
exports.log = function(error, response) {
	if (error) {
		c.LOG.error(`<API ERROR> ${exports.getTimestamp()}  ERROR: ${error}`);			
	} else if (response) {
		c.LOG.info(`<API RESPONSE> ${exports.getTimestamp()}  ${inspect(response)}`);
	}
};

/**
 * Builds an embed field object with name and value.
 * 
 * @param {String} name - the name
 * @param {Number} value - the value
 */
exports.buildField = function(name, value) {
	return {
		name: name,
		value: value,
		inline: 'true'
	};
};

/**
 * Comparator for two field objects. Compares values.
 * 
 * @param {Object} a - first field
 * @param {Object} b - second field
 */
exports.compareFieldValues = function(a,b) {
	const aNum = Number(a.value);
	const bNum = Number(b.value);

	if ( aNum > bNum)
	  return -1;
	if (aNum < bNum)
	  return 1;
	return 0;
};

/**
 * Output vote count to bot-spam channel
 */
exports.sendEmbedFieldsMessage = function(title, fields, userID) {
	if (fields.length === 1 && fields[0].name === '') {
		return;
	}

	const color = userIDToColor[userID] || 0xffff00;	
	bot.getBotSpam().send(new Discord.RichEmbed({
		color: color,
		title: title,
		fields: fields
	}));	
};

/**
 * Sends an embed message to bot-spam with an optional title, description, and image.
 */
exports.sendEmbedMessage = function(title, description, userID, image) {
	//these are all optional parameters
	title = title || '';
	description = description || '';
	image = image || '';
	const color = userIDToColor[userID] || 0xffff00;
	
	bot.getBotSpam().send(new Discord.RichEmbed({
		color: color,
		title: title,
		description: description,
		image: {
			url: image
		} 
	}));	
};

/**
 * Gets a map of scrub's ids to nicknames.
 */
exports.getScrubIDToNick = function() {
	return bot.getScrubIDToNick();
};

/**
 * Updates README.md to have the up to date list of commands.
 */
exports.updateReadme = function() {
	var result = '# scrub-daddy\n\nDiscord bot with the following commands:\n';
	c.HELP_CATEGORIES.forEach((category) => {
		result += `\n1. ${category.name.split('\`').join('')}\n`;
		category.fields.forEach((field) => {
			result += `      + ${field.name} - ${field.value}\n`
		});
	});
	fs.writeFile('README.md', result, 'utf8', exports.log);	
};

/**
 * Outputs the help message for the provided command.
 * 
 * @param {String} cmd - the command to get help for
 * @param {String} userID - the userID requesting help
 */
exports.outputHelpForCommand = function(cmd, userID) {
	if (!cmd) { return; }
	c.HELP_CATEGORIES.forEach((category) => {
		category.fields.forEach((command) => {
			if (command.name.substring(1).startsWith(cmd)) {
				exports.sendEmbedMessage(command.name, command.value, userID);
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
	exports.sendEmbedFieldsMessage(helpCategory.name, helpCategory.fields, userID);
}

/**
 * Outputs help dialog to explain command usage.
 */
exports.help = function(userID) {
	exports.sendEmbedFieldsMessage('`📖 Help Categories`', c.HELP_CATEGORIES_PROMPT, userID);
	const filter = (m) => {
		var num = parseInt(m.content);
		if (!isNaN(num) && num > 0 && num < 7) {
			return m;
		}
	};
	bot.getBotSpam().awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] })
	.then((collected) => {
		const response = collected.array()[0];
		outputHelpCategory(parseInt(response.content)-1, userID);
		response.delete();		
	})
	.catch((collected) => {
		c.LOG.info((`After 30 seconds, only ${collected.size} responses.`));
		exports.sendEmbedMessage('Reponse Timed Out', 
			'You have not selected a category, so I\'m not listening to you anymore 😛', userID);
	});
};

/**
 * Outputs a cat fact.
 */
exports.catfacts = function(userID) {
	const factIdx = exports.getRand(0,catFacts.length);
	const msg = `${catFacts[factIdx]}\n 🐈 Meeeeee-WOW!`;
	exports.sendEmbedMessage('Did you know?', msg, userID);
};

/**
 * Schedules a recurring job.
 */
exports.scheduleRecurringJobs = function() {
	const job = private.job;
	if (!job) { return; }
	var reviewRule = new schedule.RecurrenceRule();
	
	reviewRule[job.key1] = job.val1;
	reviewRule[job.key2] = job.val2;
	reviewRule[job.key3] = job.val3;

	schedule.scheduleJob(reviewRule, function(){
		bot.getBotSpam().send(c.REVIEW_ROLE);
		exports.sendEmbedMessage(null, null, null, job.img);
	});

	reviewRule[job.key3] = job.val3 - 3;
	schedule.scheduleJob(reviewRule, function(){
		bot.getBotSpam().send(`${c.REVIEW_ROLE} Upcoming Review. Reserve the room and fire up that projector.`);
	});

	var clearTimeSheetRule = new schedule.RecurrenceRule();
	clearTimeSheetRule.hour = 5;
	
	schedule.scheduleJob(clearTimeSheetRule, function(){
	  games.clearTimeSheet();
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
		if (!firstRun) { 
			previousTip.delete();						
		}
		firstRun = false;
		var tip = c.TIPS[Math.floor(Math.random()*c.TIPS.length)];		
		bot.getBotSpam().send(new Discord.RichEmbed(tip))
		.then((message) => {
			previousTip = message;
		});
	});

	if (public.lottoTime) {
		const lottoTime = public.lottoTime;
		const lottoRule = `0 ${lottoTime.hour} ${lottoTime.day} ${lottoTime.month} *`;
		var endLotto = schedule.scheduleJob(lottoRule, function() {
			c.LOG.info(`<INFO> ${exports.getTimestamp()}  Beyond lotto ending`);		
			gambling.endLotto();
		});	

		var lottoCountdownRule = new schedule.RecurrenceRule();
		lottoCountdownRule.mintue = 0;
		var updateCountdown = schedule.scheduleJob(lottoCountdownRule, function() {	
			bot.getClient().user.setPresence({game: {name: `lotto ${gambling.getTimeUntilLottoEnd().timeUntil}`}});
		});	
	}
};

/**
 * Replaces first letter of all Scrub's nicknames.
 */
exports.shuffleScrubs = function(scrubs, caller, args) {
	if (!caller.roles.find('id', c.BEYOND_ROLE_ID) || (args[1] && args[1].length > 1)) { return; }
	var randLetter = args[1] || c.ALPHABET.substr( Math.floor(Math.random() * 26), 1);
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
exports.addToReviewRole = function(target, roles) {
	target.addRole(roles.find('id', c.REVIEW_ROLE_ID));	
	exports.sendEmbedMessage(null, `Welcome to the team <@!${target.id}>!`, target.id);
};

/**
 * Removes the review role from the provided target.
 */
exports.removeFromReviewRole = function(target, roles) {
	target.removeRole(roles.find('id', c.REVIEW_ROLE_ID));
	exports.sendEmbedMessage(null, `Good riddance. You were never there to review with us anyways, <@!${target.id}>!`, target.id);	
};

/**
 * exports the user color preferences to a json file.
 */
function exportColors(title, description, userID, guild, hex, color) {
	exports.sendEmbedMessage(title, description, userID);	
	//If color not taken, write to colors.json
	if (title.substring(0, 1) !== 'C') {
		var json = JSON.stringify(userIDToColor);		
		fs.writeFile('./data/colors.json', json, 'utf8', exports.log);	
		const target = guild.members.find('id', userID);
		
		if (target.roles.find('id', c.BEYOND_ROLE_ID)) {
			guild.createRole({
				data: {
					name: color,
					color: hex,
					position: guild.roles.array().length - 3
				}
			})
			.then((role) => {
				target.addRole(role);				
			})
			.catch(console.error);
		}
	}
};

/**
 * Sets the user's message response color to the provided color.
 */
exports.setUserColor = function(targetColor, userID, guild) {
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
exports.playSoundByte = function(channel, target, userID) {
	if (!target) {
		var list = '';
		soundBytes.forEach((sound) => {
			list += `\`${sound}\`	`;
		});
		exports.sendEmbedMessage('🎶 Available Sound Bytes', list, userID);
		return;
	}
	if (soundBytes.includes(target.toLowerCase())) {
		channel.join()
		.then((connection) => {
			c.LOG.error(`<INFO> ${exports.getTimestamp()}  Connected to channel!`);			
			const dispatcher = connection.playFile(`./audio/${target}.mp3`);
			
			dispatcher.on('end', () => {
				channel.leave();
			});
		})
		.catch(console.error);
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
			exports.sendEmbedMessage('🎶 Invalid File', 'You must attach a .mp3 file with the description set to `*add-sb`', userID);						
			return;
		}

		yield Promise.all(msg.attachments.map(co.wrap(function *(file) {
			yield retry(() => new Promise((finish, error) => {
				request(file.url)
				.pipe(fs.createWriteStream(`./audio/${file.name.toLowerCase()}`))
				.on('finish', finish)
				.on('error', error)
			}), 3)
			fileName = nameData[0].toLowerCase();
		}.bind(this))))
	}
	catch (err) {
		exports.sendEmbedMessage('🎶 Invalid File', 'You must attach a .mp3 file with the description set to `*add-sb`', userID);			
		return;
	}

	exports.sendEmbedMessage('🎶 Sound Byte Successfully Added', `You may now hear the sound byte by calling \`*sb ${fileName}\` from within a voice channel.`, userID);
	soundBytes.push(fileName);				
	var json = JSON.stringify(soundBytes);
	fs.writeFile('./data/soundbytes.json', json, 'utf8', exports.log);
}.bind(this));

/**
 * Adds the attached soundbyte iff the attachment exists and is an mp3 file.
 */
exports.maybeAddSoundByte = function(message, userID) {
	downloadAttachment(message, userID);
};

/**
 * Builds a target which could be one word or multiple.
 * 
 * @param {String[]} args - command args passed in by user
 * @param {number} startIdx - the start index of your target within args
 */
exports.getTargetFromArgs = function(args, startIdx) {
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
exports.createAlias = function(userID, user, args) {
	const command = args[1];
	var aliases = userIDToAliases[userID] || {};
	aliases[command] = exports.getTargetFromArgs(args, 2);
	userIDToAliases[userID] = aliases;
	const msg = `Calling \`.${command}\` will now trigger a call to \`.${aliases[command]}\``; 
	exports.sendEmbedMessage(`Alias Created for ${user}`, msg, userID)

	var json = JSON.stringify(userIDToAliases);		
	fs.writeFile('./data/aliases.json', json, 'utf8', exports.log);	
};

/**
 * Gets the alias if it exists for the provided command and user
 * 
 * @param {String} command - the command to check for an alias value
 * @param {String} userID - the ID of the user calling the command
 */
exports.maybeGetAlias = function(command, userID) {
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
exports.outputAliases = function(userID, user) {
	const aliases = userIDToAliases[userID];
	var msg = 'None. Call `.help alias` for more info.';
	if (aliases) {
		msg = '';
		for (var alias in aliases) {
			msg += `\`.${alias}\` = \`.${aliases[alias]}\``
		}
	}
	exports.sendEmbedMessage(`Aliases Created by ${user}`, msg, userID)	
};

exports.listBackups = function() {
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
	exports.sendEmbedMessage('Available Backups', filesMsg, c.K_ID)
}

function waitForFileToExist(time, path, timeout, restart) {
	const retriesLeft = 15;
	const interval = setInterval(function() {
		if (fs.existsSync(path)) {
			clearInterval(interval);
			exports.sendEmbedMessage('Backup Successfully Created', `**${time}**`, c.K_ID);
			if (restart) {
				exports.restartBot(restart);
			}
		} else if (retriesLeft === 0){
			clearInterval(interval);
			exports.sendEmbedMessage('There Was An Issue Creating The Backup', `**${time}**`, c.K_ID);
		} else {
			retriesLeft--;
		}
	}, timeout);
};

exports.backupJson = function(restart) {
	const time = moment().format('M[-]D[-]YY[@]h[-]mm[-]a');
	public.lastBackup = time;		
	var json = JSON.stringify(public);
	fs.writeFile('./data/public.json', json, 'utf8', exports.log);	
	backup.backup('./data', `../jsonBackups/${time}.backup`);

	const backupPath = `../jsonBackups/${time}.backup`
	waitForFileToExist(time, backupPath, 2000, restart);
}

exports.restoreJsonFromBackup = function(backupTarget) {
	if (!backupTarget && public.lastBackup) {
		backupTarget = public.lastBackup
	}

	const backupPath = `../jsonBackups/${backupTarget}.backup`
	if (fs.existsSync(backupPath)) {
		backup.restore(backupPath, './data');
		setTimeout(() => {
			var spawn = require('child_process').execSync,
				mv = spawn('mv ./data/data/* data/');
			fs.rmdirSync('./data/data')
			exports.sendEmbedMessage('Json Restored From Backup', `All json files have been restored to the state they were in on ${backupTarget}.`);			
		}, 2000);
	} else {
		exports.sendEmbedMessage('Invalid Backup Specified', `There is no backup for the provided time of ${backupTarget}.`);
	}
}

exports.restartBot = function(update) {
	const updateParam = update || '';
	require('child_process').exec(`restart.sh ${updateParam}`,
	function (error, stdout, stderr) {
	  console.log('stdout: ' + stdout);
	  console.log('stderr: ' + stderr);
	  if (error !== null) {
		console.log('exec error: ' + error);
	  }
  });
}