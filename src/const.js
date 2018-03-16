var util = require('./utilities.js');

const private = require('../../private.json'); 

function define(name, value) {
    Object.defineProperty(exports, name, {
        value: value,
        enumerable: true
    });
}

define('LOG', util.logger);
define('LOOP_DELAY', 1500);							//delay between each loop
//Todo: pull up to line 26 from config.json
define('BOT_SPAM_CHANNEL_ID', '372570540482887701');//listen's to messages from this channel
define('SCRUBS_CHANNEL_ID', '370626384059695107');	//channel ID of scrubs text channel
define('LOG_CHANNEL_ID', '410258655322308608');		    	//channel ID of the text channel used for redirecting the console
define('SERVER_ID', private.serverID);				//Bed Bath Server ID
define('CATEGORY_ID', {
	'Issue': '372143355070644255', 
	'Feature': '374009714213781504',
	'Temp': '374246719648694282',
	'In Progress': '374702344316780567'
});
define('SCRUBS_ROLE', '<@&370671041644724226>');
define('SCRUBS_ROLE_ID', '370671041644724226');
define('REVIEW_ROLE', '<@&376391242105225216>');
define('REVIEW_ROLE_ID', '376391242105225216');
define('DAYS', ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
define('PUBG_ALIASES', ['scrubg', 'pubg', 'pugG', 'pabg', 'pobg', 'pebg', 'pibg', 'pybg', 'Mr. Pib G.', 'pub', 'pudgy', 'puh ba gee']);
define('GREETINGS', ['you guys', 'yous guys', 'y\'all', 'hey buddies,', 'hey pals,', 'hey friends,', 'sup dudes,', 'hello fellow humans,']);
//Todo: pull from config.json or determine programtically on start
define('BOT_IDS', ['172002275412279296', '86920406476292096', '188064764008726528',
	'263059218104320000', '116275390695079945', '362784198848675842', '306583221565521921']);
//Todo: pull from config.json or make a system that searches web for img
define('GAME_NAME_TO_IMG', {
    'World of Warcraft' : 'http://i.imgur.com/US59X7X.jpg', 
    'Overwatch' : 'http://i.imgur.com/WRQsSYp.png', 
    'PUBG' : 'https://i.imgur.com/nT2CNCs.png', 
    'Fortnite' : 'https://i.imgur.com/S0CN7n9.jpg'
});
define('THUMBS_UP_GIF', 'https://i.imgur.com/CLC53gf.gif');
define('CLEAN_WIN_IMG', 'https://i.imgur.com/LDSm2sg.png');
define('CLEAN_LOSE_IMG', 'https://i.imgur.com/gynZE1j.png');
define('SCRUB_DADDY_FACT', 'https://i.imgur.com/FbAwRTj.jpg');
define('BEYOND_LOTTO_IMG', 'https://i.imgur.com/viDJZi3.png');
define('ONLINE_IMG', 'https://i.imgur.com/w4ey7v0.gif?2');
//Todo: pull from config.json
define('AFK_CHANNEL_ID', '370628203523473408');
define('PURGATORY_CHANNEL_ID', '370626266786824192');	    //sends kicked user's to this channel    
define('VOTE_TYPE', {
	KICK : 'kick',
	BAN : 'ban',
	PTT : 'force Push To Talk',
	REMOVE_ROLE : 'remove role',
	CUSTOM : 'custom'
});
//Todo: pull from config.json
define('BEYOND_ROLE_ID', '370670924992610305');
//Todo: pull from config.json
define('CHANNEL_ID_TO_BAN_ROLE_ID',{
	'370625207150575617' : '370746310346801164',	        //Beyond
	'370625515293507584' : '370747862302326785',	        //Str8 Chillin
	'370625345138720809' : '370747704621662218',	        //Post Beta
	'370626021227233290' : '370748388578295808',	        //Spazzy's Scrub Shack
	'370625671833190400' : '370747928400232448',	        //Cartoon Network
	'378656154726957067' : '370748471835230209',	        //Civ Anonymous
	'370626139972042752' : '370747759130705922'	        	//They'll fix that b4 release
});
define('GAME_CHANNEL_NAMES', {
	'370625345138720809': 'Post Beta',
	'370626021227233290': `Spazzy's Scrub Shack`, 
	'370625671833190400': 'Cartoon Network', 
	'378656154726957067': 'Civ Anonymous', 
	'370626139972042752': `They'll fix that b4 release`, 
});

define('SETTINGS_IMG', 'https://i.imgur.com/T2ABKgC.png');
define('BUBBLE_IMAGES', ['https://i.imgur.com/rddtZR6.png','https://i.imgur.com/MdKfKVG.png','https://i.imgur.com/ZAyLJSJ.png','https://i.imgur.com/K6k4b3q.png','https://i.imgur.com/m7V6BEa.png',
						 'https://i.imgur.com/Q7JO7Fn.png','https://i.imgur.com/lXZNXoz.png','https://i.imgur.com/xdwTSuG.png','https://i.imgur.com/PE99BJ8.png','https://i.imgur.com/VhFgbRQ.png',
						 'https://i.imgur.com/hQvbZkP.png','https://i.imgur.com/LLdxaj4.png','https://i.imgur.com/cCiI4CE.png','https://i.imgur.com/fue3AAM.png','https://i.imgur.com/8cah0Ar.png',
						 'https://i.imgur.com/3bXFEcL.png','https://i.imgur.com/Q33oITR.png','https://i.imgur.com/O2iQuhP.png','https://i.imgur.com/LUq3M1Q.png','https://i.imgur.com/ne412gl.png',
						 'https://i.imgur.com/ASgP6i6.png']);
define('STEAL_IMG', 'https://i.imgur.com/L1ZYgZE.png');
//Todo: pull from config.json
define('SCRUB_DADDY_ID', '370688149971795982');
//Todo: pull from config.json
define('K_ID', '132944096347160576');
define('R_ID', '208790727197589504');
define('AF_ID', '162434234357645312');
define('HELP_VOTING',[{ name: 'Please Note', value: '`You must be in a voice channel with at least 3 members to participate in a kick/ban vote.`', inline: 'false'},
					  { name: '.votekick <`@user`>', value: '`to remove user from channel.`', inline: 'false'},
					  { name: '.voteban <`@user`>', value: '`for a more permanent solution.`', inline: 'false'},
					  { name: '.vote <`thing to vote for`>', value: '`to do a custom vote.`', inline: 'false'},
					  { name: '.voteinfo', value: '`for totals of all custom votes.`', inline: 'false'},
					  { name: '.voteinfo <`@user`>', value: '`for total votes to kick/ban that user.`', inline: 'false'}]);
define('HELP_SCRUBBING_BUBBLES',[{ name: '.enlist', value: '`enlists the discharged Scrubbing Bubbles to your army.`', inline: 'false'},
								 { name: '.discharge', value: '`honorably discharges a Scrubbing Bubble from your army.`', inline: 'false'},
								 { name: '.discharge <`numBubbles`>', value: '`honorably discharges numBubbles Scrubbing Bubble from your army.`', inline: 'false'},								 
								 { name: '.clean <`numBubbles`>', value: '`send numBubbles to clean the toilet.`', inline: 'false'},
								 { name: '.21 <`numBubbles`>', value: '`to start a game of blackjack with a bet of numBubbles.`', inline: 'false'},
								 { name: '.hit', value: '`to hit in blackjack.`', inline: 'false'},
								 { name: '.stay', value: '`to stay in blackjack.`', inline: 'false'},
								 { name: '.army', value: '`retrieves the size of your army.`', inline: 'false'},
								 { name: '.army <`@user`>', value: '`retrieves the size of the user\'s army.`', inline: 'false'},
								 { name: '.ranks', value: '`outputs the army size of every user.`', inline: 'false'},
								 { name: '.stats', value: '`outputs your clean stats.`', inline: 'false'},
								 { name: '.stats <`@user`>', value: '`outputs the user\'s clean stats.`', inline: 'false'},
								 { name: '.who-said <`channel-name`> <`minMsgLength`> <`minMsgReactions`> <`sampleSize`>', 
									 value: '`Starts a quote guessing game using 5 random quotes pulled from sampleSize messages, matching the provided criteria.`', inline: 'false'},
								 { name: '.sunken-sailor', value: '`to start a game of Sunken Sailor with the users in your current voice channel.`', inline: 'false'}]);
define('HELP_TIME_PLAYED',[{ name: '.time <`Game Name`> <`@user`>', value: '`user\'s playtime for the specified Game Name.`', inline: 'false'},
						   { name: '.time <`Game Name`>', value: '`cumulative playtime for the specified Game Name.`', inline: 'false'},
						   { name: '.time <`@user`>', value: '`user\'s playtime for all games.`', inline: 'false'},
						   { name: '.time', value: '`cumulative playtime for all games.`', inline: 'false'},
						   { name: '.opt-in', value: '`to opt into playtime tracking.`', inline: 'false'},
						   { name: '.heatmap', value: '`heatmap of player count for all games.`', inline: 'false'}]);
define('HELP_GAMING',[{ name: '.playing', value: '`player count of games currently being played.`', inline: 'false'},
							{ name: '.who-plays <`Game Name`>', value: '`to get list of players and playtime for Game Name.`', inline: 'false'},
							{ name: '.lets-play', value: '`to ask all players of the game you are playing if they want to play.`', inline: 'false'},							
							{ name: '.lets-play <`Game Name|Game Emoji`>', value: '`to ask all players of Game Name if they want to play.`', inline: 'false'},
							{ name: '.lets-play -ss <`Game Name|Game Emoji`>', value: '`.lets-play without @mentioning Super ͡Scrubs.`', inline: 'false'},
							{ name: '.1-more', value: '`to request 1 more player for the game you are playing via mentions.`', inline: 'false'},														
							{ name: '.p', value: '`to ask @Scrubs to play PUBG in scrubs text channel.`', inline: 'false'},
							{ name: '.fortnite-stats <`fortniteUserName|@user`> <`gameMode`> <`stat`>', value: '`to lookup fortnite stats for the provided player.`', inline: 'false'},
							{ name: '.fortnite-leaderboard <`gameMode`> <`stat`>', value: '`to show the leaderboard for the provided game mode + stat.`', inline: 'false'},
							{ name: '.set-fortnite-name <`fortniteUserName`>', value: '`to link your Fortnite account to Scrub Daddy for stat lookup.`', inline: 'false'}]);							
define('HELP_BOT',[{ name: 'Please Note', value: '`Your issue title or feature title must be ONE WORD! msg is optional`', inline: 'false'},
				   { name: '.tips', value: '`to show all tips.`', inline: 'false'},
				   { name: '.tips <`keyword`>', value: '`to show all tips with a title that includes the provided keyword.`', inline: 'false'},
				   { name: '.issue <`issue-title`> <`msg detailing issue`>', value: '`to submit bot issues.`', inline: 'false'},
				   { name: '.feature <`feature-title`> <`msg detailing feature`>', value: '`to submit bot feature requests.`', inline: 'false'},
				   { name: '.implement <`task-title`>', value: '`to vote for the next task to complete.\ntask-title is the channel title of the issue or feature.`', inline: 'false'},
				   { name: '.help, .info, or .h', value: '`to show this message again.`', inline: 'false'}]);
define('HELP_ROLE_AND_USER',[{ name: '.join-review-team', value: '`to be added to the review team.`', inline: 'false'},
							 { name: '.leave-review-team', value: '`to be removed from the review team.`', inline: 'false'},
							 { name: '.color <`colorName`>', value: '`to set your role/response color preference.`', inline: 'false'},
							 { name: '.shuffle-scrubs', value: '`to randomize the first letter of every Srub\'s name.`', inline: 'false'},
							 { name: '.shuffle-scrubs <`letter`>', value: '`to set the first letter of every Srub\'s name.`', inline: 'false'},
							 { name: '.set-stream <`url`>', value: '`to set the url for either your stream or the stream you are watching.`', inline: 'false'},					
							 { name: '.toggle-streaming', value: '`to toggle your streaming state on/off, which will update your nickname.`', inline: 'false'},
							 { name: '.alias <`alias`> <`command to call`>', value: '`creates an alias for the provided command call. \ne.g. .alias ow who-plays Overwatch ... will allow you to call .ow`', inline: 'false'}]);
define('HELP_SOUNDBYTES', [{ name: '*sb', value: '`to get the list of available soundbytes.`', inline: 'false'},					
						   { name: '*sb <`name`>', value: '`to play the sound byte of the given name in your voice channel.`', inline: 'false'},
						   { name: '*add-sb + `ATTACHMENT IN SAME MESSAGE`', value: '`to add a sound byte.`', inline: 'false'},
						   { name: '*fav-sb', value: '`to get the list of your most frequently used soundbytes.`', inline: 'false'},
						   { name: '*volume + `ATTACHMENT IN SAME MESSAGE`', value: '`to add a sound byte.`', inline: 'false'}]);
define('HELP_UTILITIES',[
					{ name: '.temp', value: '`Creates a temporary text channel`', inline: 'false'},
					{ name: '.temp <`text|voice`>', value: '`Creates a temp text/voice channel`', inline: 'false'},
					{ name: '.temp <`text|voice`> <`channel-title`>', value: '`Creates a voice/text channel with the provided title`', inline: 'false'},
					{ name: '.start-lotto <`MM/DD`> <`HH`>', value: '`to start a Beyond lotto that will end at the specified time (`HH` can be 0-23).`', inline: 'false'},
					{ name: '.lotto', value: '`to join the currently running Beyond lotto or get the time remaining.`', inline: 'false'},
					{ name: '.quote', value: '`to quote and reply or save the quote, depending on which reaction you use (:quoteReply: or :quoteSave:).`', inline: 'false'},
					{ name: '.quote <`@user`>', value: '`to quote and reply or save the quote from @user, depending on which reaction you use (:quoteReply: or :quoteSave:).`', inline: 'false'},																		
					{ name: '.quotes', value: '`to retrieve the list of quotes from everyone on the server.`', inline: 'false'},
					{ name: '.quotes <`@user`>', value: '`to retrieve the list of quotes from the specified user.`', inline: 'false'}]);					
define('HELP_CATEGORIES_PROMPT',[{ name: 'To select a category:', value: '`Click one of the provided reactions.`', inline: 'false'},
						  { name: '.help <`command`>', value: '`to get help for a specific command`', inline: 'false'},
						  { name: '1) Voting', value: '`votekick`	`voteban`	`vote`	`voteinfo`', inline: 'false'},
						  { name: '2) Scrubbing Bubbles', value: '`enlist`	`discharge`	`clean`	`army`	`ranks`	`stats`	`21`	`hit`	`stay`	`who-said`	`sunken-sailor`', inline: 'false'},
						  { name: '3) Time Played', value: '`time`	`opt-in`	`heatmap`', inline: 'false'},
						  { name: '4) Gaming', value: '`playing`	`who-plays`	`lets-play`	`p`	`fortnite-stats`	`fortnite-leaderboard`	`set-fortnite-name`', inline: 'false'},
						  { name: '5) Bot Issues, Feature Requests, and Help', value: '`tips`	`issue`	`feature`	`implement`	`help`', inline: 'false'},
						  { name: '6) Roles & User Settings', value: '`join-review-team`	`leave-review-team`	`color`	`shuffle-scrubs`	`set-stream`	`toggle-streaming`	`alias`', inline: 'false'},
						  { name: '7) Soundbytes', value: '`*sb`	`*add-sb`	`*fav-sb`	`*volume`', inline: 'false'},					  
						  { name: '8) Utilities', value: '`temp`	`start-lotto`	`lotto`	`quote`	`quotes`', inline: 'false'}]);
define('HELP_CATEGORIES', [{name: '`Voting`', fields: exports.HELP_VOTING},
						   {name: '`Scrubbing Bubbles`', fields: exports.HELP_SCRUBBING_BUBBLES},
						   {name: '`Time Played`', fields: exports.HELP_TIME_PLAYED},
						   {name: '`Gaming`', fields: exports.HELP_GAMING},
						   {name: '`Bot Issues, Feature Requests, and Help`', fields: exports.HELP_BOT},
						   {name: '`Roles & User Settings`', fields: exports.HELP_ROLE_AND_USER},
						   {name: '`Soundbytes`', fields: exports.HELP_SOUNDBYTES}, 
						   {name: '`Utilities`', fields: exports.HELP_UTILITIES}]);
define('NEW_LEDGER_ENTRY', { 
	armySize: 0, 
	cleanBet: 0, 
	raceBet: 0, 
	recordArmy: 0, 
	highestLost: 0, 
	highestWon: 0, 
	totalWins: 0, 
	totalLosses: 0, 
	totalEnlisted: 0, 
	scrubsBet: 0, 
	scrubsWon: 0,
	scrubsLost: 0, 
    totalDischarged: 0,
	gameStarted: false,
	gameOver: true,
   	bjBet: 0,
    player: {
		acesCount: 0, 
		aces: 0, 
		points: 0, 
		hand: {}
	},
	dealer: {
		acesCount: 0, 
		aces: 0, 
		points: 0, 
		hand: {}
	}
});
define('Clubs', ['https://i.imgur.com/o7m74ae.png', 'https://i.imgur.com/s15mB52.png', 'https://i.imgur.com/8zKQuRh.png?1', 'https://i.imgur.com/cCGAnwz.png', 'https://i.imgur.com/aw8SjKM.png', 'https://i.imgur.com/fDYMBkl.png', 'https://i.imgur.com/9GdN1xf.png', 'https://i.imgur.com/KT1weaO.png', 'https://i.imgur.com/qt9QC39.png', 'https://i.imgur.com/Z13JEy5.png', 'https://i.imgur.com/ihire3h.png', 'https://i.imgur.com/YghMO9j.png', 'https://i.imgur.com/LzMzKTB.png']);
define('Spades', ['https://i.imgur.com/FHvk0sp.png', 'https://i.imgur.com/sLDI1Bo.png', 'https://i.imgur.com/WjJ2puv.png', 'https://i.imgur.com/kQC54bz.png', 'https://i.imgur.com/9LwWVZY.png', 'https://i.imgur.com/xl4iMRD.png', 'https://i.imgur.com/QZGxsEn.png', 'https://i.imgur.com/LTwacw5.png', 'https://i.imgur.com/ktDrrsF.png', 'https://i.imgur.com/1XSryPi.png', 'https://i.imgur.com/ve4ImOC.png', 'https://i.imgur.com/gedGmML.png', 'https://i.imgur.com/8AR2XPY.png']);
define('Diamonds', ['https://i.imgur.com/0yoc7jc.png', 'https://i.imgur.com/TjpZNj4.png', 'https://i.imgur.com/RT3lgO9.png', 'https://i.imgur.com/VknG03X.png', 'https://i.imgur.com/KzRjlUJ.png', 'https://i.imgur.com/yqQFHn5.png', 'https://i.imgur.com/AOPOjZI.png', 'https://i.imgur.com/2EypWwj.png', 'https://i.imgur.com/TS00BlT.png', 'https://i.imgur.com/to5qn8r.png', 'https://i.imgur.com/bulA3sS.png', 'https://i.imgur.com/WOLNfRq.png', 'https://i.imgur.com/54qFEo9.png']);
define('Hearts', ['https://i.imgur.com/gQVUlQW.png', 'https://i.imgur.com/az3oztW.png', 'https://i.imgur.com/YzJB3ee.png', 'https://i.imgur.com/3BwKfue.png', 'https://i.imgur.com/1wQv85L.png', 'https://i.imgur.com/1fRlihh.png', 'https://i.imgur.com/7JZP5Gj.png', 'https://i.imgur.com/lXizCrc.png', 'https://i.imgur.com/Cdib2wr.png', 'https://i.imgur.com/6FVwLvj.png', 'https://i.imgur.com/dT8taqF.png', 'https://i.imgur.com/yOJPOvz.png', 'https://i.imgur.com/NfHoAdu.png']);
define('TIPS', 
	[{
		color: 0xffff00,
		title: '💡 Lrn2Use .help Ya Scrub',
		description: 'You do not need to type the `<`, `|`, or `>` symbols found within .help documentation.\n\n' +
					 '<`parameter`> just lets you know the word within the arrows is a parameter for the user to input.\n\n' +
					 '| stands for "or", so if you see that seperating two parameters it means you can choose one of them.\n' +
					 'e.g. .temp <`text|voice`> <`channel-title`> --> .temp text cool-kids-club\n\n' +
					 '.help <`command`> - to get help for a specific command\n' +
					 '.help - to get help for all commands'
	},
	{
		color: 0xffff00,					
		title: '💡 Wanna hide all dem text channels?',
		description: ' ',					
		image: {
			url: 'https://i.imgur.com/ReWl7Ir.gif'
		} 
	},
	{
		color: 0xffff00,							
		title: '💡 Adding Soundbytes', 
		description: 'You must call *add-sb and attach your .mp3 file in the same message as seen below.',
		image: {
			url: 'https://i.imgur.com/WdoyTXc.png'
		}
	},
	{
		color: 0xffff00,							
		title: '💡 New Commands', 
		description: '`tips`	`quote`	`quotes`	`21`	`fortnite-stats`	`fortnite-leaderboard`	`set-fortnite-name`	`lotto`',
		image: {
			url: 'https://media3.giphy.com/media/UGxfEt5POsukg/giphy.gif'
		}
	},
	{
		color: 0xffff00,
		title: '💡 Is Typoeing Hard?',
		description: '⌨ **Fret no more, because fuzzy commands are here!**\n\n' +
					 'You can now activate the command which is the closest match to your input.\n' +
					 'For example, `.akry` --> `.army`, `.lcan` --> `.clean`, etc.\n' +
					 'You really don\'t even have to be close anymore.'
	},
	{
		color: 0xffff00,							
		title: '💡 Lets Play & Discord\'s Join Game Integration', 
		description: 'By using Discord\'s game integration to invite users to join you, lets-play will be called for that game.'
			+ 'This will mention every user that plays the game except for Super Scrubs, because nobody wants to play with those guys.' ,
		image: {
			url: 'https://i.imgur.com/QCM9Y3n.png'
		}
	}
]);
define('COMMANDS', [
	'&nb5::(${162434234357645312})%3', '1-more','21', 
	'add-sb', 'alias', 'army', 
	'backup', 
	'catfacts', 'clean', 'color', 
	'discharge', 
	'enlist', 'export', 
	'feature',
	'fortnite-leaderboard', 'fortnite-stats', 
	'gen-heatmap', 
	'h', 'heatmap', 'help', 'hit', 
	'implement', 'info', 'issue', 
	'join-review-team', 
	'leave-review-team', 'lets-play', 'list-backups', 'log', 'lotto', 
	'opt-in', 
	'p', 'playing', 
	'quote', 'quotes', 
	'rank', 'ranks', 'restart', 'restore', 'revive', 
	'sb', 'sb-add', 'set-fortnite-name', 'set-stream', 'shuffle-scrubs', 'start-lotto', 'stats', 'stay', 'steal','sunken-sailor', 
	'temp', 'time', 'tips', 'toggle-streaming', 
	'update-readme', 
	'vote', 'voteban', 'voteinfo', 'votekick', 
	'who-plays', 'who-said']);
define('WHO_PLAYS_FUZZY_OPTIONS', {
	shouldSort: true,
	threshold: 0.3,
	location: 0,
	distance: 100,
	maxPatternLength: 32,
	minMatchCharLength: 1,
	keys: ['title']
});
define('CHANNEL_NAME_FUZZY_OPTIONS', {
	threshold: 0.1,
	location: 0,
	distance: 100,
	maxPatternLength: 32,
	minMatchCharLength: 1
});
define('ALPHABET',  'ABCDEFGHIJKLMNOPQURSTUVWXYZ');
define('ENCLOSED_CHARS', {'A': '🄰', 'B': '🄱', 'C': '🄲', 'D': '🄳', 'E': '🄴', 'F': '🄵', 'G': '🄶', 'H': '🄷', 
	'I': '🄸', 'J': '🄹', 'K': '🄺', 'L': '🄻', 'M': '🄼', 'N': '🄽', 'O': '🄾', 'P': '🄿', 'Q': '🅀', 
	'R': '🅁', 'S': '🅂', 'T': '🅃', 'U': '🅄', 'V': '🅅', 'W': '🅆', 'X': '🅇', 'Y': '🅈', 'Z': '🅉', 
	'0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨'});
define('REACTION_NUMBERS', ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣']);
define('STATS', ['trnRating','score' ,'top1','top3','top5','top6','top10','top12','top25','kd','winRatio',
	'matches','kills','minutesPlayed','kpm','kpg','avgTimePlayed','scorePerMatch','scorePerMin'])
define('GAME_MODE_TO_KEY', {
		'solo': 'stats.p2',
		'duo':  'stats.p10',
		'squad': 'stats.p9',
		'all': 'lifeTimeStats'
});
define('DEV', 'dev');
define('MAX_BITRATE', 96);
define('MIN_BITRATE', 64);
