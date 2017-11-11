var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');
var fs = require('fs');
var moment = require('moment');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var optedInUsers = require('../optedIn.json');
var timeSheet = require('../timeSheet.json');		//map of userID to gameToTimePlayed map for that user
var gameToUserIDs = require('../whoPlays.json');

var gameHistory = [];								//timestamped log of player counts for each game

/**
 * Exports the timesheet to a json file.
 */
exports.exportTimeSheetAndGameHistory = function() {
	var json = JSON.stringify(timeSheet);	
	fs.writeFile('timeSheet.json', json, 'utf8', util.log);

	json = JSON.stringify(gameHistory);
	fs.writeFile('gameHistory.json', json, 'utf8', util.log);

	json = JSON.stringify(gameToUserIDs);
	fs.writeFile('whoPlays.json', json, 'utf8', util.log);
};

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
 * Gets and outputs the player count of every game currently being played, 
 * unless called from recurring job, in which case it stores the result without outputting it.
 */
exports.maybeOutputCountOfGamesBeingPlayed = function(scrubs, userID) {
	var games = [];
	var max = 0;
	var winner = '';
	var total = 0;

	scrubs.forEach((scrub) => {
		const game = get(scrub, 'presence.activity.name');
		if (game && !scrub.user.bot) {
			if (!games[game]){
				games[game] = 1;
			} else {
				games[game]++;
			}
			if (games[game] > max) {
				max = games[game];
				winner = game;
			}
			total++;			
		}	
	});

	var fields = [];
	var time = moment();
	var gamesLog = {
		time: time, 
		playerCount: total, 
		gameData: []
	};
	for (var gameID in games) {
		fields.push(util.buildField(gameID, games[gameID]));

		//log timestamp and player count for each game
		const gameData = {
			game : gameID,
			count : games[gameID],
			time : time
		};
		gamesLog.gameData.push(gameData);
	}
	gameHistory.push(gamesLog);
	
	var imageUrl = c.THUMBS_UP_GIF;
	if (c.GAME_NAME_TO_IMG[winner]) {
		imageUrl = c.GAME_NAME_TO_IMG[winner];
	}
	if (userID !== c.SCRUB_DADDY_ID) {
		util.sendEmbedMessage(`🏆 Winner - ${winner}`, null, userID, imageUrl);
		fields.sort(util.compareFieldValues);
		util.sendEmbedFieldsMessage(`🎮 Player Count - ${total}`, fields, userID);
	}
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
	
	//TODO: THIS LOGIC IS WRONG! If they are currently playing a game and have already played it today, it won't include their current play time~~~~~~~~~~~~~~~~~~~~~~~~~
	//if the target user is currently playing the game 
	if (playtime === 0 && currentlyPlaying && currentlyPlaying.name === gameName) {						
		playtime = getTimePlayed(currentlyPlaying);
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
	user = user.match(/\d/g).join('');
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
	c.LOG.info(`<INFO> ${util.getTimestamp()}  Cumulative Hours Played All Games: ${inspect(fields)}`);
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

	c.LOG.info(`<INFO> ${util.getTimestamp()}  Time Called - game: ${game} target: ${target}`);		
	if (target !== '' && !isOptedIn(target)) { 
		util.sendEmbedMessage(null,'I do not track that scrub\'s playtime.', userID);
		c.LOG.info(`<INFO> ${util.getTimestamp()}  ${target} is not opted in.`);				
		return; 
	}
	
    if (target.match(/\d/g) !== null) {
        target = target.match(/\d/g).join('');
    } 
    var timePlayedData = getCumulativeTimePlayed(game,target);
    if (Object.keys(timePlayedData.gameToTime).length !== 0) {
        outputCumulativeTimePlayed(timePlayedData, userID);	
    } else {
		var fields = [];
		fields.push(util.buildField(game,timePlayedData.total.toFixed(1)));
		util.sendEmbedFieldsMessage('🕒 Hours Played', fields, userID);
		c.LOG.info(`<INFO> ${util.getTimestamp()}  Hours Played: ${inspect(fields)}`);
    }
};

/**
 * Outputs history of game's player counts throughout the day if such a log exists.
 */
exports.maybeOutputGameHistory = function(userID) {
	var previousTime = '';
	gameHistory.sort((a, b) => (a.time.diff(b.time))); 	
	gameHistory.forEach((gamesLog) => {
		if (gamesLog.gameData) {
			var time = gamesLog.time.format('ddd MMM Do, h:mm a');
			if (time !== previousTime) {
				var fields = [];					
				gamesLog.gameData.forEach((gameInfo) => {
					fields.push(util.buildField(gameInfo.game, gameInfo.count));
				});
				fields.sort(util.compareFieldValues);
				util.sendEmbedFieldsMessage(`📕 Player Count - ${gamesLog.playerCount} - ${time}`, fields, userID);	
				previousTime = time;			
			}	
		}
	});
};

/**
 * Outputs the users who play the provided game, as well as their recent playtime.
 */
exports.whoPlays = function(args, userID) {
	const game = util.getTargetFromArgs(args, 1);
	//Todo: Fuzzy match on game name. slightly different setup, i need to provide options to fuse.
	var usersWhoPlay = gameToUserIDs[game];
	if (usersWhoPlay) {
		var fields = [];					
		usersWhoPlay.forEach((user) => {
			fields.push(util.buildField(user.name, `${user.playtime.toFixed(2)} Hours Played`));
		});
		fields.sort(util.compareFieldValues);
		util.sendEmbedFieldsMessage(`Users Who Play ${game}`, fields, userID);
	} else {
		util.sendEmbedMessage('Literally Nobody Plays That', 'We are all judging you now.', userID);
	}
};

/**
 * Updates the games played for the provided user.
 */
function updateWhoPlays(userID, user, game) {
	if (!game) {return;}
	var usersWhoPlay = gameToUserIDs[game];

	if (!usersWhoPlay) {
		usersWhoPlay = [{ id: userID, name: user, playtime: timeSheet[userID][game] }];
	} else {
		const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);
		const newEntry = { id: userID, name: user, playtime: timeSheet[userID][game]};
		if (userEntryIdx === -1) {
			usersWhoPlay.push(newEntry);			
		} else {
			usersWhoPlay.splice(userEntryIdx, 1, newEntry);			
		}
	}

	gameToUserIDs[game] = usersWhoPlay;
}

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
		c.LOG.info(`<INFO> ${util.getTimestamp()}  Presence Update - ${userName} finished a ${hoursPlayed.toFixed(4)}hr session of ${currentlyPlaying.name}`);										
		gameToTime[currentlyPlaying.name] += hoursPlayed;
		gameToTime['playing'] = null;
	}
	return gameToTime;
}

/**
 * Updates the provided users timesheet.
 * 
 * TODO: Update this function to use the oldGame name to validate that is 
 * what they just finished playing.
 * 
 * @param {String} user 
 * @param {String} userID 
 * @param {Object} game 
 */
exports.updateTimesheet = function(user, userID, oldGame, newGame) {
	//ignore presence updates for bots and online status changes
	if (c.BOT_IDS.indexOf(userID) > -1 || oldGame === newGame) { return; }
	c.LOG.info(`<INFO> Presence Update - ${user} id: ${userID} old game: ${oldGame} new game: ${newGame}`);
	
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
		gameToTime['playing'] = {name : newGame, start : (new Date).getTime()};
		if (!gameToTime[newGame]) {
			gameToTime[newGame] = 0;
		}	
	}
	
	timeSheet[userID] = gameToTime;
	updateWhoPlays(userID, user, oldGame);		
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
	c.LOG.info(`<INFO> ${util.getTimestamp()}  ${user} (${userID}) has opted into time`);	
	var json = JSON.stringify(optedInUsers);	
	fs.writeFile('../optedIn.json', json, 'utf8', util.log);
};

/**
 * Asks Scrubs if they want to play pubg.
 */
exports.askToPlayPUBG = function() {
	bot.getScrubsChannel().send(`${c.SCRUBS_ROLE}  ${c.GREETINGS[util.getRand(0, c.GREETINGS.length)]} tryna play some ${c.PUBG_ALIASES[util.getRand(0, c.PUBG_ALIASES.length)]}?`);	
};