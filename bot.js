const inspector = require('util');
const c = require('./const.js');
const util = require('./utilities.js');
const gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');
var get = require('lodash.get');
var fs = require('fs');

const Discord = require('discord.js');
const auth = require('./secureAuth.json'); 
const client = new Discord.Client();

client.login(auth.token);
var botSpam = {};
var scrubsChannel = {};
var purgatory = {};


exports.getBotSpam = function() {
	return botSpam;
}

exports.getScrubsChannel = function() {
	return scrubsChannel;
}

exports.getPurgatory = function() {
	return purgatory;
}

/**
 * Listen's for messages in Discord
 */
//TODO: refactor this so that i dont need to pass in a million params to everything. should pass one object and then it gets split on in the other file
client.on('message', message => {
    //Scrub Daddy will listen for messages that will start with `!`
    if (message.content.substring(0, 1) == '*') {
		const args = message.content.substring(1).match(/\S+/g);
		const cmd = args[0];
		const channelID = message.channel.id;
		const userID = message.member.id;
		const user = message.member.displayName;

		//stops if the message is not from bot-spam text channel, with the expection of the message !p.
		if (channelID !== c.BOT_SPAM_CHANNEL_ID && !(channelID === c.SCRUBS_CHANNEL_ID && cmd === 'p')) {
			return;
		}
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + cmd + ' called');	
        switch(cmd) {
			case 'issue':
				util.submitIssue(userID, args);
				break;
			case 'rank':
			case 'ranks':
				gambling.armyRanks();
				break;
			case 'catfacts':
				util.catfacts();
				break;
			case 'export':
				gambling.exportLedger();
				games.exportTimeSheet();
				break;
			case 'army':
				gambling.army(userID, args);
				break;
			case 'clean':
				//PRIORITIZE ADDING NICKNAMES VIA GETSCRUBS SO YOU CAN RESPOND TO BETS WITH NICKNAMES
				gambling.maybeBetClean(userID, args);
				break;
			case 'discharge':
				gambling.dischargeScrubBubble(userID);
				break;
			case 'enlist':
				gambling.enlist(userID);
				break;
			case 'p':
				games.askToPlayPUBG();
				break;
			case 'playing':
				games.getAndOutputCountOfGamesBeingPlayed();
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
				if (args[1] === undefined) {
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
				util.sendEmbedMessage('Commands', c.HELP_MSG);
		 }
	 //TODO: replace reference to content with whatever im using in this new api. title does not exist under message.
	 } else if (message.member.id === c.SCRUB_DADDY_ID && get(message, 'embeds[0].title') && message.embeds[0].title.indexOf('duty') !== -1 && message.channel.id === c.BOT_SPAM_CHANNEL_ID) {
		gambling.maybeDeletePreviousMessage(message);
	}
});

/**
 * listens for updates to a user's presence (online status, game, etc).
 */
client.on('presenceUpdate', (oldMember, newMember) => { 
	//You are now fed both old and new member so you can actually know what game they finished playing!
	games.updateTimesheet(newMember.displayName, newMember.id, get(oldMember, 'presence.game.name'), get(newMember, 'presence.game.name'));
	gambling.maybeDischargeScrubBubble(botSpam);
});


/**
 * Logs the bot into Discord.
 */
client.on('ready', () => {
	c.LOG.info('<INFO> ' + util.getTimestamp() + '  Connected');
	botSpam = client.channels.find('id', c.BOT_SPAM_CHANNEL_ID);	
	scrubsChannel = client.channels.find('id', c.SCRUBS_CHANNEL_ID);
	purgatory = client.channels.find('id', c.PURGATORY_CHANNEL_ID);
});

client.on('disconnect', event => {
	c.LOG.info('<ERROR> ' +  util.getTimestamp() + '  event: ' + inspector.inspect(event, false, null));
	client.login(auth.token);
});

//console.log(inspector.inspect(member, false, null));
// bot.sendMessage({
// 	to: c.BOT_SPAM_CHANNEL_ID,
// 	embed:  {
// 		color: 0xffff00,
// 		title: 'This is a test of the Emergency Broadcast System',
// 		image: {
// 			url: 'https://i.kinja-img.com/gawker-media/image/upload/s--gXPJs2QR--/c_scale,f_auto,fl_progressive,q_80,w_800/sv3a6heu1v5d9ubr9ke3.jpg',
// 		}
// 	} 
// });		