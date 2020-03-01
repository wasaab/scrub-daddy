# scrub-daddy
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8f59c3e85df049d3bd319a21576f37c4)](https://www.codacy.com/app/Scrubs/scrub-daddy?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=wasaab/scrub-daddy&amp;utm_campaign=Badge_Grade)

Discord bot using Node.js, focused on gamers, with 117 commands.

## Key Features
+ Playtime tracking
+ Player count heatmap and trends
+ Track players of games and invite all or a subset
+ List players by game name or see a list of those who play the same games as you
+ Simulated stock market using real world stocks
+ Soundbytes
+ Server and bot administration
+ Discord integrated issue and feature submission system with task priority determined by majority vote
+ Game stat tracking
+ TV and movie user rating system integrated with IMDB and RT and viewable in Discord or a Bootstrap table in a website
+ Games and gambling
+ Mention custom user groups or power users of a given channel
+ fuzzy search for all commands and names of things such as games and movie titles

## Commands

### Time Played
+ .time <`Game Name`> <`@user`> - `user's playtime for the specified Game Name.`
+ .time <`Game Name`> - `cumulative playtime for the specified Game Name.`
+ .time <`@user`> - `user's playtime for all games.`
+ .time - `cumulative playtime for all games.`
+ .opt-in - `to opt into playtime tracking.`
+ .heatmap - `heatmap of player count for all games.`

### Gaming
+ .playing - `player count of games currently being played.`
+ .who-plays - `to get list of players and last time played for games you play.`
+ .who-plays <`Game Name`> - `to get list of players and last time played for Game Name.`
+ .lets-play - `to ask Scrubs who have recently played the game you are playing if they want to play.`
+ .lets-play <`Game Name|Game Emoji`> - `to ask Scrubs who have recently played Game Name if they want to play.`
+ .lets-play -all <`Game Name|Game Emoji`> - `.lets-play including Super ͡Scrubs and inactive players.`
+ .1-more - `to request 1 more player for the game you are playing via mentions.`
+ .p - `to ask @Scrubs to play PUBG in scrubs text channel.`
+ .split-group - `to generate a random group splitting for users in your voice channel.`
+ .trends <`Game Name | Game, Game2, etc`> - `to see player count trends for the provided game(s).`
+ .total-trends - `To see total player count trends across all games.`
+ .fortnite-stats <`fortniteUserName|@user`> <`gameMode`> <`stat`> - `to lookup fortnite stats for the provided player.`
+ .fortnite-leaderboard <`gameMode`> <`stat`> - `to show the leaderboard for the provided game mode + stat.`
+ .set-fortnite-name <`fortniteUserName`> - `to link your Fortnite account to Scrub Daddy for stat lookup.`

### Stocks, Gambling, and Prizes
+ .enlist - `enlists the discharged Scrubbing Bubbles to your army.`
+ .discharge <`numBubbles`> - `honorably discharges numBubbles Scrubbing Bubble from your army.`
+ .give <`numBubbles`> <`@user`> - `transfers numBubbles from your army to user's army.`
+ .reserve - `to get Scrubbing Bubble reinforcements from your reserve army.`
+ .clean <`numBubbles`> - `send numBubbles to clean the toilet.`
+ .21 <`numBubbles`> - `to start a game of blackjack with a bet of numBubbles.`
+ .hit - `to hit in blackjack.`
+ .stay - `to stay in blackjack.`
+ .army - `retrieves the size of your army.`
+ .army <`@user`> - `retrieves the size of the user's army.`
+ .ranks - `outputs the army size of every user.`
+ .stats - `outputs your clean stats.`
+ .stats <`@user`> - `outputs the user's clean stats.`
+ .invest <`stock`> <`shares`> - `to invest Scrubbing Bubbles in a stock. Cost is 1-1 with real world price.`
+ .sell-shares <`stock`> <`shares`> - `to sell shares in a stock`
+ .stocks - `to see how your stocks are doing today`
+ .portfolio - `to see how your stocks have done over time`
+ .who-said <`channel-name`> <`minMsgLength`> <`minMsgReactions`> <`sampleSize`> - `Starts a quote guessing game using 5 random quotes pulled from sampleSize messages, matching the provided criteria.`
+ .sunken-sailor - `to start a game of Sunken Sailor with the users in your current voice channel.`
+ .add-emoji <`tier`> <`name`> + `ATTACH PNG IN SAME MESSAGE` - `🏆 to add the emoji to the server with the provided name.`
+ .add-emoji <`tier`> + `ATTACH PNG IN SAME MESSAGE` - `🏆 to add the emoji to the server using the image's filename.`
+ .magic-word <`tier`> <`word`> - `🏆 to set a magic word that when typed will ban that user from the channel cmd was called from.`
+ .rename-hank <`tier`> - `🏆 to rename hank to hang`
+ .rename-channel <`tier`> <`#channel`> <`New Name`> - `🏆 to rename a channel`
+ .rename-role <`tier`> <`@role`> <`New Name`> - `🏆 to rename a role`
+ .rename-user <`tier`> <`@user`> <`New Name`> - `🏆 to rename a user`
+ .scrub-box <`tier`> - `to open a Scrub Box. Tier cost = tier * 200. Better and longer lasting prizes as tier increases.`
+ .inventory - `to see your scrub box prize inventory.`
+ .start-lotto <`MM/DD`> <`HH`> - `🏆 to start a Beyond lotto that will end at the specified time (HH is 24-hour format in EST)`
+ .stop-lotto - `🏆 to stop the current Beyond Lotto without choosing a winner.`

### Voting
+ Please Note - `You must be in a voice channel with at least 3 members to participate in a kick/ban vote.`
+ .votekick <`@user`> - `to remove user from channel.`
+ .voteban <`@user`> - `for a more permanent solution.`
+ .vote <`thing to vote for`> - `to do a custom vote.`
+ .voteinfo - `for totals of all custom votes.`
+ .voteinfo <`@user`> - `for total votes to kick/ban that user.`

### Bot Issues, Feature Requests, and Help
+ Please Note - `Your issue title or feature title must be ONE WORD! msg is optional`
+ .tips - `to show all tips.`
+ .tips <`keyword`> - `to show all tips with a title that includes the provided keyword.`
+ .issue <`issue-title`> <`msg detailing issue`> - `to submit bot issues.`
+ .feature <`feature-title`> <`msg detailing feature`> - `to submit bot feature requests.`
+ .implement <`task-title`> - `to vote for the next task to complete.
      task-title is the channel title of the issue or feature.`
+ .help or .h - `to show this message again.`

### Roles & User Settings
+ .join-review-team - `to be added to the review team.`
+ .leave-review-team - `to be removed from the review team.`
+ .color <`colorName`> - `to set your role/response color preference.`
+ .shuffle-scrubs - `to randomize the first letter of every Srub's name.`
+ .shuffle-scrubs <`letter`> - `to set the first letter of every Srub's name.`
+ .set-stream <`url`> - `to set the url for either your stream or the stream you are watching.`
+ .toggle-streaming - `to toggle your streaming state on/off, which will update your nickname.`
+ .alias <`alias`> <`command to call`> - `creates an alias for the provided command call.
      e.g. .alias ow who-plays Overwatch ... will allow you to call .ow`
+ .unalias <`alias`> - `removes the alias with the provided name.`

### Soundbytes
+ .sb - `to get the list of available soundbytes.`
+ .sb <`name`> - `to play the sound byte of the given name in your voice channel.`
+ .add-sb + `ATTACHMENT IN SAME MESSAGE` - `to add a sound byte.`
+ .fav-sb - `to get the list of your most frequently used soundbytes.`
+ .volume <soundbyte> <1-10> - `to set the volume for the provided soundbyte.`

### Utilities
+ .temp - `Creates a temporary text channel`
+ .temp <`text|voice`> - `Creates a temp text/voice channel.`
+ .temp <`text|voice`> <`channel-title`> - `Creates a voice/text channel with the provided title.`
+ .leave-temp - `to leave the temp channel the command is called in.`
+ .lotto - `to join the currently running Beyond lotto or get the time remaining.`
+ .quote - `to quote and reply or save the quote, depending on which reaction you use (:quoteReply: or :quoteSave:).`
+ .quote <`@user`> - `to quote and reply or save the quote from @user, depending on which reaction you use (:quoteReply: or :quoteSave:).`
+ .quotes - `to retrieve the list of quotes from everyone on the server.`
+ .quotes <`@user`> - `to retrieve the list of quotes from the specified user.`
+ .create-list <`name of list`> - `to create a named list that users can add entries to.`
+ .list - `to view all of the user created lists.`
+ .list <`list-name`> <`your new entry`> - `to add a new entry to a user created list.`
+ .create-group <`groupName`> <`@user1`> <`@user2`> - `To create a mentionable group of users. You can mention as many users as you want.`
+ .create-group <`groupName`> <`title of game`> - `To create a mentionable group of users who play the specified game.`
+ .@<`groupName`> <`message to send`> - `To mention all members of a custom group in a message.`
+ .@<`gameName`> <`message to send`> - `To mention all users who play gameName in a message.`
+ .@power <`message to send`> - `If not called from #bot-spam or #scrubs will mention the channel's power users in a message.`
+ .subscribe-catfacts - `Subscribe to have the latest catfacts DMed hourly!`
+ .catfacts - `to get a cat fact.`
+ .channels-left - `to see the temp channels you have left.`
+ .rejoin-temp <`channel-name`> - `to rejoin a temp channel.`
+ .ignore-posts - `after adding :trashcan: reaction to posts, to stop them from appearing in #car-parts.`
+ .delete - `call this after adding both :trashcan: and :black_circle: reactions to first and last messages to delete.
      All messages between the two you reacted to will be deleted, including those two.
      This will only work if you are in a temp channel you created.`

### TV and Movie Ratings
+ .rate <`tv|movie`> <`1-4`> <`title of content`> - `to rate a tv or movie show 1-4 stars`
+ .rating-info <`title of content`> - `to get rating info for a title`
+ .delete-rating <`tv|movie> <title of content`> - `to delete your rating of a title`
+ .refresh-ratings - `to update the IMDB and RT ratings`

### Admin Commands
+ backup - `backs up all json files within the data folder to ../jsonBackups.`
+ restore <`backupFileName`> - `restores json files to the specified backup.`
+ list-backups - `lists the available backups.`
+ restart <`up|hard| `> - `restarts and updates the bot if specified.`
+ export - `writes all local data to their appropriate json files immediately.`
+ log - `toggles server output redirection to discord channel #server-log.`
+ revive - `revives a fallen Scrubbing Bubble.`
+ update-readme - `updates the readme to include new commands.`
+ remove-player <`@user`> <`game name`>- `remove a player from gamesPlayed.`
+ cars - `gets parts for sale by crawling car forum and creating a collage of all images in post.`
+ missing-help - `prints the commands that are missing help docs.`
+ review-messages - `to review messages posted since last review.`

## Examples

### Player Count Heatmap and Trends
![Player count heatmap](https://imgur.com/m93dbTH.png)
![Peak player count trend](https://i.imgur.com/h6BAC6w.png)
![Single game player count trend](https://i.imgur.com/gXvwZ2S.png)
![Multi-game player count trend](https://i.imgur.com/4YrXOHx.png)

### Movie and TV Ratings Table
![Ratings table](https://i.imgur.com/UJNcuWU.png)

### Stocks
![Stock portfolio](https://i.imgur.com/MBnEVwY.png)
![Daily stock changes](https://i.imgur.com/zcTZtvO.png)

### Users Who Play the Same Games and Playtime
![Who Plays](https://i.imgur.com/P13BmTn.png)

![Cumulative Hours Played](https://i.imgur.com/yClv3OC.png)
