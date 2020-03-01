const Discord = require('discord.js');
const priv = require('../../private.json');
const BotEventHandler = require('./handlers/BotEventHandler.js');
var client = new Discord.Client();
const eventHandler = new BotEventHandler(client);
var server;
var botSpam;
var scrubsChannel;
var logChannel;
var purgatory;

exports.getBotSpam = function() {
	return botSpam;
};

exports.setBotSpam = function(channel) {
	botSpam = channel;
};

exports.getScrubsChannel = function() {
	return scrubsChannel;
};

exports.setScrubsChannel = function(channel) {
	scrubsChannel = channel;
};

exports.getLogChannel = function() {
	return logChannel;
};

exports.setLogChannel = function(channel) {
	logChannel = channel;
};

exports.getPurgatory = function() {
	return purgatory;
};

exports.setPurgatory = function(channel) {
	purgatory = channel;
};

exports.getClient = function() {
	return client;
};

exports.setClient = function(botClient) {
	client = botClient;
};

exports.getServer = function() {
	return server;
};

exports.setServer = function(botServer) {
	server = botServer;
};

/**
 * Starts the bot if not a test run, otherwise mocks the server.
 */
function maybeStartBot() {
	const testUtil = require('../test/configuration/testUtil.js');

	if (testUtil.isTestRun()) {
		testUtil.mockServer(eventHandler);
	} else {
		eventHandler.createEventHandlers();
		client.login(priv.token);
	}
}

maybeStartBot();