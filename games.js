var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var optedInUsers = require('./optedIn.json');

var gameHistory = [];								//timestamped log of player counts for each game
var timeSheet = {};									//map of userID to gameToTimePlayed map for that user

/**
 * Exports the timesheet to a json file.
 */
exports.exportTimeSheet = function() {
	var json = JSON.stringify(timeSheet);	
	fs.writeFile('../timeSheet.json', json, 'utf8', util.log);
}

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
		game += ' ' + args[i];
	}
	const result = {game : game, target : target};
	return result;
}

/**
 * Gets and outputs the player count of every game currently being played 
 */
exports.getAndOutputCountOfGamesBeingPlayed = function(scrubs) {
	var games = [];
	var max = 0;
	var winner = '';

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
		}	
	});

	var fields = [];
	var time = util.getTimestamp();
	var gamesLog = [];
	for (var gameID in games) {
		fields.push(util.buildField(gameID, games[gameID]));

		//log timestamp and player count for each game
		const gameData = {
			game : gameID,
			count : games[gameID],
			time : time
		};
		gamesLog.push(gameData);
	}
	gameHistory.push(gamesLog);
	
	var imageUrl = c.THUMBS_UP_GIF;
	if (c.GAME_NAME_TO_IMG[winner]) {
		imageUrl = c.GAME_NAME_TO_IMG[winner];
	}
	util.sendEmbedMessage('Winner - ' + winner, null, imageUrl);
	fields.sort(util.compareFieldValues);
	util.sendEmbedFieldsMessage('Player Count', fields);
}

/**
 * Gets the play time of the game provided.
 * 
 * @param {Object} currentlyPlaying - the game finished or currently being played
 */
function getTimePlayed(currentlyPlaying) {
	var startOfDay = new Date();
	startOfDay.setHours(0,0,0,0);
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
function outputCumulativeTimePlayed(timePlayedData) {
	var fields = [];
	fields.push(util.buildField('All Games', timePlayedData.total.toFixed(1)));	
	for (var gameName in timePlayedData.gameToTime) {
		var playtime = timePlayedData.gameToTime[gameName];
		fields.push(util.buildField(gameName, playtime.toFixed(1)));
	}
	fields.sort(util.compareFieldValues);
	util.sendEmbedFieldsMessage('Cumulative Hours Played', fields);
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  Cumulative Hours Played All Games: ' + inspect(fields));
}

/**
 * Gets and outputs the time played for the game by the user(s) provided in args.
 * 
 * @param {String[]} args - input arguments from the user
 */
exports.maybeOutputTimePlayed = function(args) {
	const nameAndTargetData = getGameNameAndTarget(args);
	var target = nameAndTargetData.target;
	var game = nameAndTargetData.game;

	c.LOG.info('<INFO> ' + util.getTimestamp() + '  Time Called - game: ' + game + ' target: ' + target);		
	if (target !== '' && !isOptedIn(target)) { 
		util.sendEmbedMessage(null,'I do not track that scrub\'s playtime.');
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + target + ' is not opted in.');				
		return; 
	}
	
    if (target.match(/\d/g) !== null) {
        target = target.match(/\d/g).join('');
    } 
    var timePlayedData = getCumulativeTimePlayed(game,target);
    if (Object.keys(timePlayedData.gameToTime).length !== 0) {
        outputCumulativeTimePlayed(timePlayedData);	
    } else {
		var fields = [];
		fields.push(util.buildField(game,timePlayedData.total.toFixed(1)));
		util.sendEmbedFieldsMessage('Hours Played', fields);
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  Hours Played: ' + inspect(fields));
    }
}

/**
 * Gets hours, mins, and meridiem from the provided timestamp.
 * 
 * @param {String} timestamp 
 */
function getTimeData(timestamp) {
	var timeData = timestamp.split(/[ :]+/);
	var hours = parseInt(timeData[1]);
	var mins = parseInt(timeData[2]);
	var meridiem = timeData[3];
	return {
		hours : hours,
		mins : mins,
		meridiem : meridiem
	};
}

/**
 * Comparator for two gameLog objects. Compares times.
 * 
 * @param {Object} a - gameLog containing array of gameData objects for comparison
 * @param {Object} b - gameLog containing array of gameData objects for comparison
 */
function compareTimestamps(a,b) {
	if (a[0] && b[0]) {
		var aTimeData = getTimeData(a[0].time);
		var bTimeData = getTimeData(b[0].time);
		
		//If a is AM and b is PM
		if (aTimeData.meridiem < bTimeData.meridiem)
			return 1;
		if (aTimeData.meridiem > bTimeData.meridiem) 
			return -1;

		var aMins = (aTimeData.hours * 60) + aTimeData.mins;
		var bMins = (bTimeData.hours * 60) + bTimeData.mins;

		if (aMins < bMins)
			return 1;
		if (aMins > bMins)
			return -1;
		return 0;
	}
}

/**
 * Outputs history of game's player counts throughout the day if such a log exists.
 */
exports.maybeOutputGameHistory = function () {
	var previousTime = '';
	gameHistory.sort(compareTimestamps);
	gameHistory.forEach(function(gamesLog) {
		if (gamesLog[0]) {
			var time = gamesLog[0].time;
			if ( time !== previousTime) {
				var fields = [];					
				gamesLog.forEach(function(gameData) {
					fields.push(util.buildField(gameData.game, gameData.count));
				});
				fields.sort(util.compareFieldValues);
				util.sendEmbedFieldsMessage('Player Count - ' + time, fields);	
				previousTime = time;			
			}	
		}
	});
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
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  Presence Update - ' + userName + ' finished a ' + hoursPlayed.toFixed(4) + 'hr session of ' + currentlyPlaying.name);											
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
	c.LOG.info('<INFO> Presence Update - ' + user + ' id: ' + userID + ' old game: ' + oldGame + ' new game: ' + newGame);
	
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
	}
	
	timeSheet[userID] = gameToTime;
}

/**
 * Waits for the provided number of seconds and then sends a scrub daddy fact. 
 * 
 * @param {Number} attempts - loop iterator
 * @param {Number} seconds - duration of each loop
 */
function waitAndSendScrubDaddyFact(attempts, seconds) {
	setTimeout(function() {
		if (attempts === seconds) {
			const title = 'You are now subscribed to Scrub Daddy Facts!';
			const imgUrl = c.SCRUB_DADDY_FACT;
			util.sendEmbedMessage(title, null, imgUrl);
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
	optedInUsers.push(userID);
	var fields = [];					
	fields.push(util.buildField(user, 'I\'m watching you.'));
	util.sendEmbedFieldsMessage('YOU ARE BEING WATCHED', fields);	
	waitAndSendScrubDaddyFact(0,5);
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + user + ' (' + userID + ') has opted into time');	
	var json = JSON.stringify(optedInUsers);	
	fs.writeFile('optedIn.json', json, 'utf8', util.log);
}

/**
 * Asks Scrubs if they want to play pubg.
 */
exports.askToPlayPUBG = function() {
	bot.getScrubsChannel().send(new Discord.MessageEmbed({
		color: 0xffff00,
		title: title,
		description: '<@&370671041644724226>  ' + c.GREETINGS[util.getRand(0, c.GREETINGS.length)] + ' tryna play some ' + c.PUBG_ALIASES[util.getRand(0, c.PUBG_ALIASES.length)] + '?'
	}));	
}