var inspect = require('util-inspect');
var get = require('lodash.get');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;
var cmdHandler = require('./cmdHandler.js');
var scheduler = require('../scheduler.js');
var gambling = require('../entertainment/gambling.js');
var ratings = require('../channelEnhancements/ratings.js');
var games = require('../entertainment/games.js');
var cars = require('../channelEnhancements/cars.js');

var config = require('../../resources/data/config.json');
var priv = require('../../../private.json');

module.exports = class BotEventHandler {
    constructor(client) {
        this.client = client;
    }

    createEventHandlers() {
        /**
         * Listen's for messages in Discord.
         */
        this.client.on('message', (message) => {
            const firstChar = message.content.substring(0, 1);

            //Scrub Daddy will listen for messages starting with the prefix specified in config.json
            if (firstChar === config.prefix) {
                cmdHandler.handle(message);
            } else {
                util.maybeReplicateLol(message);
                games.maybeCallLetsPlay(message);
                util.maybeInsertQuotes(message);
                util.maybeBanSpammer(message);
                gambling.checkForMagicWords(message);
            }
        });

        /**
         * listens for updates to a user's presence (online status, game, etc).
         */
        this.client.on('presenceUpdate', (oldMember, newMember) => {
            if (util.isDevEnv()) { return; }

            const oldGame = get(oldMember, 'presence.game.name');
            const newGame = get(newMember, 'presence.game.name');

            //ignore presence updates for bots and online status changes
            if (!newMember.user.bot && newMember.highestRole.id !== c.PLEB_ROLE_ID && oldGame !== newGame) {
                games.maybeUpdateNickname(newMember, newGame);
                games.updateTimesheet(util.getNick(newMember.id), newMember.id, newMember.highestRole, oldGame, newGame);
                gambling.maybeDischargeScrubBubble();
                gambling.maybeCheckForBots();
            }
        });

        this.client.on('messageDelete', (message) => {
            const textDeleted = message.content || get(message, 'embeds[0].description');

            logger.info(`Message by ${util.getNick(message.author.id)} deleted from ${util.mentionChannel(message.channel.id)}: "${textDeleted}"`);
        });

        this.client.on('typingStart', (channel, user) => {
            gambling.maybeEnlistForRandomUser(channel.id, user.id);
        });

        this.client.on('voiceStateUpdate', (oldMember, newMember) => {
            if (util.isDevEnv()) { return; }

            //ignore presence updates for bots, mute/unmute, and changing between voice channels
            if (!newMember.user.bot && !newMember.voiceChannel !== !oldMember.voiceChannel) {
                games.maybeUpdateNickname(newMember, get(newMember, 'presence.game.name'));
            }
        });

        /**
         * Listens for a new member joining the server.
         */
        this.client.on('guildMemberAdd', (member) => {
            if (util.isDevEnv()) { return; }

            member.addRole(c.PLEB_ROLE_ID);
            const plebsChannel = this.client.channels.find('id', c.PLEBS_CHANNEL_ID);
            util.updateMembers();
            util.addInvitedByRole(member);
            plebsChannel.send(`Welcome to the server, ${util.mentionUser(member.id)}! Check out ${util.mentionChannel(c.NEW_MEMBER_CHANNEL_ID)}.`);
        });

        /**
         * Reconnects the bot if diconnected.
         */
        this.client.on('disconnect', (event) => {
            logger.error(`event: ${inspect(event)}`);
            this.client.login(priv.token);
        });

        /**
         * Listens for error events and logs them.
         */
        this.client.on('error', (error) => {
            logger.error(`message: ${inspect(error)}`);
        });

        /**
         * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
         */
        this.client.on('ready', () => {
            this.setChannels();
            util.updateMembers();
            util.updateServerInvites();
            util.enableServerLogRedirect();
            scheduler.scheduleRecurringJobs();
            gambling.maybeRefundUnfinishedRace();
            logger.info(`Connected`);

            if (util.isDevEnv()) { return; }

            ratings.updateThirdPartyRatings(true);
            games.updatePlayingStatus();
            gambling.updateLottoCountdown();
            util.sendEmbedMessage('B A C K⠀O N L I N E !', null, null, c.ONLINE_IMG);
        });

        process.on('uncaughtException', (err) => {
            logger.error(`Uncaught Exception: ${inspect(err)}`);
            games.exportTimeSheetAndGameHistory();
		    gambling.exportLedger();
        });
    }

    setChannels() {
        const server = this.client.guilds.find('id', priv.serverID);

        bot.setServer(server);
        bot.setBotSpam(server.channels.find('id', c.BOT_SPAM_CHANNEL_ID));
        bot.setScrubsChannel(server.channels.find('id', c.SCRUBS_CHANNEL_ID));
        bot.setPurgatory(server.channels.find('id', c.PURGATORY_CHANNEL_ID));
        bot.setLogChannel(server.channels.find('id', c.LOG_CHANNEL_ID));
        cars.setCarPartsChannel(server.channels.find('id', c.CAR_PARTS_CHANNEL_ID));
        games.setDynamicGameChannels(server.channels);
    }
};