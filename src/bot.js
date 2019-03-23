var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');

var c = require('./const.js');
var util = require('./utilities.js');
var cmdHandler = require('./cmdHandler.js');
var gambling = require('./gambling.js');
var ratings = require('./ratings.js');
var games = require('./games.js');
var cars = require('./cars.js');

var config = require('../resources/data/config.json');
var private = require('../../private.json');
var client = new Discord.Client();

var server;
var botSpam;
var scrubsChannel;
var logChannel;
var purgatory;

client.login(private.token);

/**
 * Listen's for messages in Discord.
 */
client.on('message', (message) => {
	const firstChar = message.content.substring(0, 1);
    //Scrub Daddy will listen for messages starting with the prefix specified in config.json
    if (firstChar === config.prefix) {
		cmdHandler.handle(message);
	} else {
		util.maybeReplicateLol(message);
		games.maybeCallLetsPlay(message);
		util.maybeInsertQuotes(message);
		util.maybeBanSpammer(message);
		gambling.checkForMagicWords(message);
	}
});

/**
 * listens for updates to a user's presence (online status, game, etc).
 */
client.on('presenceUpdate', (oldMember, newMember) => {
	if (util.isDevEnv()) { return; }

	const oldGame = get(oldMember, 'presence.game.name');
	const newGame = get(newMember, 'presence.game.name');

	//ignore presence updates for bots and online status changes
	if (!newMember.user.bot && newMember.highestRole.id !== c.PLEB_ROLE_ID && oldGame !== newGame) {
		games.maybeUpdateNickname(newMember, newGame);
		games.updateTimesheet(util.getNick(newMember.id), newMember.id, newMember.highestRole, oldGame, newGame);
		gambling.maybeDischargeScrubBubble();
	}
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
	if (util.isDevEnv()) { return; }

	//ignore presence updates for bots, mute/unmute, and changing between voice channels
	if (!newMember.user.bot && !newMember.voiceChannel !== !oldMember.voiceChannel) {
		games.maybeUpdateNickname(newMember, get(newMember, 'presence.game.name'));
	}
});

/**
 * Listens for a new member joining the server.
 */
client.on('guildMemberAdd', (member) => {
	if (util.isDevEnv()) { return; }

	member.addRole(c.PLEB_ROLE_ID);
	const plebsChannel = client.channels.find('id', c.PLEBS_CHANNEL_ID);
	util.updateMembers();
	util.addInvitedByRole(member);
	plebsChannel.send(`Welcome to the server, ${util.mentionUser(member.id)}! Check out ${util.mentionChannel(c.NEW_MEMBER_CHANNEL_ID)}.`);
});

/**
 * Reconnects the bot if diconnected.
 */
client.on('disconnect', (event) => {
	util.logger.error(`<ERROR> ${util.getTimestamp()}  event: ${inspect(event)}`);
	client.login(private.token);
});

/**
 * Listens for error events and logs them.
 */
client.on('error', (error) => {
	util.logger.error(`<ERROR> ${util.getTimestamp()}  message: ${inspect(error)}`);
});

/**
 * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
 */
client.on('ready', () => {
	server = client.guilds.find('id', private.serverID);
	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID);
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);
	logChannel = client.channels.find('id', c.LOG_CHANNEL_ID);
	cars.setCarPartsChannel(client.channels.find('id', c.CAR_PARTS_CHANNEL_ID));
	util.updateMembers();

	util.enableServerLogRedirect();
	util.scheduleRecurringJobs();
	games.setDynamicGameChannels(client.channels);

	util.logger.info(`<INFO> ${util.getTimestamp()}  Connected`);

	if (util.isDevEnv()) { return; }

	ratings.updateThirdPartyRatings(true);
	games.updatePlayingStatus();
	util.updateLottoCountdown();
	util.sendEmbedMessage('B A C K⠀O N L I N E !', null, null, c.ONLINE_IMG);
});

exports.getBotSpam = () => botSpam;
exports.getScrubsChannel = () => scrubsChannel;
exports.getLogChannel = () => logChannel;
exports.getPurgatory = () => purgatory;
exports.getClient = () => client;
exports.getServer = () => server;

//return the elements of the array that match your conditional
// var userEntry = usersWhoPlay.filter((player) => {return player.id === userID;});
//get index of a an object with a specific property value in an array.
//const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);