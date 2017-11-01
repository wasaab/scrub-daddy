var Discord = require('discord.js');
var inspect = require('util-inspect');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var util = require('./utilities.js');
var gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');

var auth = require('./secureAuth.json'); 
var client = new Discord.Client();
client.login(auth.token);

var botSpam = {};
var scrubsChannel = {};
var purgatory = {};
var feedbackCategory = {};
var scrubIDtoNick = {};

/**
 * Returns true iff the message is an arrived for duty message.
 * 
 * @param {Object} message - the full message object
 */
function isArrivedForDutyMessage(message) {
	return message.member.id === c.SCRUB_DADDY_ID 
			&& get (message, 'embeds[0].title') 
			&& message.embeds[0].title.indexOf('duty') !== -1 
			&& message.channel.id === c.BOT_SPAM_CHANNEL_ID;
}

/**
 * Listen's for messages in Discord
 */
client.on('message', message => {
	const firstChar = message.content.substring(0, 1);
    //Scrub Daddy will listen for messages that will start with `!`
    if (firstChar === '!') {
		const args = message.content.substring(1).match(/\S+/g);
		const cmd = args[0];
		const channelID = message.channel.id;
		const user = message.member.displayName;
		var userID = message.member.id;
		
		//stops if the message is not from bot-spam text channel, with the exception of the message !p.
		if (channelID !== c.BOT_SPAM_CHANNEL_ID && !(channelID === c.SCRUBS_CHANNEL_ID && cmd === 'p')) {
			return;
		}

		c.LOG.info('<CMD> ' + util.getTimestamp() + '  ' + cmd + ' called');	
        switch(cmd) {
			case 'temp':
				const channelType = args[1] || 'text';
				const channelName = args[2] || 'temp-channel';
				util.createChannelInCategory(cmd, channelType, channelName, message, ' Channel Created By ' + user);
				break;
			case 'issue':
			case 'feature':
				const chanName = args[1];
				const feedback = args.slice(2).join(' ');
				console.log('feedback: ' + feedback);
				util.createChannelInCategory(cmd, 'text', chanName, message, ' Submitted By ' + user, feedback);
				break;
			case 'export':
				gambling.exportLedger();
				games.exportTimeSheet();
				break;
			case 'catfacts':
				util.catfacts();
				break;
			case 'army':
				gambling.army(userID, args);
				break;
			case 'stats':
				gambling.stats(userID, args);
				break;
			case 'rank':
			case 'ranks':
				gambling.armyRanks();
				break;
			case 'clean':
				gambling.maybeBetClean(userID, args);
				break;
			case 'revive':
				if (userID !== '132944096347160576') { break; }
				userID = 'dev';
			case 'discharge':
				gambling.maybeDischarging(userID, args); 
				break;
			case 'enlist':
				gambling.enlist(userID);
				break;
			case 'p':
				games.askToPlayPUBG();
				break;
			case 'playing':
				games.getAndOutputCountOfGamesBeingPlayed(message.guild.members.array());
				break;
			case 'gameHistory':
				games.maybeOutputGameHistory();
				break;
			case 'time':
				games.maybeOutputTimePlayed(args);
				break;
			case 'opt-in':
				games.optIn(user, userID);
				break;
			//custom vote
			case 'vote':
				vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.CUSTOM);			
				break;
			case 'votekick':
				c.LOG.info('<VOTE Kick> ' + util.getTimestamp() + '  ' + user + ': ' + message);
				vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.KICK, message.member.voiceChannel, message.guild.roles);
				break;
			case 'voteban':
				c.LOG.info('<VOTE Ban> ' + util.getTimestamp() + '  ' + user + ': ' + message);			
				vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.BAN, message.member.voiceChannel, message.guild.roles);
				break;
			//get custom vote totals or number of kick/ban votes for a user
			case 'voteinfo':
				if (!args[1]) {
					c.LOG.info('<VOTE Info Custom> ' + util.getTimestamp() + '  ' + user + ': ' + message);								
					vote.getCustomVoteTotals();
				} else {
					c.LOG.info('<VOTE Info User> ' + util.getTimestamp() + '  ' + user + ': ' + message);													
					vote.getTotalVotesForTarget(user, message.member.voiceChannel, channelID, args);
				}	
				break;
			case 'help':
			case 'info':
			case 'helpinfo':
				util.help();
		 }
	 } else if (isArrivedForDutyMessage(message)) {
		gambling.maybeDeletePreviousMessage(message);
	} 
});



/**
 * listens for updates to a user's presence (online status, game, etc).
 */
client.on('presenceUpdate', (oldMember, newMember) => { 
	games.updateTimesheet(newMember.displayName, newMember.id, get(oldMember, 'presence.activity.name'), get(newMember, 'presence.activity.name'));
	gambling.maybeDischargeScrubBubble(botSpam);
});

/**
 * Reconnects the bot if diconnected.
 */
client.on('disconnect', event => {
	c.LOG.error('<ERROR> ' +  util.getTimestamp() + '  event: ' + inspect(event));
	client.login(auth.token);
});

/**
 * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
 */
client.on('ready', () => {
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  Connected');
	
	const members = client.guilds.find('id', c.SERVER_ID).members;
	members.forEach((member) => {
		scrubIDtoNick[member.id] = member.displayName;
	});

	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);	
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID);
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);		
});

exports.getBotSpam = () => botSpam;
exports.getScrubsChannel = () => scrubsChannel;
exports.getPurgatory = () => purgatory;
exports.getScrubIDToNick = () => scrubIDtoNick;
exports.getClient = () => client;

