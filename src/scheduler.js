var schedule = require('node-schedule');
var Discord = require('discord.js');

var gambling = require('./entertainment/gambling.js');
var games = require('./entertainment/games.js');
var cars = require('./channelEnhancements/cars.js');
var util = require('./utilities/utilities.js');
var bot = require('./bot.js');
var c = require('./const.js');

var config = require('../resources/data/config.json');
const private = require('../../private.json');
var previousTip = {};

/**
 * Schedules a recurring scan of voice channels.
 */
function scheduleRecurringVoiceChannelScan() {
	(function(){
		var client = bot.getClient();
		gambling.maybeResetNames();
		games.maybeUpdateChannelNames();
		games.maybeChangeAudioQuality(client.channels);
		util.handleMuteAndDeaf(client.channels);
		setTimeout(arguments.callee, 60000);
	})();
}

/**
 * Schedules a recurring export of json files.
 */
function scheduleRecurringExport() {
	(function(){
		games.exportTimeSheetAndGameHistory();
		gambling.exportLedger();
		setTimeout(arguments.callee, 70000);
	})();
}

/**
 * Schedules recurring jobs.
 */
exports.scheduleRecurringJobs = function() {
	const reviewJob = private.job;

	if (Object.keys(schedule.scheduledJobs).length !== 0) { return; }

	if (reviewJob) {
		var reviewRule = new schedule.RecurrenceRule();

		reviewRule[reviewJob.key1] = reviewJob.val1;
		reviewRule[reviewJob.key2] = reviewJob.val2;
		reviewRule[reviewJob.key3] = reviewJob.val3;

		schedule.scheduleJob(reviewRule, function(){
			if (util.isDevEnv()) { return; }
			bot.getBotSpam().send(c.REVIEW_ROLE);
			util.sendEmbedMessage(null, null, null, reviewJob.img);
		});

		reviewRule[reviewJob.key3] = reviewJob.val3 - 3;
		schedule.scheduleJob(reviewRule, function(){
			if (util.isDevEnv()) { return; }
			bot.getBotSpam().send(`${c.REVIEW_ROLE} Upcoming Review. Reserve the room and fire up that projector.`);
		});
	}

	var clearTimeSheetRule = new schedule.RecurrenceRule();
	clearTimeSheetRule.hour = 5;
	clearTimeSheetRule.minute = 0;

	schedule.scheduleJob(clearTimeSheetRule, function(){
		games.clearTimeSheet();
	});

	var updateBansRule = new schedule.RecurrenceRule();
	updateBansRule.hour = [8, 20]; // 8am and 8pm
	updateBansRule.minute = 0;
	schedule.scheduleJob(updateBansRule, function(){
		util.maybeUnbanSpammers();
	});

	var crawlCarForumRule = new schedule.RecurrenceRule();
	crawlCarForumRule.hour = [17, 23]; // 5pm and 11pm
	crawlCarForumRule.minute = 0;
	schedule.scheduleJob(crawlCarForumRule, cars.crawlCarForum);

	var updateMembersHeatMapAndCatFactsSubsRule = new schedule.RecurrenceRule();
	updateMembersHeatMapAndCatFactsSubsRule.minute = 0;

	schedule.scheduleJob(updateMembersHeatMapAndCatFactsSubsRule, function(){
		util.updateMembers();
		util.messageCatFactsSubscribers();
		games.maybeOutputCountOfGamesBeingPlayed(util.getMembers(), c.SCRUB_DADDY_ID);
	});

	var updatePlayingStatusRule = new schedule.RecurrenceRule();
	updatePlayingStatusRule.minute = config.lottoTime ? [30, 50] : [5, 25, 45];

	schedule.scheduleJob(updatePlayingStatusRule, function(){
		games.updatePlayingStatus();
	});

	var tipAndInvitesRule = new schedule.RecurrenceRule();
	tipAndInvitesRule.hour = [10, 17, 23];
	tipAndInvitesRule.minute = 0;
	var firstRun = true;
	schedule.scheduleJob(tipAndInvitesRule, function(){
		util.updateServerInvites();

		if (util.isDevEnv()) { return; }
		if (!firstRun) {
			previousTip.delete();
		}

		firstRun = false;
		var tip = c.TIPS[util.getRand(0, c.TIPS.length)];
		bot.getBotSpam().send(new Discord.RichEmbed(tip))
			.then((message) => {
				previousTip = message;
			});
	});

	util.updateServerInvites();

	if (config.lottoTime) {
		exports.scheduleLotto();
	}

	scheduleRecurringExport();
	scheduleRecurringVoiceChannelScan();
};

exports.scheduleLotto = function() {
	schedule.scheduleJob(new Date(config.lottoTime), function () {
		gambling.endLotto();
	});

	var lottoCountdownRule = new schedule.RecurrenceRule();

	lottoCountdownRule.mintue = 0;
	schedule.scheduleJob(lottoCountdownRule, gambling.updateLottoCountdown);
};
