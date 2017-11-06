var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');
var fs = require('fs');
 
var c = require('./const.js');
var util = require('./utilities.js');
var gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');

var private = require('../../private.json'); 
var client = new Discord.Client();
client.login(private.token);

var botSpam = {};
var scrubsChannel = {};
var purgatory = {};
var feedbackCategory = {};
var scrubIDtoNick = {};

/**
 * Returns true iff the message is an arrived for duty message.
 * 
 * @param {Object} message - the full message object
 */
function isArrivedForDutyMessage(message) {
	return message.member.id === c.SCRUB_DADDY_ID 
			&& get (message, 'embeds[0].title') 
			&& message.embeds[0].title.indexOf('duty') !== -1 
			&& message.channel.id === c.BOT_SPAM_CHANNEL_ID;
}

function scheduleRecurringExport() {
	(function(){
		games.exportTimeSheet();
		gambling.exportLedger();		
		setTimeout(arguments.callee, 60000);
	})();
}

/**
 * Handles valid commands.
 * 
 * @param {Object} message - the full message object.
 */
function handleCommand(message) {
	const args = message.content.substring(1).match(/\S+/g);
	const cmd = args[0];
	const channelID = message.channel.id;
	const user = message.member.displayName;
	var userID = message.member.id;
	
	//stops if the message is not from bot-spam text channel, with the exception of the message !p.
	if (channelID !== c.BOT_SPAM_CHANNEL_ID && !(channelID === c.SCRUBS_CHANNEL_ID && cmd === 'p')) {
		return;
	}
	c.LOG.info(`<CMD> ${util.getTimestamp()}  ${cmd} called`);	
	
	function tempCalled () {
		const channelType = args[1] || 'text';
		const channelName = args[2] || 'temp-channel';
		util.createChannelInCategory(cmd, channelType, channelName, message, ` Channel Created By ${user}`, userID);
	}
	function issueOrFeatureCalled () {
		const chanName = args[1];
		const feedback = args.slice(2).join(' ');
		util.createChannelInCategory(cmd, 'text', chanName, message, ` Submitted By ${user}`, userID, feedback);		
	}
	function implementCalled () {
		args.splice(1, 0, cmd);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);		
	}
	function exportCalled () {
		gambling.exportLedger();
		games.exportTimeSheet();
	}
	function catfactsCalled () {
		util.catfacts(userID);
		message.delete();
	}
	function armyCalled () {
		gambling.army(userID, args);		
	}
	function statsCalled () {
		gambling.stats(userID, args);		
	}
	function ranksCalled () {
		gambling.armyRanks(userID);
		message.delete();		
	}
	function cleanCalled () {
		gambling.maybeBetClean(userID, args, message);		
	}
	function dischargeCalled () {
		gambling.dischargeScrubBubble(userID); 
	}
	function reviveCalled () {
		if (userID !== '132944096347160576') { return; }
		userID = 'dev';
		dischargeCalled();
	}
	function enlistCalled () {
		gambling.enlist(userID, message);		
	}
	function joinReviewTeamCalled() {
		util.addToReviewRole(message.member, message.guild.roles);
	}
	function leaveReviewTeamCalled() {
		util.removeFromReviewRole(message.member, message.guild.roles);
	}
	function colorCalled() {
		if (args[1]) {
			util.setUserColor(args[1], userID, message.guild);					
		}
	}
	function sbCalled() {
		util.playSoundByte(message.member.voiceChannel, args[1], userID);
	}
	function addSBCalled() {
		util.maybeAddSoundByte(message, userID);
	}
	function pCalled () {
		games.askToPlayPUBG();		
	}
	function playingCalled () {
		games.getAndOutputCountOfGamesBeingPlayed(message.guild.members.array(), userID);
		message.delete();
	}
	function gameHistoryCalled () {
		games.maybeOutputGameHistory(userID);		
	}
	function timeCalled () {
		games.maybeOutputTimePlayed(args, userID);		
	}
	function optInCalled () {
		games.optIn(user, userID);
		message.delete();
	}
	function voteCalled () {
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);					
	}
	function votekickCalled () {
		c.LOG.info(`<VOTE Kick> ${util.getTimestamp()}  ${user}: ${message}`);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.KICK, message.member.voiceChannel, message.guild.roles);		
	}
	function votebanCalled () {
		c.LOG.info(`<VOTE Ban> ${util.getTimestamp()}  ${user}: ${message}`);			
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.BAN, message.member.voiceChannel, message.guild.roles);		
	}
	function voteinfoCalled () {
		if (!args[1]) {
			c.LOG.info(`<VOTE Info Custom> ${util.getTimestamp()}  ${user}: ${message}`);								
			vote.getCustomVoteTotals(userID);
		} else {
			c.LOG.info(`<VOTE Info User> ${util.getTimestamp()}  ${user}: ${message}`);													
			vote.getTotalVotesForTarget(user, userID, message.member.voiceChannel, channelID, args);
		}	
	}
	function helpCalled () {
		util.help(userID);
		message.delete();
	}
	function colorImportCalled() {
		if (userID === '132944096347160576') {
			util.importColors(message.guild);			
		}
	}

	var commandToHandler = {
		'temp': tempCalled,
		'issue': issueOrFeatureCalled,
		'feature': issueOrFeatureCalled,
		'implement': implementCalled,
		'export': exportCalled,
		'catfacts': catfactsCalled,
		'army': armyCalled,
		'stats': statsCalled,
		'rank': ranksCalled,
		'ranks': ranksCalled,
		'clean': cleanCalled,
		'revive': reviveCalled,
		'discharge': dischargeCalled,
		'enlist': enlistCalled,
		'join-review-team': joinReviewTeamCalled,
		'leave-review-team': leaveReviewTeamCalled,
		'color': colorCalled,
		'sb': sbCalled,
		'add-sb': addSBCalled,
		'color-import': colorImportCalled,
		'p': pCalled,
		'playing': playingCalled,
		'game-history': gameHistoryCalled,
		'time': timeCalled,
		'opt-in': optInCalled,
		'vote': voteCalled,
		'votekick': votekickCalled,
		'voteban': votebanCalled,
		'voteinfo': voteinfoCalled,
		'help': helpCalled,
		'info': helpCalled,
		'helpinfo': helpCalled
	};
	
	if (typeof commandToHandler[cmd] == 'function') { 
		return commandToHandler[cmd]();
	}
}

/**
 * Listen's for messages in Discord
 * TODO: Refactor
 */
client.on('message', (message) => {
	const firstChar = message.content.substring(0, 1);
    //Scrub Daddy will listen for messages that will start with `!`
    if (firstChar === '!') {
		handleCommand(message);
	 } else if (isArrivedForDutyMessage(message)) {
		gambling.maybeDeletePreviousMessage(message);
	} 
});

/**
 * listens for updates to a user's presence (online status, game, etc).
 */
client.on('presenceUpdate', (oldMember, newMember) => { 
	games.updateTimesheet(newMember.displayName, newMember.id, get(oldMember, 'presence.activity.name'), get(newMember, 'presence.activity.name'));
	gambling.maybeDischargeScrubBubble(botSpam);
});

/**
 * Reconnects the bot if diconnected.
 */
client.on('disconnect', (event) => {
	c.LOG.error(`<ERROR> ${util.getTimestamp()}  event: ${inspect(event)}`);
	client.login(private.token);
});

/**
 * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
 */
client.on('ready', () => {
	c.LOG.info(`<INFO> ${util.getTimestamp()}  Connected`);
	
	const members = client.guilds.find('id', c.SERVER_ID).members;
	members.forEach((member) => {
		scrubIDtoNick[member.id] = member.displayName;
	});

	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);	
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID);
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);	
	
	util.scheduleRecurringJobs();
	scheduleRecurringExport();	
});

exports.getBotSpam = () => botSpam;
exports.getScrubsChannel = () => scrubsChannel;
exports.getPurgatory = () => purgatory;
exports.getScrubIDToNick = () => scrubIDtoNick;
exports.getClient = () => client;

