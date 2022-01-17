var schedule = require('node-schedule');
var moment = require('moment');
var Discord = require('discord.js');

var gambling = require('./entertainment/gambling.js');
var prizes = require('./entertainment/prizes.js');
var stocks = require('./entertainment/stocks.js');
var games = require('./entertainment/games.js');
var cars = require('./channelEnhancements/cars.js');
var util = require('./utilities/utilities.js');
var bot = require('./bot.js');
var c = require('./const.js');
const cmdHandler = require('./handlers/cmdHandler.js');

var config = require('../resources/data/config.json');
var reminders = require('../resources/data/reminders.json');
const priv = require('../../private.json');
var previousTip;

/**
 * Schedules a recurring scan of voice channels.
 */
function scheduleRecurringVoiceChannelScan() {
	(function scan(){ //eslint-disable-line
		const { channels } = bot.getClient();

		prizes.maybeResetNames();
		games.maybeUpdateChannelNames();
		games.maybeChangeAudioQuality(channels);
		util.handleMuteAndDeaf(channels);
		setTimeout(scan, 60000);
	})();
}

/**
 * Schedules a recurring export of json files.
 */
function scheduleRecurringExport() {
	(function exportLoop(){ //eslint-disable-line
		games.exportTimeSheetAndGameHistory();
		gambling.exportLedger();
		setTimeout(exportLoop, 70000);
	})();
}

/**
 * Schedules recurring jobs.
 */
exports.scheduleRecurringJobs = function() {
	if (Object.keys(schedule.scheduledJobs).length !== 0) { return; }

	scheduleHourlyJobs();		// Hourly
	updatePlayingStatusTwoOrThreeTimesAnHour(); // 2-3/Hour
	scheduleRecurringVoiceChannelScan(); // Every minute
	scheduleRecurringExport();	// Every 70 seconds
	clearTimesheetAtFiveAM();	// 5 AM
	updateBansAtEightAmAndPM(); // 8 AM/PM
	crawlCarForumAndUpdateStocksAtFivePM();	// 5 PM
	outputTipAndUpdateInvitesAtTenAMFivePMAndElevenPM(); // 10 AM, 5 PM, 11 PM
	activateRainbowRole();
	maybeScheduleReviewJob();
	maybeScheduleLottoEnd();
	scheduleReminders();
};

exports.scheduleLotto = function() {
	schedule.scheduleJob(new Date(config.lottoTime), prizes.endLotto);

	const lottoCountdownRule = new schedule.RecurrenceRule();

	lottoCountdownRule.mintue = 0;
	schedule.scheduleJob(lottoCountdownRule, prizes.updateLottoCountdown);
};

function maybeScheduleLottoEnd() {
	if (!config.lottoTime) { return; }

	if (new Date(config.lottoTime) < new Date()) {
		prizes.endLotto();
	} else {
		exports.scheduleLotto();
	}
}

function activateRainbowRole() {
	util.updateRainbowRoleColor();
}

function maybeUpdateStocks(updateStocksRule) {
	if (util.isDevEnv()) {	return; }

	const stockToInfo = gambling.getLedger()?.[c.SCRUB_DADDY_ID]?.stocks?.stockToInfo;

	if (!stockToInfo) { return; }

	updateStocksRule.dayOfWeek = new schedule.Range(1, 5);

	schedule.scheduleJob(updateStocksRule, stocks.updateStocks);
}

function outputTipAndUpdateInvitesAtTenAMFivePMAndElevenPM() {
	if (util.isDevEnv()) {	return; }

	var tipAndInvitesRule = new schedule.RecurrenceRule();
	tipAndInvitesRule.hour = [10, 17, 23];
	tipAndInvitesRule.minute = 0;

	schedule.scheduleJob(tipAndInvitesRule, () => {
		if (previousTip) {
			previousTip.delete();
		}

		var tip = c.TIPS[util.getRand(0, c.TIPS.length)];

		util.updateServerInvites();
		bot.getBotSpam().send(new Discord.RichEmbed(tip))
			.then((message) => {
				previousTip = message;
			});
	});
}

function updatePlayingStatusTwoOrThreeTimesAnHour() {
	var updatePlayingStatusRule = new schedule.RecurrenceRule();

	updatePlayingStatusRule.minute = config.lottoTime ? [30, 50] : [5, 25, 45];
	schedule.scheduleJob(updatePlayingStatusRule, games.updatePlayingStatus);
}

function scheduleHourlyJobs() {
	var hourlyJobsRule = new schedule.RecurrenceRule();

	hourlyJobsRule.minute = 0;
	schedule.scheduleJob(hourlyJobsRule, function () {
		util.updateMembers();
		util.messageCatFactsSubscribers();
		util.outputBillionaireFact();
		prizes.maybeRemoveRainbowRoleFromUsers();
		games.maybeOutputCountOfGamesBeingPlayed(util.getMembers(), c.SCRUB_DADDY_ID);
		games.checkArkServerStatus();
	});
}

function crawlCarForumAndUpdateStocksAtFivePM() {
	var crawlCarForumRule = new schedule.RecurrenceRule();

	crawlCarForumRule.hour = 17; // 5pm
	crawlCarForumRule.minute = 0;
	schedule.scheduleJob(crawlCarForumRule, cars.crawlCarForum);

	maybeUpdateStocks(crawlCarForumRule);
}

function updateBansAtEightAmAndPM() {
	var updateBansRule = new schedule.RecurrenceRule();

	updateBansRule.hour = [8, 20]; // 8am and 8pm
	updateBansRule.minute = 0;
	schedule.scheduleJob(updateBansRule, util.maybeUnbanSpammers);
}

function clearTimesheetAtFiveAM() {
	var clearTimeSheetRule = new schedule.RecurrenceRule();

	clearTimeSheetRule.hour = 5;
	clearTimeSheetRule.minute = 0;
	schedule.scheduleJob(clearTimeSheetRule, games.clearTimeSheet);
}

function maybeScheduleReviewJob() {
	const reviewJob = priv.job;

	if (!reviewJob || util.isDevEnv()) { return; }

	var reviewRule = new schedule.RecurrenceRule();

	reviewRule[reviewJob.key1] = reviewJob.val1;
	reviewRule[reviewJob.key2] = reviewJob.val2;
	reviewRule[reviewJob.key3] = reviewJob.val3;
	schedule.scheduleJob(reviewRule, function () {
		bot.getBotSpam().send(c.REVIEW_ROLE);
		util.sendEmbed({ image: reviewJob.img });
	});
	reviewRule[reviewJob.key3] = reviewJob.val3 - 3;
	schedule.scheduleJob(reviewRule, function () {
		bot.getBotSpam().send(`${c.REVIEW_ROLE} Upcoming Review. Reserve the room and fire up that projector.`);
	});
}

/**
 * Creates a reminder for a user.
 *
 * @param {Object} cmdMessage	message that called the command
 * @param {String[]} args	the arguments passed by the user
 */
function createReminder(cmdMessage, args) {
	if (args.length < 4 || isNaN(args[1])) { return; }

	const timeAmount = Number(args[1]);
	const timeUnit = args[2];
	const reminderMsg = util.getTargetFromArgs(args, 3);
	const userID = cmdMessage.member.id;
	const duration = moment.duration(timeAmount, timeUnit);

	if (!moment.isDuration(duration) || c.INVALID_DURATION_ISO === duration.toISOString()) {
		cmdMessage.react('❌');
		return;
	}

	const remindTime = moment().add(duration);
	const reminder = {
		time: remindTime.valueOf(),
		message: reminderMsg,
		userID: userID,
		channelID: cmdMessage.channel.id
	};

	reminders[reminders.length] = reminder;
	util.exportJson(reminders, 'reminders');
	scheduleReminder(reminder);
	cmdMessage.react('✅');
	cmdMessage.react('⏰');
}

function scheduleReminders() {
	reminders.forEach(scheduleReminder);
}

function scheduleReminder(reminder, index) {
	schedule.scheduleJob(moment(reminder.time).toDate(), () => {
		const content = `⏰ Reminder - ${util.mentionUser(reminder.userID)}\n\n${reminder.message}`;

		util.sendAuthoredMessage(content, c.SCRUB_DADDY_ID, reminder.channelID);
		reminders.splice(index, 1);
		util.exportJson(reminders, 'reminders');
	});
}

exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('remind-me', createReminder);
};