var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');

var c = require('./const.js');
var bot = require('./bot.js');
const catFacts = require('./catfacts.json');

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
exports.createChannelInCategory = function(command, channelType, channelName, message, createdByMsg, feedback) {
	if (channelName) {
		const description = feedback || ' ';		
		const channelCategoryName = command.charAt(0).toUpperCase() + command.slice(1);
		
		message.guild.createChannel(channelName, channelType)
		.then((channel) => {			
			//Moves channel to the Feedback category
			channel.setParent(c.CATEGORY_ID[channelCategoryName]);
			channel.send(new Discord.MessageEmbed({
				color: 0xffff00,
				title: channelCategoryName + createdByMsg,
				description: description,
			}));	
		})
		.catch(console.error);
		c.LOG.info('<INFO> ' + exports.getTimestamp() + '  ' + channelCategoryName + createdByMsg + '  ' + description);		
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
		meridiem = 'PM';
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
exports.help = function() {
	exports.sendEmbedFieldsMessage('`Help Categories`', c.HELP_CATEGORIES_PROMPT);
	const filter = (m) => {
		var num = parseInt(m.content);
		if (!isNaN(num) && num > 0 && num < 7) {
			return m;
		}
	}
	bot.getBotSpam().awaitMessages(filter, { max: 1, time: 20000, errors: ['time'] })
	.then((collected) => {
		outputHelpCategory(parseInt(collected.array()[0].content)-1);
	})
	.catch(collected => console.log(`After 10 seconds, only ${collected.size}.`));
}