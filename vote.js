//there is a role in discord that makes it so you can only use push to talk in the channel permissions. do seperate vote for this. fuck alec.
//reset a lot of the vars when channel members drop below 2.
//voteChannelMembers needs to be updating. 
//target needs to check against name and id even in the concat one
//persist this data through exits so that I can use !voteunkick? also considered automating unkick.
    //https://github.com/simonlast/node-persist
const c = require('./const.js');
const util = require('./utilities.js');
const bot = require('./bot.js');
const inspector = require('util');
var get = require('lodash.get');
var voteChannelMembers = {
	'370625207150575617' : [],						//Beyond
	'370625515293507584' : [],						//Str8 Chillin
	'370625345138720809' : [],						//D. Va licious
	'370626021227233290' : [],						//Spazzy's Scrub Shack
	'370625671833190400' : [],						//Cartoon Network
	'370625623736975372' : [],						//League
	'370626139972042752' : [],						//They'll fix that b4 release
	'370628203523473408' : []						//Where he at doe?
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
		util.sendEmbedFieldsMessage("Custom Vote Totals", totals);
	}
}

/**
 * Retrieves the total votes for the given target
 * 
 * @param {String} user - the user requesting the total
 * @param {String} kickChannel - the voice channel to kick a user from
 * @param {String} channelID - bot-spam channel to respond in
 * @param {String[]} args - input args of the requester (cmd and target)
 */
exports.getTotalVotesForTarget = function(user, kickChannel, channelID, args) {
	if (!kickChannel) {
		const description = 'Sup ' + user + '! Tryna voteinfo @user from nothing, ey dumbass?';
		util.sendEmbedMessage(null, description);
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
		util.sendEmbedFieldsMessage(kickChannel.name + "	-	Vote Totals for " + titleTarget, totals);
	}
}

/**
 * Gets the ID of the vote's target iff they are in the current vote's channel.
 * 
 * @param {Object} vote - the current vote 
 * @returns {String} the id of the target if found and 'none' otherwise
 */
function getTargetInVoteChannel(vote) {
	var result;
	voteChannelMembers[vote.channelID].forEach(function(vMember) {
		const kickTarget = vote.targetConcat.split(':-:')[0];
		if (vMember.name === kickTarget || (kickTarget.match(/\d/g) !== null && vMember.id === kickTarget.match(/\d/g).join(""))) {
			result = vMember.fullMember;
		}
	});
	
	return result;
}

/**
 * Ends the vote and performs the relevant operation for the vote type.
 * 
 * @param {Object} vote - the current vote 
 * @param {Object} target - the vote's target
 * @param {Collection} roles - server's roles
 */
function endVote(vote, target, roles) {
	switch (vote.targetConcat.split(':-:')[2]) {
		case c.VOTE_TYPE.BAN:
			target.addRole(roles.find('id', c.CHANNEL_ID_TO_BAN_ROLE_ID[vote.channelID]));
			target.setVoiceChannel(bot.getPurgatory());
			break;
		case c.VOTE_TYPE.KICK:
			target.setVoiceChannel(bot.getPurgatory());	
	}
}

/**
 * Ends the vote if the necessary conditions have been met.
 * 
 * @param {Object} voteData - the current vote
 */
function maybeEndVote(voteData, roles) {
	const target = getTargetInVoteChannel(voteData);
	if (!target) {
		return;
	}

	channelSize = voteChannelMembers[voteData.channelID].length;
	const majority = channelSize/2;
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  majority: ' + majority + ' votes: ' + votes[voteData.targetConcat]);
	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const targetName = voteData.targetConcat.split(':-:')[0];
		endVote(voteData, target, roles);
		
		const description = targetName + ' has been voted off the island, a.k.a. ' + voteData.channelName + '!' ;
		util.sendEmbedMessage(null, description);
		c.LOG.info('<KICK> ' + util.getTimestamp() + '  Kicking ' + targetName + ' from ' + voteData.channelName);							
	}
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
exports.conductVote = function(user, userID, channelID, args, type, kickChannel, roles) {
	//if voting user not in a voice channel
	if (!kickChannel) {
		const description = 'Sup ' + user + '! Tryna vote' + type + ' from nothing, ey dumbass?';
		util.sendEmbedMessage(null, description);
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

		//if not a custom vote
		if (type !== c.VOTE_TYPE.CUSTOM) {
			voteChannelMembers[kickChannel.id] = [];
			var kickMembers = kickChannel.members.array();
			kickMembers.forEach(function (member) {
				var memberData = {id: member.id, name: member.displayName, fullMember: member}
				voteChannelMembers[kickChannel.id].push(memberData);
			})
			exports.getTotalVotesForTarget(user, kickChannel, channelID, args);		
			var currVote =  {
				channelID : kickChannel.id, 
				channelName : kickChannel.name, 
				targetConcat: targetConcat,
			};			
			maybeEndVote(currVote, roles);	
			c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + votes[targetConcat] + msg + target + ' from ' + kickChannel.name);	
		} else {
			//custom vote
			var message = votes[targetConcat] + msg
			if (votes[targetConcat] > 2) {
				message = 'The vote has concluded with ' + votes[targetConcat] + msg
			}
			util.sendEmbedMessage(null, message);
			c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + message);				
		}
	} else {
		const message = 'Fuck yourself ' + user + '! You can only vote for a person once.';
		util.sendEmbedMessage(null, message);
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
