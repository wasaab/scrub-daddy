var Fuse = require('fuse.js');
var c = require('./const.js');
var util = require('./utilities.js');
var ratings = require('./ratings.js');
var heatmap = require('./heatmap.js');
var gambling = require('./gambling.js');
var trends = require('./trends.js');
var games = require('./games.js');
var vote = require('./vote.js');
var cars = require('./cars.js');
var blackjack = require("./blackjack.js");
var fuse = new Fuse(c.COMMANDS, {verbose: false});

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
exports.handle = function(message) {
	var args = message.content.substring(1).match(/\S+/g);
	if (!args) { return; }

	var userID = message.member.id;
	var cmd;
	const aliasCmd = util.maybeGetAlias(args[0], userID);
	if (aliasCmd) {
		args = aliasCmd.split(' ');
		cmd = args[0];
	} else if ('@' === args[0][0]) {
		args.splice(0,1,...['@', args[0].split('@')[1]]);
		cmd = '@';
	} else {
		cmd = findClosestCommandMatch(args[0]);
		if (!cmd) { return; }
		args[0] = cmd;
	}

	const channelID = message.channel.id;
	const user = util.getNick(message.member.id);

	//If not called in from bot spam and not a global command, do nothing
	if (channelID !== c.BOT_SPAM_CHANNEL_ID && !c.GLOBAL_COMMANDS.includes(cmd)) { return; }

	function mentionGroupCalled() {
		if (args.length < 2) { return; }
		util.mentionGroup(args[1], args, message, message.channel, userID);
		message.delete();
	}
	function oneMoreCalled() {
		games.letsPlay(args, userID, user, message, true);
	}
	function blackjackCalled() {
        blackjack.checkUserData(userID, user, args);
        message.delete();
	}
	function addEmojiCalled() {
		const tierNumber = Number(args[1]);
		if (!gambling.hasPrize(userID, cmd, tierNumber)) { return; }

		gambling.addEmoji(message, args[2], tierNumber, userID, cmd);
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
	function annoyCalled() {
		// TODO: create
		if (!gambling.hasPrize(userID, cmd, Number(args[1]))) { return; }
	}
	function armyCalled() {
        gambling.army(userID, args);
    }
	function backupCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.backupJson(args[1]);
	}
	function carsCalled() {
		if (!util.isAdmin(userID)) { return; }
		cars.crawlCarForum();
	}
	function catfactsCalled() {
		util.outputCatFact(userID);
		message.delete();
	}
	function channelsLeftCalled() {
		util.outputTempChannelsLeftByUser(userID);
	}
	function changeCategoryCalled() {
		if (!args[1] || channelID !== c.RATINGS_CHANNEL_ID) { return; }
		ratings.changeCategory(args, message.channel, userID);
		message.delete();
	}
	function cleanCalled() {
		gambling.maybeBetClean(userID, args, message);
	}
	function colorCalled() {
		if (!args[1]) { return; }
		util.setUserColor(args[1], userID, message.guild);
	}
	function createGroupCalled() {
		if (args.length < 3) { return; }
		util.createGroup(args[1], args, userID);
		message.delete();
	}
	function createListCalled() {
		if (!args[1]) { return; }
		util.createList(args, userID);
	}
	function deleteCalled() {
		if (!util.isAdmin(userID)
			&& !util.isChannelOwner(message.channel, message.member)) { return; }
		util.deleteMessages(message);
	}
	function deleteRatingCalled() {
		if (!args[1] || channelID !== c.RATINGS_CHANNEL_ID) { return; }
		ratings.delete(args, message.channel, userID);
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
		if (!args[1] || !args[2]) { return; }
		games.getFortniteStats(args[1], args[2], userID);
	}
	function fortniteStatsCalled() {
		if (args[1] && args[2]) {
			const targetStat = args[3] || 'all';
			games.getFortniteStats(args[2], targetStat, userID, args[1]);
		} else {
			games.outputFortniteHelp();
		}
	}
	function giveCalled() {
		if (args.length !== 3) { return; }
		gambling.giveScrubBubbles(userID, user, args[2], args[1]);
	}
	function heatmapCalled() {
		heatmap.generateHeatMap(userID);
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
	function ignorePostsCalled() {
		if (channelID !== c.CAR_PARTS_CHANNEL_ID) { return; }
		cars.ignorePosts();
	}
	function inventoryCalled() {
		gambling.outputInventory(userID);
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
	function magicWordCalled() {
		const tierNumber = Number(args[1]);
		if (!gambling.hasPrize(userID, cmd, tierNumber)) { return; }
		message.delete();
		gambling.addMagicWord(args[2], tierNumber, channelID, userID, cmd);
	}
	function missingHelpCalled() {
		if (!util.isAdmin(userID)) { return; }
		util.outputCmdsMissingHelpDocs();
	}
	function moveUserCalled() {
		// TODO: create
		if (!gambling.hasPrize(userID, cmd, Number(args[1]))) { return; }
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
		util.quoteUser(message, args[1], userID, channelID);
	}
	function quotesCalled() {
		util.getQuotes(args[1], userID);
	}
	function rainbowRoleCalled() {
		// TODO: create
		if (!gambling.hasPrize(userID, cmd, Number(args[1]))) { return; }
	}
	function ranksCalled() {
		gambling.armyRanks(userID);
		message.delete();
	}
	function rateCalled() {
		if (args.length < 3 || channelID !== c.RATINGS_CHANNEL_ID) { return; }
		ratings.rate(args[1], Number(args[2]), args, message.channel, userID);
		message.delete();
	}
	function ratingInfoCalled() {
		if (!args[1]) { return; }
		ratings.ratingInfo(args, userID);
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
	function rejoinTempCalled() {
		if (!args[1]) { return; }
		util.rejoinTempChannel(userID, args[1]);
	}
	function removePlayerCalled() {
		if (!util.isAdmin(userID)) { return; }
		games.removePlayer(args);
	}
	function renameCalled() {
		if (!args[1]) { return; }
		ratings.rename(args, userID, message.channel);
		message.delete();
	}
	function renameChannelCalled() {
		const tierNumber = Number(args[1]);

		if (message.mentions.channels.size === 0 || !gambling.hasPrize(userID, cmd, tierNumber)) { return; }
		gambling.renameUserRoleOrChannel('channel', util.getIdFromMention(args[2]), args, tierNumber, userID, cmd, message.mentions);
	}
	function renameHankCalled() {
		const tierNumber = Number(args[1]);

		if (!gambling.hasPrize(userID, cmd, tierNumber)) { return; }
		gambling.renameUserRoleOrChannel('hank', c.H_ID, ['', '', '', 'hang'], tierNumber, userID, cmd, message.guild.members.find('id', c.H_ID));
	}
	function renameRoleCalled() {
		const tierNumber = Number(args[1]);

		if (message.mentions.roles.size === 0 || !gambling.hasPrize(userID, cmd, tierNumber)) { return; }
		gambling.renameUserRoleOrChannel('role', util.getIdFromMention(args[2]), args, tierNumber, userID, cmd, message.mentions);
	}
	function renameUserCalled() {
		const tierNumber = Number(args[1]);

		if (message.mentions.users.size === 0 || !gambling.hasPrize(userID, cmd, tierNumber)) { return; }
		gambling.renameUserRoleOrChannel('user', util.getIdFromMention(args[2]), args, tierNumber, userID, cmd, message.mentions);
	}
	function reserveCalled() {
		gambling.reserve(userID)
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
	function rockCalled() {
		gambling.rock(userID);
	}
	function sbCalled() {
		if (config.soundBytesEnabled) {
			util.playSoundByte(message.member.voiceChannel, args[1], userID);
		}
	}
	function scrubBoxCalled() {
		if (!args[1] || isNaN(args[1])) { return; }
		gambling.scrubBox(userID, Number(args[1]));
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
	function splitGroupCalled() {
		games.splitGroup(message.member);
	}
	function startLottoCalled() {
		if (args.length < 3 || (!gambling.hasPrize(userID, cmd, 3) && !util.isAdmin(userID))) { return; }

		gambling.startLotto(user, userID, args[1], args[2]);
	}
	function statsCalled() {
		gambling.stats(userID, args);
	}
	function stayCalled() {
        blackjack.stay(userID, user);
	}
	function stopLottoCalled() {
		if (!gambling.hasPrize(userID, cmd, 3)) { return; }

		gambling.stopLotto(userID, 3, cmd);
	}
	function stealCalled() {
		if (args.length === 3 && (userID === c.AF_ID || util.isAdmin(userID))) {
			gambling.fakeSteal(Number(args[1]), args[2], userID)
		}
	}
	function stealAllCalled() {
		if (userID === c.AF_ID || util.isAdmin(userID)) {
			gambling.fakeStealAll();
		}
	}
	function subscribeToCatFactsCalled() {
		util.subscribeToCatFacts(userID);
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
	function trendsCalled() {
		trends.outputGameTrendsGraph(args, userID);
	}
	function trendsTotalCalled() {
		trends.ouputTotalPlayerCountGraph(userID);
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
		'@' : mentionGroupCalled,
		'1-more': oneMoreCalled,
		'21': blackjackCalled,
		'add-emoji': addEmojiCalled,
		'add-sb': addSBCalled,
		'alias': aliasCalled,
		'annoy': annoyCalled,
		'army': armyCalled,
		'backup': backupCalled,
		'cars': carsCalled,
		'catfacts': catfactsCalled,
		'channels-left': channelsLeftCalled,
		'change-category': changeCategoryCalled,
		'clean': cleanCalled,
		'color': colorCalled,
		'create-group': createGroupCalled,
		'create-list': createListCalled,
		'delete': deleteCalled,
		'delete-rating': deleteRatingCalled,
		'discharge': dischargeCalled,
		'enlist': enlistCalled,
		'export': exportCalled,
		'feature': issueOrFeatureCalled,
		'fortnite-leaderboard': fortniteLeaderboardCalled,
		'fortnite-stats': fortniteStatsCalled,
		'give': giveCalled,
        'h': helpCalled,
		'heatmap': heatmapCalled,
		'help': helpCalled,
		'hit':hitCalled,
		'ignore-posts': ignorePostsCalled,
		'inventory': inventoryCalled,
		'implement': implementCalled,
		'issue': issueOrFeatureCalled,
		'join-review-team': joinReviewTeamCalled,
		'leave-temp': leaveTempCalled,
		'leave-review-team': leaveReviewTeamCalled,
		'lets-play': letsPlayCalled,
		'list': listCalled,
		'list-backups': listBackupsCalled,
		'log': logCalled,
		'lotto': lottoCalled,
		'magic-word': magicWordCalled,
		'missing-help': missingHelpCalled,
		'move-user': moveUserCalled,
		'opt-in': optInCalled,
		'p': pCalled,
		'playing': playingCalled,
		'quote': quoteCalled,
		'quotes': quotesCalled,
		'rainbow-role': rainbowRoleCalled,
		'rank': ranksCalled,
		'ranks': ranksCalled,
		'rate': rateCalled,
		'ratings': ratingsCalled,
		'rating-info': ratingInfoCalled,
		'refresh-ratings': refreshRatingsCalled,
		'rejoin-temp': rejoinTempCalled,
		'remove-player': removePlayerCalled,
		'rename': renameCalled,
		'rename-channel': renameChannelCalled,
		'rename-hank': renameHankCalled,
		'rename-role': renameRoleCalled,
		'rename-user': renameUserCalled,
		'reserve': reserveCalled,
		'restore': restoreCalled,
		'restart': restartCalled,
		'review-messages': reviewMessagesCalled,
		'revive': reviveCalled,
		'rock': rockCalled,
		'sb': sbCalled,
		'sb-add': addSBCalled,
		'scrub-box': scrubBoxCalled,
		'set-fortnite-name': setFortniteNameCalled,
		'set-stream': setStreamCalled,
		'shuffle-scrubs': shuffleScrubsCalled,
		'split-group': splitGroupCalled,
		'start-lotto': startLottoCalled,
		'stats': statsCalled,
		'stay': stayCalled,
		'stop-lotto': stopLottoCalled,
		'steal': stealCalled,
		'steal-all': stealAllCalled,
		'subscribe-catfacts': subscribeToCatFactsCalled,
		'sunken-sailor': sunkenSailorCalled,
		'temp': tempCalled,
		'time': timeCalled,
		'tips': tipsCalled,
		'toggle-streaming': toggleStreamingCalled,
		'trends': trendsCalled,
		'total-trends': trendsTotalCalled,
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
	} else if (commandToHandler[cmd]){
		util.logger.info(`<CMD> ${util.getTimestamp()}  ${cmd} called`);
		return commandToHandler[cmd]();
	}
}