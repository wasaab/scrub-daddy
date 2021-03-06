var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;

var voteChannelMembers = {
	'370625207150575617' : [],						//Beyond
	'370625515293507584' : [],						//Str8 Chillin
	'370625345138720809' : [],						//Post Beta
	'370626021227233290' : [],						//Spazzy's Scrub Shack
	'370625671833190400' : [],						//Cartoon Network
	'370625623736975372' : [],						//Civ Anonymous
	'370626139972042752' : [],						//They'll fix that b4 release
	'370628203523473408' : []						//Where he at doe?
};
var votes = {};										//map of targetConcat to number of votes
var alreadyVoted = {};								//map of targetConcat to array of people who have voted for them

/**
 * Moves the channel associated with the provided task name to the
 * In Progress category iff the channel exists.
 *
 * @param {String} taskName - the name of the task/channel to move
 */
function maybeMoveTaskToInProgress(taskName) {
	const taskChannel = bot.getServer().channels.find('name', taskName);
	if (taskChannel) {
		taskChannel.setParent(c.CATEGORY_ID['In Progress']);
		taskChannel.send('The scrubs have spoken! Implement this feature next.');
	} else {
		util.sendEmbedMessage('The task you voted for does not exist',
			'Make sure your input matches the channel title. Only letters, nums, -, _ are allowed.');
	}
}

/**
 * Outputs totals for custom votes to bot-spam channel.
 */
exports.getCustomVoteTotals = function(userID) {
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
		util.sendEmbedFieldsMessage('Custom Vote Totals', totals, userID);
	}
};

/**
 * Retrieves the total votes for the given target
 *
 * @param {String} user - the user requesting the total
 * @param {String} kickChannel - the voice channel to kick a user from
 * @param {String[]} args - input args of the requester (cmd and target)
 */
exports.getTotalVotesForTarget = function(user, userID, kickChannel, args) {
	if (!kickChannel) {
		const description = `Sup ${user}! Tryna voteinfo @user from nothing, ey dumbass?`;
		util.sendEmbedMessage(null, description, userID);
		logger.info(`${user} is trying to voteinfo @user from nothing.`);
		return;
	}
	var target = util.getTargetFromArgs(args, 1);
	var titleTarget = 'The Provided User';
	voteChannelMembers[kickChannel.id].forEach((vMember) => {
		if (vMember.name === target || (util.isMention(target) && vMember.id === util.getIdFromMention(target))) {
			titleTarget = vMember.name;
		}
	});
	const kickTargetConcat = `${target}:-:${kickChannel.id}:-:${c.VOTE_TYPE.KICK}`;
	const banTargetConcat = `${target}:-:${kickChannel.id}:-:${c.VOTE_TYPE.BAN}`;
	var totals = [];
	if (votes[kickTargetConcat]) {
		totals.push(util.buildField('Kick 👢', votes[kickTargetConcat]));
	}
	if (votes[banTargetConcat]) {
		totals.push(util.buildField('Ban 🔨', votes[banTargetConcat]));
	}
	if (totals.length > 0) {
		util.sendEmbedFieldsMessage(`${kickChannel.name}    -	Vote Totals for ${titleTarget}`, totals, userID);
	}
};

/**
 * Gets the ID of the vote's target iff they are in the current vote's channel.
 *
 * @param {Object} vote - the current vote
 * @returns {Object} the member iff found.
 */
function getTargetInVoteChannel(vote) {
	var result;
	voteChannelMembers[vote.channelID].forEach((vMember) => {
		const kickTarget = vote.targetConcat.split(':-:')[0];
		if (vMember.name === kickTarget || (util.isMention(kickTarget) && vMember.id === util.getIdFromMention(kickTarget))) {
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
function maybeEndVote(voteData, roles, userID) {
	const target = getTargetInVoteChannel(voteData);
	if (!target) {
		return;
	}

	const channelSize = voteChannelMembers[voteData.channelID].length;
	const majority = channelSize/2;
	logger.info(`majority: ${majority} votes: ${votes[voteData.targetConcat]}`);
	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const targetName = voteData.targetConcat.split(':-:')[0];
		endVote(voteData, target, roles);

		const description = `${targetName} has been voted off the island, a.k.a. ${voteData.channelName}! 🔨` ;
		util.sendEmbedMessage(null, description, userID);
		logger.info(`Kicking ${targetName} from ${voteData.channelName}`);
	}
}

/**
 * Conducts a vote to kick or ban the specified user from the channel provided.
 * TODO: Refactor
 *
 * @param {String} user - the user
 * @param {String} userID - the user's ID
 * @param {String[]} args - target of the vote
 * @param {String} type - vote type
 * @param {String} kickChannel - the voice channel of the user calling !vote
 * @param {String} roles - the guild's role objects
 */
exports.conductVote = function(user, userID, args, type, kickChannel, roles) {
	if (type === c.VOTE_TYPE.CUSTOM) {
		kickChannel = { id: '', name: ''};
	}

	//if voting user not in a voice channel
	if (!kickChannel) {
		const description = `Sup ${user}! Tryna vote${type} from nothing, ey dumbass?`;
		util.sendEmbedMessage(null, description, userID);
		logger.info(`${user} is trying to kick from nothing.`);
		return;
	}

	var target = util.getTargetFromArgs(args, 1);
	if (type === c.VOTE_TYPE.CUSTOM) {
		type = target;
	}

	if ('implement' === args[0]) {
		if (!util.isMention(args[2], c.MENTION_TYPE.channel)) { return; }

		const taskChannel = bot.getServer().channels.find('id', util.getIdFromMention(args[2]));

		if (!taskChannel || (taskChannel.parentID !== c.CATEGORY_ID.Issue
			&& taskChannel.parentID !== c.CATEGORY_ID.Feature)) { return; }
	}

	const targetConcat = `${target}:-:${kickChannel.id}:-:${type}`;
	var msg = ` votes to ${type} `;

	//If this is the first vote for the given target
	if (!votes[targetConcat]) {
		alreadyVoted[targetConcat] = [];
		votes[targetConcat] = 0;
		msg = ` vote to ${type} `;
	}
	//If the user has not already voted for the target
	if (!alreadyVoted[targetConcat].includes(user)) {
		votes[targetConcat] = votes[targetConcat] + 1;
		alreadyVoted[targetConcat].push(user);

		//If not a custom vote
		if (kickChannel.name !== '') {
			voteChannelMembers[kickChannel.id] = [];
			var kickMembers = kickChannel.members.array();
			kickMembers.forEach((member) => {
				var memberData = {id: member.id, name: util.getNick(member.id), fullMember: member};
				voteChannelMembers[kickChannel.id].push(memberData);
			});
			exports.getTotalVotesForTarget(user, userID, kickChannel, args);
			var currVote =  {
				channelID : kickChannel.id,
				channelName : kickChannel.name,
				targetConcat: targetConcat,
			};
			maybeEndVote(currVote, roles, userID);
			logger.info(`${votes[targetConcat]}${msg}${target} from ${kickChannel.name}`);
		} else {
			//custom vote
			var message = votes[targetConcat] + msg;
			if (votes[targetConcat] > 2) {
				message = `The vote has concluded with ${votes[targetConcat]}${msg}`;

				if (targetConcat.startsWith('implement')) {
					maybeMoveTaskToInProgress(targetConcat.split(':')[0].slice(10));
				}
			}
			util.sendEmbedMessage(null, `📋 ${message}`, userID);
			logger.info(`${message}`);
		}
	} else {
		const message = `Screw yourself ${user}! You can only vote for a person once.`;
		util.sendEmbedMessage(null, message, userID);
		logger.info(`${user} is attempting to vote for a person more than once.`);
	}
};