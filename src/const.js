module.exports = {
	BOT_SPAM_CHANNEL_ID: '372570540482887701',		//listen's to messages from this channel
	SCRUBS_CHANNEL_ID: '370626384059695107',		//channel ID of scrubs text channel
	PLEBS_CHANNEL_ID: '370623193528008705',			//channel ID of plebs text channel
	AFK_CHANNEL_ID: '370628203523473408',			//channel ID of the server's afk voice channel
  AFK_IMMUNE_CHANNEL_ID: '370626021227233290', // ID of channel where users are immune from afk move
	PURGATORY_CHANNEL_ID: '370626266786824192',	    //sends kicked user's to this channel
	LOG_CHANNEL_ID: '410258655322308608',			//channel ID of the text channel used for redirecting the console
	RATINGS_CHANNEL_ID: '601115821066027102',		//channel used for rating tv and movies
	CAR_PARTS_CHANNEL_ID: '544229507767468054',
	LOL_CHANNEL_ID: '509761663814336532',
	BILLIONAIRE_CHANNEL_ID: '780562033333501964',
	ARK_SERVER_WEBHOOK_ID: '850716841647013949',
	ARK_SERVER_STATUS_MSG_ID: '850832949451685898',
	ARK_CHANNEL_ID: '725823809562869863',
	ARK_SERVER_ADMIN_ID: '126527690319593473',
	CATEGORY_ID: {
		'Issue': '372143355070644255',				//category for bot issues
		'Feature': '374009714213781504',			//category for bot feature requests
		'Temp': '374246719648694282',				//category for temporary channels
		'Topics': '370623193528008704',				//category for topics channels
		'In Progress': '374702344316780567',		//category for bot features/issues actively being worked on
		'Text': '436695467414257676'				//category for general text channels
	},
	BILLIONAIRE_ROLE_ID: '780560807854342166',		//P2P role ID
	BEYOND_ROLE_ID: '370670924992610305',			//elevated role ID
	SCRUBS_ROLE_ID: '370671041644724226',			//main role ID
	SUPER_SCRUBS_ROLE_ID: '370671068282617866',		//lowered permission role ID
	PLEB_ROLE_ID: '370671263473074177',				//newly joined member role ID
	BOTS_ROLE_ID: '370694212162945025',
	GAME_NAME_TO_IMG: {
		'World of Warcraft' : 'https://i.imgur.com/0qTPYEw.jpg',
		'Overwatch' : 'http://i.imgur.com/WRQsSYp.png',
		'PUBG' : 'https://i.imgur.com/nT2CNCs.png',
		'Fortnite' : 'https://i.imgur.com/S0CN7n9.jpg'
	},
	CHANNEL_ID_TO_BAN_ROLE_ID:{
		'370625207150575617' : '370746310346801164',	        //Beyond
		'370625515293507584' : '370747862302326785',	        //Str8 Chillin
		'370625345138720809' : '370747704621662218',	        //Post Beta
		'370626021227233290' : '370748388578295808',	        //Spazzy's Scrub Shack
		'370625671833190400' : '370747928400232448',	        //Cartoon Network
		'370626139972042752' : '370747759130705922'	        	//They'll fix that b4 release
	},
	GAME_CHANNEL_NAMES: {
		'370625345138720809': 'Post Beta',
		'370626021227233290': `Spazzy's Scrub Shack`,
		'370625671833190400': 'Cartoon Network',
		'370626139972042752': `They'll fix that b4 release`,
	},
	'4_STAR_TV_MSG_ID': '609569096685715462',
	'3_STAR_TV_MSG_ID': '609569095943192627',
	'2_STAR_TV_MSG_ID': '609569095494533120',
	'1_STAR_TV_MSG_ID': '609569094840090642',
	'4_STAR_MOVIES_MSG_ID': '609569066897899541',
	'3_STAR_MOVIES_MSG_ID': '609569066264297482',
	'2_STAR_MOVIES_MSG_ID': '609569065354264805',
	'1_STAR_MOVIES_MSG_ID': '609569064783839268',
	UNVERIFIED_4_STAR_TV_MSG_ID: '609569064183922730',
	UNVERIFIED_3_STAR_TV_MSG_ID: '609569040448356371',
	UNVERIFIED_2_STAR_TV_MSG_ID: '609569039911485480',
	UNVERIFIED_1_STAR_TV_MSG_ID: '609569038934343692',
	UNVERIFIED_4_STAR_MOVIES_MSG_ID: '609569038669971456',
	UNVERIFIED_3_STAR_MOVIES_MSG_ID: '609569037940162600',
	UNVERIFIED_2_STAR_MOVIES_MSG_ID: '609569014443802661',
	UNVERIFIED_1_STAR_MOVIES_MSG_ID: '609569013797879825',
	RENAMED_LIST_MSG_ID: '780524043643125792',
	SCRUB_DADDY_ID: '773323199710494730',			//ID of this bot
	K_ID: '132944096347160576',
	R_ID: '208790727197589504',
	DBC_ID: '465686834358255616',
	AF_ID: '162434234357645312',
	H_ID: '126528082919161856',
	SCRUB_DADDY_ROLE_ID: '370728799668535307',
	REVIEW_ROLE: '<@&376391242105225216>',
	REVIEW_ROLE_ID: '376391242105225216',
	INACTIVE_GAMBLER_IDS: ['115587855824191495', '136677809367023617', '285600309257043968',
		'165286296875433985', '126527690319593473', '465686834358255616', '773323199710494730', '119482224713269248'],
	DAYS: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
	GREETINGS: ['you guys', 'yous guys', 'y\'all', 'hey buddies,', 'hey pals,', 'hey friends,', 'sup dudes,', 'hello fellow humans,'],
	LOOP_DELAY: 1500,							//delay between each loop
	MIN_STOCK_PRICE: 50,
	VOTE_TYPE: {
		KICK : 'kick',
		BAN : 'ban',
		PTT : 'force Push To Talk',
		REMOVE_ROLE : 'remove role',
		CUSTOM : 'custom'
	},
	THUMBS_UP_GIF: 'https://i.imgur.com/CLC53gf.gif',
	CLEAN_WIN_IMG: 'https://i.imgur.com/LDSm2sg.png',
	CLEAN_LOSE_IMG: 'https://i.imgur.com/gynZE1j.png',
	SCRUB_DADDY_FACT_IMG: 'https://i.imgur.com/FbAwRTj.jpg',
	BEYOND_LOTTO_IMG: 'https://i.imgur.com/viDJZi3.png',
	ROCK_IMG: 'https://i.imgur.com/DtQPHcn.png',
	ONLINE_IMG: 'https://i.imgur.com/w4ey7v0.gif?2',
	OFFLINE_IMG: 'https://media0.giphy.com/media/Meg4PTH32tPpe/giphy.gif',
	LEAVE_IMAGES: ['https://media.giphy.com/media/48FhEMYGWji8/giphy.gif',
		'https://media.giphy.com/media/l0K42RIaNOZcK7CNy/giphy.gif',
		'https://media.giphy.com/media/LPtp3yR0EiVc4/giphy.gif',
		'https://media.giphy.com/media/3oEjHZmJLsBqZWKlFK/giphy.gif',
		'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif',
		'https://media.giphy.com/media/PrGNf7O36heCs/giphy.gif'],
	REJOIN_IMAGES: [ 'https://media.giphy.com/media/l41YcwXNqeoQcEnYs/giphy.gif',
		'https://media.giphy.com/media/55o51RBAxpbjWVIY0K/giphy.gif',
		'https://media.giphy.com/media/l0MYyv6UK0Bd4DE76/giphy.gif',
		'https://media.giphy.com/media/NUesM2Iybd2Gpxmyhw/giphy.gif',
		'https://media.giphy.com/media/9D1vFuUNdhB50rys9P/giphy.gif',
		'https://media.giphy.com/media/6ielGX780cN5C/giphy.gif'],
	BUBBLE_IMAGES: ['https://i.imgur.com/rddtZR6.png', 'https://i.imgur.com/MdKfKVG.png', 'https://i.imgur.com/ZAyLJSJ.png',
		'https://i.imgur.com/K6k4b3q.png', 'https://i.imgur.com/m7V6BEa.png', 'https://i.imgur.com/Q7JO7Fn.png',
		'https://i.imgur.com/lXZNXoz.png', 'https://i.imgur.com/xdwTSuG.png', 'https://i.imgur.com/PE99BJ8.png',
		'https://i.imgur.com/VhFgbRQ.png', 'https://i.imgur.com/hQvbZkP.png', 'https://i.imgur.com/LLdxaj4.png',
		'https://i.imgur.com/cCiI4CE.png', 'https://i.imgur.com/fue3AAM.png', 'https://i.imgur.com/8cah0Ar.png',
		'https://i.imgur.com/3bXFEcL.png', 'https://i.imgur.com/Q33oITR.png', 'https://i.imgur.com/O2iQuhP.png',
		'https://i.imgur.com/LUq3M1Q.png','https://i.imgur.com/ne412gl.png'],
	BANNED_IMAGES: ['https://media.giphy.com/media/fe4dDMD2cAU5RfEaCU/giphy.gif',
		'https://media.giphy.com/media/GB0lKzzxIv1te/giphy.gif',
		'https://media.giphy.com/media/52FmnokM0kfcgFb5fq/giphy.gif',
		'https://media.giphy.com/media/l41YzMffhYx40mL0Q/giphy.gif',
		'https://media.giphy.com/media/11rIergnpiYpvW/giphy.gif',
		'https://media.giphy.com/media/cAbRpmEksTR8XVhFI7/giphy.gif',
		'https://media.giphy.com/media/2394PGDVooY5BzXwJ1/giphy.gif'],
	BOT_CHECK_IMG: 'https://i.imgur.com/MZwgz9Z.png',
	STEAL_IMG: 'https://i.imgur.com/L1ZYgZE.png',
	DROP_ALL_IMG: 'https://i.imgur.com/JDMFy2s.png',
	SETTINGS_IMG: 'https://i.imgur.com/T2ABKgC.png',
	INFO_IMG: 'https://i.imgur.com/WLWBbQ9.png',
	COLOR_OPTIONS_URL: 'https://www.w3.org/TR/2018/PR-css-color-3-20180315/#svg-color',
	HELP_CATEGORIES_PROMPT: [
		{ name: '1) `Voting`', value: '`votekick`	`voteban`	`vote`	`voteinfo`', inline: 'false'},
		{ name: '2) `Scrubbing Bubbles`', value: '`enlist`	`discharge`	`give`	`reserve`	`clean`		`race`'
			+ '	`invest`	`invest-scrubbles`	`sell-shares`	`stocks`	`portfolio`	`prizes`	`worth`	`army`	`ranks`	`worth-ranks`	`stats`	`who-said`	`sunken-sailor`	`add-emoji`	`magic-word`'
			+ '	`rename-hank`	`rename-channel`	`rename-role`	`rename-user`	`scrub-box`		`inventory`	`start-lotto`	`stop-lotto`	`billionaires-club`	`replace-scrubble`', inline: 'false'},
		{ name: '3) `Time Played`', value: '`time`	`opt-in`	`heatmap`', inline: 'false'},
		{ name: '4) `Gaming`', value: '`playing`	`who-plays`	`lets-play`	`1-more`	`p`	`split-group`	`trends`	`total-trends`'
			+ '	`fortnite-stats`	`fortnite-leaderboard`	`set-fortnite-name`	`add-dalle`	`guess-dalle`', inline: 'false'},
		{ name: '5) `Bot Issues, Feature Requests, and Help`', value: '`tips`	`issue`	`feature`	`implement`	`help`', inline: 'false'},
		{ name: '6) `Roles & User Settings`', value: '`join-review`	`leave-review`	`color`	`shuffle-scrubs`	`set-birthday`	`set-stream`'
			+ '	`toggle-streaming`	`alias`	`unalias`', inline: 'false'},
		{ name: '7) `Soundbites`', value: '`sb`	`add-sb`	`fav-sb`	`volume`', inline: 'false'},
		{ name: '8) `Utilities`', value: '`temp`	`leave-temp`	`lotto`	`quote`	`quotes`	`create-list`	`list`	`create-group`	`remind-me`'
			+ '	`@`	`subscribe-catfacts`	`catfacts`	`channels-left`	`rejoin-temp`	`ignore-posts`	`delete`', inline: 'false'},
	],
	HELP_CATEGORIES: [
		{
			name: '`Voting`',
			fields: [
				{ name: 'Please Note', value: '`You must be in a voice channel with at least 3 members to participate in a kick/ban vote.`', inline: 'false'},
				{ name: '.votekick <`@user`>', value: '`to remove user from channel.`', inline: 'false'},
				{ name: '.voteban <`@user`>', value: '`for a more permanent solution.`', inline: 'false'},
				{ name: '.vote <`thing to vote for`>', value: '`to do a custom vote.`', inline: 'false'},
				{ name: '.voteinfo', value: '`for totals of all custom votes.`', inline: 'false'},
				{ name: '.voteinfo <`@user`>', value: '`for total votes to kick/ban that user.`', inline: 'false'}
			],
		},
		{
			name: '`Scrubbing Bubbles`',
			fields:[
				{ name: '.enlist', value: '`enlists the discharged Scrubbing Bubbles to your army.`', inline: 'false'},
				{ name: '.discharge <`numBubbles`>', value: '`honorably discharges numBubbles Scrubbing Bubble from your army.`', inline: 'false'},
				{ name: '.give <`numBubbles`> <`@user`>', value: '`transfers numBubbles from your army to user\'s army.`', inline: 'false'},
				{ name: '.reserve', value: '`to get Scrubbing Bubble reinforcements from your reserve army.`', inline: 'false'},
				{ name: '.clean <`numBubbles`>', value: '`send numBubbles to clean the toilet.`', inline: 'false'},
				{ name: '.race <`numBubbles`>', value: '`to start a race that costs numBubbles to enter`', inline: 'false'},
				{ name: '.race', value: '`to join a race`', inline: 'false'},
				{ name: '.army', value: '`retrieves the size of your army.`', inline: 'false'},
				{ name: '.army <`@user`>', value: '`retrieves the size of the user\'s army.`', inline: 'false'},
				{ name: '.worth', value: '`retrieves your net worth (army + stock portfolio).`', inline: 'false'},
				{ name: '.worth <`@user`>', value: '`retrieves the user\'s net worth (army + stock portfolio).`', inline: 'false'},
				{ name: '.worth-ranks', value: '`outputs the net worth of every user.`', inline: 'false'},
				{ name: '.ranks', value: '`outputs the army size of every user.`', inline: 'false'},
				{ name: '.stats', value: '`outputs your clean stats.`', inline: 'false'},
				{ name: '.stats <`@user`>', value: '`outputs the user\'s clean stats.`', inline: 'false'},
				{ name: '.invest <`stock`> <`shares`>', value: '`to invest in shares of a stock. Cost is 1-1 with real world price.`', inline: 'false'},
				{ name: '.invest-scrubbles <`stock`> <`numBubbles`>', value: '`to invest the provided # of Scrubbing Bubbles in a stock. Cost is 1-1 with real world price.`', inline: 'false'},
				{ name: '.sell-shares <`stock`> <`shares`>', value: '`to sell shares in a stock`', inline: 'false'},
				{ name: '.stocks', value: '`to see how your stocks are doing today`', inline: 'false'},
				{ name: '.portfolio', value: '`to see how your stocks have done over time`', inline: 'false'},
				{ name: '.add-dalle + `ATTACH IMAGE IN SAME MESSAGE`', value: '`to add a Dall-E image for guessing game`', inline: 'false'},
				{ name: '.guess-dalle <`image #`> <`letter or full prompt`>', value: '`to guess a letter or entire prompt that was used to generate a Dall-E image`', inline: 'false'},
				{ name: '.who-said <`channel-name`> <`minMsgLength`> <`minMsgReactions`> <`sampleSize`>', value: '`Starts a quote guessing game using 5 random quotes pulled from sampleSize messages, matching the provided criteria.`', inline: 'false'},
				{ name: '.sunken-sailor', value: '`to start a game of Sunken Sailor with the users in your current voice channel.`', inline: 'false'},
				{ name: '.add-emoji <`tier`> <`name`> + `ATTACH PNG IN SAME MESSAGE`', value: '`🏆 to add the emoji to the server with the provided name.`', inline: 'false'},
				{ name: '.add-emoji <`tier`> + `ATTACH PNG IN SAME MESSAGE`', value: '`🏆 to add the emoji to the server using the image\'s filename.`', inline: 'false'},
				{ name: '.magic-word <`tier`> <`word`>', value: '`🏆 to set a magic word that when typed will ban that user from the channel cmd was called from.`', inline: 'false'},
				{ name: '.rename-hank <`tier`>', value: '`🏆 to rename hank to hang`', inline: 'false'},
				{ name: '.rename-channel <`tier`> <`#channel`> <`New Name`>', value: '`🏆 to rename a channel`', inline: 'false'},
				{ name: '.rename-role <`tier`> <`@role`> <`New Name`>', value: '`🏆 to rename a role`', inline: 'false'},
				{ name: '.rename-user <`tier`> <`@user`> <`New Name`>', value: '`🏆 to rename a user`', inline: 'false'},
				{ name: '.scrub-box <`tier`>', value: '`to open a Scrub Box. Tier cost = tier * 200. Better and longer lasting prizes as tier increases. For more info call: .prizes`', inline: 'false'},
				{ name: '.scrub-box <`tier`> <`numBoxes`>', value: '`to open the provided # of Scrub Box. Tier cost = tier * 200. Better and longer lasting prizes as tier increases. For more info call: .prizes`', inline: 'false'},
				{ name: '.inventory', value: '`to see your scrub box prize inventory.`', inline: 'false'},
				{ name: '.prizes', value: '`to see the prize tiers table`', inline: 'false'},
				{ name: '.start-lotto <`MM/DD`> <`HH`>', value: '`🏆 to start a Beyond lotto that will end at the specified time\n-----(HH is 24-hour format in EST)-----`', inline: 'false'},
				{ name: '.stop-lotto', value: '`🏆 to stop the current Beyond Lotto without choosing a winner.`', inline: 'false'},
				{ name: '.billionaires-club', value: '`🏆 to join The Billionaire\'s Club.`', inline: 'false'},
				{ name: '.replace-scrubble <`word`> <`emoji`>', value: '`🏆 replace all textual and emoji references to scrubbles. provide singular form of word.`', inline: 'false'}
			],
		},
		{
			name: '`Time Played`',
			fields: [
				{ name: '.time <`Game Name`> <`@user`>', value: '`user\'s playtime for the specified Game Name.`', inline: 'false'},
				{ name: '.time <`Game Name`>', value: '`cumulative playtime for the specified Game Name.`', inline: 'false'},
				{ name: '.time <`@user`>', value: '`user\'s playtime for all games.`', inline: 'false'},
				{ name: '.time', value: '`cumulative playtime for all games.`', inline: 'false'},
				{ name: '.opt-in', value: '`to opt into playtime tracking.`', inline: 'false'},
				{ name: '.heatmap', value: '`heatmap of player count for all games.`', inline: 'false'}
			]
		},
		{
			name: '`Gaming`',
			fields: [
				{ name: '.playing', value: '`player count of games currently being played.`', inline: 'false'},
				{ name: '.who-plays', value: '`to get list of players and last time played for games you play.`', inline: 'false'},
				{ name: '.who-plays <`Game Name`>', value: '`to get list of players and last time played for Game Name.`', inline: 'false'},
				{ name: '.lets-play', value: '`to ask Scrubs who have recently played the game you are playing if they want to play.`', inline: 'false'},
				{ name: '.lets-play <`Game Name|Game Emoji`>', value: '`to ask Scrubs who have recently played Game Name if they want to play.`', inline: 'false'},
				{ name: '.lets-play -all <`Game Name|Game Emoji`>', value: '`.lets-play including Super ͡Scrubs and inactive players.`', inline: 'false'},
				{ name: '.1-more', value: '`to request 1 more player for the game you are playing via mentions.`', inline: 'false'},
				{ name: '.split-group', value: '`to generate a random group splitting for users in your voice channel.`', inline: 'false'},
				{ name: '.round-robin <`groupName`>', value: '`to get the next user in the group in round robin fashion.`', inline: 'false'},
				{ name: '.trends <`Game Name | Game, Game2, etc`>', value: '`to see player count trends for the provided game(s).`', inline: 'false'},
				{ name: '.total-trends', value: '`To see total player count trends across all games.`', inline: 'false'},
				{ name: '.fortnite-stats <`fortniteUserName|@user`> <`gameMode`> <`stat`>', value: '`to lookup fortnite stats for the provided player.`', inline: 'false'},
				{ name: '.fortnite-leaderboard <`gameMode`> <`stat`>', value: '`to show the leaderboard for the provided game mode + stat.`', inline: 'false'},
				{ name: '.set-fortnite-name <`fortniteUserName`>', value: '`to link your Fortnite account to Scrub Daddy for stat lookup.`', inline: 'false'}
			]
		},
		{
			name: '`Bot Issues, Feature Requests, and Help`',
			fields: [
				{ name: 'Please Note', value: '`Your issue title or feature title must be ONE WORD! msg is optional`', inline: 'false'},
				{ name: '.tips', value: '`to show all tips.`', inline: 'false'},
				{ name: '.tips <`keyword`>', value: '`to show all tips with a title that includes the provided keyword.`', inline: 'false'},
				{ name: '.issue <`issue-title`> <`msg detailing issue`>', value: '`to submit bot issues.`', inline: 'false'},
				{ name: '.feature <`feature-title`> <`msg detailing feature`>', value: '`to submit bot feature requests.`', inline: 'false'},
				{ name: '.implement <`task-title`>', value: '`to vote for the next task to complete.\ntask-title is the channel title of the issue or feature.`', inline: 'false'},
				{ name: '.help or .h', value: '`to get help for all commands.`', inline: 'false'},
				{ name: '.help <`command`>', value: '`to get help for a specific command`', inline: 'false' }
			]
		},
		{
			name: '`Roles & User Settings`',
			fields: [
				{ name: '.join-review-team', value: '`to be added to the review team.`', inline: 'false'},
				{ name: '.leave-review-team', value: '`to be removed from the review team.`', inline: 'false'},
				{ name: '.color <`colorName`>', value: '`to set your role/response color preference.`', inline: 'false'},
				{ name: '.rainbow-role <`tier`>', value: '`🏆 to add a role with changing color for a limited time`', inline: 'false'},
				{ name: '.shuffle-scrubs', value: '`to randomize the first letter of every Srub\'s name.`', inline: 'false'},
				{ name: '.shuffle-scrubs <`letter`>', value: '`to set the first letter of every Srub\'s name.`', inline: 'false'},
				{ name: '.set-birthday <`MM/DD`>', value: '`to set your birthday and get a random cake nickname.`', inline: 'false'},
				{ name: '.set-birthday <`MM/DD`> <`Desired Name`>', value: '`to set your birthday and desired nickname.`', inline: 'false'},
				{ name: '.set-stream <`url`>', value: '`to set the url for either your stream or the stream you are watching.`', inline: 'false'},
				{ name: '.toggle-streaming', value: '`to toggle your streaming state on/off, which will update your nickname.`', inline: 'false'},
				{ name: '.alias <`alias`> <`command to call`>', value: '`creates an alias for the provided command call. \ne.g. .alias ow who-plays Overwatch ... will allow you to call .ow`', inline: 'false'},
				{ name: '.unalias <`alias`>', value: '`removes the alias with the provided name.`', inline: 'false'}
			]
		},
		{
			name: '`Soundbites`',
			fields: [
				{ name: '.sb', value: '`to get the list of available soundbites.`', inline: 'false'},
				{ name: '.sb <`name`>', value: '`to play the sound byte of the given name in your voice channel.`', inline: 'false'},
				{ name: '.add-sb + `ATTACHMENT IN SAME MESSAGE`', value: '`to add a sound byte.`', inline: 'false'},
				{ name: '.fav-sb', value: '`to get the list of your most frequently used soundbites.`', inline: 'false'},
				{ name: '.volume <soundbite> <1-10>', value: '`to set the volume for the provided soundbite.`', inline: 'false'}
			]
		},
		{
			name: '`Utilities`',
			fields: [
				{ name: '.temp', value: '`Creates a temporary text channel`', inline: 'false'},
				{ name: '.temp <`text|voice`>', value: '`Creates a temp text/voice channel.`', inline: 'false'},
				{ name: '.temp <`text|voice`> <`channel-title`>', value: '`Creates a voice/text channel with the provided title.`', inline: 'false'},
				{ name: '.leave-temp', value: '`to leave the temp channel the command is called in.`', inline: 'false'},
				{ name: '.remind-me <`#`> <`minutes|hours|days|etc`> <`message`>', value: '`to be reminded of something at the specified time.`', inline: 'false'},
				{ name: '.lotto', value: '`to join the currently running Beyond lotto or get the time remaining.`', inline: 'false'},
				{ name: '.quote', value: '`to quote and reply or save the quote, depending on which reaction you use (:quoteReply: or :quoteSave:).`', inline: 'false'},
				{ name: '.quote <`@user`>', value: '`to quote and reply or save the quote from @user, depending on which reaction you use (:quoteReply: or :quoteSave:).`', inline: 'false'},
				{ name: '.quotes', value: '`to retrieve the list of quotes from everyone on the server.`', inline: 'false'},
				{ name: '.quotes <`@user`>', value: '`to retrieve the list of quotes from the specified user.`', inline: 'false'},
				{ name: '.create-list <`name of list`>', value: '`to create a named list that users can add entries to.`', inline: 'false'},
				{ name: '.list', value: '`to view all of the user created lists.`', inline: 'false'},
				{ name: '.list <`list-name`> <`your new entry`>', value: '`to add a new entry to a user created list.`', inline: 'false'},
				{ name: '.create-group <`groupName`> <`@user1`> <`@user2`>', value: '`To create a mentionable group of users. You can mention as many users as you want.`', inline: 'false'},
				{ name: '.create-group <`groupName`> <`title of game`>', value: '`To create a mentionable group of users who play the specified game.`', inline: 'false'},
				{ name: '.@<`groupName`> <`message to send`>', value: '`To mention all members of a custom group in a message.`', inline: 'false'},
				{ name: '.@<`gameName`> <`message to send`>', value: '`To mention all users who play gameName in a message.`', inline: 'false'},
				{ name: '.@power <`message to send`>', value: '`If not called from #bot-spam or #scrubs will mention the channel\'s power users in a message.`', inline: 'false'},
				{ name: '.subscribe-catfacts', value: '`Subscribe to have the latest catfacts DMed hourly!`', inline: 'false'},
				{ name: '.catfacts', value: '`to get a cat fact.`', inline: 'false'},
				{ name: '.channels-left', value: '`to see the temp channels you have left.`', inline: 'false'},
				{ name: '.rejoin-temp <`channel-name`>', value: '`to rejoin a temp channel.`', inline: 'false'},
				{ name: '.ignore-posts', value: '`after adding :trashcan: reaction to posts, to stop them from appearing in #car-parts.`', inline: 'false'},
				{ name: '.delete', value: '`call this after adding both :trashcan: and :black_circle: reactions to first and last messages to delete.\n' +
					'All messages between the two you reacted to will be deleted, including those two.\nThis will only work if you are in a temp channel you created.`', inline: 'false'}
			]
		}
	],
	NEW_LEDGER_ENTRY: {
		armySize: 0,
		cleanBet: 0,
		raceBet: 0,
		bjBet: 0,
		bjGameStarted: false,
		bjGameOver: true,
		rocksDropped: 0,
		player:{},
		dealer: {},
		stats: {
			recordArmy: 0,
			mostBet: 0,
			mostLost: 0,
			mostWon: 0,
			betsWon: 0,
			betsLost: 0,
			scrubsBet: 0,
			scrubsWon: 0,
			scrubsLost: 0,
			winStreak: 0,
			lossStreak: 0,
			highestWinStreak: 0,
			highestLossStreak: 0,
			scrubsEnlisted: 0,
			scrubsDischared: 0,
			stocksNetArmyChange: 0
		},
	},
	THIRD_PARTY_RATINGS: {
		movies: {
			rt: {},
			imdb: {}
		},
		tv: {
			imdb: {}
		}
	},
	MISSING_TITLES: {
		movies: {
			rt: [],
			imdb: []
		},
		tv: {
			imdb: []
		}
	},
	Clubs: ['https://i.imgur.com/o7m74ae.png', 'https://i.imgur.com/s15mB52.png', 'https://i.imgur.com/8zKQuRh.png?1', 'https://i.imgur.com/cCGAnwz.png',
		'https://i.imgur.com/aw8SjKM.png', 'https://i.imgur.com/fDYMBkl.png','https://i.imgur.com/9GdN1xf.png', 'https://i.imgur.com/KT1weaO.png',
		'https://i.imgur.com/qt9QC39.png','https://i.imgur.com/Z13JEy5.png', 'https://i.imgur.com/ihire3h.png', 'https://i.imgur.com/YghMO9j.png', 'https://i.imgur.com/LzMzKTB.png'],
	Spades: ['https://i.imgur.com/FHvk0sp.png', 'https://i.imgur.com/sLDI1Bo.png', 'https://i.imgur.com/WjJ2puv.png', 'https://i.imgur.com/kQC54bz.png',
		'https://i.imgur.com/9LwWVZY.png', 'https://i.imgur.com/xl4iMRD.png', 'https://i.imgur.com/QZGxsEn.png', 'https://i.imgur.com/LTwacw5.png',
		'https://i.imgur.com/ktDrrsF.png', 'https://i.imgur.com/1XSryPi.png', 'https://i.imgur.com/ve4ImOC.png', 'https://i.imgur.com/gedGmML.png', 'https://i.imgur.com/8AR2XPY.png'],
	Diamonds: ['https://i.imgur.com/0yoc7jc.png', 'https://i.imgur.com/TjpZNj4.png', 'https://i.imgur.com/RT3lgO9.png', 'https://i.imgur.com/VknG03X.png',
		'https://i.imgur.com/KzRjlUJ.png', 'https://i.imgur.com/yqQFHn5.png', 'https://i.imgur.com/AOPOjZI.png', 'https://i.imgur.com/2EypWwj.png',
		'https://i.imgur.com/TS00BlT.png', 'https://i.imgur.com/to5qn8r.png', 'https://i.imgur.com/bulA3sS.png', 'https://i.imgur.com/WOLNfRq.png','https://i.imgur.com/54qFEo9.png'],
	Hearts: ['https://i.imgur.com/gQVUlQW.png', 'https://i.imgur.com/az3oztW.png', 'https://i.imgur.com/YzJB3ee.png', 'https://i.imgur.com/3BwKfue.png',
		'https://i.imgur.com/1wQv85L.png', 'https://i.imgur.com/1fRlihh.png', 'https://i.imgur.com/7JZP5Gj.png', 'https://i.imgur.com/lXizCrc.png',
		'https://i.imgur.com/Cdib2wr.png', 'https://i.imgur.com/6FVwLvj.png', 'https://i.imgur.com/dT8taqF.png', 'https://i.imgur.com/yOJPOvz.png', 'https://i.imgur.com/NfHoAdu.png'],
	TIPS:[
		{
			color: 0xffff00,
			title: '💡 .help',
			description: 'You do not need to type the `<`, `|`, or `>` symbols found within .help documentation.\n\n' +
				'<`title`> represents.\n\n' +
				'| stands for "or", so if you see that seperating two parameters it means you can choose one of them.\n' +
				'e.g. .temp <`text|voice`> <`channel-title`> --> .temp text birds\n\n' +
				'.help <`command`> - to get help for a specific command\n' +
				'.help - to get help for all commands'
		},
		{
			color: 0xffff00,
			title: '💡 Hiding text channels',
			description: ' ',
			image: {
				url: 'https://i.imgur.com/ReWl7Ir.gif'
			}
		},
		{
			color: 0xffff00,
			title: '💡 Adding Soundbites And Emojis',
			description: 'You must call *add-sb/.add-emoji and attach your .mp3/.png file in the same message as seen below.',
			image: {
				url: 'https://i.imgur.com/WdoyTXc.png'
			}
		},
		{
			color: 0xffff00,
			title: '💡 New Commands',
			description: '`replace-scrubble`	`worth-ranks`	`billionaires-club`	`remind-me`	`set-birthday`	`worth`	`invest-scrubbles`',
			image: {
				url: 'https://media3.giphy.com/media/UGxfEt5POsukg/giphy.gif'
			}
		},
		{
			color: 0xffff00,
			title: '💡 Is Typoeing Hard?',
			description: '⌨ You can activate the command which is the closest match to your input.\n' +
				'For example, `.akry` --> `.army`, `.cl` --> `.clean`, etc.\n'
		},
		{
			color: 0xffff00,
			title: '💡 Lets Play & Discord\'s Join Game Integration',
			description: 'By using Discord\'s game integration to invite users to join you, lets-play will be called for that game.'
				+ 'This will mention every user that recently played the game except for Super Scrubs, because nobody wants to play with those guys.' ,
			image: {
				url: 'https://i.imgur.com/QCM9Y3n.png'
			}
		}
	],
	COMMANDS: [
		'@', ',,,', '1-more',
		'add-dalle', 'add-emoji', 'add-player', 'add-sb', 'admin-help', 'alias', 'army',
		'backup', 'billionaires-club',
		'cars', 'catfacts', 'channels-left', 'change-category', 'clean', 'color', 'create-group', 'create-list',
		'delete', 'delete-rating', 'discharge',
		'enlist', 'export',
		'feature',
		'fav-sb', 'fortnite-leaderboard', 'fortnite-stats',
		'give', 'guess-dalle',
		'h', 'heatmap', 'help',
		'ignore-posts', 'implement', 'inventory', 'invest', 'invest-scrubbles', 'issue',
		'join-review-team',
		'list', 'leave-temp', 'leave-review-team', 'lets-play', 'list-backups', 'log', 'lotto',
		'magic-word', 'missing-help',
		'opt-in',
		'ping-ark-server', 'playing', 'portfolio', 'prizes',
		'quote', 'quotes',
		'race', 'rainbow-role', 'ranks', 'rate', 'ratings', 'rating-info', 'refresh-ratings', 'rejoin-temp', 'remind-me', 'remove-player', 'rename', 'rename-channel', 'rename-hank', 'rename-role', 'rename-user', 'replace-scrubble', 'reserve', 'restart', 'restore', 'review-messages', 'revive', 'rock', 'round-robin',
		'sb', 'scrub-box', 'sell-shares', 'set-birthday', 'set-fortnite-name', 'set-stream', 'shuffle-scrubs', 'split-group', 'start-lotto', 'stats', 'steal', 'steal-all', 'stocks', 'stop-lotto', 'subscribe-catfacts', 'sunken-sailor',
		'temp', 'test', 'time', 'tips', 'toggle-streaming', 'trends', 'total-trends',
		'unalias', 'update-readme',
		'volume', 'vote', 'voteban', 'voteinfo', 'votekick',
		'who-plays', 'who-said', 'worth', 'worth-ranks'
	],
	GLOBAL_COMMANDS: [
		'@', ',,,', 'cars', 'change-category', 'delete', 'delete-rating',
		'ignore-posts', 'leave-temp', 'magic-word', 'quote', 'rate',
		'remind-me', 'rename', 'refresh-ratings', 'rating-info'
	],
	WHO_PLAYS_FUZZY_OPTIONS: {
		shouldSort: true,
		threshold: 0.3,
		location: 0,
		distance: 100,
		maxPatternLength: 32,
		minMatchCharLength: 1,
		keys: ['title']
	},
	RATING_FUZZY_OPTIONS: {
		shouldSort: true,
		threshold: 0.1,
		location: 0,
		distance: 100,
		maxPatternLength: 32,
		minMatchCharLength: 1,
	},
	CHANNEL_NAME_FUZZY_OPTIONS: {
		threshold: 0.1,
		location: 0,
		distance: 100,
		maxPatternLength: 32,
		minMatchCharLength: 1
	},
	LEFT_CHANNEL_PERMISSION: 1152,
	ALPHABET:  'ABCDEFGHIJKLMNOPQURSTUVWXYZ',
	ENCLOSED_CHARS: {
		'A': '🄰', 'B': '🄱', 'C': '🄲', 'D': '🄳', 'E': '🄴', 'F': '🄵', 'G': '🄶', 'H': '🄷',
		'I': '🄸', 'J': '🄹', 'K': '🄺', 'L': '🄻', 'M': '🄼', 'N': '🄽', 'O': '🄾', 'P': '🄿', 'Q': '🅀',
		'R': '🅁', 'S': '🅂', 'T': '🅃', 'U': '🅄', 'V': '🅅', 'W': '🅆', 'X': '🅇', 'Y': '🅈', 'Z': '🅉',
		'0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨'
	},
	REACTION_NUMBERS: ['0⃣', '1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣','9⃣'],
	NUMBER_TO_EMOJI: {
		'zero': '0️⃣',
		'one': '1️⃣',
		'two': '2️⃣',
		'three': '3️⃣',
		'four': '4️⃣',
		'five': '5️⃣',
		'six': '6️⃣',
		'seven': '7️⃣',
		'eight': '8️⃣',
		'nine': '9️⃣',
	},
	PPL_EMOJIS: ['😢', '🕺', '👬', '👨‍👨‍👧', '👨‍👨‍👧‍👦⠀', '🧙👩‍👩‍👧‍👦⠀'],
	RACER_EMOJIS: ['🐒', '🦆', '🐢', '🐳', '🐓', '🐬', '🏃', '🦀',
		'🐘', '🐉', '🐇', '🐐', '🐌', '🐩', '🐑'],
	FINISH_LINE: '🙾🙾',
	TV_EMOJI: '📺',
	MOVIES_EMOJI: '📀',
	TRASH_REACTION: 'trashcan:427231130241204224',
	DELETE_REACTION: 'delete:567030275054239754',
	SCRUBBING_BUBBLE_EMOJI: '<:ScrubbingBubble:567548883085819904>',
	TAG_TO_TEXT: {
        '🔵' : ['estoril', ' blue ', 'ebii', ' eb ', ' eb2 '],
        '🔴': ['melbourne', ' red ', ' mr '],
        '🚬': ['exhaust', 'downpipe', ' dp ', ' mpe ', 'catback', 'axleback'],
        '👄': [' lip ', 'spoiler'],
        '🍔': ['grill', 'kidney']
    },
	STATS: ['trnRating','score' ,'top1','top3','top5','top6','top10','top12','top25','kd','winRatio',
		'matches','kills','minutesPlayed','kpm','kpg','avgTimePlayed','scorePerMatch','scorePerMin'],
	GAME_MODE_TO_KEY: {
		'solo': 'stats.p2',
		'duo':  'stats.p10',
		'squad': 'stats.p9',
		's-solo': 'stats.curr_p2',
		's-duo':  'stats.curr_p10',
		's-squad': 'stats.curr_p9',
		'all': 'lifeTimeStats'
	},
	ARK_SERVER_STATUS_TO_COLOR: {
		'Starting...': 0xffbb33,
		'⬆️': 0x00C851,
		'⬇️': 0xff4444
	},
	REDDIT_URL_PATTERN: {
		video: /https:\/\/v\.redd\.it\/([a-z0-9]+)/,
		gif: /https:\/\/preview\.redd\.it\/([a-z0-9]+).gif(\?width=[0-9]{3,4})?[?&]format=mp4&s=[a-z0-9]+/,
		comments: /https:\/\/((www|old)\.)?(old\.)?reddit.com\/r\/\w+\/comments\/[a-z0-9]+\/\w+\//
	},
	TWITTER_STATUS_URL_PATTERN: /https:\/\/twitter\.com\/.+\/status\/[0-9]+/,
	STOCKS_BASE_URL: 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=',
	DEV: 'dev',
	MAX_USERNAME_LENGTH: '32',
	MAX_BITRATE: 96,
	MIN_BITRATE: 64,
	CODACY_BADGE: '[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8f59c3e85df049d3bd319a21576f37c4)]'
		+ '(https://www.codacy.com/app/Scrubs/scrub-daddy?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=wasaab/scrub-daddy&amp;utm_campaign=Badge_Grade)',
	ADMIN_COMMANDS: '1. Admin Commands\n' +
		'+ backup - `backs up all json files within the data folder to ../jsonBackups.`\n' +
		'+ restore <`backupFileName`> - `restores json files to the specified backup.`\n' +
		'+ list-backups - `lists the available backups.`\n' +
		'+ restart <`up|hard`> - `restarts and updates the bot if specified.`\n' +
		'+ export - `writes all local data to their appropriate json files immediately.`\n' +
		'+ log - `toggles server output redirection to discord channel #server-log.`\n' +
		'+ revive - `revives a fallen Scrubbing Bubble.`\n' +
		'+ update-readme - `updates the readme to include new commands.`\n' +
		'+ add-player <`@user`> <`game name`> - `adds a player to gamesPlayed.`\n' +
		'+ remove-player <`@user`> <`game name`> - `removes a player from gamesPlayed.`\n' +
		'+ cars - `craws car forum and outputs updates as discord embeds.`\n' +
		'+ admin-help - `lists admin command usage.`\n' +
		'+ missing-help - `lists commands missing help.`\n' +
		'+ review-messages - `initiates message review process for quarantined users.`\n',
	PRIZE_TO_DESCRIPTION: {
		'rename-hank': 'Automatically change hanks name to hang for ``.',
		'rename-user': 'Rename a user for ``.',
		'rename-channel': 'Rename a channel for ``.',
		'rename-role': 'Rename a role for ``.',
		// 'annoy': 'Random chance to have scrub daddy enter a user’s channel while they are speaking to play a specified sb for ``.',
		'magic-word': 'Set a magic word, that when typed by someone, will ban them from that text channel for a day. The magic word will be in effect for ``.',
		'rainbow-role': 'Give yourself a constantly changing role color (Rainbow Role) for ``.',
		// 'move-user': 'Randomly moves a user through the voice channels for ``.',
		'add-emoji': 'Add `` to the server.',
		'add-bubbles': '`` Scrubbing Bubbles.',
		'subtract-bubbles': '`` Scrubbing Bubbles.',
		'start-lotto': 'Start a Beyond lottery.',
		'stop-lotto': 'Stop a Beyond lottery.',
		'billionaires-club': 'Join The Billionaire\'s Club.',
		'replace-scrubble': 'Replace all references to scrubbles'
	},
	PRIZE_TIERS: [
		{
			'rename-hank': '1 day',
			'rename-user': '1 day',
			'rename-channel': '2 days',
			'rename-role': '2 days',
			// 'annoy': '1 day',
			'magic-word': '2 days',
			'rainbow-role': '1 day',
			// 'move-user': '.5 days',
			'add-emoji': '1 emoji',
			'add-bubbles': 300,
			'subtract-bubbles': 100
		},
		{
			'rename-hank': '2 days',
			'rename-user': '2 days',
			'rename-channel': '4 days',
			'rename-role': '4 days',
			// 'annoy': '4 days',
			'magic-word': '6 days',
			'rainbow-role': '4 days',
			// 'move-user': '1 day',
			'add-bubbles': 550,
			'subtract-bubbles': 200
		},
		{
			'rename-hank': '3 days',
			'rename-user': '3 days',
			'rename-channel': '1 week',
			'rename-role': '1 week',
			'magic-word': '1 week',
			'rainbow-role': '1 week',
			// 'move-user': '3 days',
			'add-emoji': '3 emojis',
			'add-bubbles': 800,
			'subtract-bubbles': 400,
			'start-lotto': '1 use',
			'stop-lotto': '1 use'
		},
		{
			'billionaires-club': '1 week',
			'add-bubbles': 150000000000,
			'replace-scrubble': '1 week'
		// 	'demote': '',
		// 	'clear-lotto': '',
		// 	//client.on('guildMemberSpeaking')
		// 	'talking-rainbow-role': '1 day',
		}
	],
	TIER_COST: [200, 400, 600, 100000000000],
	BILLIONAIRE_JOIN_IMAGES: [
		'https://media0.giphy.com/media/h0MTqLyvgG0Ss/giphy.gif',
		'https://media3.giphy.com/media/xT1XH1dfMnbezHSa9a/giphy.gif',
		'https://media1.giphy.com/media/LQpCRK5tnJmNKxWoqZ/giphy.gif',
		'https://media4.giphy.com/media/QWFMD7qdzm0UwsSHH4/giphy.gif',
		'https://media3.giphy.com/media/MFsqcBSoOKPbjtmvWz/giphy.gif',
		'https://media4.giphy.com/media/hAcDHEhZHA2bu/giphy.gif',
		'https://media3.giphy.com/media/2dI7FZreQAp44/giphy.gif',
		'https://media2.giphy.com/media/l41lIkTqv4NTHPktO/giphy.gif'
	],
	MENTION_TYPE_TO_SYMBOL: {
		role: '@&',
		user: '@!?',
		channel: '#'
	},
	MENTION_TYPE: {
		user: 'user',
		channel: 'channel',
		role: 'role'
	},
	LARGE_NUM_UNITS: [
		'Quadrillion', 'Quintillion', 'Sextillion',
		'Septillion', 'Octillion', 'Nonillion', 'Decillion'
	],
	INVALID_DURATION_ISO: 'P0D',
	DAY_HM_DATE_TIME_FORMAT: 'ddd h:mm A',
	MDY_HM_DATE_TIME_FORMAT: 'M/DD/YY hh:mm A',
	MDY_DATE_FORMAT: 'MM/DD/YY',
	MD_DATE_FORMAT: 'MM/DD',
	FULL_DATE_TIME_FORMAT: 'LLLL',
	SHORT_DATE_FORMAT: 'l',
	BACKUP_DATE_FORMAT: 'M[-]D[-]YY[@]h[-]mm[-]a',
	NO_RENAMES_MSG: 'No active renames',
	CUSTOM_STATUS: 'Custom Status',
	DAILY_RESERVE_AMOUNT: 10,
	VOLUME_TO_DB: [-70, -60, -50, -40, -30, -20, -15, -10, -5, 0],
	TABLE_COL_SEPARATOR: ' ║ '
};

function deepFreeze(constants) {
	var propNames = Object.getOwnPropertyNames(constants);
	propNames.forEach((name) => {
		var prop = constants[name];

		if (typeof prop === 'object' && prop !== null) {
			deepFreeze(prop);
		}
	});

	return Object.freeze(constants);
}

deepFreeze(module.exports);