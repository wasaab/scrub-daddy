var Discord = require('discord.js');
var schedule = require('node-schedule');
var tinycolor = require("tinycolor2");
var inspect = require('util-inspect');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var bot = require('./bot.js');
var games = require('./games.js');
const private = require('../../private.json'); 
const catFacts = require('../catfacts.json');
var userIDToColor = require('../colors.json');

var dropped = 0;
var previousMessage = {};


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
		const description = feedback || ' ';		
		const channelCategoryName = command.charAt(0).toUpperCase() + command.slice(1);
		const color = userIDToColor[userID] || 0xffff00;

		const permissions = {
			parent: c.CATEGORY_ID[channelCategoryName],
			overwrites: [{
				allowed: new Discord.Permissions(['MANAGE_CHANNELS', 'MANAGE_ROLES']),
				id: userID,
				type: 'member'
			}]
		};
		message.guild.createChannel(channelName, channelType, permissions)
		.then((channel) => {			
			channel.send(new Discord.MessageEmbed({
				color: color,
				title: channelCategoryName + createdByMsg,
				description: description,
				image: {
					url: c.SETTINGS_IMG
				} 
			}));	
		})
		exports.sendEmbedMessage('Temp Channel Created', `You can find your channel, \`${channelName}\`, under the \`TEMP CHANNELS\` category.`, userID);
		c.LOG.info(`<INFO> ${exports.getTimestamp()}  ${channelCategoryName}${createdByMsg}  ${description}`);		
	}
};

/**
 * initializes the logger.
 */
exports.initLogger = function() {
	c.LOG.remove(c.LOG.transports.Console);
	c.LOG.add(c.LOG.transports.Console, {
    	colorize: true
	});
	c.LOG.level = 'debug';
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
		c.LOG.info(`<API ERROR> ${exports.getTimestamp()}  ERROR: ${error}`);			
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
	bot.getBotSpam().send(new Discord.MessageEmbed({
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
	
	bot.getBotSpam().send(new Discord.MessageEmbed({
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
 * Outputs the help category for the given selection.
 * 
 * @param {number} selection - the category selection
 */
function outputHelpCategory(selection) {
	const helpCategory = c.HELP_CATEGORIES[selection];
	exports.sendEmbedFieldsMessage(helpCategory.name, helpCategory.fields);
}

/**
 * Outputs help dialog to explain command usage.
 */
exports.help = function(userID) {
	exports.sendEmbedFieldsMessage('`Help Categories`', c.HELP_CATEGORIES_PROMPT);
	const filter = (m) => {
		var num = parseInt(m.content);
		if (!isNaN(num) && num > 0 && num < 7) {
			return m;
		}
	};
	bot.getBotSpam().awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] })
	.then((collected) => {
		const response = collected.array()[0];
		outputHelpCategory(parseInt(response.content)-1);
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

	schedule.scheduleJob('*/30 * * * *', function(){
		exports.sendEmbedMessage('Wanna hide all dem text channels?', null, null, c.HELP_HIDE_IMG);
	});
};

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
function exportColors() {
    var json = JSON.stringify(userIDToColor);
	fs.writeFile('colors.json', json, 'utf8', exports.log);
	exports.sendEmbedMessage(title, description, userID);	
};

/**
 * Sets the user's message response color to the provided color.
 */
exports.setUserColor = function(targetColor, userID) {
	var color = tinycolor(targetColor);
	const title = 'User Color Preference Set!';
	const description = 'If the color on the left is not what you chose, then you typed something wrong or did not choose from the provided colors.\n' +
	'You may use any of the colors on this list: http://www.w3.org/TR/css3-color/#svg-color';
	
	if (color) {
		var hex = parseInt(color.toHexString().replace(/^#/, ''), 16);
		userIDToColor[userID] = hex;
	}
	exportColors(title, description, userID);	
};