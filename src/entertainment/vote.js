var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
const { logger } = require('../logger.js');
const cmdHandler = require('../handlers/cmdHandler.js');

var voteChannelIdToMembers = {};
var votes = {}; // map of targetConcat to number of votes
var alreadyVoted = {}; // map of targetConcat to array of people who have voted for them

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
		util.sendEmbedMessage(
			'The task you voted for does not exist',
			'Make sure your input matches the channel title. Only letters, nums, -, _ are allowed.'
		);
	}
}

/**
 * Outputs totals for custom votes to bot-spam channel.
 */
function getCustomVoteTotals(userID) {
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
}

/**
 * Retrieves the total votes for the given target
 *
 * @param {String} user - the user requesting the total
 * @param {String} kickChannel - the voice channel to kick a user from
 * @param {String[]} args - input args of the requester (cmd and target)
 */
function getTotalVotesForTarget(user, userID, kickChannel, args) {
	if (!kickChannel) {
		const description = `${util.mentionUser(userID)}, you must be in a voice channel with the target user`;

		util.sendEmbed({ description, userID });
		logger.info(`${user} is trying to voteinfo a user not in their VC.`);
		return;
	}

	var target = util.getTargetFromArgs(args, 1);
	var titleTarget = 'The Provided User';
	const voteChannelMembers = voteChannelIdToMembers[kickChannel.id];

	if (!voteChannelMembers) { return; }

	voteChannelMembers.forEach((member) => {
		if (member.name === target || (util.isMention(target) && member.id === util.getIdFromMention(target))) {
			titleTarget = member.name;
		}
	});

	const kickTargetKey = `${target}:-:${kickChannel.id}:-:${c.VOTE_TYPE.KICK}`;
	const banTargetKey = `${target}:-:${kickChannel.id}:-:${c.VOTE_TYPE.BAN}`;
	var totals = [];

	if (votes[kickTargetKey]) {
		totals.push(util.buildField('Kick 👢', votes[kickTargetKey]));
	}

	if (votes[banTargetKey]) {
		totals.push(util.buildField('Ban 🔨', votes[banTargetKey]));
	}

	if (totals.length > 0) {
		util.sendEmbedFieldsMessage(`${kickChannel.name}    -	Vote Totals for ${titleTarget}`, totals, userID);
	}
}

/**
 * Gets the ID of the vote's target iff they are in the current vote's channel.
 *
 * @param {Object} vote - the current vote
 * @returns {Object} the member iff found.
 */
function getTargetInVoteChannel(vote) {
	const voteChannelMembers = voteChannelIdToMembers[vote.channelID];

	if (!voteChannelMembers) { return; }

	const targetMember = voteChannelMembers.find((member) => {
		const kickTarget = vote.targetConcat.split(':-:')[0];

		return member.name === kickTarget || (util.isMention(kickTarget) && member.id === util.getIdFromMention(kickTarget));
	});

	if (!targetMember) { return; }

	return targetMember.fullMember;
}

/**
 * Ends the vote and performs the relevant operation for the vote type.
 *
 * @param {Object} vote - the current vote
 * @param {Object} target - the vote's target
 * @param {Collection} roles - server's roles
 */
function endVote(vote, target, roles) {
	const voteType = vote.targetConcat.split(':-:')[2];

	if (c.VOTE_TYPE.BAN === voteType) {
		target.addRole(roles.find('id', c.CHANNEL_ID_TO_BAN_ROLE_ID[vote.channelID]));
		target.setVoiceChannel(bot.getPurgatory());
	} else { // vote kick
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

	if (!target) { return; }

	const voteChannelMembers = voteChannelIdToMembers[voteData.channelID];

	if (!voteChannelMembers) { return; }

	const channelSize = voteChannelMembers.length;
	const majority = channelSize / 2;

	logger.info(`majority: ${majority} votes: ${votes[voteData.targetConcat]}`);

	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const targetName = voteData.targetConcat.split(':-:')[0];

		endVote(voteData, target, roles);

		const description = `${targetName} has been voted off the island, a.k.a. ${voteData.channelName}! 🔨`;

		util.sendEmbed({ description, userID });
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
function conductVote(user, userID, args, type, kickChannel, roles) {
	if (type === c.VOTE_TYPE.CUSTOM) {
		kickChannel = { id: '', name: ''};
	}

	//if voting user not in a voice channel
	if (!kickChannel) {
		const description = `Sup ${user}! Tryna vote${type} from nothing, eh?`;

		util.sendEmbed({ description, userID });
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

	//If the user has already voted for the target
	if (alreadyVoted[targetConcat].includes(user)) {
		const description = `Nice try, ${user}. You can only vote for a person once.`;

		util.sendEmbed({ description, userID });
		logger.info(`${user} is attempting to vote for a person more than once.`);
	} else {
		votes[targetConcat]++;
		alreadyVoted[targetConcat].push(user);

		//If custom vote
		if (kickChannel.name === '') {
			var message = votes[targetConcat] + msg;

			if (votes[targetConcat] > 2) {
				message = `The vote has concluded with ${votes[targetConcat]}${msg}`;

				if (targetConcat.startsWith('implement')) {
					maybeMoveTaskToInProgress(targetConcat.split(':')[0].slice(10));
				}
			}

			util.sendEmbed({ description: `📋 ${message}`, userID });
			logger.info(`${message}`);
		} else {	//not a custom vote
			var kickMembers = kickChannel.members.array();

			voteChannelIdToMembers[kickChannel.id] = [];
			kickMembers.forEach((member) => {
				var memberData = {id: member.id, name: util.getNick(member.id), fullMember: member};

				voteChannelIdToMembers[kickChannel.id].push(memberData);
			});
			getTotalVotesForTarget(user, userID, kickChannel, args);

			var currVote = {
				channelID : kickChannel.id,
				channelName : kickChannel.name,
				targetConcat: targetConcat,
			};

			maybeEndVote(currVote, roles, userID);
			logger.info(`${votes[targetConcat]}${msg}${target} from ${kickChannel.name}`);
		}
	}
}

exports.registerCommandHandlers = () => {
  cmdHandler.registerCommandHandler(
		'implement',
		(message, args) => {
			args.splice(1, 0, args[0]);
			conductVote(util.getNick(message.member.id), message.member.id, args, c.VOTE_TYPE.CUSTOM);
		}
	);

  cmdHandler.registerCommandHandler(
		'vote',
		(message, args) => conductVote(util.getNick(message.member.id), message.member.id, args, c.VOTE_TYPE.CUSTOM)
	);

  cmdHandler.registerCommandHandler(
		'voteban',
		(message, args) => {
			const user = util.getNick(message.member.id);

			logger.info(`VOTE Ban - ${user}: ${message}`);
			conductVote(user, message.member.id, args, c.VOTE_TYPE.BAN, message.member.voiceChannel, message.guild.roles);
		}
	);

  cmdHandler.registerCommandHandler(
		'voteinfo',
		(message, args) => {
			const user = util.getNick(message.member.id);

			if (args[1]) {
				logger.info(`VOTE Info User - ${user}: ${message}`);
				getTotalVotesForTarget(user, message.member.id, message.member.voiceChannel, args);
			} else {
				logger.info(`VOTE Info Custom - ${user}: ${message}`);
				getCustomVoteTotals(message.member.id);
			}
		}
	);

  cmdHandler.registerCommandHandler(
		'votekick',
		(message, args) => {
			const user = util.getNick(message.member.id);

			logger.info(`VOTE Kick - ${user}: ${message}`);
			conductVote(user, message.member.id, args, c.VOTE_TYPE.KICK, message.member.voiceChannel, message.guild.roles);
		}
  );
};