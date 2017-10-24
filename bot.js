const inspector = require('util');
const c = require('./const.js');
const util = require('./utilities.js');
const gambling = require('./gambling.js');
var games = require('./games.js');
var vote = require('./vote.js');

/**
 * Asks Scrubs if they want to play pubg.
 */
function askToPlayPUBG() {
	c.BOT.sendMessage({
		to: c.SCRUBS_CHANNEL_ID,
		message: "<@&370671041644724226>  " + c.GREETINGS[util.getRand(0, c.GREETINGS.length)] + " tryna play some " + c.PUBG_ALIASES[util.getRand(0, c.PUBG_ALIASES.length)] + "?"
	});	
}

/**
 * Listen's for messages in Discord
 */
c.BOT.on('message', function (user, userID, channelID, message, evt) {
    //Scrub Daddy will listen for messages that will start with `!`
    if (message.substring(0, 1) == '*') {
		const args = message.substring(1).match(/\S+/g);
		const cmd = args[0];

		//stops if the message is not from bot-spam text channel, with the expection of the message !p.
		if (channelID !== c.BOT_SPAM_CHANNEL_ID && !(channelID === c.SCRUBS_CHANNEL_ID && cmd === 'p')) {
			return;
		}
		c.LOG.info('<INFO> ' + util.getTimestamp() + '  ' + cmd + ' called');	
        switch(cmd) {
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
				askToPlayPUBG();
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
				vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.KICK);
				break;
			case 'voteban':
				c.LOG.info('<VOTE Ban> ' + util.getTimestamp() + '  ' + user + ': ' + message);			
				vote.conductVote(user, userID, channelID, args, c.VOTE_TYPE.BAN);
				break;
			//get custom vote totals or number of kick/ban votes for a user
			case 'voteinfo':
				if (args[1] === undefined) {
					c.LOG.info('<VOTE Info Custom> ' + util.getTimestamp() + '  ' + user + ': ' + message);								
					vote.getCustomVoteTotals();
				} else {
					c.LOG.info('<VOTE Info User> ' + util.getTimestamp() + '  ' + user + ': ' + message);													
					vote.getTotalVotesForTarget(user, userID, channelID, args);
				}	
				break;
			case 'help':
			case 'info':
			case 'helpinfo':
				c.BOT.sendMessage({
					to: channelID,
					embed:  {
						color: 0xffff00,
						title: "Commands",
						description: "------------------------- Voting --------------------------" +
									 "\nPlease Note: You must be in a voice channel with at least 3 members to participate in a kick/ban vote." +
									 "\n\n!votekick <@user> - to remove user from channel." +
									 "\n!voteban <@user> - for a more permanent solution." +
									 "\n!vote <thing to vote for> - to do a custom vote." +
									 "\n!voteinfo - for totals of all custom votes." +
									 "\n!voteinfo <@user> - for total votes to kick/ban that user." +
									 "\n------------------------------------------------------------" +
									 "\n\n------------------------ Gambling ------------------------" +
									 "\n!enlist - enlists the discharged Scrubbing Bubbles to your army." +
									 "\n!discharge - honorably discharges a Scrubbing Bubble from your army." +
									 "\n!clean <numBubbles> <t|b> - send numBubbles to clean toilet/bath." +
									 "\n!army - retrieves the size of your army" +
									 "\n------------------------------------------------------------" +	
									 "\n\n----------------------- Time Played ----------------------" +
									 "\n!time <Game Name> <@user> - user's playtime for the specified Game Name." +
									 "\n!time <Game Name> - cumulative playtime for the specified Game Name." +
									 "\n!time <@user> - user's playtime for all games." + 
									 "\n!time - cumulative playtime for all games." +
									 "\n!opt-in - to opt into playtime tracking." + 
									 "\n------------------------------------------------------------" +									 
									 "\n\n---------------------- Player Count ----------------------" +
									 "\n!playing - player count of games currently being played." +
									 "\n!gameHistory - player counts for all games throughout the day." +
									 "\n------------------------------------------------------------" +
									 "\n\n!test - to try out features in development." +									 
									 "\n!p - to ask @Scrubs to play PUBG in scrubs text channel." +
									 "\n!help, !info, or !helpinfo - to show this message again."
					}
				});
		 }
	 } else if (userID === c.SCRUB_DADDY_ID && evt.d.embeds !== undefined && evt.d.embeds[0] !== undefined && 
		evt.d.embeds[0].title !== undefined && evt.d.embeds[0].title.indexOf('duty') !== -1) {
		gambling.maybeDeletePreviousMessage(evt.d.id);
	}
});

/**
 * listens for updates to a user's presence (online status, game, etc).
 */
c.BOT.on('presence', function(user, userID, status, game, event) { 
	games.updateTimesheet(user, userID, game);
	gambling.maybeDischargeScrubBubble();
});

/**
 * Logs the bot into Discord.
 */
c.BOT.on('ready', function (evt) {
	//util.initLogger();
    c.LOG.info('<INFO> ' + util.getTimestamp() + '  Connected');
    c.LOG.info('<INFO> Logged in as: ');
	c.LOG.info('<INFO> ' + c.BOT.username + ' - (' + c.BOT.id + ')');
});

c.BOT.on('disconnect', function(erMsg, code) {
	c.LOG.info('<ERROR> ' +  util.getTimestamp() + '  code: ' + code + '  msg: ' + erMsg);
	c.BOT.connect();
});

//console.log(inspector.inspect(bot.getScrubs(), false, null));


	// bot.sendMessage({
	// 	to: c.BOT_SPAM_CHANNEL_ID,
	// 	embed:  {
	// 		color: 0xffff00,
	// 		title: "This is a test of the Emergency Broadcast System",
	// 		image: {
	// 			url: "https://i.kinja-img.com/gawker-media/image/upload/s--gXPJs2QR--/c_scale,f_auto,fl_progressive,q_80,w_800/sv3a6heu1v5d9ubr9ke3.jpg",
	// 		}
	// 	} 
	// });		