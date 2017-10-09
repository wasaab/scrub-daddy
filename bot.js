//there is a role in discord that makes it so you can only use push to talk in the channel permissions. do seperate vote for this. fuck alec.
//reset a lot of the vars when channel members drop below 2.
//voteChannelMembers needs to be updating. 
//target needs to check against name and id even in the concat one
//persist this data through exits so that I can use !voteunkick? also considered automating unkick.
	//https://github.com/simonlast/node-persist
const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json'); 
const util = require('util');
const loopDelay = 1500;								//delay between each loop
const botSpamChannelID = '261698738718900224';		//listen's to messages from this channel
const purgatoryChannelID = '363935969310670861';	//sends kicked user's to this channel
const serverID = '132944227163176960';				//Bed Bath Server ID
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const voteType =  {
	KICK : "kick" ,
	BAN : "ban",
	PTT : "force Push To Talk",
	REMOVE_ROLE : "remove role",
	CUSTOM : "custom"
}
// Initialize Discord Bot
const bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
const channelIDToBanRoleID = {
	'260886906437500928' : '363913248665370644',	//Beyond
	'134557049374769152' : '363912027749482497',	//Str8 Chillin
	'188111442770264065' : '363912469611282432',	//D. Va licious
	'258062007499096064' : '363912643028844544',	//Spazzy's Scrub Shack
	'258041915574845440' : '363912739082469378',	//Cartoon Network
	'132944231583973376' : '363912781667500033',	//The Dream Team
	'309106757110857729' : '363912871693778946',	//25pooky
	'318081358364934151' : '363912911661432849',	//Cat People
	'338468590716190722' : '363912963377201152',	//They'll fix that b4 release
	'280108491929157643' : '363913029630558209'		//Where he at doe?
}
var voteChannelMembers = {
	'260886906437500928' : [],						//Beyond
	'134557049374769152' : [],						//Str8 Chillin
	'188111442770264065' : [],						//D. Va licious
	'258062007499096064' : [],						//Spazzy's Scrub Shack
	'258041915574845440' : [],						//Cartoon Network
	'132944231583973376' : [],						//The Dream Team
	'309106757110857729' : [],						//25pooky
	'318081358364934151' : [],						//Cat People
	'338468590716190722' : [],						//They'll fix that b4 release
	'280108491929157643' : []						//Where he at doe?
};
var votes = {};										//map of targetConcat to number of votes
var alreadyVoted = {};								//map of targetConcat to array of people who have voted for them
var kickChannel = {};								//channel the kick is being initiated in (name, id)

/**
 * initializes the logger
 */
function initLogger() {
	logger.remove(logger.transports.Console);
	logger.add(logger.transports.Console, {
    	colorize: true
	});
	logger.level = 'debug';
}

/**
 * Gets a timestamp representing the current time.
 * 
 * @return {String} properly formatted timestamp
 */
function getTimestamp() {
	function pad(n) {
			return (n < 10) ? '0' + n : n;
	}

	const time = new Date();
	const day = days[time.getDay()];
	var hours = time.getHours();
	var minutes = time.getMinutes();

	if (hours > 12) {
		hours -= 12;
	} else if (hours === 0) {
		hours = 12;
	}

	return day + ' ' + pad(hours) + ':' + pad(minutes);
}

/**
 * Logs the response of an API request for Add Role or Move User.
 * 
 * @param {String} error - error returned from API request
 * @param {Object} response - response returned from API request
 */
function log(error, response) {
	if (undefined === response) {
		if (null === error || undefined === error) {
			logger.info('<AddRoleOrMoveUser API INFO> ' + getTimestamp() + '  Successful API Call');
		} else {
			logger.info('<AddRoleOrMoveUser API RESPONSE> ' + getTimestamp() + '  ERROR: ' + error);			
		}
	} else {
		logger.info('<AddRoleOrMoveUser API RESPONSE> ' + getTimestamp() + '  ' + response);
	}
}

/**
 * Gets the ID of the vote's target iff they are in the current vote's channel.
 * 
 * @param {Object} vote - the current vote 
 * @returns {String} the id of the target if found and 'none' otherwise
 */
function getIDOfTargetInVoteChannel(vote) {
	var result = 'none';
	voteChannelMembers[vote.channelID].forEach(function(vMember) {
		const kickTarget = vote.targetConcat.split(':-:')[0];
		if (vMember.name === kickTarget || vMember.id === kickTarget.match(/\d/g).join("")) {
			result = vMember.id;
		}
	});
	
	return result;
}

/**
 * Ends the vote and performs the relevant operation for the vote type.
 * 
 * @param {Object} vote - the current vote 
 * @param {String} targetsID - the id of the vote's target
 */
function endVote(vote, targetsID) {
	purgatoryMoveReq = {serverID: serverID, userID: targetsID, channelID: purgatoryChannelID};
	switch (vote.targetConcat.split(':-:')[2]) {
		case voteType.BAN:
			var roleReq = {serverID: serverID, roleID: channelIDToBanRoleID[vote.channelID], userID: targetsID};		
			bot.addToRole(roleReq, log);
			bot.moveUserTo(purgatoryMoveReq, log);
			break;
		case voteType.KICK:
			bot.moveUserTo(purgatoryMoveReq. log);
	}
}

/**
 * Ends the vote if the necessary conditions have been met.
 * 
 * @param {Object} voteData - the current vote
 */
function maybeEndVote(voteData) {
	const targetID = getIDOfTargetInVoteChannel(voteData);
	if (targetID === 'none') {
		return;
	}

	channelSize = voteChannelMembers[voteData.channelID].length;
	const majority = channelSize/2;
	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const target = voteData.targetConcat.split(':-:')[0];
		endVote(voteData, targetID);

		bot.sendMessage({
			to: botSpamChannelID,
			message: target + ' has been voted off the island, a.k.a. ' + voteData.channelName + '!' 
		});
		logger.info('<KICK> ' + getTimestamp() + '  Kicking ' + target + ' from ' + voteData.channelName);							
	}
}

/**
 * Adds a member from the voice channel associated with a vote 
 * to the voteChannelMembers array.
 * 
 * @param {String} error - error returned from API getUser request
 * @param {Object} response - response returned from API getUser request
 */
function addVoteChannelMember(error, response) {
	if (undefined === response) {
		logger.info('<GetUser API RESPONSE> ' + getTimestamp() + '  ERROR: ' + error);
	} else {
		const userObj = {id : response.id, name : response.username};
		voteChannelMembers[lockedBy.channelID].push(userObj);
		logger.info('<GetUser API RESPONSE> ' + getTimestamp() +  '  userID: ' + response.id + ' name: ' + response.username);
	}
};

var lockedBy = {voteID : ' '};

/**
 * Executes a 1.5 second wait before calling maybeEndVote(),
 * so that a getUser request can finish.
 * 
 * @param {Boolean} retry - flag to signify first loop iteration 
 */
function maybeEndVoteAfterWaitingToGetUser(retry) {
	setTimeout(function() {
		if (!retry) {
			maybeEndVote(lockedBy);
			lockedBy.voteID = ' ';	
		} else {
			maybeEndVoteAfterWaitingToGetUser(false);
		}
	}, loopDelay);
}

/**
 * Retrieves the name and id of members currently in the voice channel, who are eligible to vote.
 * 
 * @param {Object[]} kickChannelMembers - the members in the channel (not including names)
 * @param {Number} i - number of members grabbed
 * @param {Object} vote - the current vote
 */
function retrieveVoteMembers(kickChannelMembers, i, vote) {
	if (lockedBy.voteID === ' ') {
		lockedBy = vote;
	}
	if (lockedBy.voteID !== vote.voteID) {
		return;
	}
	if (voteChannelMembers[vote.channelID].length > 0 && Object.keys(kickChannelMembers).length == voteChannelMembers[vote.channelID].length) {
		logger.info('<INFO> ' + getTimestamp() +  '  Not updating voteChannelMembers.');
		maybeEndVote(vote);
		return;
	}

	//Only allowed into this function if vote == lockedBy
	setTimeout(function(){
		const member = {userID : kickChannelMembers[Object.keys(kickChannelMembers)[i]].user_id};
		bot.getUser(member, addVoteChannelMember);
		i++;
		
		//continue loop if members remain
		if (i < Object.keys(kickChannelMembers).length) {
			retrieveVoteMembers(kickChannelMembers, i, lockedBy);
		} else {
			maybeEndVoteAfterWaitingToGetUser(true);
		}
	}, loopDelay);
}

/**
 * Determines which voice channel the vote has been initiated from.
 * 
 * @param {String} userID - id of the user initiating the vote
 */
function determineKickChannel(userID) {
	const channels = bot.channels;
	for (var c in channels) {
		var channel = channels[c];
		for (var m in channel.members) {
			var member = channel.members[m];
			if (member.user_id === userID) {
				var kChannel = {id : c, name : channel.name};
				return kChannel;
			}	
		}
	}
	return 'none';
};

/**
 * Builds the a unique vote id for the current vote.
 */
function buildVoteID() {
	return 'xx-xx-yx'.replace(/[xy]/g, function(c) {
	  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	  return v.toString(16);
	});
}

/**
 * Conducts a vote to kick or ban the specified user from the channel provided.
 * 
 * @param {String} user - the user
 * @param {String} userID - the user's ID
 * @param {String} channelID - the channel's ID
 * @param {String[]} args - target of the vote
 * @param {String} type - vote type
 */
function conductVote(user, userID, channelID, args, type) {
	const kickChannel = { id: '', name: ''};
	if (type !== voteType.CUSTOM) {
		kickChannel = determineKickChannel(userID);	
	}
	
	//if voting user not in a voice channel
	if (kickChannel === 'none') {
		bot.sendMessage({
			to: channelID,
			message: 'Sup ' + user + '! Tryna vote' + type + ' from nothing, ey dumbass?'
		});
		logger.info('<INFO> ' + getTimestamp() + '  ' + user + ' is trying to kick from nothing.');		
		return;
	}			

	var target = args[1];
	for (var k=2; k < args.length; k++) {
		target += ' ' + args[k];
	}
	if (type === voteType.CUSTOM) {
		type = target;
	}
	const targetConcat = target + ':-:' + kickChannel.id + ':-:' + type;
	var msg = ' votes to ' + type + ' '; 				
	
	if (votes[targetConcat] === undefined) {
		alreadyVoted[targetConcat] = [];
		votes[targetConcat] = 0;
		msg = ' vote to ' + type + ' ';
	}
	if (!alreadyVoted[targetConcat].includes(user)) {
		votes[targetConcat] = votes[targetConcat] + 1;
		alreadyVoted[targetConcat].push(user); 
		var currVote =  {
			voteID : buildVoteID(), 
			channelID : kickChannel.id, 
			channelName : kickChannel.name, 
			targetConcat: targetConcat
		};					

		if (type !== voteType.CUSTOM) {
			retrieveVoteMembers(bot.channels[kickChannel.id].members, 0, currVote);
			bot.sendMessage({
				to: channelID,
				message: votes[targetConcat] + msg + target + ' from ' + kickChannel.name
			});
			logger.info('<INFO> ' + getTimestamp() + '  ' + votes[targetConcat] + msg + target + ' from ' + kickChannel.name);	
		} else {
			var message = votes[targetConcat] + msg + target
			if (votes[targetConcat] > 2) {
				message = 'The vote has concluded with ' + votes[targetConcat] + msg + target 
			}
			bot.sendMessage({
				to: channelID,
				message: message
			});
			logger.info('<INFO> ' + getTimestamp() + '  ' + message);				
		}
	} else {
		bot.sendMessage({
			to: channelID,
			message: 'Fuck yourself ' + user + '! You can only vote for a person once.'
		});
		logger.info('<INFO> ' + getTimestamp() + '  ' + user + ' is attempting to vote for a person more than once.');
	}
}

/**
 * Listen's for messages in Discord
 */
bot.on('message', function (user, userID, channelID, message, evt) {
	// stops if the message is not from bot-spam text channel
	if (channelID !== botSpamChannelID) {
		return;
	}

    // Scrub Daddy will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
		const args = message.substring(1).match(/\S+/g);
		const cmd = args[0];

        switch(cmd) {
			case 'vote':
				conductVote(user, userID, channelID, args, voteType.CUSTOM);			
				break;
			case 'votekick':
				logger.info('<VOTE Kick> ' + getTimestamp() + '  ' + user + ': ' + message);
				conductVote(user, userID, channelID, args, voteType.KICK);
				break;
			case 'voteban':
				logger.info('<VOTE Ban> ' + getTimestamp() + '  ' + user + ': ' + message);			
				conductVote(user, userID, channelID, args, voteType.BAN);
				break;
			case 'help':
			case 'info':
			case 'helpinfo':
				bot.sendMessage({
					to: channelID,
					message: 'Commands: !votekick @user to remove from channel or !voteban @user for a more permanent solution. You must be in a voice channel with at least 3 members to participate in a vote.' 
				});
         }
     }
});

/**
 * Logs the bot into Discord.
 */
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
//console.log(util.inspect(bot.channels[chanID.id].members, false, null));