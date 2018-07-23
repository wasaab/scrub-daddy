# scrub-daddy
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8f59c3e85df049d3bd319a21576f37c4)](https://www.codacy.com/app/Scrubs/scrub-daddy?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=wasaab/scrub-daddy&amp;utm_campaign=Badge_Grade)

[Update Log](https://github.com/wasaab/scrub-daddy/tree/update-log)

Discord bot with the following 83 commands:

1. Voting
      + Please Note - `You must be in a voice channel with at least 3 members to participate in a kick/ban vote.`
      + .votekick <`@user`> - `to remove user from channel.`
      + .voteban <`@user`> - `for a more permanent solution.`
      + .vote <`thing to vote for`> - `to do a custom vote.`
      + .voteinfo - `for totals of all custom votes.`
      + .voteinfo <`@user`> - `for total votes to kick/ban that user.`

1. Scrubbing Bubbles
      + .enlist - `enlists the discharged Scrubbing Bubbles to your army.`
      + .discharge - `honorably discharges a Scrubbing Bubble from your army.`
      + .discharge <`numBubbles`> - `honorably discharges numBubbles Scrubbing Bubble from your army.`
      + .give <`@user`> - `transfers a Scrubbing Bubble from your army to user's army.`
      + .give <`numBubbles`> <`@user`> - `transfers numBubbles from your army to user's army.`
      + .clean <`numBubbles`> - `send numBubbles to clean the toilet.`
      + .21 <`numBubbles`> - `to start a game of blackjack with a bet of numBubbles.`
      + .hit - `to hit in blackjack.`
      + .stay - `to stay in blackjack.`
      + .army - `retrieves the size of your army.`
      + .army <`@user`> - `retrieves the size of the user's army.`
      + .ranks - `outputs the army size of every user.`
      + .stats - `outputs your clean stats.`
      + .stats <`@user`> - `outputs the user's clean stats.`
      + .who-said <`channel-name`> <`minMsgLength`> <`minMsgReactions`> <`sampleSize`> - `Starts a quote guessing game using 5 random quotes pulled from sampleSize messages, matching the provided criteria.`
      + .sunken-sailor - `to start a game of Sunken Sailor with the users in your current voice channel.`

1. Time Played
      + .time <`Game Name`> <`@user`> - `user's playtime for the specified Game Name.`
      + .time <`Game Name`> - `cumulative playtime for the specified Game Name.`
      + .time <`@user`> - `user's playtime for all games.`
      + .time - `cumulative playtime for all games.`
      + .opt-in - `to opt into playtime tracking.`
      + .heatmap - `heatmap of player count for all games.`

1. Gaming
      + .playing - `player count of games currently being played.`
      + .who-plays - `to get list of players and last time played for games you play.`
      + .who-plays <`Game Name`> - `to get list of players and last time played for Game Name.`
      + .lets-play - `to ask all players of the game you are playing if they want to play.`
      + .lets-play <`Game Name|Game Emoji`> - `to ask all players of Game Name if they want to play.`
      + .lets-play -ss <`Game Name|Game Emoji`> - `.lets-play without @mentioning Super ͡Scrubs.`
      + .1-more - `to request 1 more player for the game you are playing via mentions.`
      + .p - `to ask @Scrubs to play PUBG in scrubs text channel.`
      + .fortnite-stats <`fortniteUserName|@user`> <`gameMode`> <`stat`> - `to lookup fortnite stats for the provided player.`
      + .fortnite-leaderboard <`gameMode`> <`stat`> - `to show the leaderboard for the provided game mode + stat.`
      + .set-fortnite-name <`fortniteUserName`> - `to link your Fortnite account to Scrub Daddy for stat lookup.`

1. Bot Issues, Feature Requests, and Help
      + Please Note - `Your issue title or feature title must be ONE WORD! msg is optional`
      + .tips - `to show all tips.`
      + .tips <`keyword`> - `to show all tips with a title that includes the provided keyword.`
      + .issue <`issue-title`> <`msg detailing issue`> - `to submit bot issues.`
      + .feature <`feature-title`> <`msg detailing feature`> - `to submit bot feature requests.`
      + .implement <`task-title`> - `to vote for the next task to complete.
            where task-title is the channel title of the issue or feature.`
      + .help, .info, or .h - `to show this message again.`

1. Roles & User Settings
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

1. Soundbytes
      + *sb - `to get the list of available soundbytes.`
      + *sb <`name`> - `to play the sound byte of the given name in your voice channel.`
      + *add-sb + `ATTACHMENT IN SAME MESSAGE` - `to add a sound byte.`
      + *fav-sb - `to get the list of your most frequently used soundbytes.`
      + *volume + `ATTACHMENT IN SAME MESSAGE` - `to add a sound byte.`

1. Utilities
      + .temp - `Creates a temporary text channel`
      + .temp <`text|voice`> - `Creates a temp text/voice channel.`
      + .temp <`text|voice`> <`channel-title`> - `Creates a voice/text channel with the provided title.`
      + .leave-temp - `to leave the temp channel the command is called in.`
      + .start-lotto <`MM/DD`> <`HH`> - `to start a Beyond lotto that will end at the specified time (`HH` can be 0-23).`
      + .lotto - `to join the currently running Beyond lotto or get the time remaining.`
      + .quote - `to quote and reply or save the quote, depending on which reaction you use (:quoteReply: or :quoteSave:).`
      + .quote <`@user`> - `to quote and reply or save the quote from @user, depending on which reaction you use (:quoteReply: or :quoteSave:).`
      + .quotes - `to retrieve the list of quotes from everyone on the server.`
      + .quotes <`@user`> - `to retrieve the list of quotes from the specified user.`
      + .create-list <`name of list`> - `to create a named list that users can add entries to.`
      + .list - `to view all of the user created lists.`
      + .list <`list-name`> <`your new entry`> - `to add a new entry to a user created list.`
      + .delete - `call this after adding both :trashcan: and :black_circle: reactions to first and last messages to delete.
             All messages between the two you reacted to will be deleted, including those two.
             This will only work if you are in a temp channel you created.`
1. Admin Commands
      + backup - `backs up all json files within the data folder to ../jsonBackups.`
      + restore <`backupFileName`> - `restores json files to the specified backup.`
      + list-backups - `lists the available backups.`
      + restart <`up|hard| `> - `restarts and updates the bot if specified.`
      + export - `writes all local data to their appropriate json files immediately.`
      + log - `toggles server output redirection to discord channel #server-log.`
      + revive - `revives a fallen Scrubbing Bubble.`
      + update-readme - `updates the readme to include new commands.`
      + gen-heatmap - `generates the player count heatmap.`

## Setup
---

Add a file named `private.json` with the following contents one directory outside of the `scrub-daddy` directory:

```
{
    "token": "Insert your discord bot token here.",
    "trnApiKey": "Get a fortnite stats TRN API key from https://fortnitetracker.com/site-api and insert it here",
    "googleUrlApiKey": "Get a Google URL Shortener API key from https://developers.google.com/url-shortener/v1/getting_started#APIKey and insert it here"
}
```

If you need help generating the discord bot token needed to add the bot to your server, use [the guide created by jagrosh](https://github.com/jagrosh/MusicBot/wiki/Adding-Your-Bot-To-Your-Server)

Call `.setup` within the server you added this bot to once that file is created. You can add the api keys later, but the token needs to be added prior to calling `.setup`.