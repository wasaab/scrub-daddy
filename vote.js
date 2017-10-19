//there is a role in discord that makes it so you can only use push to talk in the channel permissions. do seperate vote for this. fuck alec.
//reset a lot of the vars when channel members drop below 2.
//voteChannelMembers needs to be updating. 
//target needs to check against name and id even in the concat one
//persist this data through exits so that I can use !voteunkick? also considered automating unkick.
    //https://github.com/simonlast/node-persist
const c = require('./const.js');
const util = require('./utilities.js');

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
 * Outputs totals for custom votes to bot-spam channel.
 */
exports.getCustomVoteTotals = function() {
	var totals = [];
	for (var targetConcat in votes) {
		const target = targetConcat.split(':-:')[2];
		if (target !== c.VOTE_TYPE.KICK && target !== c.VOTE_TYPE.BAN) {
			totals.push({
				name: target,
				value: votes[targetConcat],
				inline: 'true'
			});
		}
	}
	if (totals.length > 0) {
		util.sendEmbedMessage("Custom Vote Totals", totals);
	}
}

/**
 * Retrieves the total votes for the given target
 * 
 * @param {String} user - the user requesting the total
 * @param {String} userID - id of the user requesting the total
 * @param {String} channelID - bot-spam channel to respond in
 * @param {String[]} args - input args of the requester (cmd and target)
 */
exports.getTotalVotesForTarget = function(user, userID, channelID, args) {
	const kickChannel = determineKickChannel(userID)
	if (kickChannel === 'none') {
		c.BOT.sendMessage({
			to: channelID,
			message: 'Sup ' + user + '! Tryna voteinfo @user from nothing, ey dumbass?'
		});
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + user + ' is trying to voteinfo @user from nothing.');	
		return;
	}
	var target = args[1];
	for (var k=2; k < args.length; k++) {
		target += ' ' + args[k];
	}
	var titleTarget = 'The Provided User';
	voteChannelMembers[kickChannel.id].forEach(function(vMember) {
		if (vMember.name === target || (target.match(/\d/g) !== null && vMember.id === target.match(/\d/g).join(""))) {
			titleTarget = vMember.name;
		}
	});
	const kickTargetConcat = target + ':-:' + kickChannel.id + ':-:' + c.VOTE_TYPE.KICK;
	const banTargetConcat = target + ':-:' + kickChannel.id + ':-:' + c.VOTE_TYPE.BAN;
	var totals = [];
	if (votes[kickTargetConcat] !== undefined) {
		totals.push(util.buildField("Kick", votes[kickTargetConcat]));
	}
	if (votes[banTargetConcat] !== undefined) {
		totals.push(util.buildField("Ban", votes[banTargetConcat]));
	}
	if (totals.length > 0) {
		util.sendEmbedMessage(kickChannel.name + "	-	Vote Totals for " + titleTarget, totals);
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
		if (vMember.name === kickTarget || (kickTarget.match(/\d/g) !== null && vMember.id === kickTarget.match(/\d/g).join(""))) {
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
	purgatoryMoveReq = {serverID: c.SERVER_ID, userID: targetsID, channelID: c.PURGATORY_CHANNEL_ID};
	switch (vote.targetConcat.split(':-:')[2]) {
		case c.VOTE_TYPE.BAN:
			var roleReq = {serverID: c.SERVER_ID, roleID: c.CHANNEL_ID_TO_BAN_ROLE_ID[vote.channelID], userID: targetsID};		
			c.BOT.addToRole(roleReq, util.log);
			c.BOT.moveUserTo(purgatoryMoveReq, util.log);
			break;
		case c.VOTE_TYPE.KICK:
			c.BOT.moveUserTo(purgatoryMoveReq, util.log);
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
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  majority: ' + majority + ' votes: ' + votes[voteData.targetConcat]);
	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const target = voteData.targetConcat.split(':-:')[0];
		endVote(voteData, targetID);

		c.BOT.sendMessage({
			to: c.BOT_SPAM_CHANNEL_ID,
			message: target + ' has been voted off the island, a.k.a. ' + voteData.channelName + '!' 
		});
		c.LOG.info('<KICK> ' + util.getTimestamp() + '  Kicking ' + target + ' from ' + voteData.channelName);							
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
		c.LOG.info('<GetUser API RESPONSE> ' + util.getTimestamp() + '  ERROR: ' + error);
	} else {
		const userObj = {id : response.id, name : response.username};
		voteChannelMembers[lockedBy.channelID].push(userObj);
		c.LOG.info('<GetUser API RESPONSE> ' + util.getTimestamp() +  '  userID: ' + response.id + ' name: ' + response.username);
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
	}, c.LOOP_DELAY);
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
		c.LOG.info('<INFO> ' + util.getTimestamp() +  '  Not updating voteChannelMembers.');
		maybeEndVote(vote);
		lockedBy.voteID = ' ';	
		return;
	}

	//Only allowed into this function if vote == lockedBy
	setTimeout(function(){
		const member = {userID : kickChannelMembers[Object.keys(kickChannelMembers)[i]].user_id};
		c.BOT.getUser(member, addVoteChannelMember);
		i++;
		
		//continue loop if members remain
		if (i < Object.keys(kickChannelMembers).length) {
			retrieveVoteMembers(kickChannelMembers, i, lockedBy);
		} else {
			maybeEndVoteAfterWaitingToGetUser(true);
		}
	}, c.LOOP_DELAY);
}

/**
 * Determines which voice channel the vote has been initiated from.
 * 
 * @param {String} userID - id of the user initiating the vote
 */
function determineKickChannel(userID) {
	const channels = c.BOT.channels;
	for (var cID in channels) {
		var channel = channels[cID];
		for (var m in channel.members) {
			var member = channel.members[m];
			if (member.user_id === userID) {
				var kChannel = {id : cID, name : channel.name};
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
exports.conductVote = function(user, userID, channelID, args, type) {
	var kickChannel = { id: '', name: ''};
	if (type !== c.VOTE_TYPE.CUSTOM) {
		kickChannel = determineKickChannel(userID);	
	}
	
	//if voting user not in a voice channel
	if (kickChannel === 'none') {
		c.BOT.sendMessage({
			to: channelID,
			message: 'Sup ' + user + '! Tryna vote' + type + ' from nothing, ey dumbass?'
		});
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + user + ' is trying to kick from nothing.');		
		return;
	}			

	var target = args[1];
	for (var k=2; k < args.length; k++) {
		target += ' ' + args[k];
	}
	if (type === c.VOTE_TYPE.CUSTOM) {
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

		//if not a custom vote
		if (kickChannel.name !== '') {
			retrieveVoteMembers(c.BOT.channels[kickChannel.id].members, 0, currVote);
			getTotalVotesForTarget(user, userID, channelID, args);			
			c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + votes[targetConcat] + msg + target + ' from ' + kickChannel.name);	
		} else {
			//custom vote
			var message = votes[targetConcat] + msg
			if (votes[targetConcat] > 2) {
				message = 'The vote has concluded with ' + votes[targetConcat] + msg
			}
			c.BOT.sendMessage({
				to: channelID,
				message: message
			});
			c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + message);				
		}
	} else {
		c.BOT.sendMessage({
			to: channelID,
			message: 'Fuck yourself ' + user + '! You can only vote for a person once.'
		});
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + user + ' is attempting to vote for a person more than once.');
	}
}












// var bannedFrom = [];		

// function getBanned(members) {
// 	var bannedIDToChannelID = {};
// 	for (var member in members) {
// 		if (member.roles !== undefined && member.roles.length > 1) {			
// 		for (var id in c.CHANNEL_ID_TO_BAN_ROLE_ID) {
// 			var banRoleId = c.CHANNEL_ID_TO_BAN_ROLE_ID[id];
// 				roles.forEach(function(role) {
// 					if (role === banRoleId) {
// 						//may need to wrap member.id with <@!>
// 						const targetConcat = member.id + ':-:' + id + ':-:' + c.VOTE_TYPE.BAN;
// 						bannedFrom[targetConcat].push(id);
// 					}
// 				});
// 		}
// 	}
// }
