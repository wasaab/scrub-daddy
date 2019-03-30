var Discord = require('discord.js');
var private = require('../../private.json');
var client = new Discord.Client();
var BotEventHandler = require('./BotEventHandler.js');
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

eventHandler.createEventHandlers();
client.login(private.token);