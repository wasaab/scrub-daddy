const winston = require('winston');
const Transport = require('winston-transport');
const util = require('./utilities.js');
const bot = require('./bot.js');
const c = require('./const.js');

/**
 * Console logger.
 *
 * @param {Object[]} opts - logger options
 */
class ConsoleTransport extends Transport {
	constructor(opts) {
        super(opts);
	}

	log(info, callback) {
		console.log(info.message); //eslint-disable-line
		callback();
	}
}

/**
 * Discord server logger.
 *
 * @param {Object[]} opts - logger options
 */
class DiscordServerTransport extends Transport {
	constructor(opts) {
        super(opts);
        this.logChannel = opts.channel;
	}

	log(info, callback) {
		this.logChannel.send(info.message);
		callback();
	}
}

const format = winston.format((info) => {
	info.message = `<${info.level.toUpperCase()}> ${util.getTimestamp()} |	${info.message}`;
	return info;
});

const logger = new winston.createLogger({
	levels: {
		error: 0,
		warn: 1,
		info: 2,
		cmd: 3
	},
	format: format(),
	transports: [ new ConsoleTransport({ level: 'cmd' }) ]
});

/**
 * Enables the server log redirect.
 */
exports.enableServerLogRedirect = function() {
    const logChannel = bot.getLogChannel();

	if (!logChannel) { return; }
	logger.add(new DiscordServerTransport({ level: 'cmd', channel: logChannel }));
};

/**
 * Toggles the logger redirect to discord text channel on or off.
 */
exports.toggleServerLogRedirect = function(userID) {
	if (logger.transports.length === 2) {
		const discordTransport = logger.transports.find((transport) => {
			return transport.constructor.name === 'DiscordServerTransport';
		});

		logger.remove(discordTransport);
		util.sendEmbedMessage('Server Log Redirection Disabled', 'Server logs will stay where they belong!', userID);
	} else {
		exports.enableServerLogRedirect();
		util.sendEmbedMessage('Server Log Redirection Enabled', `The server log will now be redirected to ${util.mentionChannel(c.LOG_CHANNEL_ID)}`, userID);
	}
};

exports.botLogger = logger;