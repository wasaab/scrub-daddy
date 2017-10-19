function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}
const Discord = require('discord.io');
const auth = require('./secureAuth.json'); 
// Initialize Discord Bot
define('BOT', new Discord.Client({
    token: auth.token,
    autorun: true
 }));
 
define('LOG', require('winston'));

define("LOOP_DELAY", 1500);							        //delay between each loop
define('BOT_SPAM_CHANNEL_ID', '370626436609867786');		//listen's to messages from this channel
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
	KICK : "kick" ,
	BAN : "ban",
	PTT : "force Push To Talk",
	REMOVE_ROLE : "remove role",
	CUSTOM : "custom"
});
define('CHANNEL_ID_TO_BAN_ROLE_ID',{
	'370625207150575617' : '363913248665370644',	        //Beyond
	'370625515293507584' : '363912027749482497',	        //Str8 Chillin
	'370625345138720809' : '363912469611282432',	        //D. Va licious
	'370626021227233290' : '363912643028844544',	        //Spazzy's Scrub Shack
	'370625671833190400' : '363912739082469378',	        //Cartoon Network
	'370625623736975372' : '363912781667500033',	        //The League
	'370626139972042752' : '363912963377201152',	        //They'll fix that b4 release
	'370628203523473408' : '363913029630558209'		        //Where he at doe?
});