var Fuse = require('fuse.js');
var c = require('../const.js');
const { logger } = require('../logger.js');
var userIdToAliases = require('../../resources/data/aliases.json');
var fuse = new Fuse(c.COMMANDS, { verbose: false });
var commandToHandler = {};

/**
 * Gets the alias if it exists for the provided command and user
 *
 * @param {String} command - the command to check for an alias value
 * @param {String} userID - the ID of the user calling the command
 */
function maybeGetAlias(command, userID) {
	const aliases = userIdToAliases[userID];

	if (!aliases) { return; }

	return aliases[command];
}

/**
 * Returns the closest matching command to what was provided.
 * 
 * @param {String} command word to check for command matches
 * @return {String} matching command name
 */
exports.findClosestCommandMatch = function(command) {
	const fuzzyResults = fuse.search(command.toLowerCase());

	if (fuzzyResults.length === 0) { return; }

	const [ matchingCommandIdx, runnerUpCommandIdx ] = fuzzyResults;

	logger.cmd(`1st: ${c.COMMANDS[matchingCommandIdx]}, 2nd: ${c.COMMANDS[runnerUpCommandIdx]}`);

	return c.COMMANDS[matchingCommandIdx];
};

/**
 * Determines the target command and its arguments.
 * 
 * @param {Objecr} message the message containing a command call
 */
function determineCommandInfo(message) {
	var args = message.content.slice(1).match(/\S+/g);

	if (!args) { return; }

	const aliasCmd = maybeGetAlias(args[0], message.member.id);
	var cmd;

	if (aliasCmd) {
		args = aliasCmd.split(' ');
		cmd = args[0];
	} else if ('@' === args[0].charAt(0)) {
		args.splice(0, 1, ...['@', args[0].slice(1)]);
		cmd = '@';
	} else {
		cmd = exports.findClosestCommandMatch(args[0]);

		if (!cmd) { return; }
		
		args[0] = cmd;
	}

	return { cmd, args };
}

/**
 * Handles valid commands.
 *
 * @param {Object} message - the full message object.
 */
exports.handle = function(message) {
	const commandInfo = determineCommandInfo(message);

	if (!commandInfo) { return; }

	const { cmd, args } = commandInfo;

	if (message.channel.id !== c.BOT_SPAM_CHANNEL_ID && !c.GLOBAL_COMMANDS.includes(cmd)) { return; }

	if (args[1] === 'help') {
		args[1] = args[0];
		logger.cmd(`help for ${cmd} called`);
		commandToHandler.help(message, args);
	} else if (commandToHandler[cmd]){
		logger.cmd(`${cmd} called by ${message.member.displayName} - "${message.content}"`);

		try {
			commandToHandler[cmd](message, args);
		} catch (error) {
			logger.error(`${cmd} command error:`, error);
		}
	}
};

exports.registerCommandHandler = function(command, handler) {
	commandToHandler[command] = handler;
};

exports.setUserIdToAliases = function(updatedUserIdToAliases) {
	userIdToAliases = updatedUserIdToAliases;
};