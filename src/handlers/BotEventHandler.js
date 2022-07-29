var inspect = require('util-inspect');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
const { logger } = require('../logger.js');
var cmdHandler = require('./cmdHandler.js');
var scheduler = require('../scheduler.js');
var gambling = require('../entertainment/gambling.js');
var ratings = require('../channelEnhancements/ratings.js');
var heatmap = require('../imageCreation/heatmap.js');
var trends = require('../imageCreation/trends.js');
var prizes = require('../entertainment/prizes.js');
var stocks = require('../entertainment/stocks.js');
var games = require('../entertainment/games.js');
var vote = require('../entertainment/vote.js');
var cars = require('../channelEnhancements/cars.js');
var reacter = require('../entertainment/reacter.js');
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
            if (!message.guild) { return; } //ignore DMs

            //Scrub Daddy will listen for messages starting with the prefix specified in config.json
            if (message.content.charAt(0) === config.prefix) {
                cmdHandler.handle(message);
            } else if (!util.isDevEnv()) {
                reacter.maybeReact(message);
                util.maybeReplicateLol(message);
                games.maybeCallLetsPlay(message);
                util.maybeInsertQuotes(message);
                util.maybeBanSpammer(message);
                prizes.checkForMagicWords(message);
                games.maybeUpdateArkServerStatus(message);
                util.maybePostExternalMedia(message);
            }
        });

        /**
         * listens for updates to a user's presence (online status, game, etc).
         */
        this.client.on('presenceUpdate', (oldMember, newMember) => {
            if (util.isDevEnv()) { return; }

            const oldGame = games.determineActiveGameName(oldMember);
            const newGame = games.determineActiveGameName(newMember);

            //ignore presence updates for bots and online status changes
            if (!newMember.user.bot && newMember.highestRole.id !== c.PLEB_ROLE_ID && oldGame !== newGame) {
                games.maybeUpdateNickname(newMember, newGame);
                games.updateTimesheet(util.getNick(newMember.id), newMember.id, newMember.highestRole, oldGame, newGame);
                gambling.maybeDischargeScrubBubble();
                gambling.maybeCheckForBots();
            }
        });

        this.client.on('messageDelete', (message) => {
            const textDeleted = message.content ?? message.embeds?.[0]?.description;

            logger.info(`Message by ${util.getNick(message.author.id)} deleted from ${util.mentionChannel(message.channel.id)}: "${textDeleted}"`);
        });

        this.client.on('typingStart', (channel, user) => {
            gambling.maybeEnlistForRandomUser(channel.id, user.id);
        });

        this.client.on('voiceStateUpdate', (oldMember, newMember) => {
            if (util.isDevEnv()) { return; }

            //ignore presence updates for bots, mute/unmute, and changing between voice channels
            if (!newMember.user.bot && !newMember.voiceChannel !== !oldMember.voiceChannel) {
                const gameName = games.determineActiveGameName(newMember);

                if (!gameName) { return; }

                games.maybeUpdateNickname(newMember,gameName);
            }
        });

        /**
         * Listens for a new member joining the server.
         */
        this.client.on('guildMemberAdd', (member) => {
            if (util.isDevEnv()) { return; }

            const plebsChannel = this.client.channels.find('id', c.PLEBS_CHANNEL_ID);

            member.addRole(c.PLEB_ROLE_ID);
            util.updateMembers();
            util.addInvitedByRole(member);
            plebsChannel.send(`Welcome to the server, ${util.mentionUser(member.id)}!`);
        });

        /**
         * Reconnects the bot if diconnected.
         */
        this.client.on('disconnect', (event) => {
            logger.error(`disconnect event: ${inspect(event)}`);
            this.client.login(priv.token);
        });

        /**
         * Listens for error events and logs them.
         */
        this.client.on('error', (error) => {
            logger.error('error event: ', error);
        });

        /**
         * Logs the bot into Discord, stores id to nick map, and retrieves 3 crucial channels.
         */
        this.client.on('ready', () => {
            this.setChannels();
            this.registerCommandHandlers();
            util.updateMembers();
            util.updateServerInvites();
            util.enableServerLogRedirect();
            scheduler.scheduleRecurringJobs();
            gambling.maybeRefundUnfinishedRace();
            logger.info(`Connected`);
            reacter.train();

            if (util.isDevEnv()) { return; }

            games.updatePlayingStatus();
            prizes.updateLottoCountdown();
            prizes.maybeRenameBirthdayUsers();
            util.sendEmbed({ title: 'B A C K⠀O N L I N E !', image: c.ONLINE_IMG });
        });

        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception: ', err);
            util.sendEmbed({ image: c.OFFLINE_IMG });
            games.exportTimeSheetAndGameHistory();
            gambling.exportLedger();

            throw err;
        });

        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled promise rejection: ', err);
        });
    }

    setChannels(server) {
        server = server || this.client.guilds.find('id', priv.serverID);

        bot.setServer(server);
        bot.setBotSpam(server.channels.find('id', c.BOT_SPAM_CHANNEL_ID));
        bot.setScrubsChannel(server.channels.find('id', c.SCRUBS_CHANNEL_ID));
        bot.setPurgatory(server.channels.find('id', c.PURGATORY_CHANNEL_ID));
        bot.setLogChannel(server.channels.find('id', c.LOG_CHANNEL_ID));
        cars.setCarPartsChannel(server.channels.find('id', c.CAR_PARTS_CHANNEL_ID));
        games.setDynamicGameChannels(server.channels);
    }

    registerCommandHandlers() {
        const modules = [trends, heatmap, vote, util, scheduler, games, gambling, prizes, stocks, ratings, cars];

        modules.forEach((handler) => {
            handler.registerCommandHandlers();
        });
    }
};