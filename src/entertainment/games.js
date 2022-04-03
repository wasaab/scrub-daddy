var Discord = require('discord.js');
var inspect = require('util-inspect');
const { spawnSync } = require('child_process');
var txtgen = require('txtgen');
var moment = require('moment');
var GoogleUrl = require('google-url');
var Fuse = require('fuse.js');
var get = require('lodash.get');
var fs = require('fs');
var rp = require('request-promise');
var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var testUtil = require('../../test/configuration/testUtil.js');
const { logger } = require('../logger.js');
const cmdHandler = require('../handlers/cmdHandler.js');
var priv = require('../../../private.json');
var optedInUsers = require('../../resources/data/optedIn.json');		//users that have opted in to playtime tracking
var userIDToFortniteUserName = require('../../resources/data/fortniteUserData.json'); //map of Discord userID to Fortnite username
var userIDToStreamingUrl = require('../../resources/data/streaming.json'); //map of user id to the url of their stream
var gamesPlayed = require('../../resources/data/gamesPlayed.json');	//map of game name to users that play that game
var gameHistory = require('../../resources/data/gameHistory.json');	//timestamped log of player counts for each game
var timeSheet = require('../../resources/data/timeSheet.json');		//map of userID to gameToTimePlayed map for that user
var heatMapData = require('../../resources/data/rawHeatMapData.json');	//Heat map data for every day-hour combo.
var gameChannels = [];		//voice channels that change name based upon what the users are playing
var whoSaidScore = {};
const channelIdToIsBeingRenamed = {};

/**
 * Exports the timesheet to a json file.
 */
exports.exportTimeSheetAndGameHistory = function() {
	util.exportJson(timeSheet, 'timeSheet');
	util.exportJson(gameHistory, 'gameHistory');
	util.exportJson(gamesPlayed, 'gamesPlayed');
};

/**
 * Clears the time sheet and exports jsons. Called at the start of each day.
 */
exports.clearTimeSheet = function() {
	timeSheet = {};
	exports.exportTimeSheetAndGameHistory();
};

/**
 * Gets the name of the game provided as well as the target if one exists
 *
 * @param {String[]} args - input arguments from the user
 */
function getGameNameAndTarget(args) {
	var game = '';
	var target = '';

	for (var i = 1; i < args.length; i++) {
		if (args[i].indexOf('<') === 0) {
			target = args[i];
			break;
		}

		game += ` ${args[i]}`;
	}

	return { game: game.substr(1), target: target };
}

/**
 * Updates the player count heat map.
 */
function updateHeatMap(logTime, playerCount) {
	const dayHourData = heatMapData[logTime.day()][logTime.hour()] || {};
	const count = dayHourData.playerCount || 0;
	const size = dayHourData.sampleSize || 0;

	heatMapData[logTime.day()][logTime.hour()] = {
		playerCount: count + playerCount,
		sampleSize: size + 1
	};
	util.exportJson(heatMapData, 'rawHeatMapData');
}

/**
 * Gets the data of games currently being played by the provided users.
 *
 * @param {Object[]} players group of players to get games of
 */
function getGamesBeingPlayedData(players) {
	var games = [];
	var max = 0;
	var winner = '';
	var total = 0;

	players.forEach((player) => {
		const game = exports.determineActiveGameName(player);
		const status = player.presence?.status;

		if (game && !player.user.bot && player.highestRole.id !== c.PLEB_ROLE_ID && status !== 'idle') {
			games[game] = games[game] ? games[game] + 1 : 1;
			if (games[game] > max) {
				max = games[game];
				winner = game;
			}
			total++;
		}
	});

	return { games: games, winner: winner, total: total, max: max };
}

/**
 * Updates history of games played and player count.
 *
 * @param {Number} time time of update in ms since epoch
 * @param {Number} total total number of players
 * @param {Object[]} games games being played
 */
function determinePlayingFieldsAndUpdateHistory(time, total, games) {
	var fields = [];
	var gamesLog = {
		time: time,
		playerCount: total,
		gameData: []
	};

	for (var gameID in games) {
		const gameData = {
			game: gameID,
			count: games[gameID],
			time: time
		};

		fields.push(util.buildField(gameID, games[gameID]));
		gamesLog.gameData.push(gameData); //log timestamp and player count for each game
	}

	gameHistory.push(gamesLog);

	return fields;
}

/**
 * Gets and outputs the player count of every game currently being played,
 * unless called from recurring job, in which case it stores the result without outputting it.
 */
exports.maybeOutputCountOfGamesBeingPlayed = function(scrubs, userID) {
	const { games, winner, total } = getGamesBeingPlayedData(scrubs);
	const time = moment();

	if (userID === c.SCRUB_DADDY_ID) {
		updateHeatMap(time, total);
	} else {
		const imageUrl = c.GAME_NAME_TO_IMG[winner] ?? c.THUMBS_UP_GIF;
		const fields = determinePlayingFieldsAndUpdateHistory(time, total, games);

		util.sendEmbedMessage(`🏆 Winner - ${winner}`, null, userID, imageUrl);
		fields.sort(util.compareFieldValues);
		util.sendEmbedFieldsMessage(`🎮 Player Count - ${total}`, fields, userID);
	}
};

/**
 * Updates the bot's playing status.
 */
exports.updatePlayingStatus = function() {
	var { winner, max } = getGamesBeingPlayedData(util.getMembers());

	if (winner === '') {
		winner = 'nothing';
	}

	const pplEmojiIdx = max > 5 ? 5 : max;
	const newStatus = `${winner} - ${max} ${c.PPL_EMOJIS[pplEmojiIdx]}`;

	bot.getClient().user.setPresence({ game: { name: newStatus } });
};

/**
 * Gets the play time of the game provided.
 *
 * @param {Object} currentlyPlaying - the game finished or currently being played
 */
function getTimePlayed(currentlyPlaying) {
	const dayStartTime = moment().startOf('day').add(5, 'hours');
	var playStartTime = moment(currentlyPlaying.start);

	if (playStartTime.isBefore(dayStartTime) && moment().isAfter(dayStartTime)) {
		playStartTime = dayStartTime;
	}

	return Math.abs(moment().diff(playStartTime, 'hours', true));
}

/**
 * Gets the provided users playtime for a specific game.
 *
 * @param {String} userID - id of the user to get playtime of
 * @param {String} gameName - name of the game to get playtime of
 */
function getUsersPlaytimeForGame(userID, gameName) {
	const userEntry = timeSheet[userID];

	if (!userEntry) {
		return 0;
	}

	var playtime = userEntry[gameName];
	var currentlyPlaying = userEntry.playing;

	//if the target user is currently playing the game
	if (playtime && currentlyPlaying && currentlyPlaying.name === gameName) {
		playtime += getTimePlayed(currentlyPlaying);
	}

	return playtime;
}

/**
 * Gets the cumulative play time of everyone on the server for the provided game.
 * Can also get cumulative time for all games.
 *
 * @param {String} gameName - the game to get play time for
 */
function getCumulativeTimePlayed(gameName, target) {
	var cumulativeTimePlayed = {
		total: 0,
		gameToTime: {}
	};
	var userToTimes = timeSheet;

	//if a target is provided get cumulative time played of their games
	if (target !== '') {
		userToTimes = {};
		userToTimes[target] = timeSheet[target];
	}

	for (const userID in userToTimes) {
		//get time of all games
		if (gameName === '') {
			const gameToTime = userToTimes[userID];

			for (const game in gameToTime) {
				if (game === 'playing') { continue; }

				const playtime = getUsersPlaytimeForGame(userID, game);

				if (!playtime) { continue; }
				if (!cumulativeTimePlayed.gameToTime[game]) {
					cumulativeTimePlayed.gameToTime[game] = 0;
				}

				cumulativeTimePlayed.gameToTime[game] += playtime;
				cumulativeTimePlayed.total += playtime;
			}
		} else {
			const timePlayed = getUsersPlaytimeForGame(userID, gameName);

			if (timePlayed) {
				cumulativeTimePlayed.total += timePlayed;
			}
		}
	}

	return cumulativeTimePlayed;
}

/**
 * Checks if the provided user has opted into playtime tracking.
 *
 * @param {String} user - the user to check
 */
function isOptedIn(user) {
	if (!util.isMention(user)) { return false; }

	user = util.getIdFromMention(user);

	if (optedInUsers.indexOf(user) === -1) {
		return false;
	}

	return true;
}

/**
 * Outputs the cumulative playtime.
 *
 * @param {Object} timePlayedData
 */
function outputCumulativeTimePlayed(timePlayedData, userID) {
	var fields = [];
	fields.push(util.buildField('All Games', timePlayedData.total.toFixed(1)));

	for (var gameName in timePlayedData.gameToTime) {
		const playtime = timePlayedData.gameToTime[gameName];

		fields.push(util.buildField(gameName, playtime.toFixed(1)));
	}

	fields.sort(util.compareFieldValues);
	util.sendEmbedFieldsMessage('🕒 Cumulative Hours Played', fields, userID);
	logger.info(`Cumulative Hours Played All Games: ${inspect(fields)}`);
}

/**
 * Gets and outputs the time played for the game by the user(s) provided in args.
 *
 * @param {String[]} args - input arguments from the user
 */
exports.maybeOutputTimePlayed = function(args, userID) {
	var { game, target } = getGameNameAndTarget(args);

	logger.info(`Time Called - game: ${game} target: ${target}`);

	if (target !== '' && !isOptedIn(target)) {
		util.sendEmbed({ description: 'I do not track that scrub\'s playtime.', userID });
		logger.info(`${target} is not opted in.`);
		return;
	}

	if (util.isMention(target)) {
		target = util.getIdFromMention(target);
	}

	var timePlayedData = getCumulativeTimePlayed(game, target);

	if (Object.keys(timePlayedData.gameToTime).length === 0) {
		const fields = [util.buildField(game, timePlayedData.total.toFixed(1))];

		util.sendEmbedFieldsMessage('🕒 Hours Played', fields, userID);
		logger.info(`Hours Played: ${inspect(fields)}`);
	} else {
		outputCumulativeTimePlayed(timePlayedData, userID);
	}
};

/**
 * Gets the user data for the provided game.
 *
 * @param {String} gameName - the game to find players of
 */
function getGameUserData(gameName, fuzzyThreshold) {
	const options = { ...c.WHO_PLAYS_FUZZY_OPTIONS, threshold: fuzzyThreshold };
	const fuse = new Fuse(gamesPlayed, options);
	const [game] = fuse.search(gameName);

	return game ?? {};
}

function buildWhoPlaysFields(usersWhoPlay) {
	var fields = [];

	usersWhoPlay.sort((a, b) => {
		if (isNaN(b.time - a.time)) {
			return isNaN(a.time) ? 1 : -1;
		}

		return b.time - a.time;
	});

	usersWhoPlay.forEach((user) => {
		const lastPlayed = isNaN(user.time) ? 'N/A' : moment(user.time).format(c.MDY_HM_DATE_TIME_FORMAT);
		const name = util.getNick(user.id);

		if (name) {
			fields.push(util.buildField(name, `\`${lastPlayed}\``));
		}
	});

	if (fields.length !== 2 && fields.length % 3 === 2) {
		fields.push(util.buildField('\u200B', '\u200B'));
	}

	return fields;
}

/**
 * Outputs list users who play the same games as the provided user and last time played.
 *
 * @param {String} userID id of user to get shared games for
 */
function whoPlaysUsersGames(userID) {
	//get the games played by userID that at least 1 other person plays
	var sharedGames = gamesPlayed.filter((game) => {
		if (game.users.length < 2) { return false; }
		const userEntryIdx = game.users.map((user) => user.id).indexOf(userID);
		return userEntryIdx !== -1;
	});
	if (sharedGames.length === 0) { return; }

	//sort sharedGames by length of users array within each game.
	sharedGames.sort((a, b) => b.users.length - a.users.length);

	var legendMsg = '';
	var gamesOutput = [];

	sharedGames.slice(0, 10).forEach((game, index) => {
		var fields = buildWhoPlaysFields(game.users);
		gamesOutput.push({
			name: `Users Who Play ${game.title} / Last Time Played`,
			fields: fields
		});
		legendMsg += `**${index}**.	${game.title}\n`;
	});

	util.sendDynamicMessage(userID, 'game', gamesOutput);
	util.sendEmbedMessage('Legend for Who Plays', legendMsg, userID);
}

/**
 * Outputs the users who play the provided game, as well as when they last played.
 *
 * @param {Object} message	message that called backup-json command
 * @param {String[]} args	the arguments passed by the user
 */
exports.whoPlays = function(message, args) {
	const userID = message.member.id;

	if (!args[1]) {
		whoPlaysUsersGames(userID);
		return;
	}

	const game = util.getTargetFromArgs(args, 1);
	const gameUserData = getGameUserData(game, 0.3);
	const usersWhoPlay = gameUserData.users;

	logger.info(`Who Plays ${game} - ${inspect(gameUserData)}`);

	if (usersWhoPlay) {
		const fields = buildWhoPlaysFields(usersWhoPlay);

		util.sendEmbedFieldsMessage(`Users Who Play ${gameUserData.title} / Last Time Played`, fields, userID);
	} else {
		util.sendEmbedMessage('Literally Nobody Plays That', 'We are all judging you now.', userID);
	}
};

/**
 * Excludes the provided user from who-plays based on role membership and last time played.
 *
 * @param {Boolean} allFlagProvided whether or not the user added the all flag
 * @param {Object} user user to consider excluding
 */
function shouldExcludeUserFromLetsPlay(allFlagProvided, user) {
	return !allFlagProvided && (user.role === c.SUPER_SCRUBS_ROLE_ID || !user.time
		|| moment().diff(moment(user.time), 'days') > 8);
}

function maybeAddCurrPlayingToArgs(args, user, gameIdx) {
	if (args.length !== gameIdx) { return; }

	const currPlaying = exports.determineActiveGameName(user);

	if (currPlaying) {
		args[gameIdx] = currPlaying;
	}
}

/**
 * @Mentions every user that plays the provided game, asking them if they want to play.
 */
exports.letsPlay = function(args, userID, message, oneMore, customMessage) {
	const { emojis } = message.guild;
	const allFlagProvided = '-all' === args[1];
	const gameIdx = allFlagProvided ? 2 : 1;

	maybeAddCurrPlayingToArgs(args, message.member, gameIdx);

	//If no game provided and user is not currently playing a game, output help
	if (args.length === gameIdx) { return util.outputHelpForCommand('lets-play', userID); }

	var game = util.getTargetFromArgs(args, gameIdx).replace(/:/g, '');
	const gameUserData = getGameUserData(game, 0.3);
	var usersWhoPlay = gameUserData.users;
	var msg = '';

	logger.info(`Lets Play ${game} - ${inspect(gameUserData)}`);

	if (!usersWhoPlay) { return util.sendEmbedMessage('Literally Nobody Plays That', 'You\'re on your own bud.', userID); }

	if (customMessage) {
		msg += `\`@${gameUserData.title}\` ${customMessage}`;
	} else {
		const oneMoreMsg = oneMore ? 'We need **1** more for ' : '';
		const punctuation = oneMore ? '!' : '?';

		game = emojis.find('name', util.capitalizeFirstLetter(game)) || game;
		msg += `${oneMoreMsg}${game}${punctuation}`;
	}

	usersWhoPlay.forEach((user) => {
		if (shouldExcludeUserFromLetsPlay(allFlagProvided, user)) { return; }

		msg += ` ${util.mentionUser(user.id)}`;
	});

	util.sendAuthoredMessage(msg, userID, c.SCRUBS_CHANNEL_ID);
};

/**
 * Calls lets play if the discord game invitiation was sent by a user.
 *
 * @param {Object} message message sent by user
 */
exports.maybeCallLetsPlay = function(message) {
	const game = message.member?.presence?.game?.name;

	if (message.author.bot || message.content !== '' || message.attachments.size !== 0
		|| message.type !== 'DEFAULT' || !game) { return; }

	exports.letsPlay(['', game], message.member.id, message);
};

/**
 * Determines the updated users who play a game.
 *
 * @param {Object{}} usersWhoPlay users who play the game
 * @param {String} userID id of calling user
 * @param {Object} role target role
 * @param {Boolean} isRemoval whether or not this is a remove user call
 */
function determineUpdatedUsersWhoPlay(usersWhoPlay, userID, role, isRemoval) {
	if (usersWhoPlay) {
		const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);
		const newEntry = { id: userID, time: moment().valueOf(), role: role.id };

		if (userEntryIdx === -1) {
			usersWhoPlay.push(newEntry);
		} else if (isRemoval) {
			usersWhoPlay.splice(userEntryIdx, 1);
		} else {
			usersWhoPlay.splice(userEntryIdx, 1, newEntry);
		}
	} else {
		usersWhoPlay = [{ id: userID, time: moment().valueOf(), role: role.id }];
	}

	return usersWhoPlay;
}

/**
 * Updates the games played for the provided user.
 */
function updateWhoPlays(userID, role, gameName, isRemoval) {
	if (!gameName) { return; }

	const game = gamesPlayed.find(({ title }) => title.toLowerCase() === gameName.toLowerCase());
	const gameUserData = getGameUserData(gameName, 0);
	const usersWhoPlay = determineUpdatedUsersWhoPlay(gameUserData.users, userID, role, isRemoval);

	if (game) {
		game.users = usersWhoPlay;
	} else {
		gamesPlayed.push({
			title: gameName,
			users: usersWhoPlay
		});
	}
}

/**
 * Adds or removes a player from list of user who play a game.
 *
 * @param {Object} message - the message calling the cmd
 * @param {Object} message.member - the calling member
 * @param {String[]} args arguments provided to the command
 */
function forceAddOrRemovePlayer({ member }, args) {
	const [cmd, playerMention] = args;

	if (!util.isAdmin(member.id) || !util.isMention(playerMention)) { return; }

	updateWhoPlays(
		util.getIdFromMention(playerMention),
		{ id: c.SCRUBS_ROLE_ID },
		util.getTargetFromArgs(args, 2),
		cmd.startsWith('remove')
	);
}

/**
 * Updates the time played for a game when the user finishes playing it.
 *
 * @param {Object} gameToTime - map of game to time played
 * @param {userName} userName - name of the user whos playtime is being updated
 */
function getUpdatedGameToTime(gameToTime, userName) {
	var currentlyPlaying = gameToTime.playing;

	if (currentlyPlaying) {
		var hoursPlayed = getTimePlayed(currentlyPlaying);
		logger.info(`Presence Update - ${userName} finished a ${hoursPlayed.toFixed(4)}hr session of ${currentlyPlaying.name}`);
		gameToTime[currentlyPlaying.name] += hoursPlayed;
		gameToTime.playing = null;
	}
	return gameToTime;
}

/**
 * Updates the provided users timesheet.
 *
 * @param {String} user - name of the user
 * @param {String} userID - id of the user
 * @param {String} highestRole - the user's highest role
 * @param {String} oldGame - name of the game the user finished playing
 * @param {String} newGame - name of the game the user started playing
 */
exports.updateTimesheet = function(user, userID, highestRole, oldGame, newGame) {
	logger.info(`Presence Update - ${user} id: ${userID} old game: ${oldGame} new game: ${newGame}`);

	//get user's timesheet
	var gameToTime = timeSheet[userID];
	if (!gameToTime) {
		gameToTime = {};
	}

	//finished playing a game
	if (oldGame) {
		gameToTime = getUpdatedGameToTime(gameToTime, user);
	}
	//started playing a game
	if (newGame) {
		gameToTime.playing = { name: newGame, start: getCurrentTimeMillis() };
		if (!gameToTime[newGame]) {
			gameToTime[newGame] = 0;
		}
	}

	timeSheet[userID] = gameToTime;
	updateWhoPlays(userID, highestRole, oldGame);
};

/**
 * Gets the current time in milliseconds.
 */
function getCurrentTimeMillis() {
	return testUtil.isTestRun() ? testUtil.getMockCurrentTime() : new Date().getTime();
}

/**
 * Waits for the provided number of seconds and then sends a scrub daddy fact.
 *
 * @param {Number} attempts - loop iterator
 * @param {Number} seconds - duration of each loop
 */
function waitAndSendScrubDaddyFact(attempts, seconds, userID) {
	if (testUtil.isTestRun()) { return; }

	setTimeout(() => {
		if (attempts === seconds) {
			const title = '➕ You are now subscribed to Scrub Daddy Facts!';
			const image = c.SCRUB_DADDY_FACT;

			util.sendEmbed({ title, userID, image });
		} else {
			waitAndSendScrubDaddyFact(attempts + 1, seconds);
		}
	}, 1000);
}

/**
 * Opts all users out of playtime tracking.
 */
exports.optOutAllUsers = function() {
	optedInUsers = [];
};

/**
 * opts a user into playtime tracking
 *
 * @param {String} user - the name of the user to opt in
 * @param {String} userID - the ID of the user to opt in
 */
exports.optIn = function(userID) {
	const userName = util.getNick(userID);

	if (optedInUsers.includes(userID)) {
		util.sendEmbedMessage(
			`You are already opted-in ${userName}`,
			`Pray I do not opt you in further.`,
			userID
		);
		return;
	}

	var fields = [];

	optedInUsers.push(userID);
	fields.push(util.buildField(userName, '👀 I\'m watching you.'));
	util.sendEmbedFieldsMessage('👀 YOU ARE BEING WATCHED', fields, userID);
	waitAndSendScrubDaddyFact(0, 5, userID);
	logger.info(`${userName} (${userID}) has opted into time`);
	util.exportJson(optedInUsers, 'optedIn');
};

/**
 * Determines what game the majority of the users are playing
 * in the provided voice channel.
 *
 * @param {Obejct} voiceChannel - the voice channel to find the majority game for.
 */
function determineMajorityGame(voiceChannel) {
	const majority = voiceChannel.members.size / 2;
	var gameToCount = {};
	var result = null;

	voiceChannel.members.some((member) => {
		const game = exports.determineActiveGameName(member);

		if (!game) { return false; }

		if (gameToCount[game]) {
			gameToCount[game]++;
		} else {
			gameToCount[game] = 1;
		}

		if (gameToCount[game] > majority) {
			result = game.replace('B', '🅱️');

			return true;
		}
	});

	return result;
}

/**
 * Sets the provided channel's name back to its default.
 *
 * @param {Object} voiceChannel - the voice channel to reset the name of
 */
function resetChannelName(voiceChannel) {
	const defaultName = c.GAME_CHANNEL_NAMES[voiceChannel.id];

	if (voiceChannel.name === defaultName) { return; }

	logger.info(`Resetting Channel Name - ${voiceChannel.name} -> ${defaultName}`);
	voiceChannel.setName(defaultName);
}

/**
 * Sets the provided channel's name to the game being played by the
 * majority of users in the channel.
 *
 * @param {Object} channel - the voice channel to set name of
 * @param {String} majorityGame - the name of the game played by majority of users
 */
function setChannelNameToMajorityGame(channel, majorityGame) {
	const fuse = new Fuse([channel.name], c.CHANNEL_NAME_FUZZY_OPTIONS);

	// only rename if the name is not already up to date
	if (fuse.search(`▶ ${majorityGame}`).length !== 0 || channelIdToIsBeingRenamed[channel.id]) { return; }

	const updateNameLogMsg = `Updating Channel Name - ${channel.name} -> ▶ ${majorityGame}`;

	channelIdToIsBeingRenamed[channel.id] = true;
	logger.info(updateNameLogMsg);
	channel.setName(`▶ ${majorityGame}`)
		.then(() => {
			logger.info(`FINISHED ${updateNameLogMsg}`);
			channelIdToIsBeingRenamed[channel.id] = false;
		})
		.catch(util.log);
}

/**
 * Updates the dynamic voice channel names if the majority is playing a game.
 */
exports.maybeUpdateChannelNames = function() {
	gameChannels.forEach((channel) => {
		if (channel.members.size === 0) {
			resetChannelName(channel);
			return;
		}

		const majorityGame = determineMajorityGame(channel);

		if (!majorityGame) {
			resetChannelName(channel);
			return;
		}

		setChannelNameToMajorityGame(channel, majorityGame);
	});
};

/**
 * Determines if the member is eligible to experience high quality voice.
 *
 * @param {Object} member - the member to check eligibility of
 * @returns {Boolean} whether the member is eligible for HQ voice
 */
function isEligibileForHighQualityVoice(member) {
	return member.roles.find('id', c.BEYOND_ROLE_ID)
		|| member.roles.find('id', c.BILLIONAIRE_ROLE_ID)
		|| member.selfDeaf;
}

/**
 * Raises audio quality for channels with only beyond members. Vice versa for all others.
 *
 * @param {Object[]} channels - the server's channels
 */
exports.maybeChangeAudioQuality = function(channels) {
	channels.forEach((channel) => {
		if (channel.type !== "voice") { return; }

		const memberCount = channel.members?.size;

		if (!memberCount) { return; }

		const beyondCount = channel.members.array()
			.filter(isEligibileForHighQualityVoice)
			.length;

		if (memberCount === beyondCount && channel.bitrate !== c.MAX_BITRATE) {
			setAudioQuality(channel, c.MAX_BITRATE);
		} else if (channel.bitrate === c.MAX_BITRATE && memberCount !== beyondCount) {
			setAudioQuality(channel, c.MIN_BITRATE);
		}
	});
};

function setAudioQuality(channel, bitrate) {
	const actionMsg = bitrate === c.MAX_BITRATE ? 'Raising' : 'Lowering';

	channel.setBitrate(bitrate)
		.then(logger.info(`${actionMsg} Channel Bitrate - ${channel.name}`))
		.catch((err) => {
			logger.error(`set VC bitrate error: ${err}`);
		});
}

/**
 * Populates the array of dynamic voice channels.
 *
 * @param {Object[]} channels - the server's channels
 */
exports.setDynamicGameChannels = function(channels) {
	Object.keys(c.GAME_CHANNEL_NAMES).forEach((channelID) => {
		gameChannels.push(channels.find('id', channelID));
	});
};

/**
 * Sets the user's streaming url for use with toggle-streaming.
 */
exports.setStreamingUrl = function(member, url) {
	const shortener = new GoogleUrl({ key: priv.googleUrlApiKey });

	shortener.shorten(url, (err, shortUrl) => {
		if (!shortUrl) { return; }
		if (err) {
			logger.error('Failed to shorten url: ', err);
			return;
		}

		userIDToStreamingUrl[member.id] = shortUrl;
		util.exportJson(userIDToStreamingUrl, 'streaming');
		util.sendEmbedMessage(
			`Stream Url Set For ${util.getNick(member.id)}`,
			`Your stream can be watched at ${shortUrl}`
		);
	});

};

/**
 * Toggles nickname streaming icon.
 */
exports.toggleStreaming = function(member) {
	if (member.displayName.includes('📺')) {
		member.setNickname(member.displayName.split('📺')[0].slice(0, -1));
	} else {
		const url = userIDToStreamingUrl[member.id] || '?';
		var name = member.displayName;
		if (name.length > 16) {
			name = name.slice(0, 16);
		}
		member.setNickname(`${name} 📺@${url.split('//')[1]}`);
	}
};

/**
 * Determines the active game of the provided member.
 *
 * @param {Object} member - the member to determine the game of
 */
exports.determineActiveGameName = function(member) {
	const gameName = member.presence?.game?.name;

	if (c.CUSTOM_STATUS === gameName) { return; }

	return gameName;
};

/**
 * Updates the provided users nickname to contain the game they
 * just started playing.
 *
 * @param {Object} member - the member to update name of
 * @param {String} game - the game they are playing
 */
exports.maybeUpdateNickname = function(member, game) {
	const nameTokens = member.displayName.split(' ▫ ');
	const status = member.presence?.status;

	if (game && member.voiceChannel && status !== 'idle') {
		logger.info(`${nameTokens[0]} is playing ${game}`);
		if (game === `Sid Meier's Civilization VI`) {
			game = 'C I V 6';
		}
		const gameTokens = game.split(' ');
		var nick = `${nameTokens[0]} ▫ `;
		gameTokens.forEach((token) => {
			var firstChar = token.charAt(0).toUpperCase();
			if (!(/[a-zA-Z0-9]/).test(firstChar)) {
				firstChar = token;
			}
			nick += c.ENCLOSED_CHARS[firstChar] || firstChar;
		});
		logger.info(`Updating Nickname - ${member.displayName} -> ${nick}`);
		member.setNickname(nick);
	} else if (nameTokens[1]) {
		logger.info(`Updating Nickname - ${member.displayName} -> ${nameTokens[0]}`);
		member.setNickname(nameTokens[0]);
	}
};

/**
 * Outputs help for the fortnite stats commands.
 */
exports.outputFortniteHelp = function () {
	var possibleStats = '';
	c.STATS.forEach((stat) => {
		possibleStats += `${stat}       `;
	});
	util.sendEmbedMessage('Fortnite Stats Help', 'Usage: fortnite-stats <userName> <gameMode> <stat>\n'
		+ 'e.g. fortnite-stats wasaab squad kills\n\n'
		+ 'gameMode options: solo, duo, squad, all\n\n'
		+ `stat options: ${possibleStats}`);
};

/**
 * Retrieves Fortnite stats for the provided player or shows leaderboard in stat/mode for all players
 */
exports.getFortniteStats = function(gameMode, stat, callingUserID, fortniteUserName) {
	function requestStats(userID) {
		options.uri += fortniteUserName || userIDToFortniteUserName[userID];
		options.uri = encodeURI(options.uri);

		rp(options).then(function (response) {
			const player = JSON.parse(response);

			if (gameMode && c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]) {
				if (gameMode === 'all') {
					var allFields = [];

					get(player, c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]).forEach((category) => {
						allFields.push(util.buildField(category.key, category.value));
					});
					util.sendEmbedFieldsMessage(`Fortnite Lifetime Stats for ${util.getNick(userID)}`, allFields, callingUserID);
				} else {
					const statKeyBase = `${c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]}.${stat}`;
					const { label, displayValue, percentile } = player[statKeyBase];
					const gameModeTitle = util.capitalizeFirstLetter(gameMode);

					if (fortniteUserName) {
						const title = `Fortnite ${gameModeTitle} ${label} for ${fortniteUserName}`;

						util.sendEmbedMessage(title, `${displayValue}\nTop ${percentile}% in the world`, callingUserID);
					} else if (label) {
						fields.push(util.buildField(util.getNick(userID), displayValue));

						if (!statTitleLabel) {
							statTitleLabel = label;
						}
					}
				}
			}
		})
			.catch(function (err) {
				logger.error(`ERROR: ${err}`);
			})
			.finally(() => {
				if (userIDs.length > 0 && !fortniteUserName) {
					options.uri = baseUri;
					requestStats(userIDs.pop());
				} else if (fields.length > 0) {
					fields.sort(util.compareFieldValues);
					util.sendEmbedFieldsMessage(`Fortnite ${gameModeTitle} ${statTitleLabel} Leaderboard`, fields, callingUserID);
				}
			});
	}

	const gameModeTitle = util.capitalizeFirstLetter(gameMode);
	var userIDs = Object.keys(userIDToFortniteUserName);
	var fields = [];
	var statTitleLabel;
	const baseUri = 'http://api.fortnitetracker.com/v1/profile/pc/';

	var options = {
		uri: baseUri,
		method: 'GET',
		headers: {
			'TRN-Api-Key': priv.trnApiKey
		}
	};

	//get stats of @mentioned user
	if (util.isMention(fortniteUserName)) {
		const matchedName = userIDToFortniteUserName[util.getIdFromMention(fortniteUserName)];
		if (matchedName) {
			fortniteUserName = matchedName;
			requestStats();
		} else {
			util.sendEmbedMessage(
				'Fortnite Stats Lookup Error',
				'The provided user does not have their Fortnite account linked to Scrub Daddy.',
				callingUserID
			);
		}
	} else {
		requestStats(userIDs.pop());
	}
};

/**
 * Stores the user's fortnite username
 */
exports.setFortniteName = function(userID, args) {
	var userNameStartIdx = 1;
	//if called by admin and first argument is a mention
	if (util.isAdmin(userID) && util.isMention(args[1])) {
		userID = util.getIdFromMention(args[1]);
		userNameStartIdx = 2;
	}
	const userName = util.getTargetFromArgs(args, userNameStartIdx);
	userIDToFortniteUserName[userID] = userName;
	util.exportJson(userIDToFortniteUserName, 'fortniteUserData');
};

/**
 * Sends the sunken sailor message to a user via DM.
 *
 * @param {Object} user user to send dm to
 * @param {Boolean} isSunken whether or not they are the sunken sailor
 */
function sendSunkenSailorMessage(user, isSunken) {
	user.createDM()
		.then((dm) => {
			dm.send(generateSunkenSailorSentence(isSunken));
		});
}

/**
 * Generates the sunken sailor sentence templates.
 *
 * @param {String} secretWord secret word to include in sentence
 */
function generateSunkenSailerSentenceTemplates(secretWord) {
	const nounArg = '{{noun}}';
	var originalSentenceTemplates = txtgen.getTemplates();

	var nounSentenceTemplates = [];
	var sunkenSentenceTemplate;

	util.shuffleArray(originalSentenceTemplates);

	originalSentenceTemplates.forEach((template) => {
		if (template.includes(nounArg)) {
			nounSentenceTemplates.push(template.replace(nounArg, `**${secretWord}**`));
		} else if (!sunkenSentenceTemplate) {
			sunkenSentenceTemplate = template;
		}
	});

	txtgen.setTemplates(nounSentenceTemplates);

	return { nounTemplate: nounSentenceTemplates, sunkenTemplate: sunkenSentenceTemplate };
}

/**
 * Generates a sunken sailor sentence.
 *
 * @param {Boolean} isSunken whether or not the user is the sunken sailor
 * @param {Object} template sentence template for nouns or sunken
 */
function generateSunkenSailorSentence(isSunken, template) {
	const templates = isSunken ? [template.sunkenTemplate] : template.nounTemplate;

	txtgen.setTemplates(templates);

	return txtgen.sentence();
}

/**
 * Starts a game of sunken sailor.
 *
 * @param {Object} callingMember member starting the game
 */
exports.sunkenSailor = function(callingMember) {
	if (!callingMember.voiceChannel) { return; }

	var players = callingMember.voiceChannel.members.array();

	if (players.length < 2) { return; }

	util.shuffleArray(players);
	util.sendEmbedMessage(
		'Sunken Sailor Round Started',
		`Feel free to join in https://aggie.io/${priv.aggieIoRoomId}. You must be in the voice channel to participate.`
	);
	var nouns = fs.readFileSync('./resources/data/nouns.json'); //585 nouns
	nouns = JSON.parse(nouns);
	const secretWord = nouns[util.getRand(0, 585)];
	const template = generateSunkenSailerSentenceTemplates(secretWord);

	for (var i = 0; i < players.length - 1; i++) {
		sendSunkenSailorMessage(players[i], false, template);
	}
	sendSunkenSailorMessage(players[players.length - 1], true, template);
	util.shuffleArray(players);
	var turnOrderMsg = '';
	players.forEach((player, index) => {
		turnOrderMsg += `\`${index + 1}.\`  **${util.getNick(player.id)}**\n`;
	});
	util.sendEmbedMessage('Sunken Sailor Turn Order', turnOrderMsg);
};

/**
 * Gets up to 5 random quotes that match the provided criteria.
 *
 * @param {Object} channel - channel to get quotes from
 * @param {Number} minLength - minimum length required to include msg
 * @param {Number} minReactions - minimum reactions required to include msg
 * @param {Number} sampleSize - number of messages to scan
 */
function getRandomQuotes(channel, minLength = 15, minReactions = 0, sampleSize = 100) {
	channel = bot.getServer().channels.find('name', channel) || bot.getScrubsChannel();

	return channel.fetchMessages({ limit: sampleSize })
		.then((foundMessages) => {
			var matchingQuotes = foundMessages.array().filter(isQuotableMsg(minLength, minReactions));

			util.shuffleArray(matchingQuotes);

			return matchingQuotes.slice(0, 5);
		});
}

/**
 * Determines if a message is quoteable, based on length and reactions.
 *
 * @param {Number} minLength min length of required
 * @param {Number} minReactions min reaction required
 */
function isQuotableMsg(minLength, minReactions) {
	return (message) => message.content && message.content.length >= minLength
		&& message.reactions.size >= minReactions
		&& !message.author.bot;
}

/**
 * Gets the image from the message contents if found.
 *
 * @param {String} content content of message
 */
function maybeGetImageFromContent(content) {
	const images = content.match(/\bhttps?:\/\/\S+\.(png|jpeg|jpg|gif)(\s|$)/gi);
	if (!images) { return null; }
	return images[util.getRand(0, images.length)];
}

/**
 * Mentions a group of users with a custom message.
 *
 * @param {Object} message	message that called mention group command
 * @param {String[]} args	the arguments passed by the user
 */
exports.mentionGroup = function(message, args) {
	if (args.length < 2) { return; }

	const userID = message.member.id;
	const groupName = args[1];
	const customMessage = util.getTargetFromArgs(args, 2);
	const { group, name } = util.getGroup(groupName);

	if (!group) {
		//If no group found and called from bot spam or scrubs channel, trigger a call to letsPlay with groupName
		if (c.BOT_SPAM_CHANNEL_ID === message.channel.id || c.SCRUBS_CHANNEL_ID === message.channel.id) {
			const letsPlayArgs = ['lets-play', groupName];
			exports.letsPlay(letsPlayArgs, userID, message, false, customMessage);
		} else { //If no group found and called from any other channel, trigger a call to mentionChannelsPowerUsers
			util.mentionChannelsPowerUsers(message.channel, customMessage, userID);
		}
	} else if (Array.isArray(group)) { //Mention the group of users retrieved from getGroup
		var msg = `\`@${name}\` ${customMessage}`;
		group.forEach((groupMemberID) => {
			msg += ` ${util.mentionUser(groupMemberID)}`;
		});
		util.sendAuthoredMessage(msg, userID, c.SCRUBS_CHANNEL_ID);
	} else { //Trigger a call to letsPlay with title retrieved from getGroup
		const letsPlayArgs = ['lets-play', ...group.split(' ')];
		exports.letsPlay(letsPlayArgs, userID, message, false, customMessage);
	}

	message.delete();
};

/**
 * Outputs the next user in the group. Used for determining turn.
 *
 * @param {String} groupName name of group to pick next user from
 * @param {String} userID id of calling user
 */
exports.roundRobin = function(groupName, userID) {
	const { group, name } = util.getGroup(groupName);

	if (!group || !group.includes(userID)) { return; }

	const winningUser = group.shift();

	group.push(winningUser);
	util.modifyGroup(name, group);
	util.sendEmbedMessage('Round Robin', `${util.mentionUser(winningUser)} you're up!`, winningUser);
};

/**
 * Outputs a random splitting of the users in the same voice channel. Used for determining teams.
 *
 * @param {Object} callingMember member who called the command
 */
exports.splitGroup = function(callingMember) {
	if (!callingMember.voiceChannel) { return; }

	var players = callingMember.voiceChannel.members.array();
	if (players.length < 2) { return; }

	util.shuffleArray(players);
	var turnOrderMsg = '';
	players.forEach((player, index) => {
		turnOrderMsg += `\`${index + 1}.\`  **${util.getNick(player.id)}**\n`;
	});
	util.sendEmbedMessage('Randomized Group Split', turnOrderMsg);
};

/**
 * End a game of who said.
 */
function endWhoSaidGame() {
	var fields = [];

	for (var userID in whoSaidScore) {
		fields.push(util.buildField(util.getNick(userID), whoSaidScore[userID]));
	}

	fields.sort(util.compareFieldValues);
	util.sendEmbedFieldsMessage('Who Said - Game Over', fields);
	util.unLock('startWhoSaidGame');
}

/**
 * Starts a round of who said.
 *
 * @param {Object} quote quote to guess author of
 * @param {Number} round round number
 */
function startWhoSaidRound(quote, round) {
	if (!quote.content) { return; }

	util.sendEmbed({
		title: `Who Said - Round ${round}`,
		description: `Who said "${quote.content}"?`,
		image: maybeGetImageFromContent(quote.content)
	});

	const filter = (msg) => msg.content === util.mentionUser(quote.author.id)
		|| msg.content === util.getNick(quote.member.id);

	return bot.getBotSpam().awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] });
}

/**
 * Game loop for who said.
 *
 * @param {Object[]} randomQuotes random quote to guess author of
 * @param {Number} round round number
 */
function whoSaidGameLoop(randomQuotes, round) {
	if (round === 6) {
		endWhoSaidGame();
		return;
	}

	const selectedQuote = randomQuotes[round - 1];
	startWhoSaidRound(selectedQuote, round)
		.then((answers) => {
			const roundWinner = answers.array()[0].member;
			const quoteCreatedTime = moment(selectedQuote.createdTimestamp).format(c.FULL_DATE_TIME_FORMAT);

			util.sendEmbedMessage(
				`Congrats ${util.getNick(roundWinner.id)}`,
				`You're correct! **${util.getNick(selectedQuote.author.id)}**\nsaid that on \`${quoteCreatedTime}\``
			);
			whoSaidScore[roundWinner.id] = whoSaidScore[roundWinner.id] ? whoSaidScore[roundWinner.id] + 1 : 1;
			whoSaidGameLoop(randomQuotes, round + 1);
		})
		.catch(() => {
			logger.info(`After 30 seconds, there were no responses for Who Said.`);
			util.sendEmbedMessage('Reponse Timed Out', 'Nobody wins this round! 😛');
			whoSaidGameLoop(randomQuotes, round + 1);
		});
}

/**
 * Starts a game of Who Said, which is a quote guessing game.
 *
 * @param {Object} channel - channel to get quotes from
 * @param {Number} minLength - minimum length required to include msg
 * @param {Number} minReactions - minimum reactions required to include msg
 * @param {Number} sampleSize - number of messages to scan
 */
exports.startWhoSaidGame = function(channel, minLength, minReactions, sampleSize) {
	if (util.isLocked()) { return; }
	util.lock();
	whoSaidScore = {};

	getRandomQuotes(channel, minLength, minReactions, sampleSize)
		.then((randomQuotes) => {
			if (!randomQuotes || randomQuotes.length === 0) { return; }
			whoSaidGameLoop(randomQuotes, 1);
		});
};

/**
 * Builds the updated ark server status.
 *
 * @param {Object} pinnedStatusMsg - pinned msg with server status
 * @param {String} serverEvent - the event sent by the server
 * @param {Boolean} isPlayerCountUpdate - whether or not the update for for player count
 * @returns {String} the updated status
 */
function buildUpdatedArkServerStatus(pinnedStatusMsg, serverEvent, isPlayerCountUpdate) {
	const status = isPlayerCountUpdate ? pinnedStatusMsg.embeds[0].description.split('⠀')[0] : serverEvent;
	const playerCount = isPlayerCountUpdate ? Number(serverEvent) : 0;
	const playerCountLabel = util.maybeGetPlural(playerCount, 'player').toUpperCase();

	return `${status}⠀⠀| ⠀⠀${c.REACTION_NUMBERS[playerCount]}⠀**${playerCountLabel}**`;
}

/**
 * Updates the ark server status if the message is from the server's webhookID
 *
 * @param {Object} message - the message to check for a status update
 */
exports.maybeUpdateArkServerStatus = function(message) {
	if (message.webhookID !== c.ARK_SERVER_WEBHOOK_ID) { return; }

	const serverEvent = message.content.split(' ').pop();
	const isPlayerCountUpdate = !isNaN(serverEvent);
	const statusColor = c.ARK_SERVER_STATUS_TO_COLOR[serverEvent];

	if (isPlayerCountUpdate) {
		message.delete();
	} else if (!statusColor) {
		return;
	}

	message.channel.fetchMessage(c.ARK_SERVER_STATUS_MSG_ID)
		.then((pinnedStatusMsg) => {
			const updatedStatus = buildUpdatedArkServerStatus(pinnedStatusMsg, serverEvent, isPlayerCountUpdate);
			const updatedMsg = new Discord.RichEmbed({
				color: isPlayerCountUpdate ? pinnedStatusMsg.embeds[0].color : statusColor,
				title: pinnedStatusMsg.embeds[0].title,
				description: updatedStatus,
				timestamp: new Date()
			});

			pinnedStatusMsg.edit('', updatedMsg)
				.catch((err) => {
					logger.error(`Edit Ark Server Status Msg Error: ${err}`);
				});

			const updateTime = moment().format(c.DAY_HM_DATE_TIME_FORMAT);

			message.channel.edit({ topic: `${updatedStatus} ⠀⠀ ⠀⠀@ **${updateTime}**` })
				.catch((err) => {
					logger.error(`Edit #ark Topic Error: ${err}`);
				});
			logger.info(`Ark server status updated to: ${updatedStatus}`);
		})
		.catch((err) => {
			logger.error(`Fetch Ark Server Status Msg Error: ${err}`);
		});
};

/**
 * Pings the physical server hosting ark to determine if it is online.
 *
 * @returns {Boolean} whether or not the server is online
 */
async function isArkServerOnline() {
	const pingOptions = process.platform.startsWith('win') ? ['-n', '2', '-w', '1500'] : ['-c', '2', '-w', '3'];
	const pingArgs = [priv.arkServerIp, ...pingOptions];
	const result = await spawnSync('ping', pingArgs, { encoding: 'utf-8' });

	return result.stdout.includes('from');
}

/**
 * Checks if the status of the physical server hosting ark
 * and notifies the server admin if down.
 */
exports.checkArkServerStatus = async function() {
	const isOnline = await isArkServerOnline();
	const channel = bot.getServer().channels.find('id', c.ARK_CHANNEL_ID);
	const isPrevStatusDown = channel.topic.startsWith('⬇️');

	if (isOnline ^ isPrevStatusDown) { return; }

	if (!isOnline) {
		const reportMsg = 'the server hosting the ark VM is **down**. Please investigate.';

		channel.send(`${util.mentionUser(c.ARK_SERVER_ADMIN_ID)}, ${reportMsg}`)
			.catch(util.log);
	}

	exports.maybeUpdateArkServerStatus({
		content: isOnline ? '⬆️' : '⬇️',
		channel,
		webhookID: c.ARK_SERVER_WEBHOOK_ID
	});
};

exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('who-plays', exports.whoPlays);
	cmdHandler.registerCommandHandler('@', exports.mentionGroup);
	cmdHandler.registerCommandHandler('1-more', (message, args) => {
		exports.letsPlay(args, message.member.id, message, true);
	});
	cmdHandler.registerCommandHandler('fortnite-leaderboard', (message, args) => {
		if (!args[1] || !args[2]) { return; }

		exports.getFortniteStats(args[1], args[2], message.member.id);
	});
	cmdHandler.registerCommandHandler('fortnite-stats', (message, args) => {
		if (args[1] && args[2]) {
			const targetStat = args[3] || 'all';
			exports.getFortniteStats(args[2], targetStat, message.member.id, args[1]);
		} else {
			exports.outputFortniteHelp();
		}
	});
	cmdHandler.registerCommandHandler('lets-play', (message, args) => {
		exports.letsPlay(args, message.member.id, message);
	});
	cmdHandler.registerCommandHandler('opt-in', (message) => {
		exports.optIn(message.member.id);
		message.delete();
	});
	cmdHandler.registerCommandHandler('playing', (message) => {
		exports.maybeOutputCountOfGamesBeingPlayed(message.guild.members.array(), message.member.id);
		message.delete();
	});
	cmdHandler.registerCommandHandler('add-player', forceAddOrRemovePlayer);
	cmdHandler.registerCommandHandler('remove-player', forceAddOrRemovePlayer);
	cmdHandler.registerCommandHandler('round-robin', (message, args) => {
		if (!args[1]) { return; }

		exports.roundRobin(args[1], message.member.id);
	});
	cmdHandler.registerCommandHandler('set-fortnite-name', (message, args) => {
		if (!args[1]) { return; }

		exports.setFortniteName(message.member.id, args);
	});
	cmdHandler.registerCommandHandler('set-stream', (message, args) => {
		if (!args[1]) { return; }

		exports.setStreamingUrl(message.member, args[1]);
	});
	cmdHandler.registerCommandHandler('split-group', (message) => {
		exports.splitGroup(message.member);
	});
	cmdHandler.registerCommandHandler('sunken-sailor', (message) => {
		exports.sunkenSailor(message.member);
	});
	cmdHandler.registerCommandHandler('time', (message, args) => {
		exports.maybeOutputTimePlayed(args, message.member.id);
	});
	cmdHandler.registerCommandHandler('toggle-streaming', (message) => {
		exports.toggleStreaming(message.member);
	});
	cmdHandler.registerCommandHandler('who-said', (message, args) => {
		exports.startWhoSaidGame(args[1], args[2], args[3], args[4]);
	});
	cmdHandler.registerCommandHandler('ping-ark-server', exports.checkArkServerStatus);
};