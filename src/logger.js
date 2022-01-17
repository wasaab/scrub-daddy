const moment = require('moment');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');

const c = require('./const.js');

const isTestRun = process.argv.includes('test/**/?(**)/*.js');

/**
 * Discord server logger.
 *
 * @param {Object[]} opts - logger options
 */
class DiscordServerTransport extends Transport {
	constructor(opts) {
		super(opts);

		this.logChannel = opts.channel;
		this.format = discordLogFormat;
	}

	log(info, callback) {
		const msg = info.message;

		if (msg.length <= 2000) {
			this.logChannel.send(msg);
		}

		callback();
	}
}

/**
 * Gets a timestamp representing the current time.
 *
 * @return {String} properly formatted timestamp
 */
function getTimestamp() {
	return moment().format(c.DAY_HM_DATE_TIME_FORMAT);
}

/**
 * Formats a log message using the info provided.
 * 
 * @param {Object} info log info
 */
function formatLogMsg(info) {
	return `<${info.level.toUpperCase()}> ${getTimestamp()} |	${info.message}`;
}

const logFormat = format.printf((info) => {
	var formattedMessage = formatLogMsg(info);

	if (info.request) {
		formattedMessage += ` | ${info.request.method} ${info.request.path}`;
	}

	if (info.stack) {
		formattedMessage += `\n${info.stack}`;
	}

	return formattedMessage;
});
const discordLogFormat = format.printf((info) => {
	info.message = formatLogMsg(info);

	return info;
});
exports.logger = createLogger({
	levels: {
		error: 0,
		warn: 1,
		info: 2,
		cmd: 3,
		send: 4
	},
	format: logFormat,
	transports: [
		new transports.Console({
			level: isTestRun ? 'send' : 'cmd',
		}),
		new transports.File({
			level: 'cmd',
			dirname: path.resolve('..', 'bot-logs'),
			filename: `bot-${moment().format('M[-]D[-]YY')}.log`
		})
	]
});

exports.DiscordServerTransport = DiscordServerTransport;