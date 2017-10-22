//do trends with game presence data. most played weekly and whatnot would be cool.
	//I have potential to track hours played, but not sure if i should.
//for player count command, add filter so it ignores either the 5 ids of the bots or checks their role ids to see if they contain bot. first choice seems more efficient.
//add command that outputs all games playtimes with pic of the winner
//doesn't currently handle multiple games being played at once by the same person, because of 'playing' being overwritten.
//add logic to maybeOutputTimePlayed or a child, for getting time played of all games for a specific user.
const c = require('./const.js');
const util = require('./utilities.js');
const inspector = require('util');
var fs = require('fs');

var gameHistory = [];								//timestamped log of player counts for each game
var timeSheet = {};									//map of userID to gameToTimePlayed map for that user
var optedInUsers = require('./optedIn.json');
//optedInUsers = JSON.parse(optedInUsers);
/**
 * Gets the name of the game provided as well as the target if one exists
 * 
 * @param {String[]} args - input arguments from the user
 */
function getGameNameAndTarget(args) {
	var game = '';
	var target = '';
	for (i=1; i < args.length; i++) {
		if (args[i].indexOf('<') === 0) {
			target = args[i]
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
exports.getAndOutputCountOfGamesBeingPlayed = function() {
	var scrubs = c.BOT.getScrubs();
	var games = [];
	var max = 0;
	var winner = '';
	for (var s in scrubs) {
		var scrub = scrubs[s];
		if (scrub.game !== undefined && scrub.game !== null && scrub.bot === false) {
			var game = scrub.game.name;
			if (games[game] === undefined) {
				games[game] = 1;
			} else {
				games[game] += 1;
			}
			if (games[game] > max) {
				max = games[game];
				winner = game;
			}
		}
	}
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
	
	var imageUrl = 'http://i0.kym-cdn.com/entries/icons/original/000/012/982/post-19715-Brent-Rambo-gif-thumbs-up-imgu-L3yP.gif';
	if (c.GAME_NAME_TO_IMG[winner] !== undefined && c.GAME_NAME_TO_IMG[winner] !== null) {
		imageUrl = c.GAME_NAME_TO_IMG[winner];
	}
	c.BOT.sendMessage({
		to: c.BOT_SPAM_CHANNEL_ID,
		embed:  {
			color: 0xffff00,
			title: "Winner - " + winner,
			image: {
				url: imageUrl
			}
		} 
	});	
	fields.sort(compareFieldValues);
	util.sendEmbedMessage("Player Count", fields);
}

/**
 * Gets the provided users playtime for a specific game.
 * 
 * @param {String} userID - id of the user to get playtime of
 * @param {String} gameName - name of the game to get playtime of
 */
function getUsersPlaytimeForGame(userID, gameName) {
	if (timeSheet[userID] === undefined) {
		return 0;
	}

	var playtime = timeSheet[userID][gameName];
	var currentlyPlaying = timeSheet[userID]['playing'];						
	
	//THIS LOGIC IS WRONG! If they are currently playing a game and have already played it today, it won't include their current play time~~~~~~~~~~~~~~~~~~~~~~~~~
	//if the target user is currently playing the game 
	if (playtime === 0 && currentlyPlaying !== undefined && currentlyPlaying.name === gameName) {						
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
				if (playtime !== undefined) {
					if (cumulativeTimePlayed.gameToTime[game] === undefined) {
						cumulativeTimePlayed.gameToTime[game] = 0;
					}
					cumulativeTimePlayed.gameToTime[game] += playtime;
					cumulativeTimePlayed.total += playtime;
				}
			}
		} else {
			var timePlayed = getUsersPlaytimeForGame(userID, gameName);
			if (timePlayed !== undefined) {
				cumulativeTimePlayed.total += timePlayed;							
			}
		}
	}
	
	return cumulativeTimePlayed;
}

/**
 * Comparator for two field objects. Compares values.
 * 
 * @param {Object} a - first field
 * @param {Object} b - second field
 */
function compareFieldValues(a,b) {
	const aNum = Number(a.value);
	const bNum = Number(b.value);

	if ( aNum > bNum)
	  return -1;
	if (aNum < bNum)
	  return 1;
	return 0;
}

/**
 * Checks if the provided user has opted into playtime tracking.
 * 
 * @param {String} user - the user to check
 */
function isOptedIn(user) {
	user = user.match(/\d/g).join("");
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
	fields.sort(compareFieldValues);
	util.sendEmbedMessage('Cumulative Hours Played', fields);
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  Cumulative Hours Played All Games: ' + inspector.inspect(fields, false, null));
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
		c.BOT.sendMessage({
			to: c.BOT_SPAM_CHANNEL_ID,
			message: 'I do not track that scrub\'s playtime.'
		});	
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + target + ' is not opted in.');				
		return; 
	}
	
    if (target.match(/\d/g) !== null) {
        target = target.match(/\d/g).join("");
    } 
    var timePlayedData = getCumulativeTimePlayed(game,target);
    if (Object.keys(timePlayedData.gameToTime).length !== 0) {
        outputCumulativeTimePlayed(timePlayedData);	
    } else {
		var fields = [];
		fields.push(util.buildField(game,timePlayedData.total.toFixed(1)));
		util.sendEmbedMessage('Hours Played', fields);
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  Hours Played: ' + inspector.inspect(fields, false, null));
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
	if (a[0] !== undefined && b[0] !== undefined) {
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
		if (gamesLog[0] !== undefined) {
			var time = gamesLog[0].time;
			if ( time !== previousTime) {
				var fields = [];					
				gamesLog.forEach(function(gameData) {
					fields.push(util.buildField(gameData.game, gameData.count));
				});
				fields.sort(compareFieldValues);
				util.sendEmbedMessage('Player Count - ' + time, fields);	
				previousTime = time;			
			}	
		}
	});
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
 * Updates the provided users timesheet.
 * 
 * @param {String} user 
 * @param {String} userID 
 * @param {Object} game 
 */
exports.updateTimesheet = function(user, userID, game) {
    //ignore presence updates for bots
	for (i = 0; i < c.BOT_IDS.length; i++) {
		if (userID === c.BOT_IDS[i]) {
			return;
		}
	}
	c.LOG.info('<INFO> Presence Update - ' + user + ' id: ' + userID + ' game: ' + inspector.inspect(game, false, null))	
	
	//get user's timesheet
	var gameToTime = timeSheet[userID];
	if (gameToTime === undefined) {
		gameToTime = {};
	}

	//Just started playing a game
	if (game !== null && game.timestamps !== undefined) {
		if (gameToTime[game.name] === undefined) {
			gameToTime[game.name] = 0;
		}
		gameToTime['playing'] = {name : game.name, start : game.timestamps.start} ;
	//Just finished playing a game
	} else {
		var currentlyPlaying = gameToTime['playing'];
		
		//This user started playing the game before the bot was running
		//so there is no start timestamp associated with the game
		if (currentlyPlaying === undefined) {
			return;
		}

		var hoursPlayed = getTimePlayed(currentlyPlaying);
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  Presence Update - ' + user + ' finished a ' + hoursPlayed.toFixed(2) + 'hr session of ' + currentlyPlaying.name);											
		gameToTime[currentlyPlaying.name] += hoursPlayed;
		gameToTime['playing'] = undefined;
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
			c.BOT.sendMessage({
				to: c.BOT_SPAM_CHANNEL_ID,
				embed:  {
					color: 0xffff00,
					title: "You are now subscribed to Scrub Daddy Facts!",
					image: {
						url: "http://marycoffeystrand.com/wp-content/uploads/2015/02/scrubsmile-300x233.jpg",
					}
				} 
			});
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
	util.sendEmbedMessage('YOU ARE BEING WATCHED', fields);	
	waitAndSendScrubDaddyFact(0,5);
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + user + ' (' + userID + ') has opted into time#######');	
	var json = JSON.stringify(optedInUsers);	
	fs.writeFile('optedIn.json', json, 'utf8', util.log);
}
