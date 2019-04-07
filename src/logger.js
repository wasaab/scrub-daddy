const moment = require('moment');
const winston = require('winston');
const Transport = require('winston-transport');

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

/**
 * Gets a timestamp representing the current time.
 *
 * @return {String} properly formatted timestamp
 */
function getTimestamp() {
	return moment().format('ddd h:mm A');
}

const format = winston.format((info) => {
	info.message = `<${info.level.toUpperCase()}> ${getTimestamp()} |	${info.message}`;
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

exports.botLogger = logger;
exports.DiscordServerTransport = DiscordServerTransport;