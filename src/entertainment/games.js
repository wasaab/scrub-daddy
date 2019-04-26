var inspect = require('util-inspect');
var txtgen = require('txtgen');
var moment = require('moment');
var gUrl = require( 'google-url' );
var Fuse = require('fuse.js');
var get = require('lodash.get');
var fs = require('fs');
var rp = require('request-promise');
var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;
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
	for (var i=1; i < args.length; i++) {
		if (args[i].indexOf('<') === 0) {
			target = args[i];
			break;
		}
		game += ` ${args[i]}`;
	}
	const result = {game : game, target : target};
	return result;
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

function getGamesBeingPlayedData(players) {
	var games = [];
	var max = 0;
	var winner = '';
	var total = 0;

	players.forEach((player) => {
		const game = get(player, 'presence.game.name');
		const status = get(player, 'presence.status');

		if(game && !player.user.bot && player.highestRole.id !== c.PLEB_ROLE_ID && status !== 'idle') {
			games[game] = games[game] ? games[game] + 1 : 1;
			if(games[game] > max) {
				max = games[game];
				winner = game;
			}
			total++;
		}
	});

    return { games: games, winner: winner, total: total, max: max };
}

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

	var time = moment();
	var fields = determinePlayingFieldsAndUpdateHistory(time, total, games);

	var imageUrl = c.THUMBS_UP_GIF;
	if (c.GAME_NAME_TO_IMG[winner]) {
		imageUrl = c.GAME_NAME_TO_IMG[winner];
	}
	if (userID !== c.SCRUB_DADDY_ID) {
		util.sendEmbedMessage(`🏆 Winner - ${winner}`, null, userID, imageUrl);
		fields.sort(util.compareFieldValues);
		util.sendEmbedFieldsMessage(`🎮 Player Count - ${total}`, fields, userID);
	} else {
		updateHeatMap(time, total);
	}
};

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
	var startOfDay = new Date();
	startOfDay.setHours(5,0,0,0);
	var utcSeconds = Number(currentlyPlaying.start) / 1000;
	var startedPlaying = new Date(0); // The 0 there is the key, which sets the date to the epoch
	startedPlaying.setUTCSeconds(utcSeconds);
	var currentTime = new Date();
	if (startedPlaying < startOfDay) {
		startedPlaying = startOfDay;
	}
	var hoursPlayed = Math.abs(currentTime - startedPlaying) / 36e5;
	return hoursPlayed;
}

/**
 * Gets the provided users playtime for a specific game.
 *
 * @param {String} userID - id of the user to get playtime of
 * @param {String} gameName - name of the game to get playtime of
 */
function getUsersPlaytimeForGame(userID, gameName) {
	if (!timeSheet[userID]) {
		return 0;
	}

	var playtime = timeSheet[userID][gameName];
	var currentlyPlaying = timeSheet[userID]['playing'];

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
		total : 0,
		gameToTime : {}
	};
	var userToTimes = timeSheet;
	//if a target is provided get cumulative time played of their games
	if (target !== '') {
		userToTimes = {};
		userToTimes[target] = timeSheet[target];
	}
	for (var userID in userToTimes) {
		//get time of all games
		if (gameName === '') {
			var gameToTime = userToTimes[userID];
			for (var game in gameToTime) {
				if (game === 'playing') {
					continue;
				}
				var playtime = getUsersPlaytimeForGame(userID, game);
				if (playtime) {
					if (!cumulativeTimePlayed.gameToTime[game]) {
						cumulativeTimePlayed.gameToTime[game] = 0;
					}
					cumulativeTimePlayed.gameToTime[game] += playtime;
					cumulativeTimePlayed.total += playtime;
				}
			}
		} else {
			var timePlayed = getUsersPlaytimeForGame(userID, gameName);
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
	user = util.getIdFromMention(user);
	if (optedInUsers.indexOf(user) === -1)
		return false;
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
		var playtime = timePlayedData.gameToTime[gameName];
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
	const nameAndTargetData = getGameNameAndTarget(args);
	var target = nameAndTargetData.target;
	var game = nameAndTargetData.game;

	logger.info(`Time Called - game: ${game} target: ${target}`);
	if (target !== '' && !isOptedIn(target)) {
		util.sendEmbedMessage(null,'I do not track that scrub\'s playtime.', userID);
		logger.info(`${target} is not opted in.`);
		return;
	}

    if (target.match(/\d/g) !== null) {
        target = util.getIdFromMention(target);
    }
    var timePlayedData = getCumulativeTimePlayed(game,target);
    if (Object.keys(timePlayedData.gameToTime).length !== 0) {
        outputCumulativeTimePlayed(timePlayedData, userID);
    } else {
		var fields = [];
		fields.push(util.buildField(game,timePlayedData.total.toFixed(1)));
		util.sendEmbedFieldsMessage('🕒 Hours Played', fields, userID);
		logger.info(`Hours Played: ${inspect(fields)}`);
    }
};

/**
 * Gets the user data for the provided game.
 *
 * @param {String} gameName - the game to find players of
 */
function getGameUserData(gameName, fuzzyThreshold) {
	var options = c.WHO_PLAYS_FUZZY_OPTIONS;
	options.threshold = fuzzyThreshold;
	var fuse = new Fuse(gamesPlayed, options);
	var result = fuse.search(gameName);
	if (result.length === 0) {return {};}

	return result[0];
}

function buildWhoPlaysFields(usersWhoPlay) {
	var fields = [];
    usersWhoPlay.sort((a, b) => {
		if(isNaN(b.time - a.time)) {
			return isNaN(a.time) ? 1 : -1;
		}

		return b.time - a.time;
	});

	const scrubIDToNick = util.getScrubIdToNick();
	usersWhoPlay.forEach((user) => {
		const lastPlayed = isNaN(user.time) ? 'N/A': moment(user.time).format(c.MDY_HM_DATE_TIME_FORMAT);
		const name = scrubIDToNick[user.id];
		if (name) {
			fields.push(util.buildField(name, `\`${lastPlayed}\``));
		}
	});

    if(fields.length !== 2 && fields.length % 3 === 2) {
		fields.push(util.buildField('\u200B', '\u200B'));
	}

	return fields;
}

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
 */
exports.whoPlays = function(args, userID) {
	if (!args[1]) {
		whoPlaysUsersGames(userID);
		return;
	}
	const game = util.getTargetFromArgs(args, 1);
	const gameUserData = getGameUserData(game, 0.3);
	logger.info(`Who Plays ${game} - ${inspect(gameUserData)}`);

	var usersWhoPlay = gameUserData.users;
	if (usersWhoPlay) {
		var fields = buildWhoPlaysFields(usersWhoPlay);
		util.sendEmbedFieldsMessage(`Users Who Play ${gameUserData.title} / Last Time Played`, fields, userID);
	} else {
		util.sendEmbedMessage('Literally Nobody Plays That', 'We are all judging you now.', userID);
	}
};

function shouldExcludeUserFromLetsPlay(allFlagProvided, user) {
	return !allFlagProvided && (user.role === c.SUPER_SCRUBS_ROLE_ID || !user.time
		|| moment().diff(moment(user.time), 'days') > 8);
}

function maybeAddCurrPlayingToArgs(args, user, gameIdx) {
	if (args.length !== gameIdx) { return; }

	const currPlaying = get(user, 'presence.game.name');

	if (currPlaying) {
		args[gameIdx] = currPlaying;
	}
}

/**
 * @Mentions every user that plays the provided game, asking them if they want to play.
 */
exports.letsPlay = function(args, userID, userName, message, oneMore, customMessage) {
	const emojis = message.guild.emojis;
	const allFlagProvided = '-all' === args[1];
	const gameIdx = allFlagProvided ? 2 : 1;

	maybeAddCurrPlayingToArgs(args, message.member, gameIdx);

	//If no game provided and user is not currently playing a game, output help
	if (args.length === gameIdx) { return util.outputHelpForCommand('lets-play', userID); }

	var game = util.getTargetFromArgs(args, gameIdx).replace(/:/g, '');
	const gameUserData = getGameUserData(game, 0.3);
	var usersWhoPlay = gameUserData.users;
	var msg = `↪️ **${userName}**: `;

	logger.info(`Lets Play ${game} - ${inspect(gameUserData)}`);

	if (!usersWhoPlay) { return util.sendEmbedMessage('Literally Nobody Plays That', 'You\'re on your own bud.', userID); }

	if (customMessage) {
		msg += `\`@${gameUserData.title}\` ${customMessage}`;
	} else {
		const oneMoreMsg = oneMore ? 'We need **1** more for ' : '';
		const punctuation = oneMore ? '!' : '?';

		game = emojis.find('name',  util.capitalizeFirstLetter(game)) || game;
		msg += `${oneMoreMsg}${game}${punctuation}`;
	}

	usersWhoPlay.forEach((user) => {
		if (shouldExcludeUserFromLetsPlay(allFlagProvided, user)){ return; }

		msg += ` ${util.mentionUser(user.id)}`;
	});
	bot.getScrubsChannel().send(msg);
};

exports.maybeCallLetsPlay = function(message) {
	const game = get(message, 'member.presence.game.name');

	if (message.author.bot || message.content !== '' || message.attachments.size !== 0
		|| message.type !== 'DEFAULT' || !game) { return; }

	exports.letsPlay(['', game], message.member.id, util.getNick(message.member.id), message);
};

function determineUpdatedUsersWhoPlay(usersWhoPlay, userID, role, isRemoval) {
	if (!usersWhoPlay) {
		usersWhoPlay = [{ id: userID, time: moment().valueOf(), role: role.id }];
	} else {
		const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);
		const newEntry = { id: userID, time: moment().valueOf(), role: role.id };

		if (userEntryIdx === -1) {
			usersWhoPlay.push(newEntry);
		} else if (isRemoval) {
			usersWhoPlay.splice(userEntryIdx, 1);
		} else {
			usersWhoPlay.splice(userEntryIdx, 1, newEntry);
		}
	}

	return usersWhoPlay;
}

/**
 * Updates the games played for the provided user.
 */
function updateWhoPlays(userID, role, game, isRemoval) {
	if (!game) { return; }

	const gameIdx = gamesPlayed.map((game) => game.title.toLowerCase()).indexOf(game.toLowerCase());
	const gameUserData = getGameUserData(game, 0);
	var usersWhoPlay = determineUpdatedUsersWhoPlay(gameUserData.users, userID, role, isRemoval);

	if (gameIdx === -1) {
		gamesPlayed.push({
			title: game,
			users: usersWhoPlay
		});
	} else {
		gamesPlayed[gameIdx].users = usersWhoPlay;
	}
}

exports.removePlayer = function(args) {
	updateWhoPlays(util.getIdFromMention(args[1]), { id: 'Temp Role' }, util.getTargetFromArgs(args, 2), true);
};


/**
 * Updates the time played for a game when the user finishes playing it.
 *
 * @param {Object} gameToTime - map of game to time played
 * @param {userName} userName - name of the user whos playtime is being updated
 */
function getUpdatedGameToTime(gameToTime, userName) {
	var currentlyPlaying = gameToTime['playing'];

	if (currentlyPlaying) {
		var hoursPlayed = getTimePlayed(currentlyPlaying);
		logger.info(`Presence Update - ${userName} finished a ${hoursPlayed.toFixed(4)}hr session of ${currentlyPlaying.name}`);
		gameToTime[currentlyPlaying.name] += hoursPlayed;
		gameToTime['playing'] = null;
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
		gameToTime['playing'] = {name : newGame, start : new Date().getTime()};
		if (!gameToTime[newGame]) {
			gameToTime[newGame] = 0;
		}
	}

	timeSheet[userID] = gameToTime;
	updateWhoPlays(userID, highestRole, oldGame);
};

/**
 * Waits for the provided number of seconds and then sends a scrub daddy fact.
 *
 * @param {Number} attempts - loop iterator
 * @param {Number} seconds - duration of each loop
 */
function waitAndSendScrubDaddyFact(attempts, seconds, userID) {
	setTimeout(() => {
		if (attempts === seconds) {
			const title = '➕ You are now subscribed to Scrub Daddy Facts!';
			const imgUrl = c.SCRUB_DADDY_FACT;
			util.sendEmbedMessage(title, null, userID, imgUrl);
			return;
		} else {
			waitAndSendScrubDaddyFact(attempts+1, seconds);
		}
	}, 1000);
}

/**
 * opts a user into playtime tracking
 *
 * @param {String} user - the name of the user to opt in
 * @param {String} userID - the ID of the user to opt in
 */
exports.optIn = function(user, userID) {
	if (optedInUsers.includes(userID)) {
		util.sendEmbedMessage(`You are already opted-in ${user}`, `Pray I do not opt you in further.`, userID);
		return;
	}
	optedInUsers.push(userID);
	var fields = [];
	fields.push(util.buildField(user, '👀 I\'m watching you.'));
	util.sendEmbedFieldsMessage('👀 YOU ARE BEING WATCHED', fields, userID);
	waitAndSendScrubDaddyFact(0, 5, userID);
	logger.info(`${user} (${userID}) has opted into time`);
	util.exportJson(optedInUsers, 'optedIn');
};

/**
 * Asks Scrubs if they want to play pubg.
 */
exports.askToPlayPUBG = function() {
	bot.getScrubsChannel().send(`${util.mentionRole(c.SCRUBS_ROLE_ID)}  ${c.GREETINGS[util.getRand(0, c.GREETINGS.length)]} tryna play some ${c.PUBG_ALIASES[util.getRand(0, c.PUBG_ALIASES.length)]}?`);
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
		const game = get(member, 'presence.game.name');
		if (game) {
			if (!gameToCount[game]) {
				gameToCount[game] = 1;
			} else {
				gameToCount[game]++;
			}
			if (gameToCount[game] > majority) {
				game.indexOf( 'B' ) === 0 ? result = game.replace( 'B', '🅱️' ) : result = game;
				return true;
			}
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
	if (voiceChannel.name !== defaultName) {
		logger.info(`Resetting Channel Name - ${voiceChannel.name} -> ${defaultName}`);
		voiceChannel.setName(defaultName);
	}
}

/**
 * Updates the dynamic voice channel names if the majority is playing a game.
 *
 */
exports.maybeUpdateChannelNames = function() {
	gameChannels.forEach((channel) => {
		if (channel.members.length !== 0) {
			const majorityGame = determineMajorityGame(channel);
			var fuse = new Fuse([channel.name], c.CHANNEL_NAME_FUZZY_OPTIONS);
			//only rename if the name is not already up to date
			if (fuse.search(`▶ ${majorityGame}`).length === 0) {
				if (majorityGame) {
					logger.info(`Updating Channel Name - ${channel.name} -> ▶ ${majorityGame}`);
					channel.setName(`▶ ${majorityGame}`);
				} else {
					resetChannelName(channel);
				}
			}
		} else {
			resetChannelName(channel);
		}
	});
};

/**
* Raises audio quality for channels with only beyond members. Vice versa for all others.
*
* @param {Object[]} channels - the server's channels
*/
exports.maybeChangeAudioQuality = function(channels) {
	channels.forEach((channel) => {
		if (channel.type === "voice") {
			const memberCount = get(channel, 'members.size');
			if (memberCount) {
				const beyondCount = channel.members.array().filter((member) => {
					return get(member, 'hoistRole.id') === c.BEYOND_ROLE_ID || member.selfDeaf;
				}).length;
				if (memberCount === beyondCount && channel.bitrate !== c.MAX_BITRATE) {
					channel.setBitrate(c.MAX_BITRATE)
					.then(logger.info(`Raising Channel Bitrate - ${channel.name}`))
					.catch((err) => {
						logger.error(`Add Role Error: ${err}`);
					});
				} else if (channel.bitrate === c.MAX_BITRATE && memberCount !== beyondCount) {
					channel.setBitrate(c.MIN_BITRATE)
					.then(logger.info(`Lowering Channel Bitrate - ${channel.name}`))
					.catch((err) => {
						logger.error(`Add Role Error: ${err}`);
					});
				}
			}
		}
	});
};

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
	var shortener = new gUrl({key: priv.googleUrlApiKey});
	shortener.shorten(url, function(err, shortUrl) {
		if (shortUrl) {
			userIDToStreamingUrl[member.id] = shortUrl;
			util.exportJson(userIDToStreamingUrl, 'streaming');
			util.sendEmbedMessage(`Stream Url Set For ${util.getNick(member.id)}`, `Your stream can be watched at ${shortUrl}`);
		}
	});

};

/**
 * Toggles nickname streaming icon.
 */
exports.toggleStreaming = function(member) {
	if (member.displayName.includes('📺')) {
		member.setNickname(member.displayName.split('📺')[0].slice(0,-1));
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
 * Updates the provided users nickname to contain the game they
 * just started playing.
 *
 * @param {Object} member - the member to update name of
 * @param {String} game - the game they are playing
 */
exports.maybeUpdateNickname = function(member, game) {
	const nameTokens = member.displayName.split(' ▫ ');
	const status = get(member, 'presence.status');

	if (game && member.voiceChannel && status !== 'idle') {
		logger.info(`${nameTokens[0]} is playing ${game}`);
		if (game === `Sid Meier's Civilization VI`) {
			game = 'C I V 6';
		}
		const gameTokens = game.split(' ');
		var nick = `${nameTokens[0]} ▫ `;
		gameTokens.forEach((token) => {
			var firstChar = token.charAt(0).toUpperCase();
			if (!/[a-zA-Z0-9]/.test(firstChar)) {
				firstChar = token;
			}
			nick += c.ENCLOSED_CHARS[firstChar] || firstChar;
		});
		logger.info(`Updating Nickname - ${member.displayName} -> ${nick}`);
		member.setNickname(nick);
	} else {
		if (nameTokens[1]) {
			logger.info(`Updating Nickname - ${member.displayName} -> ${nameTokens[0]}`);
			member.setNickname(nameTokens[0]);
		}
	}
};

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

		rp(options)
		.then(function (response) {
			const player = JSON.parse(response);
			if (gameMode && c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]) {
				if (gameMode !== 'all') {
					const statKeyBase = `${c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]}.${stat}`;
					const label = get(player, `${statKeyBase}.label`);
					const value = get(player, `${statKeyBase}.displayValue`);
					const percentile = get(player, `${statKeyBase}.percentile`);
					const gameModeTitle = util.capitalizeFirstLetter(gameMode);
					if (fortniteUserName) {
						const title = `Fortnite ${gameModeTitle} ${label} for ${fortniteUserName}`;
						util.sendEmbedMessage(title, `${value}\nTop ${percentile}% in the world`, callingUserID);
					} else if (label) {
						fields.push(util.buildField(util.getNick(userID), value));
						if (!statTitleLabel) {
							statTitleLabel = label;
						}
					}
				} else {
					var allFields = [];
					get(player, c.GAME_MODE_TO_KEY[gameMode.toLowerCase()]).forEach((category) => {
						allFields.push(util.buildField(category.key, category.value));
					});
					util.sendEmbedFieldsMessage(`Fortnite Lifetime Stats for ${util.getNick(userID)}`, allFields, callingUserID);
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

	var options= {
		uri: baseUri,
		method: 'GET',
		headers: {
			'TRN-Api-Key': priv.trnApiKey
		}
	};

	//get stats of @mentioned user
	if (fortniteUserName && fortniteUserName.match(/\d/g) !== null) {
		const matchedName = userIDToFortniteUserName[util.getIdFromMention(fortniteUserName)];
		if (matchedName) {
			fortniteUserName = matchedName;
			requestStats();
		} else {
			util.sendEmbedMessage('Fortnite Stats Lookup Error', 'The provided user does not have their Fortnite account linked to Scrub Daddy.', callingUserID);
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
	if (util.isAdmin(userID) && !isNaN(util.getIdFromMention(args[1]))) {
		userID = util.getIdFromMention(args[1]);
		userNameStartIdx = 2;
	}
	const userName = util.getTargetFromArgs(args, userNameStartIdx);
	userIDToFortniteUserName[userID] = userName;
	util.exportJson(userIDToFortniteUserName, 'fortniteUserData');
};

function sendSunkenSailorMessage(user, isSunken) {
	user.createDM()
	.then((dm) => {
		dm.send(txtgen.sentence(isSunken));
	});
}

exports.sunkenSailor = function(callingMember) {
	if (!callingMember.voiceChannel) { return; }
	var players = callingMember.voiceChannel.members.array();
	if (players.length < 2) { return; }
	util.shuffleArray(players);
	util.sendEmbedMessage('Sunken Sailor Round Started', 'Feel free to join in https://aggie.io/c_ut33ka. You must be in the voice channel to participate.');
	var nouns = fs.readFileSync('./resources/data/nouns.json'); //585 nouns
	nouns = JSON.parse(nouns);
	const secretWord = nouns[util.getRand(0, 585)];
	txtgen.generateSunkenSailerSentenceTemplates(secretWord);

	for (var i = 0; i < players.length - 1; i++) {
		sendSunkenSailorMessage(players[i], false);
	}
	sendSunkenSailorMessage(players[players.length - 1], true);
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
function getRandomQuotes(channel, minLength, minReactions, sampleSize) {
	if (channel) {
		channel = bot.getClient().channels.find('name', channel);
	}
	channel = channel || bot.getScrubsChannel();
	minLength = minLength || 15;
	minReactions = minReactions || 0;
	sampleSize = sampleSize || 100;
	return channel.fetchMessages({limit: sampleSize})
	.then((foundMessages) => {
		var matchingQuotes = foundMessages.array().filter((message) => {
			return message.content && message.content.length >= minLength
				&& message.reactions.size >= minReactions
				&& !message.author.bot;
		});
		util.shuffleArray(matchingQuotes);
		return matchingQuotes.slice(0,5);
	});
}

function maybeGetImageFromContent(content) {
	const images = content.match(/\bhttps?:\/\/\S+\.(png|jpeg|jpg|gif)(\s|$)/gi);
	if (!images) { return null; }
	return images[util.getRand(0, images.length)];
}

/**
 * Mentions a group of users with a custom message.
 *
 * @param {String} groupName - name of the group to mention
 * @param {String[]} args - arguments passed to command
 * @param {Object} message - the message command was sent in
 * @param {Object} channel - channel command was sent in
 * @param {String} userID - id of the user
 */
exports.mentionGroup = function(groupName, args, message, channel, userID) {
	const customMessage = util.getTargetFromArgs(args, 2);
	const { group, name } = util.getGroup(groupName);
	const nickName = util.getNick(userID);

	if (!group) {
		//If no group found and called from bot spam or scrubs channel, trigger a call to letsPlay with groupName
		if (c.BOT_SPAM_CHANNEL_ID === channel.id || c.SCRUBS_CHANNEL_ID === channel.id) {
			const letsPlayArgs = ['lets-play', groupName];
			exports.letsPlay(letsPlayArgs, userID, nickName, message, false, customMessage);
		} else { //If no group found and called from any other channel, trigger a call to mentionChannelsPowerUsers
			util.mentionChannelsPowerUsers(channel, nickName, customMessage);
		}
	} else if (Array.isArray(group)) { //Mention the group of users retrieved from getGroup
		var msg = `↪️ **${nickName}**: \`@${name}\` ${customMessage}`;
		group.forEach((groupMemberID) => {
			msg += ` ${util.mentionUser(groupMemberID)}`;
		});
		bot.getScrubsChannel().send(msg);
	} else { //Trigger a call to letsPlay with title retrieved from getGroup
		const letsPlayArgs = ['lets-play', ...group.split(' ')];
		exports.letsPlay(letsPlayArgs, userID, nickName, message, false, customMessage);
	}
};

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

function endWhoSaidGame() {
	var fields =[];
	for(var userID in whoSaidScore) {
		fields.push(util.buildField(util.getNick(userID), whoSaidScore[userID]));
	}

	fields.sort(util.compareFieldValues);
	util.sendEmbedFieldsMessage('Who Said - Game Over', fields);
	util.unLock('startWhoSaidGame');
}

function startWhoSaidRound(quote, round) {
	if (!quote.content) { return; }
	util.sendEmbedMessage(`Who Said - Round ${round}`, `Who said "${quote.content}"?`, null, maybeGetImageFromContent(quote.content));

	const filter = (m) => {
		if (m.content === util.mentionUser(quote.author.id) || m.content === util.getNick(quote.member.id)) { return m; }
	};
	return bot.getBotSpam().awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] });
}

function whoSaidGameLoop(randomQuotes, round) {
	if (round === 6) {
		endWhoSaidGame();
		return;
	}

	const selectedQuote = randomQuotes[round - 1];
    startWhoSaidRound(selectedQuote, round)
    .then((answers) => {
		const roundWinner = answers.array()[0].member;
		util.sendEmbedMessage(`Congrats ${util.getNick(roundWinner.id)}`,
		`You're correct! **${util.getNick(selectedQuote.author.id)}**\nsaid that on \`${moment(selectedQuote.createdTimestamp).format(c.FULL_DATE_TIME_FORMAT)}\``);
		whoSaidScore[roundWinner.id] = whoSaidScore[roundWinner.id] ? whoSaidScore[roundWinner.id] + 1 : 1;
		whoSaidGameLoop(randomQuotes, round + 1);
	})
    .catch(() => {
		logger.info((`After 30 seconds, there were no responses for Who Said.`));
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