var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');

var c = require('./const.js');
var bot = require('./bot.js');
const catFacts = require('./catfacts.json');

/**
 * For submitting feature requests or issues with the bot.
 * 
 * @param {String} user - the user's name
 * @param {String[]} feedbackMsg - the feedback message split by spaces
 * @param {Object} message - the full message object
 */
exports.submitFeedback = function(user, feedbackMsg, message) {
	if (feedbackMsg[1]) {
		const type = feedbackMsg[0].charAt(0).toUpperCase() + feedbackMsg[0].slice(1);
		var issue = '';
		for (var i=2; i < feedbackMsg.length; i++) {
			issue += feedbackMsg[i] + ' ';
		}	
		
		message.guild.createChannel(feedbackMsg[1], "text")
		.then((channel) => {			
			//Moves channel to the Feedback category
			channel.setParent(c.FEEDBACK_CATEGORY_ID[type]);
			channel.send(new Discord.MessageEmbed({
				color: 0xffff00,
				title: type + ' Submitted By ' + user,
				description: issue,
			}));	
		})
		.catch(console.error);
		c.LOG.info('<INFO> ' + exports.getTimestamp() + '  ' + user + ' submitted issue: ' + issue);		
	}
}

/**
 * initializes the logger.
 */
exports.initLogger = function() {
	c.LOG.remove(c.LOG.transports.Console);
	c.LOG.add(c.LOG.transports.Console, {
    	colorize: true
	});
	c.LOG.level = 'debug';
}

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
}

/**
 * Gets a timestamp representing the current time.
 * 
 * @return {String} properly formatted timestamp
 */
exports.getTimestamp = function() {
	function pad(n) {
			return (n < 10) ? '0' + n : n;
	}

	const time = new Date();
	const day = c.DAYS[time.getDay()];
	var hours = time.getHours();
	var minutes = time.getMinutes();
	var meridiem = 'AM';

	if (hours > 12) {
		hours -= 12;
		meridiem = 'PM'
	} else if (hours === 0) {
		hours = 12;
	}

	return day + ' ' + pad(hours) + ':' + pad(minutes) + ' ' + meridiem;
}

/**
 * Logs the response of an API request for Add Role or Move User.
 * 
 * @param {String} error - error returned from API request
 * @param {Object} response - response returned from API request
 */
exports.log = function(error, response) {
	if (!response) {
		if (!error) {
			c.LOG.info('<API INFO> ' + exports.getTimestamp() + '  Successful API Call');
		} else {
			c.LOG.info('<API RESPONSE> ' + exports.getTimestamp() + '  ERROR: ' + error);			
		}
	} else {
		c.LOG.info('<API RESPONSE> ' + exports.getTimestamp() + '  ' + inspect(response));
	}
}

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
}

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
}

/**
 * Output vote count to bot-spam channel
 */
exports.sendEmbedFieldsMessage = function(title, fields) {
	if (fields.length === 1 && fields[0].name === '') {
		return;
	}

	bot.getBotSpam().send(new Discord.MessageEmbed({
		color: 0xffff00,
		title: title,
		fields: fields
	}));	
}

/**
 * Sends an embed message to bot-spam with an optional title, description, and image.
 */
exports.sendEmbedMessage = function(title, description, image) {
	//these are all optional parameters
	title = title || '';
	description = description || '';
	image = image || '';

	bot.getBotSpam().send(new Discord.MessageEmbed({
		color: 0xffff00,
		title: title,
		description: description,
		image: {
			url: image
		} 
	}));	
}

/**
 * Outputs a cat fact.
 */
exports.catfacts = function() {
	const factIdx = exports.getRand(0,catFacts.length);
	const msg = catFacts[factIdx] + '\n 🐈 Meeeeee-WOW!';
	exports.sendEmbedMessage('Did you know?', msg);
}

/**
 * Gets a map of scrub's ids to nicknames.
 */
exports.getScrubIDToNick = function() {
	return bot.getScrubIDToNick();
}