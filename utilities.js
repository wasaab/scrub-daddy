const c = require('./const.js');
const catFacts = require('./catfacts.json');
const scrubData = require('../scrubData.json');

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
	if (undefined === response) {
		if (null === error || undefined === error) {
			c.LOG.info('<API INFO> ' + exports.getTimestamp() + '  Successful API Call');
		} else {
			c.LOG.info('<API RESPONSE> ' + exports.getTimestamp() + '  ERROR: ' + error);			
		}
	} else {
		c.LOG.info('<API RESPONSE> ' + exports.getTimestamp() + '  ' + response);
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
exports.sendEmbedMessage = function(title, fields) {
	c.BOT.sendMessage({
		to: c.BOT_SPAM_CHANNEL_ID,
		embed:  {
			color: 0xffff00,
			title: title,
			fields: fields
		} 
	});	
}

exports.catfacts = function() {
	const factIdx = exports.getRand(0,catFacts.length);
	c.BOT.sendMessage({
		to: c.BOT_SPAM_CHANNEL_ID,
		embed:  {
			color: 0xffff00,
			title: 'Did you know?',
			description: catFacts[factIdx] + '\n 🐈 Meeeeee-WOW!'
		} 
	});	
}

exports.getScrubIDToNick = function() {
	scrubIDtoNick = {};
	scrubData.forEach(function(member)  {
		scrubIDtoNick[member.id] = member.nick;
	});
	return scrubIDtoNick;
}
