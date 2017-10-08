//there is a role in discord that makes it so you can only use push to talk in the channel permissions. do seperate vote for this. fuck alec.
//reset a lot of the vars when channel members drop below 2.
//voteChannelMembers needs to be updating. 
//target needs to check against name and id even in the concat one
//persist this data through exits so that I can use !voteunkick? also considered automating unkick.
	//https://github.com/simonlast/node-persist
const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json'); 
var votes = {};
var alreadyVoted = {};
//need to make this work for multiple votes going on at once as u did with already voted

const util = require('util');
const loopDelay = 1500;	// delay between each loop
const botSpamChannelID = '261698738718900224';		
const purgatoryChannelID = '363935969310670861';
const serverID = '132944227163176960';
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
	'260886906437500928' : [],	//Beyond
	'134557049374769152' : [],	//Str8 Chillin
	'188111442770264065' : [],	//D. Va licious
	'258062007499096064' : [],	//Spazzy's Scrub Shack
	'258041915574845440' : [],	//Cartoon Network
	'132944231583973376' : [],	//The Dream Team
	'309106757110857729' : [],	//25pooky
	'318081358364934151' : [],	//Cat People
	'338468590716190722' : [],	//They'll fix that b4 release
	'280108491929157643' : []	//Where he at doe?
};

var kickChannel = {};
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
//fakeasdasdasdasdasdasdeterwsadfgsdfdhfswetfgdgsdsafdfdhgfghrdfs
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
const bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

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

function getIDOfTargetInVoteChannel(vote) {
	var result = 'none';
	//logger.info('vote: ' + util.inspect(vote, false, null));
	voteChannelMembers[vote.channelID].forEach(function(vMember) {
		//logger.info('vMember: ' + util.inspect(vMember, false, null));		
		const kickTarget = vote.targetConcat.split(':-:')[0];
		//logger.info('kickTarget: ' + kickTarget + ' toID: ' + kickTarget.match(/\d/g).join(""));
		if (vMember.name === kickTarget || vMember.id === kickTarget.match(/\d/g).join("")) {
			//logger.info('returning: ' + vMember.id);
			result = vMember.id;
		}
	});
	
	return result;
}


function maybeEndVote(voteData) {
	const targetID = getIDOfTargetInVoteChannel(voteData);
	//logger.info('targetID: ' + targetID);
	if (targetID === 'none') {
		return;
	}

	channelSize = voteChannelMembers[voteData.channelID].length;
	const majority = channelSize/2;
	//logger.info('channelSize: ' + channelSize);	
	if (channelSize > 2 && votes[voteData.targetConcat] > majority) {
		const target = voteData.targetConcat.split(':-:')[0];
		logger.info('<KICK> ' + getTimestamp() + '  Kicking ' + target + ' from ' + voteData.channelName);					
		var req = {serverID: serverID, roleID: channelIDToBanRoleID[voteData.channelID], userID: targetID};
		bot.addToRole(req, log);
		req = {serverID: serverID, userID: targetID, channelID: purgatoryChannelID};
		bot.moveUserTo(req, log);

		bot.sendMessage({
			to: botSpamChannelID,
			message: target + ' has been voted off the island, a.k.a. ' + voteData.channelName + '!' 
		});
	}
}

function addVoteChannelMembers(error, response) {
	if (undefined === response) {
		logger.info('<GetUser API RESPONSE> ' + getTimestamp() + '  ERROR: ' + error);
	} else {
		const userObj = {id : response.id, name : response.username};
		voteChannelMembers[lockedBy.channelID].push(userObj);
		logger.info('<GetUser API RESPONSE> ' + getTimestamp() +  '  userID: ' + response.id + ' name: ' + response.username);
	}
};

var lockedBy = {voteID : ' ', channelID : ' ', channelName : ' '};

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

function retrieveVoteMembers(kickChannelMembers, i, vote) {
	if (lockedBy.voteID === ' ') {
		lockedBy = vote;
	}
	
	//stop if the members have all been stored
	//the if locked will become an issue when i expect to get namne from voteMembers at successful kick.
	//Is it really likely for the majority to be reached before ive finished grabbing the users names though?
	if (lockedBy.voteID !== vote.voteID || Object.keys(kickChannelMembers).length == voteChannelMembers[vote.channelID].length) {
		logger.info('<INFO> ' + getTimestamp() +  '  Not updating voteChannelMembers.');
		//logger.info('condition1: ' + (lockedBy.voteID !== vote.voteID));
		//logger.info('condition2: ' + (Object.keys(kickChannelMembers).length == voteChannelMembers[vote.channelID].length));
		maybeEndVote(vote); //STOP CALLING THIS JUST BECAUSE VOTE ISNT LOCKED BY.
							//why check for end condition if length isn't where it needs to be yet. 
							//probably just want to call return in such a case.
							//think carefully about this logic because u were assuming all kinds of shit about right side of ||
							//based upon knowing left condition must have been false
		return;
	}

	//Only allowed into this function if vote == lockedBy
	setTimeout(function(){
		const member = {userID : kickChannelMembers[Object.keys(kickChannelMembers)[i]].user_id};
		bot.getUser(member, addVoteChannelMembers);
		i++;
		
		//continue loop if members remain
		if (i < Object.keys(kickChannelMembers).length) {
			retrieveVoteMembers(kickChannelMembers, i, lockedBy);
		} else {
			maybeEndVoteAfterWaitingToGetUser(true);
		}
	}, loopDelay);
}

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

function uuid() {
	return 'xx-xx-yx'.replace(/[xy]/g, function(c) {
	  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	  return v.toString(16);
	});
}

bot.on('message', function (user, userID, channelID, message, evt) {
	if (channelID !== botSpamChannelID) {
		return;
	}
	logger.info('<MSG> ' + getTimestamp() + '  ' + user + ': ' + message);

    // Scrub Daddy will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
		const args = message.substring(1).match(/\S+/g);
		const cmd = args[0];

        switch(cmd) {
			case 'votekick':
				const kickChannel = determineKickChannel(userID);	
				//if voting user not in a voice channel
				if (kickChannel === 'none') {
					bot.sendMessage({
						to: channelID,
						message: 'Sup ' + user + '! Tryna votekick from nothing, ey dumbass?'
					});
					return;
				}			

				const target = args[1];
				for (var k=2; k < args.length; k++) {
					target += ' ' + args[k];
				}
				const targetConcat = target + ':-:' + kickChannel.id;
				var msg = ' votes to kick ';				
				
				if (votes[targetConcat] === undefined) {
					alreadyVoted[targetConcat] = [];
					votes[targetConcat] = 0;
					msg = ' vote to kick ';
				}
				if (!alreadyVoted[targetConcat].includes(user)) {
					votes[targetConcat] = votes[targetConcat] + 1;
					alreadyVoted[targetConcat].push(user); 
					var currVote =  {voteID : uuid(), channelID : kickChannel.id, channelName : kickChannel.name, targetConcat: targetConcat};					
					retrieveVoteMembers(bot.channels[kickChannel.id].members, 0, currVote);

					bot.sendMessage({
						to: channelID,
						message: votes[targetConcat] + msg + target + ' from ' + kickChannel.name
					});
				} else {
					bot.sendMessage({
						to: channelID,
						message: 'Fuck yourself ' + user + '! You can only vote for a person once.'
					});
				}
         }
     }
});

//console.log(util.inspect(bot.channels[chanID.id].members, false, null));