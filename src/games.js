var Discord = require('discord.js');
var inspect = require('util-inspect');
var moment = require('moment');
var Fuse = require('fuse.js');
var get = require('lodash.get');
var fs = require('fs');
var cp = require("copy-paste");

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var heatmap = require('./heatmap.js');
var optedInUsers = require('../optedIn.json');		//users that have opted in to playtime tracking
var gamesPlayed = require('../gamesPlayed.json');	//map of game name to users that play that game
var gameHistory = require('../gameHistory.json');	//timestamped log of player counts for each game
var timeSheet = require('../timeSheet.json');		//map of userID to gameToTimePlayed map for that user
var heatMapData = require('../heatMapData.json');	//Heat map data for every day-hour combo.
var heatMapImgUrl = '';		//url for the newest player count heat map image
var gameChannels = [];		//voice channels that change name based upon what the users are playing

/**
 * Exports the timesheet to a json file.
 */
exports.exportTimeSheetAndGameHistory = function() {
	var json = JSON.stringify(timeSheet);	
	fs.writeFile('timeSheet.json', json, 'utf8', util.log);

	json = JSON.stringify(gameHistory);
	fs.writeFile('gameHistory.json', json, 'utf8', util.log);

	json = JSON.stringify(gamesPlayed);
	fs.writeFile('gamesPlayed.json', json, 'utf8', util.log);
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
	
	writeHeatMapDataToTsvFile();	
	var json = JSON.stringify(heatMapData);	
	fs.writeFile('heatMapData.json', json, 'utf8', util.log);
};

exports.generateHeatMap = function() {
	writeHeatMapDataToTsvFile();
	var json = JSON.stringify(heatMapData);	
	fs.writeFile('heatMapData.json', json, 'utf8', util.log);
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
		const status = get(scrub, 'presence.status');
		
		if (game && !scrub.user.bot && scrub.highestRole.name !== 'Pleb' && status !== 'idle') {
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
	} else {
		updateHeatMap(time, total);		
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
 * Writes the heat map data to a tsv file.
 */
function writeHeatMapDataToTsvFile() {
	const firstLine = 'day	hour	value\n';
	formattedHistory = firstLine;

	heatMapData.forEach((day, dayIdx) => {
		day.forEach((hour, hourIdx) => {
			const avgCount = Math.round(hour.playerCount / hour.sampleSize);
			//convert from moment's day format to graph's day format
			if (dayIdx === 0) {
				dayIdx = 7;
			}
			formattedHistory += `${dayIdx}	${hourIdx}	${avgCount}\n`;
		});
	});

	if (formattedHistory !== firstLine) {		
		fs.writeFile('./graphs/test.tsv', formattedHistory, 'utf8', util.log);
		heatmap.generateHeatMap();
	}		
}

/**
 * Outputs heatmap of game's player counts throughout the day if such a log exists.
 */
exports.maybeOutputHeatMap = function(userID) {
	util.sendEmbedMessage('🔥 Player Count Heat Map', null, null, heatmap.getUpdatedHeatMapUrl());
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

/**
 * Outputs the users who play the provided game, as well as their recent playtime.
 */
exports.whoPlays = function(args, userID) {
	const game = util.getTargetFromArgs(args, 1);
	const gameUserData = getGameUserData(game, 0.3);
	c.LOG.info(`<INFO> ${util.getTimestamp()}  Who Plays ${game} - ${inspect(gameUserData)}`);						
	
	var usersWhoPlay = gameUserData.users;
	if (usersWhoPlay) {
		var fields = [];					
		usersWhoPlay.forEach((user) => {
			user.playtime = user.playtime || 0;
			fields.push(util.buildField(user.name, `${user.playtime.toFixed(2)} Hours Played`));
		});
		fields.sort(util.compareFieldValues);
		util.sendEmbedFieldsMessage(`Users Who Play ${gameUserData.title}`, fields, userID);
	} else {
		util.sendEmbedMessage('Literally Nobody Plays That', 'We are all judging you now.', userID);
	}
};

exports.letsPlay = function(args, userID, userName, emojis) {
	const gameIdx = args[1] === '-ss' ? 2 : 1;
	var game = util.getTargetFromArgs(args, gameIdx);
	const gameTokens = game.split(':');
	if (gameTokens && gameTokens.length === 3) {
		game = gameTokens[1];
	}
	const gameUserData = getGameUserData(game, 0.3);
	c.LOG.info(`<INFO> ${util.getTimestamp()}  Lets Play ${game} - ${inspect(gameUserData)}`);						
	
	var usersWhoPlay = gameUserData.users;
	if (usersWhoPlay) {
		game = emojis.find('name', game) || game;		
		var msg = `↪️${userName}: ${game}?`;					
		usersWhoPlay.forEach((user) => {
			if (gameIdx === 1 || user.role !== '(ᵔᴥᵔ) ͡Super ͡Scrubs ™') {
				msg += ` <@!${user.id}>`;
			}
		});
		bot.getScrubsChannel().send(msg);
	} else {
		util.sendEmbedMessage('Literally Nobody Plays That', 'You\'re on your own bud.', userID);
	}
};

/**
 * Updates the games played for the provided user.
 */
function updateWhoPlays(userID, user, role, game) {
	if (!game) {return;}
	const gameUserData = getGameUserData(game, 0);
	var usersWhoPlay = gameUserData.users;
	
	if (!usersWhoPlay) {
		usersWhoPlay = [{ id: userID, name: user, playtime: timeSheet[userID][game], role: role.name }];
	} else {
		const userEntryIdx = usersWhoPlay.map((player) => player.id).indexOf(userID);
		const newEntry = { id: userID, name: user, playtime: timeSheet[userID][game], role: role.name };
		if (userEntryIdx === -1) {
			usersWhoPlay.push(newEntry);			
		} else {
			usersWhoPlay.splice(userEntryIdx, 1, newEntry);			
		}
	}

	const gameIdx = gamesPlayed.map((game) => game.title.toLowerCase()).indexOf(game.toLowerCase());
	if (gameIdx === -1) {
		gamesPlayed.push({
			title: game,
			users: usersWhoPlay
		});
	} else {
		gamesPlayed[gameIdx].users = usersWhoPlay;
	}

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
exports.updateTimesheet = function(user, userID, highestRole, oldGame, newGame) {
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
	updateWhoPlays(userID, user, highestRole, oldGame);		
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
		const game = get(member, 'presence.activity.name');
		if (game) {
			if (!gameToCount[game]) {
				gameToCount[game] = 1;
			} else {
				gameToCount[game]++;
			}
			if (gameToCount[game] > majority) {
				game.indexOf( 'B' ) == 0 ? result = game.replace( 'B', '🅱️' ) : result = game; 
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
		c.LOG.info(`<INFO> ${util.getTimestamp()}  Resetting Channel Name - ${voiceChannel.name} -> ${defaultName}`);							
		voiceChannel.setName(defaultName);
	}
}

/**
 * Updates the dynamic voice channel names if the majority is playing a game.
 * 
 * @param {Object[]} channels - the server's channels
 */
exports.maybeUpdateChannelNames = function(channels) {
	gameChannels.forEach((channel) => {
		if (channel.members.length !== 0) {
			const majorityGame = determineMajorityGame(channel);
			var fuse = new Fuse([channel.name], c.CHANNEL_NAME_FUZZY_OPTIONS);
			//only rename if the name is not already up to date
			if (fuse.search(`▶ ${majorityGame}`).length === 0) {
				if (majorityGame) {
					c.LOG.info(`<INFO> ${util.getTimestamp()}  Updating Channel Name - ${channel.name} -> ▶ ${majorityGame}`);					
					channel.setName(`▶ ${majorityGame}`);
				} else {
					resetChannelName(channel);
				}
			}
		} else {
			resetChannelName(channel);
		}
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
		const gameTokens = game.split(' ');
		var nick = `${nameTokens[0]} ▫ `;
		gameTokens.forEach((token) => {
			const firstChar = token[0].toUpperCase();
			nick += c.ENCLOSED_CHARS[firstChar] || firstChar;
		});
		c.LOG.info(`<INFO> ${util.getTimestamp()}  Updating Nickname - ${member.displayName} -> ${nick}`);	
		member.setNickname(nick);
	} else {
		if (nameTokens[1]) {
			c.LOG.info(`<INFO> ${util.getTimestamp()}  Updating Nickname - ${member.displayName} -> ${nameTokens[0]}`);				
			member.setNickname(nameTokens[0]);
		}
	}
};