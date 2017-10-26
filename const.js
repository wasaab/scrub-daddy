const util = require('./utilities.js');
const auth = require('./secureAuth.json'); 
var get = require('lodash.get');
function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

// Initialize Discord Bot
// define('BOT', new Discord.Client({
//     token: auth.token,
//     autorun: true
//  }));
 
define('LOG', require('winston'));

define("LOOP_DELAY", 1500);							        //delay between each loop
define('BOT_SPAM_CHANNEL_ID', '372865125155078154');		//listen's to messages from this channel
define('SCRUBS_CHANNEL_ID', '370626384059695107');		    //channel ID of scrubs text channel
define('SERVER_ID', auth.serverID);				    		//Bed Bath Server ID
define('DAYS', ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]);
define('PUBG_ALIASES', ["scrubg", "pubg", "pugG", "pabg", "pobg", "pebg", "pibg", "pybg", "Mr. Pib G.", "pub", "pudgy", "puh ba gee"]);
define('GREETINGS', ["you guys", "yous guys", "y'all", "hey buddies,", "hey pals,", "hey friends,", "sup dudes,", "hello fellow humans,"]);
define('BOT_IDS', ['172002275412279296', '86920406476292096', '188064764008726528', '263059218104320000', '116275390695079945', '362784198848675842']);
define('GAME_NAME_TO_IMG', {
    'World of Warcraft' : 'http://i.imgur.com/US59X7X.jpg', 
    'Overwatch' : 'http://i.imgur.com/WRQsSYp.png', 
    'PUBG' : 'https://i.imgur.com/nT2CNCs.png', 
    'Fortnite' : 'https://i.imgur.com/S0CN7n9.jpg'
});
define('PURGATORY_CHANNEL_ID', '370626266786824192');	    //sends kicked user's to this channel    
define('VOTE_TYPE', {
	KICK : "kick",
	BAN : "ban",
	PTT : "force Push To Talk",
	REMOVE_ROLE : "remove role",
	CUSTOM : "custom"
});
define('CHANNEL_ID_TO_BAN_ROLE_ID',{
	'370625207150575617' : '370746310346801164',	        //Beyond
	'370625515293507584' : '370747862302326785',	        //Str8 Chillin
	'370625345138720809' : '370747704621662218',	        //D. Va licious
	'370626021227233290' : '370748388578295808',	        //Spazzy's Scrub Shack
	'370625671833190400' : '370747928400232448',	        //Cartoon Network
	'370625623736975372' : '370748471835230209',	        //The League
	'370626139972042752' : '370747759130705922',	        //They'll fix that b4 release
});
define('BUBBLE_IMAGES', ['https://i.imgur.com/rddtZR6.png','https://i.imgur.com/MdKfKVG.png','https://i.imgur.com/ZAyLJSJ.png','https://i.imgur.com/K6k4b3q.png','https://i.imgur.com/m7V6BEa.png',
						 'https://i.imgur.com/Q7JO7Fn.png','https://i.imgur.com/lXZNXoz.png','https://i.imgur.com/xdwTSuG.png','https://i.imgur.com/PE99BJ8.png','https://i.imgur.com/VhFgbRQ.png',
						 'https://i.imgur.com/hQvbZkP.png','https://i.imgur.com/LLdxaj4.png','https://i.imgur.com/cCiI4CE.png','https://i.imgur.com/fue3AAM.png','https://i.imgur.com/8cah0Ar.png',
						 'https://i.imgur.com/3bXFEcL.png','https://i.imgur.com/Q33oITR.png','https://i.imgur.com/O2iQuhP.png','https://i.imgur.com/LUq3M1Q.png','https://i.imgur.com/ne412gl.png',
						 'https://i.imgur.com/ASgP6i6.png']);
define('SCRUB_DADDY_ID', '370688149971795982');
define('SCRUB_ID_TO_NICK', util.getScrubIDToNick());
define('HELP_MSG',  '------------------------- Voting --------------------------' +
					'\nPlease Note: You must be in a voice channel with at least 3 members to participate in a kick/ban vote.' +
					'\n\n!votekick <@user> - to remove user from channel.' +
					'\n!voteban <@user> - for a more permanent solution.' +
					'\n!vote <thing to vote for> - to do a custom vote.' +
					'\n!voteinfo - for totals of all custom votes.' +
					'\n!voteinfo <@user> - for total votes to kick/ban that user.' +
					'\n------------------------------------------------------------' +
					'\n\n------------------------ Gambling ------------------------' +
					'\n!enlist - enlists the discharged Scrubbing Bubbles to your army.' +
					'\n!discharge - honorably discharges a Scrubbing Bubble from your army.' +
					'\n!clean <numBubbles> <t|b> - send numBubbles to clean toilet/bath.' +
					'\n!army - retrieves the size of your army' +
					'\n------------------------------------------------------------' +	
					'\n\n----------------------- Time Played ----------------------' +
					'\n!time <Game Name> <@user> - user\'s playtime for the specified Game Name.' +
					'\n!time <Game Name> - cumulative playtime for the specified Game Name.' +
					'\n!time <@user> - user\'s playtime for all games.' + 
					'\n!time - cumulative playtime for all games.' +
					'\n!opt-in - to opt into playtime tracking.' + 
					'\n------------------------------------------------------------' +									 
					'\n\n---------------------- Player Count ----------------------' +
					'\n!playing - player count of games currently being played.' +
					'\n!gameHistory - player counts for all games throughout the day.' +
					'\n------------------------------------------------------------' +
					'\n\n!test - to try out features in development.' +									 
					'\n!p - to ask @Scrubs to play PUBG in scrubs text channel.' +
					'\n!help, !info, or !helpinfo - to show this message again.');