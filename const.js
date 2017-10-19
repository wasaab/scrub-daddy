function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}
const Discord = require('discord.io');
const auth = require('./auth.json'); 
// Initialize Discord Bot
define('BOT', new Discord.Client({
    token: auth.token,
    autorun: true
 }));
 
define('LOG', require('winston'));

define("LOOP_DELAY", 1500);							        //delay between each loop
define('BOT_SPAM_CHANNEL_ID', '261698738718900224');		//listen's to messages from this channel
define('SCRUBS_CHANNEL_ID', '132944227163176960');		    //channel ID of scrubs text channel
define('SERVER_ID', '132944227163176960');				    //Bed Bath Server ID
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
define('PURGATORY_CHANNEL_ID', '363935969310670861');	    //sends kicked user's to this channel    
define('VOTE_TYPE', {
	KICK : "kick" ,
	BAN : "ban",
	PTT : "force Push To Talk",
	REMOVE_ROLE : "remove role",
	CUSTOM : "custom"
});
define('CHANNEL_ID_TO_BAN_ROLE_ID',{
	'260886906437500928' : '363913248665370644',	        //Beyond
	'134557049374769152' : '363912027749482497',	        //Str8 Chillin
	'188111442770264065' : '363912469611282432',	        //D. Va licious
	'258062007499096064' : '363912643028844544',	        //Spazzy's Scrub Shack
	'258041915574845440' : '363912739082469378',	        //Cartoon Network
	'132944231583973376' : '363912781667500033',	        //The Dream Team
	'309106757110857729' : '363912871693778946',	        //25pooky
	'318081358364934151' : '363912911661432849',	        //Cat People
	'338468590716190722' : '363912963377201152',	        //They'll fix that b4 release
	'280108491929157643' : '363913029630558209'		        //Where he at doe?
});