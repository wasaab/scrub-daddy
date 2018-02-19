var Discord = require('discord.js');
var inspect = require('util-inspect');
var Fuse = require('fuse.js');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var util = require('./utilities.js');
var gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');
var blackjack = require("./BlackJack.js")

var config = require('../resources/data/config.json');
var private = require('../../private.json'); 
var client = new Discord.Client();
client.login(private.token);

var fuse = new Fuse(c.COMMANDS, {verbose: false});
var botSpam = {};
var scrubsChannel = {};
var logChannel = {};
var purgatory = {};
var feedbackCategory = {};
var scrubIDtoNick = {};
var quoteBlocked = false;

/**
 * Returns true iff the message is an arrived for duty message.
 * 
 * @param {Object} message - the full message object
 */
function isArrivedForDutyMessage(message) {
	return message.channel.id === c.BOT_SPAM_CHANNEL_ID
			&& message.member.id === c.SCRUB_DADDY_ID 
			&& get (message, 'embeds[0].title') 
			&& message.embeds[0].title.indexOf('duty') !== -1;
}

function scheduleRecurringExportAndVCScan() {
	(function(){
		games.exportTimeSheetAndGameHistory();
		gambling.exportLedger();		
		games.maybeUpdateChannelNames();
		games.maybeChangeAudioQuality(client.channels);
		setTimeout(arguments.callee, 60000);
	})();
}

/**
 * Returns the closest matching command to what was provided.
 */
function findClosestCommandMatch(command) {
	const fuzzyResults = fuse.search(command.toLowerCase());
	if (fuzzyResults.length !== 0) {
		c.LOG.info(`<INFO> ${util.getTimestamp()}	1st: ${c.COMMANDS[fuzzyResults[0]]}, 2nd: ${c.COMMANDS[fuzzyResults[1]]}`);		
		return c.COMMANDS[fuzzyResults[0]];
	}
}

/**
 * Handles valid commands.
 * 
 * @param {Object} message - the full message object.
 */
function handleCommand(message) {
	var args = message.content.substring(1).match(/\S+/g);
	if (!args) { return; }
	if (args[0].startsWith('<@')) {
		args[1] = args[0];
		args[0] = 'quote';
	}
	var userID = message.member.id;	
	var cmd;
	const aliasCmd = util.maybeGetAlias(args[0], userID);
	if (aliasCmd) {
		args = aliasCmd.split(' ');
		cmd = args[0];
	} else {
		cmd = findClosestCommandMatch(args[0]);		
		if (!cmd) { return; }		
		args[0] = cmd;		
	}

	const channelID = message.channel.id;
	const user = message.member.displayName;
	
	if (channelID !== c.BOT_SPAM_CHANNEL_ID && cmd !== 'quote') { return; }
	
	function aliasCalled () {
		if (args.length > 1) {			
			util.createAlias(userID, user, args);
		} else {
			util.outputAliases(userID, user);
		}
	}
	function tempCalled () {
		const channelType = args[1] || 'text';
		const channelName = util.getTargetFromArgs(args, 2) || 'temp-channel';
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
		if (userID === c.K_ID) {
			gambling.exportLedger();
			games.exportTimeSheetAndGameHistory();
		}
	}
	function listBackupsCalled() {
		if (userID === c.K_ID) {			
			util.listBackups();
		}
	}
	function backupCalled() {
		if (userID === c.K_ID) {
			util.backupJson(args[1]);
		}
	}
	function restoreCalled() {
		if (userID === c.K_ID) {
			util.restoreJsonFromBackup(args[1]);
		}
	}
	function restartCalled() {
		if (userID === c.K_ID) {
			util.restartBot(args[1]);
		}
	}
	function logCalled() {
		if (userID === c.K_ID) {
			util.toggleServerLogRedirect(userID);
		}
	}
	function catfactsCalled () {
		util.catfacts(userID);
		message.delete();
	}
	function startLottoCalled() {
		if (args[1] && args[2]) {
			gambling.startLotto(user, userID, args[1], args[2]);
		}
	}
	function lottoCalled() {
		if (args[1] && args[1] === 'check') {
			gambling.checkLotto(userID);
		} else {
			gambling.joinLotto(user, userID);
		}
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
	function blackjackCalled () {
        blackjack.checkUserData(userID, user, args);
        message.delete();
    }
    function hitCalled () {
        blackjack.hitMe(userID, user);
        message.delete();
    }
    function stayCalled () {
        blackjack.stay(userID, user);
    }
	function cleanCalled () {
		gambling.maybeBetClean(userID, args, message);		
	}
	function dischargeCalled () {
		gambling.dischargeScrubBubble(userID); 
	}
	function reviveCalled () {
		if (userID !== c.K_ID) { return; }
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
		if (config.soundBytesEnabled) {
			util.playSoundByte(message.member.voiceChannel, args[1], userID);
		}
	}
	function addSBCalled() {
		if (config.soundBytesEnabled) {
			util.maybeAddSoundByte(message, userID);
		}
	}
	function updateReadmeCalled() {
		if (userID === c.K_ID) {
			util.updateReadme();
		}
	}
	function shuffleScrubsCalled() {
		util.shuffleScrubs(message.guild.members.array(), message.member, args);
	}
	function fortniteStatsCalled() {
		if (args[1] && args[2]) {
			const targetStat = args[3] || 'all';
			games.getFortniteStats(args[2], targetStat, userID, args[1]);
		} else {
			var possibleStats = '';
			c.STATS.forEach((stat) => {
				possibleStats += `${stat}	`;
			});
			util.sendEmbedMessage('Fortnite Stats Help', 'Usage: fortnite-stats <userName> <gameMode> <stat>\n'
				+ 'e.g. fortnite-stats wasaab squad kills\n\n'
				+ 'gameMode options: solo, duo, squad, all\n\n'
				+ `stat options: ${possibleStats}`);	
		}
	}
	function fortniteLeaderboardCalled() {
		if (args[1] && args[2]) {
			games.getFortniteStats(args[1], args[2], userID);
		}
	}
	function setFortniteNameCalled() {
		if (args[1]) {
			games.setFortniteName(userID, args[1]);
		}
	}
	function setStreamCalled() {
		if (args[1]) {
			games.setStreamingUrl(message.member, args[1]);
		}
	}
	function toggleStreamingCalled() {
		games.toggleStreaming(message.member)
	}
	function pCalled () {
		games.askToPlayPUBG();		
	}
	function playingCalled () {
		games.maybeOutputCountOfGamesBeingPlayed(message.guild.members.array(), userID);
		message.delete();
	}
	function heatmapCalled () {
		games.maybeOutputHeatMap(userID);		
	}
	function genHeatMapCalled() {
		if (userID === c.K_ID) {
			games.generateHeatMap();
		}
	}
	function whoPlaysCalled() {
		if (args[1]) {
			games.whoPlays(args, userID);
		} else {
			util.outputHelpForCommand(cmd, userID);			
		}
	}
	function letsPlayCalled() {
		if (args[1]) {
			games.letsPlay(args, userID, user, message.guild.emojis);
		} else {
			util.outputHelpForCommand(cmd, userID);			
		}
	}
	function timeCalled() {
		games.maybeOutputTimePlayed(args, userID);		
	}
	function optInCalled() {
		games.optIn(user, userID);
		message.delete();
	}
	function voteCalled() {
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);					
	}
	function votekickCalled() {
		c.LOG.info(`<VOTE Kick> ${util.getTimestamp()}  ${user}: ${message}`);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.KICK, message.member.voiceChannel, message.guild.roles);		
	}
	function votebanCalled() {
		c.LOG.info(`<VOTE Ban> ${util.getTimestamp()}  ${user}: ${message}`);			
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.BAN, message.member.voiceChannel, message.guild.roles);		
	}
	function voteinfoCalled() {
		if (!args[1]) {
			c.LOG.info(`<VOTE Info Custom> ${util.getTimestamp()}  ${user}: ${message}`);								
			vote.getCustomVoteTotals(userID);
		} else {
			c.LOG.info(`<VOTE Info User> ${util.getTimestamp()}  ${user}: ${message}`);													
			vote.getTotalVotesForTarget(user, userID, message.member.voiceChannel, channelID, args);
		}	
	}
	function quoteCalled() {
		if (quoteBlocked) { return; }
		quoteBlocked = true;
		setTimeout(() => {
			util.quoteTipMsg.delete();
			quoteBlocked = false;
			util.exportQuotes();
		}, 10500);
		util.quoteUser(message, args[1], userID, channelID);
	}
	function quotesCalled() {
		util.getQuotes(args[1], userID);
	}
	function helpCalled() {
		if (args[1]) {
			util.outputHelpForCommand(findClosestCommandMatch(args[1]), userID);				
		} else {
			util.help(userID);
		}
		message.delete();
    }

	var commandToHandler = {
		'alias': aliasCalled,
		'temp': tempCalled,
		'issue': issueOrFeatureCalled,
		'feature': issueOrFeatureCalled,
		'implement': implementCalled,
		'export': exportCalled,
		'list-backups': listBackupsCalled,
		'backup': backupCalled,
		'restore': restoreCalled,
		'restart': restartCalled,
		'log': logCalled,
		'catfacts': catfactsCalled,
		'start-lotto': startLottoCalled,
		'lotto': lottoCalled,
		'army': armyCalled,
		'stats': statsCalled,
		'rank': ranksCalled,
		'ranks': ranksCalled,
		'21':blackjackCalled,
        'hit':hitCalled,
        'stay':stayCalled,
		'clean': cleanCalled,
		'revive': reviveCalled,
		'discharge': dischargeCalled,
		'enlist': enlistCalled,
		'join-review-team': joinReviewTeamCalled,
		'leave-review-team': leaveReviewTeamCalled,
		'color': colorCalled,
		'sb': sbCalled,
		'add-sb': addSBCalled,
		'sb-add': addSBCalled,
		'update-readme': updateReadmeCalled,
		'shuffle-scrubs': shuffleScrubsCalled,
		'fortnite-stats': fortniteStatsCalled,
		'fortnite-leaderboard': fortniteLeaderboardCalled,
		'set-fortnite-name': setFortniteNameCalled,
		'toggle-streaming': toggleStreamingCalled,
		'set-stream': setStreamCalled,
		'p': pCalled,
		'playing': playingCalled,
		'heatmap': heatmapCalled,
		'gen-heatmap': genHeatMapCalled,
		'who-plays': whoPlaysCalled,
		'lets-play': letsPlayCalled,
		'time': timeCalled,
		'opt-in': optInCalled,
		'vote': voteCalled,
		'votekick': votekickCalled,
		'voteban': votebanCalled,
		'voteinfo': voteinfoCalled,
		'quote': quoteCalled,
		'quotes': quotesCalled,
		'help': helpCalled,
		'info': helpCalled,
        'helpinfo': helpCalled
	};

	if (args[1] === 'help') {
		args[1] = args[0];
		c.LOG.info(`<CMD> ${util.getTimestamp()}  help for ${cmd} called`);			
		helpCalled();
	} else {
		c.LOG.info(`<CMD> ${util.getTimestamp()}  ${cmd} called`);			
		return commandToHandler[cmd]();		
	}
}

/**
 * Listen's for messages in Discord
 * TODO: Refactor
 */
client.on('message', (message) => {
	const firstChar = message.content.substring(0, 1);
    //Scrub Daddy will listen for messages that will start with `.`
    if (firstChar === '.') {
		handleCommand(message);
	} else if (isArrivedForDutyMessage(message)) {
		gambling.maybeDeletePreviousMessage(message);
	} else if (firstChar === '!') {
		util.sendEmbedMessage('The Command Prefix Has Changed', 'Use `*` for sb commands and `.` for all others.', message.author.id);
	} else {
		util.maybeInsertQuotes(message);
	}
});

/**
 * listens for updates to a user's presence (online status, game, etc).
 */
client.on('presenceUpdate', (oldMember, newMember) => { 
	const oldGame = get(oldMember, 'presence.game.name');
	const newGame = get(newMember, 'presence.game.name');
	
	//ignore presence updates for bots and online status changes
	if (!newMember.user.bot && newMember.highestRole.name !== 'Pleb' && oldGame !== newGame) {
		games.maybeUpdateNickname(newMember, newGame);			
		games.updateTimesheet(newMember.displayName, newMember.id, newMember.highestRole, oldGame, newGame);
		gambling.maybeDischargeScrubBubble(botSpam);
	}
});

client.on('voiceStateUpdate', (oldMember, newMember) => { 
	//ignore presence updates for bots, mute/unmute, and changing between voice channels
	if (!newMember.user.bot && !newMember.voiceChannel !== !oldMember.voiceChannel) {
		games.maybeUpdateNickname(newMember, get(newMember, 'presence.game.name'));	
	}		
	
});

/**
 * Reconnects the bot if diconnected.
 */
client.on('disconnect', (event) => {
	c.LOG.error(`<ERROR> ${util.getTimestamp()}  event: ${inspect(event)}`);
	client.login(private.token);
});

/**
 * Listens for error events and logs them.
 */
client.on('error', (error) => {
	c.LOG.error(`<ERROR> ${util.getTimestamp()}  message: ${inspect(error)}`);
});

/**
 * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
 */
client.on('ready', () => {
	if (config.lottoTime) {
		client.user.setPresence({game: {name: `lotto ${gambling.getTimeUntilLottoEnd().timeUntil}`}});
	}
	const members = client.guilds.find('id', c.SERVER_ID).members;
	members.forEach((member) => {
		scrubIDtoNick[member.id] = member.displayName;
	});

	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);	
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID).messages;
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);	
	logChannel = client.channels.find('id', c.LOG_CHANNEL_ID);	

	util.scheduleRecurringJobs();
	games.setDynamicGameChannels(client.channels);
	scheduleRecurringExportAndVCScan();	

	c.LOG.info(`<INFO> ${util.getTimestamp()}  Connected`);
});

exports.getBotSpam = () => botSpam;
exports.getScrubsChannel = () => scrubsChannel;
exports.getLogChannel = () => logChannel;
exports.getPurgatory = () => purgatory;
exports.getScrubIDToNick = () => scrubIDtoNick;
exports.getClient = () => client;

		//return the elements of the array that match your conditional
		// var userEntry = usersWhoPlay.filter((player) => {return player.id === userID;});
		//get index of a an object with a specific property value in an array.
		//const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);
		