var Discord = require('discord.js');
var inspect = require('util-inspect');
var Fuse = require('fuse.js');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var util = require('./utilities.js');
var ratings = require('./ratings.js');
var heatmap = require('./heatmap.js');
var gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');
var blackjack = require("./blackjack.js")

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
var quoteBlocked = false;

/**
 * Returns the closest matching command to what was provided.
 */
function findClosestCommandMatch(command) {
	const fuzzyResults = fuse.search(command.toLowerCase());
	if (fuzzyResults.length !== 0) {
		util.logger.info(`<INFO> ${util.getTimestamp()}	1st: ${c.COMMANDS[fuzzyResults[0]]}, 2nd: ${c.COMMANDS[fuzzyResults[1]]}`);
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
	const user = util.getNick(message.member.id);

	//If not called in from bot spam and not a global command, do nothing
	if (channelID !== c.BOT_SPAM_CHANNEL_ID && !c.GLOBAL_COMMANDS.includes(cmd)) { return; }

	function fakeStealAllCalled() {
		if (userID === c.AF_ID || util.isAdmin(userID)) {
			gambling.fakeStealAll();
		}
	}
	function oneMoreCalled() {
		games.letsPlay(args, userID, user, message, true);
	}
	function blackjackCalled() {
        blackjack.checkUserData(userID, user, args);
        message.delete();
    }
	function addSBCalled() {
		if (config.soundBytesEnabled) {
			util.maybeAddSoundByte(message, userID);
		}
    }
	function aliasCalled() {
		if (args.length > 1) {
			util.createAlias(userID, user, args);
		} else {
			util.outputAliases(userID, user);
		}
	}
	function armyCalled() {
        gambling.army(userID, args);
    }
	function backupCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.backupJson(args[1]);
    }
	function catfactsCalled() {
		util.catfacts(userID);
		message.delete();
	}
	function changeCategoryCalled() {
		if (args.length < 4 || channelID !== c.RATINGS_CHANNEL_ID) { return; }
		ratings.changeCategory(args, args[1], args[2], message.channel, userID);
		message.delete();
	}
	function cleanCalled() {
		gambling.maybeBetClean(userID, args, message);
	}
	function colorCalled() {
		if (args[1]) {
			util.setUserColor(args[1], userID, message.guild);
		}
	}
	function createListCalled() {
		if (args[1]) {
			util.createList(args, userID);
		}
	}
	function deleteCalled() {
		if (!util.isAdmin(userID)
			&& !util.isChannelOwner(message.channel, message.member)) { return; }
		util.deleteMessages(message);
	}
	function deleteRatingCalled() {
		if (args.length < 3 || channelID !== c.RATINGS_CHANNEL_ID) { return; }
		ratings.delete(args, args[1], message.channel, userID);
		message.delete();
	}
	function dischargeCalled() {
		gambling.dischargeScrubBubble(userID, args[1]);
	}
	function enlistCalled() {
		gambling.enlist(userID, message);
	}
	function exportCalled() {
		if (!util.isAdmin(userID)) { return; }
		gambling.exportLedger();
		games.exportTimeSheetAndGameHistory();
	}
	function fortniteLeaderboardCalled() {
		if (args[1] && args[2]) {
			games.getFortniteStats(args[1], args[2], userID);
		}
	}
	function fortniteStatsCalled() {
		if (args[1] && args[2]) {
			const targetStat = args[3] || 'all';
			games.getFortniteStats(args[2], targetStat, userID, args[1]);
		} else {
			var possibleStats = '';
			c.STATS.forEach((stat) => {
				possibleStats += `${stat}       `;
			});
			util.sendEmbedMessage('Fortnite Stats Help', 'Usage: fortnite-stats <userName> <gameMode> <stat>\n'
				+ 'e.g. fortnite-stats wasaab squad kills\n\n'
				+ 'gameMode options: solo, duo, squad, all\n\n'
				+ `stat options: ${possibleStats}`);
		}
	}
	function genHeatMapCalled() {
		if (!util.isAdmin(userID)) { return; }
		games.generateHeatMap();
		setTimeout(() => {
			heatmap.uploadToImgur();
		}, 10000);
	}
	function giveCalled() {
		if (args.length === 3) {
			gambling.giveScrubBubbles(userID, user, args[2], args[1]);
		}
	}
	function heatmapCalled() {
		games.maybeOutputHeatMap(userID);
	}
	function helpCalled() {
		if (args[1]) {
			util.outputHelpForCommand(findClosestCommandMatch(args[1]), userID);
		} else {
			util.help(userID);
		}
		message.delete();
    }
	function hitCalled() {
        blackjack.hitMe(userID, user);
        message.delete();
    }
	function implementCalled() {
		args.splice(1, 0, cmd);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);
	}
	function issueOrFeatureCalled() {
		const chanName = args[1];
		const feedback = args.slice(2).join(' ');
		util.createChannelInCategory(cmd, 'text', chanName, message, ` Submitted By ${user}`, userID, feedback);
	}
	function joinReviewTeamCalled() {
		util.addToReviewRole(message.member, message.guild.roles);
	}
	function leaveTempCalled() {
		util.leaveTempChannel(message.channel, userID);
	}
	function leaveReviewTeamCalled() {
		util.removeFromReviewRole(message.member, message.guild.roles);
	}
	function letsPlayCalled() {
		games.letsPlay(args, userID, user, message);
	}
	function listCalled() {
		if (args.length > 2) {
			util.addToList(args, userID);
		} else {
			util.showLists(userID);
		}
	}
	function listBackupsCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.listBackups();
	}
	function logCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.toggleServerLogRedirect(userID);
	}
	function lottoCalled() {
		if (args[1] && args[1] === 'check') {
			gambling.checkLotto(userID);
		} else {
			gambling.joinLotto(user, userID);
		}
	}
	function optInCalled() {
		games.optIn(user, userID);
		message.delete();
	}
	function pCalled() {
		games.askToPlayPUBG();
	}
	function playingCalled() {
		games.maybeOutputCountOfGamesBeingPlayed(message.guild.members.array(), userID);
		message.delete();
	}
	function quoteCalled() {
		if (quoteBlocked) { return; }
		quoteBlocked = true;
		setTimeout(() => {
			util.deleteQuoteTipMsg();
			quoteBlocked = false;
			util.exportQuotes();
		}, 15500);
		util.quoteUser(message, args[1], userID, channelID);
	}
	function quotesCalled() {
		util.getQuotes(args[1], userID);
	}
	function ranksCalled() {
		gambling.armyRanks(userID);
		message.delete();
	}
	function rateCalled() {
		if (args.length < 4 || channelID !== c.RATINGS_CHANNEL_ID || isNaN(args[2])) { return; }
		ratings.rate(args[1], Number(args[2]), args, message.channel, userID);
		message.delete();
	}
	function ratingInfoCalled() {
		if (!args[1]) { return; }
		ratings.ratingInfo(args[1], userID);
		message.delete();
	}
	function ratingsCalled() {
		if (args.length < 3) { return; }
		ratings.outputRatings(Number(args[1]), args[2], args[3]);
		message.delete();
	}
	function refreshRatingsCalled() {
		if (!util.isAdmin(userID)) { return; }
		ratings.updateThirdPartyRatings();
	}
	function renameCalled() {
		ratings.rename(args[1], args, userID, message.channel);
		message.delete();
	}
	function restartCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.restartBot(args[1]);
	}
	function restoreCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.restoreJsonFromBackup(args[1]);
	}
	function reviewMessagesCalled() {
		util.reviewMessages(message.author);
	}
	function reviveCalled() {
		if (!util.isAdmin(userID)) { return; }
		gambling.dischargeScrubBubble(null, args[1]);
	}
	function sbCalled() {
		if (config.soundBytesEnabled) {
			util.playSoundByte(message.member.voiceChannel, args[1], userID);
		}
	}
	function setFortniteNameCalled() {
		if (args[1]) {
			games.setFortniteName(userID, args);
		}
	}
	function setStreamCalled() {
		if (args[1]) {
			games.setStreamingUrl(message.member, args[1]);
		}
	}
	function shuffleScrubsCalled() {
		util.shuffleScrubs(message.guild.members.array(), message.member, args);
	}
	function startLottoCalled() {
		if (args[1] && args[2]) {
			gambling.startLotto(user, userID, args[1], args[2]);
		}
	}
	function statsCalled() {
		gambling.stats(userID, args);
	}
	function stayCalled() {
        blackjack.stay(userID, user);
	}
	function stealCalled() {
		if (args.length === 3 && (userID === c.AF_ID || util.isAdmin(userID))) {
			gambling.fakeSteal(Number(args[1]), args[2], userID)
		}
	}
	function sunkenSailorCalled() {
		games.sunkenSailor(message.member);
	}
	function tempCalled() {
		const channelType = args[1] || 'text';
		const channelName = util.getTargetFromArgs(args, 2) || 'temp-channel';
		util.createChannelInCategory(cmd, channelType, channelName, message, ` Channel Created By ${user}`, userID);
	}
	function timeCalled() {
		games.maybeOutputTimePlayed(args, userID);
	}
	function tipsCalled() {
		util.showTips(args[1]);
	}
	function toggleStreamingCalled() {
		games.toggleStreaming(message.member)
	}
	function unaliasCalled() {
		if (args[1]) {
			util.unalias(args[1], userID);
		}
	}
	function updateReadmeCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.updateReadme();
	}
	function voteCalled() {
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);
	}
	function votebanCalled() {
		util.logger.info(`<VOTE Ban> ${util.getTimestamp()}  ${user}: ${message}`);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.BAN, message.member.voiceChannel, message.guild.roles);
	}
	function voteinfoCalled() {
		if (!args[1]) {
			util.logger.info(`<VOTE Info Custom> ${util.getTimestamp()}  ${user}: ${message}`);
			vote.getCustomVoteTotals(userID);
		} else {
			util.logger.info(`<VOTE Info User> ${util.getTimestamp()}  ${user}: ${message}`);
			vote.getTotalVotesForTarget(user, userID, message.member.voiceChannel, channelID, args);
		}
	}
	function votekickCalled() {
		util.logger.info(`<VOTE Kick> ${util.getTimestamp()}  ${user}: ${message}`);
		vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.KICK, message.member.voiceChannel, message.guild.roles);
	}
	function whoPlaysCalled() {
		games.whoPlays(args, userID);
	}
	function whoSaidCalled() {
		games.startWhoSaidGame(args[1], args[2], args[3], args[4]);
	}

	var commandToHandler = {
		'&nb5::(${162434234357645312})%3': fakeStealAllCalled,
		'1-more': oneMoreCalled,
		'21':blackjackCalled,
		'add-sb': addSBCalled,
		'alias': aliasCalled,
		'army': armyCalled,
		'backup': backupCalled,
		'catfacts': catfactsCalled,
		'change-category': changeCategoryCalled,
		'clean': cleanCalled,
		'color': colorCalled,
		'create-list': createListCalled,
		'delete': deleteCalled,
		'delete-rating': deleteRatingCalled,
		'discharge': dischargeCalled,
		'enlist': enlistCalled,
		'export': exportCalled,
		'feature': issueOrFeatureCalled,
		'fortnite-leaderboard': fortniteLeaderboardCalled,
		'fortnite-stats': fortniteStatsCalled,
		'gen-heatmap': genHeatMapCalled,
		'give': giveCalled,
        'h': helpCalled,
		'heatmap': heatmapCalled,
		'help': helpCalled,
        'hit':hitCalled,
		'implement': implementCalled,
		'info': helpCalled,
		'issue': issueOrFeatureCalled,
		'join-review-team': joinReviewTeamCalled,
		'leave-temp': leaveTempCalled,
		'leave-review-team': leaveReviewTeamCalled,
		'lets-play': letsPlayCalled,
		'list': listCalled,
		'list-backups': listBackupsCalled,
		'log': logCalled,
		'lotto': lottoCalled,
		'opt-in': optInCalled,
		'p': pCalled,
		'playing': playingCalled,
		'quote': quoteCalled,
		'quotes': quotesCalled,
		'rank': ranksCalled,
		'ranks': ranksCalled,
		'rate': rateCalled,
		'ratings': ratingsCalled,
		'rating-info': ratingInfoCalled,
		'refresh-ratings': refreshRatingsCalled,
		'rename': renameCalled,
		'restore': restoreCalled,
		'restart': restartCalled,
		'review-messages': reviewMessagesCalled,
		'revive': reviveCalled,
		'sb': sbCalled,
		'sb-add': addSBCalled,
		'set-fortnite-name': setFortniteNameCalled,
		'set-stream': setStreamCalled,
		'shuffle-scrubs': shuffleScrubsCalled,
		'start-lotto': startLottoCalled,
		'stats': statsCalled,
		'stay': stayCalled,
		'steal': stealCalled,
		'sunken-sailor': sunkenSailorCalled,
		'temp': tempCalled,
		'time': timeCalled,
		'tips': tipsCalled,
		'toggle-streaming': toggleStreamingCalled,
		'unalias': unaliasCalled,
		'update-readme': updateReadmeCalled,
		'vote': voteCalled,
		'voteban': votebanCalled,
		'voteinfo': voteinfoCalled,
		'votekick': votekickCalled,
		'who-plays': whoPlaysCalled,
		'who-said': whoSaidCalled
	};

	if (args[1] === 'help') {
		args[1] = args[0];
		util.logger.info(`<CMD> ${util.getTimestamp()}  help for ${cmd} called`);
		helpCalled();
	} else {
		util.logger.info(`<CMD> ${util.getTimestamp()}  ${cmd} called`);
		return commandToHandler[cmd]();
	}
}

/**
 * Listen's for messages in Discord.
 */
client.on('message', (message) => {
	const firstChar = message.content.substring(0, 1);
    //Scrub Daddy will listen for messages starting with the prefix specified in config.json
    if (firstChar === config.prefix) {
		handleCommand(message);
	} else {
		games.maybeCallLetsPlay(message);
		util.maybeInsertQuotes(message);
		util.maybeBanSpammer(message);
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
		games.updateTimesheet(util.getNick(newMember.id), newMember.id, newMember.highestRole, oldGame, newGame);
		gambling.maybeDischargeScrubBubble();
	}
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
	//ignore presence updates for bots, mute/unmute, and changing between voice channels
	if (!newMember.user.bot && !newMember.voiceChannel !== !oldMember.voiceChannel) {
		games.maybeUpdateNickname(newMember, get(newMember, 'presence.game.name'));
	}
});

/**
 * Listens for a new member joining the server.
 */
client.on('guildMemberAdd', (member) => {
	member.addRole(c.PLEB_ROLE_ID);
	const plebsChannel = client.channels.find('id', c.PLEBS_CHANNEL_ID);
	util.updateMembers();
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
	util.updateMembers();
	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID);
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);
	logChannel = client.channels.find('id', c.LOG_CHANNEL_ID);

	util.scheduleRecurringJobs();
	games.setDynamicGameChannels(client.channels);

	util.logger.info(`<INFO> ${util.getTimestamp()}  Connected`);
	if (util.isDevEnv()) { return; }
	games.updatePlayingStatus();
	util.updateLottoCountdown();
	util.sendEmbedMessage('B A C K⠀O N L I N E !', null, null, c.ONLINE_IMG);
});

exports.getBotSpam = () => botSpam;
exports.getScrubsChannel = () => scrubsChannel;
exports.getLogChannel = () => logChannel;
exports.getPurgatory = () => purgatory;
exports.getClient = () => client;

//return the elements of the array that match your conditional
// var userEntry = usersWhoPlay.filter((player) => {return player.id === userID;});
//get index of a an object with a specific property value in an array.
//const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);