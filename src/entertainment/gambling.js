var Discord = require('discord.js');
var moment = require('moment');
var get = require('lodash.get');
var rp = require('request-promise');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;
var scheduler = require('../scheduler.js');

var loot = require('../../resources/data/loot.json');
var ledger = require('../../resources/data/ledger.json');   //keeps track of how big of an army each member has as well as bet amounts
var config = require('../../resources/data/config.json');
var priv = require('../../../private.json');

const activeGamblerIds = getActiveGamblerIds();

var numStocksUpdated = 0;
var dropped = 0;
var previousMessage;
var idToAmountStolen = {};
var prevDropNum;

/**
 * exports the ledger to a json file.
 */
exports.exportLedger = function() {
    util.exportJson(ledger, 'ledger');
};

/**
 * Gives a scrubbing bubble to the provided user, taking that amount from
 * the calling user's army.
 *
 * @param {String} userID - the id of the user giving bubbles
 * @param {String} userName - the name of the user giving bubbles
 * @param {String} targetMention - a mention of the user to give bubbles to
 * @param {Number} numBubbles - the number of bubbles to give
 */
exports.giveScrubBubbles = function (userID, userName, targetMention, numBubbles) {
    if (isNaN(numBubbles)) { return; }
    numBubbles = Number(numBubbles);
    if (numBubbles < 1 || !(ledger[userID] && ledger[userID].armySize >= numBubbles)) { return; }

    const targetID = util.getIdFromMention(targetMention);
    if (util.getNick(targetID)) {
        removeFromArmy(userID, numBubbles);
        addToArmy(targetID, numBubbles);
        const msg = `${targetMention}  ${getArmyGrownMessage(numBubbles)} ${getArmySizeMsg(targetID)}`;
        util.sendEmbedMessage(`Scrubbing Bubbles Gifted By ${userName}`, msg, userID);
    }
};

/**
 * Discharges a scrub bubble from the provided user's army, so that another
 * member may enlist the bubble to their army.
 *
 * @param {String} userID - the id of the user discharging a bubble
 * @param {Number} numBubbles - the number of bubbles to discharge
 */
exports.dischargeScrubBubble = function(numBubbles, userID) {
    numBubbles = numBubbles && !isNaN(numBubbles) ? Number(numBubbles) : 1;
    if (userID) {
        if (numBubbles < 1 || !(ledger[userID] && ledger[userID].armySize >= numBubbles)) { return; }

        removeFromArmy(userID, numBubbles);
    }

    dropped += numBubbles;
    var droppedImg = dropped;
    var msg = 'Bubble\nhas';

    if (dropped > 1) {
        msg = 'Bubbles\nhave';
        if (dropped > 21) {
            droppedImg = 21;
        }
    }

    const title = `**${dropped} Scrubbing ${msg} arrived for duty!**`;
    const thisMessage = util.sendEmbedMessage(null, title, userID, c.BUBBLE_IMAGES[droppedImg-1], true);

    exports.maybeDeletePreviousMessage(thisMessage);
};

/**
 * drops a scrub bubble in bot-spam with a 40% chance.
 */
exports.maybeDischargeScrubBubble = function() {
    if (util.isDevEnv()) { return; }

    var num = util.getRand(1, 11);
    if (num > 6) {
        if (num !== prevDropNum) {
            exports.dischargeScrubBubble();
        } else {
            exports.dischargeScrubBubble(util.getRand(1, 61));
        }

        prevDropNum = num;
    }
};

exports.reserve = function(userID) {
    const baseTitle = 'Request for Reserve Scrubbing Bubbles';
    const lastReserveTime = ledger[userID].lastReserveTime;

    if (lastReserveTime && moment().isSame(moment(lastReserveTime), 'day')) {
        util.sendEmbedMessage(`${baseTitle} Denied`,
            `${util.mentionUser(userID)}, you have to wait a day to request more soldiers.`);
    } else {
        addToArmy(userID, c.DAILY_RESERVE_AMOUNT);
        const msg = `${util.mentionUser(userID)} ${util.formatAsBoldCodeBlock(c.DAILY_RESERVE_AMOUNT)} Scrubbing Bubbles have been called to active duty! ${getArmySizeMsg(userID)}`;
        util.sendEmbedMessage(`${baseTitle} Approved`, msg, userID);
        ledger[userID].lastReserveTime = moment().valueOf();
        exports.exportLedger();
    }
};

/**
 * Removes the given number of Scrubbing Bubbles from the provided user's army.
 *
 * @param {String} userID - id of the user to remove from
 * @param {Number} amount - amount to remove
 */
function removeFromArmy(userID, amount) {
    ledger[userID].armySize -= amount;
    ledger[userID].stats.scrubsDischared += amount;
}

function maybeCreateLedgerEntry(userID) {
    if (ledger[userID]) { return; }

    ledger[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
}

/**
 * Adds the given number of Scrubbing Bubbles to the provided user's army.
 *
 * @param {String} userID - id of the user to add to
 * @param {Number} amount - amount to add
 */
function addToArmy(userID, amount) {
    maybeCreateLedgerEntry(userID);

    const userEntry = ledger[userID];

    userEntry.armySize += amount;

    if (!userEntry.stats) { return; }

    userEntry.stats.scrubsEnlisted += amount;

    if (userEntry.armySize > userEntry.stats.recordArmy) {
        userEntry.stats.recordArmy = userEntry.armySize;
    }
}

function getArmyGrownMessage(amount) {
    return `Your Scrubbing Bubbles army has grown by ${util.formatAsBoldCodeBlock(amount)}!`;
}

function getArmySizeMsg(userID) {
    return `You now have an army of ${util.formatAsBoldCodeBlock(ledger[userID].armySize)}.`;
}

function getActiveGamblerIds() {
    return Object.keys(ledger).filter((id) => !c.INACTIVE_GAMBLER_IDS.includes(id));
}

exports.maybeEnlistForRandomUser = function(channelID, userID) {
    if (channelID !== c.BOT_SPAM_CHANNEL_ID || userID !== c.DBC_ID || util.getRand(0, 5) === 0) { return; }

    exports.enlist(activeGamblerIds[util.getRand(0, activeGamblerIds.length)]);
};

/**
 * enlists a scrubbing bubble in userID's army.
 */
exports.enlist = function(userID, message) {
    if (dropped < 1) { return; }

    addToArmy(userID, dropped);
    const msg = `${util.mentionUser(userID)}  ${getArmyGrownMessage(dropped)} ${getArmySizeMsg(userID)}`;
    util.sendEmbedMessage(null, msg, userID);
    exports.maybeDeletePreviousMessage();
    dropped = 0;

    if (!message) { return; }

    message.delete();           
};

/**
 * Takes the user's bet from the ledger.
 *
 * @param {String} userID - the id of the user betting
 * @param {number} bet - the bet amount
 * @param {String} type - the type of bet
 */
function takeBetFromUser(userID, bet, type) {
    var userEntry = ledger[userID];

    userEntry[`${type}Bet`] = bet;
    userEntry.armySize -= bet;
    userEntry.stats.scrubsBet += bet;

    if (userEntry.stats.mostBet < bet) {
        userEntry.stats.mostBet = bet;
    }
}

/**
 * Resets the ledger's bets to 0.
 *
 * @param {String} userID - the id of the user betting
 * @param {String} type - the type of bet
 */
function resetLedgerAfterBet(userID, type) {
    ledger[userID][`${type}Bet`] = 0;
}

/**
 * Adds to the given user's gaming streak stats.
 *
 * @param {Object} userStats - stats of the user
 * @param {Boolean} isWin - true iff bet was won
 */
function addToGamblingStreaks(userStats, isWin) {
    const outcome = isWin ? 'Win' : 'Loss';
    const highestStreakStat = `highest${outcome}Streak`;
    const currentStreakStat = `${outcome.toLocaleLowerCase()}Streak`;
    const oppositeStreakStat = isWin ? 'lossStreak' : 'winStreak';

    userStats[currentStreakStat]++;
    userStats[oppositeStreakStat] = 0;

    if (userStats[currentStreakStat] > userStats[highestStreakStat]){
        userStats[highestStreakStat] = userStats[currentStreakStat];
    }
}

/**
 * Adds to to the user's gambling stats.
 *
 * @param {number} amount - amount the user won or lost
 * @param {String} userID - the user to add stats to
 * @param {Boolean} isWin - true iff bet was won
 */
function addToGamblingStats(amount, userID, isWin) {
    const outcome = isWin ? 'Won' : 'Lost';
    const userStats = ledger[userID].stats;
    const mostStat = `most${outcome}`;

    userStats[`bets${outcome}`]++;
    userStats[`scrubs${outcome}`] += amount;

    if (amount > userStats[mostStat]) {
        userStats[mostStat] = amount;
    }

    addToGamblingStreaks(userStats, isWin);
}

exports.maybeRefundUnfinishedRace = function() {
    const scrubDaddyEntry = ledger[c.SCRUB_DADDY_ID];

    if (!scrubDaddyEntry || !scrubDaddyEntry.race) { return; }

    const userIdToEmoji = scrubDaddyEntry.race.userIdToEmoji;

    for (var userID in userIdToEmoji) {
        const bet = ledger[userID].raceBet;
        addToArmy(userID, bet);
        resetLedgerAfterBet(userID, 'race');
        scrubDaddyEntry.armySize -= bet;
    }

    delete scrubDaddyEntry.race;
};

function updateRace(raceMsg, updates) {
    if (updates.length === 0) { return endRace(); }

    raceMsg.edit('', updates.pop())
        .then((msgSent) => {
            setTimeout(() => {
                updateRace(msgSent, updates);
            }, 700);
        });
}

function startRace() {
    const updates = buildRaceProgressUpdates();

    util.sendEmbedMessage('🏁 Race', updates.pop().description).then((msgSent) => {
        setTimeout(() => {
            updateRace(msgSent, updates);
        }, 1500);
    });
}

function buildRaceUpdate(userIdToProgress, sideline) {
    var raceUpdate = new Discord.RichEmbed({
        color: 0xffff00,
        title: '🏁 Race',
        description: ''
    });

    for (var userID in userIdToProgress) {
        raceUpdate.description += `${sideline}\n${userIdToProgress[userID]}\n`;
    }

    raceUpdate.description += sideline;

    return raceUpdate;
}

function buildRaceProgressUpdates() {
    const sideline = '━'.repeat(18);
    const lane = `${c.FINISH_LINE}${'﹒ '.repeat(11)}`;
    const race = ledger[c.SCRUB_DADDY_ID].race;
    const userIds = Object.keys(race.userIdToEmoji);
    const numRacers = userIds.length;
    var newProgress;
    var movingUserId;
    var prevMovingUserId;
    var raceUpdates = [];
    var userIdToProgress = {};
    var movesRemainingInUpdate = util.getRand(1, numRacers + 1);

    function updateProgress() {
        prevMovingUserId = movingUserId;
        movingUserId = userIds[util.getRand(0, numRacers)];

        if (movesRemainingInUpdate > 1 && prevMovingUserId === movingUserId) { return; }

        newProgress = userIdToProgress[movingUserId].replace('﹒ ', '');
        userIdToProgress[movingUserId] = newProgress;
        movesRemainingInUpdate--;
    }

    function maybeAddUpdatedProgress(isRaceFinished) {
        if (!isRaceFinished && movesRemainingInUpdate !== 0) { return; }

        raceUpdates.push(buildRaceUpdate(userIdToProgress, sideline));
        movesRemainingInUpdate = util.getRand(1, numRacers + 1);
    }

    userIds.forEach((userID) => {
        userIdToProgress[userID] = lane + race.userIdToEmoji[userID];
    });

    raceUpdates.push(buildRaceUpdate(userIdToProgress, sideline));

    while (!newProgress || newProgress.startsWith(`${c.FINISH_LINE}﹒`)) {
        updateProgress();
        maybeAddUpdatedProgress();
    }

    maybeAddUpdatedProgress(true);

    race.winner = {
        emoji: race.userIdToEmoji[movingUserId],
        id: movingUserId,
        racerIds: userIds
    };

    return raceUpdates.reverse();
}

function endRace() {
    const scrubDaddyEntry = ledger[c.SCRUB_DADDY_ID];
    const winner = scrubDaddyEntry.race.winner;
    const bet = ledger[winner.id].raceBet;
    const payoutMultiplier = winner.racerIds.length < 4 ? 2 : 2.6;
    var winnings = Math.floor(bet * payoutMultiplier);
    var extraWinningsMsg = '';

    if (util.getRand(1, 11) === 1) {
        const extraWinnings = util.getRand(1, scrubDaddyEntry.armySize);

        scrubDaddyEntry.armySize -= extraWinnings;
        winnings += extraWinnings;
        extraWinningsMsg = `\n\nThe RNG Gods have blessed you with an additional ${util.formatAsBoldCodeBlock(extraWinnings)} `
            + `Scrubbing Bubbles from ${util.mentionUser(c.SCRUB_DADDY_ID)}s army!`;
    }

    addToArmy(winner.id, winnings);
    util.sendEmbedMessage('🏁 Race Finished', `🎊 ${winner.emoji} 🎊    ${util.mentionUser(winner.id)} is the winner mon!`
        + `${extraWinningsMsg}\n\n${getArmyGrownMessage(winnings - bet)} ${getArmySizeMsg(winner.id)}`);

    winner.racerIds.forEach((userID) => {
        resetLedgerAfterBet(userID, 'race');
    });

    delete scrubDaddyEntry.race;
}

function isAbleToAffordBet(userID, bet) {
    const userEntry = ledger[userID];
    return userEntry && userEntry.armySize >= bet;
}

function enterRace(userID, bet, type) {
    const scrubDaddyEntry = ledger[c.SCRUB_DADDY_ID];
    const racerEmoji = scrubDaddyEntry.race.racerEmojis.pop();
    const updatedSDArmySize = scrubDaddyEntry.armySize ? scrubDaddyEntry.armySize + bet : bet;

    takeBetFromUser(userID, bet, type);
    scrubDaddyEntry.armySize = updatedSDArmySize;
    scrubDaddyEntry.race.userIdToEmoji[userID] = racerEmoji;
    util.sendEmbedMessage('New Race Competitor', `Watch out boys, ${util.mentionUser(userID)}'s ${racerEmoji} has joined the race.`, userID);
}

exports.race = function(userID, args, type) {
    const scrubDaddyEntry = ledger[c.SCRUB_DADDY_ID] || {};

    if (!scrubDaddyEntry.race) {
        if (!args[1] || isNaN(args[1])) { return; }

        const racerEmojis = c.RACER_EMOJIS.slice(0);

        util.shuffleArray(racerEmojis);
        ledger[c.SCRUB_DADDY_ID] = Object.assign(scrubDaddyEntry, {
            race: {
                bet: Number(args[1]),
                userIdToEmoji: {},
                racerEmojis: racerEmojis
            }
        });
    }

    const race = scrubDaddyEntry.race;

    if (race.ongoing || !isAbleToAffordBet(userID, race.bet)|| race.userIdToEmoji[userID] || race.racerEmojis.length === 0) { return; }

    enterRace(userID, race.bet, type);

    if (Object.keys(race.userIdToEmoji).length !== 1) { return; }

    util.sendEmbedMessage('Race Starting Soon', `A race will start in 20 seconds.\n`
        + `Call ${util.formatAsBoldCodeBlock(`${config.prefix}race`)} to enter with a bet of ${util.formatAsBoldCodeBlock(race.bet)} Scrubbing Bubbles.`);
    setTimeout(() => {
        if (Object.keys(race.userIdToEmoji).length === 1) {
            return cancelRace(race, userID);
        }

        race.ongoing = true;
        startRace();
    }, 20000);
};

function cancelRace(race, userID) {
    exports.maybeRefundUnfinishedRace();
    util.sendEmbedMessage('Race Cancelled', `Sorry ${util.mentionUser(userID)}, looks like everybody is too 🐔 to challenge your ${race.userIdToEmoji[userID]}`);
}

/**
 * Handles clean command. Takes the bet from the user and
 * keeps it if they lose. If they win, twice the bet is given to the user.
 *
 * @param {String} userID - the id of the user betting
 * @param {number} bet - the bet amount
 * @param {String} type - the type of bet
 */
function betClean(userID, bet, type) {
    var wallet = ledger[userID];
    var msg = '';

    if (!wallet || wallet.armySize < bet ) {
        msg = 'Your army is nonexistent.';
        if (wallet && wallet.armySize > 0) {
            msg = `Your ${wallet.armySize} soldier${util.maybeGetPlural(wallet.armySize)} would surely perish.`;
        }
        const description = `${util.mentionUser(userID)}  You do not have enough Scrubbing Bubbles to clean the bathroom. ${msg}`;
        util.sendEmbedMessage(null, description, userID);
    } else {
        var img = '';
        takeBetFromUser(userID, bet, type);

        if (util.getRand(0,2)) {
            const payout = bet*2;
            img = c.CLEAN_WIN_IMG;
            msg = `Congrats, your auxiliary army gained ${util.formatAsBoldCodeBlock(bet)} Scrubbing Bubbles after cleaning the bathroom and conquering the land!`;
            addToArmy(userID, payout);
            addToGamblingStats(payout, userID, true);
        } else {
            img = c.CLEAN_LOSE_IMG;
            msg = `Sorry bud, you lost ${util.formatAsBoldCodeBlock(bet)} Scrubbing Bubble${util.maybeGetPlural(bet)} in the battle.`;
            addToGamblingStats(bet, userID, false);
        }
        util.sendEmbedMessage(null, `${util.mentionUser(userID)}  ${msg}\n${getArmySizeMsg(userID)}`, userID, img);
        resetLedgerAfterBet(userID, type);
    }
}

/**
 * Calls betClean if the bet is valid.
 */
exports.maybeBetClean = function(userID, args, message) {
    const bet = Number(args[1]);

    if (!bet || bet < 1) { return; }

    betClean(userID, bet, args[0]);
    message.delete();
};

/**
 * Outputs the user's army size or their gambling stats.
 */
function outputUserGamblingData(userID, args) {
    var msg = ' your';
    if (args[1]) {
        if (args[1].match(/\d/g) !== null) {
            userID = util.getIdFromMention(args[1]);
            msg = '\'s';
        }
    }

    const userEntry = ledger[userID];

    if (!userEntry) { return; }

    const armySize = userEntry.armySize;
    var title;
    var description = '';

    if (args[0] === 'army') {
        description = `${util.mentionUser(userID)}${msg} army is ${util.formatAsBoldCodeBlock(armySize)} Scrubbing Bubble${util.maybeGetPlural(armySize)} strong!`;
    } else {
        const userStats = userEntry.stats;

        title = 'Gambling Stats';
        description = `${util.mentionUser(userID)}${msg} Stats (starting from 10/31/17):\n` +
            `Current Army Size: ${util.formatAsBoldCodeBlock(armySize)}\n` +
            `Record Army Size: ${util.formatAsBoldCodeBlock(userStats.recordArmy)}\n` +
            `Total Scrubbles Bet: ${util.formatAsBoldCodeBlock(userStats.scrubsBet)}\n` +
            `Total Scrubbles Won: ${util.formatAsBoldCodeBlock(userStats.scrubsWon)}\n` +
            `Total Scrubbles Lost: ${util.formatAsBoldCodeBlock(userStats.scrubsLost)}\n` +
            `Total Bets Won: ${util.formatAsBoldCodeBlock(userStats.betsWon)}\n` +
            `Total Bets Lost: ${util.formatAsBoldCodeBlock(userStats.betsLost)}\n` +
            `Total Scrubbles Enlisted: ${util.formatAsBoldCodeBlock(userStats.scrubsEnlisted)}\n` +
            `Total Scrubbles Discharged: ${util.formatAsBoldCodeBlock(userStats.scrubsDischared)}\n` +
            `Most Scrubbles Bet: ${util.formatAsBoldCodeBlock(userStats.mostBet)}\n` +
            `Most Scrubbles Won: ${util.formatAsBoldCodeBlock(userStats.mostWon)}\n` +
            `Most Scrubbles Lost: ${util.formatAsBoldCodeBlock(userStats.mostLost)}\n` +
            `Longest Win Streak: ${util.formatAsBoldCodeBlock(userStats.highestWinStreak)}\n` +
            `Longest Loss Streak: ${util.formatAsBoldCodeBlock(userStats.highestLossStreak)}\n` +
            `Current Win Streak: ${util.formatAsBoldCodeBlock(userStats.winStreak)}\n` +
            `Current Loss Streak: ${util.formatAsBoldCodeBlock(userStats.lossStreak)}`;

        if (!isNaN(userStats.rocksDropped)) {
            description += `\nRocks Dropped: ${util.formatAsBoldCodeBlock(userStats.rocksDropped)}`;
        }

        if (!isNaN(userStats.stocksNetArmyChange)) {
            description += `\nStocks Net Army Change: ${util.formatAsBoldCodeBlock(userStats.stocksNetArmyChange)}`;
        }
    }

    util.sendEmbedMessage(title, description, userID);
}


/**
 * Outputs the user's army size.
 */
exports.army = function(userID, args) {
    outputUserGamblingData(userID, args);
};

/**
 * Outputs the user's gambling stats.
 */
exports.stats = function (userID, args) {
    outputUserGamblingData(userID, args);
};

/**
 * Outputs all member's army sizes in order.
 */
exports.armyRanks = function(userID) {
    var fields = [];
    const scrubIDToNick = util.getScrubIdToNick();
    for (var id in ledger) {
        if (id === c.SCRUB_DADDY_ID) { continue; }

        fields.push(util.buildField(scrubIDToNick[id], ledger[id].armySize));
    }
    fields.sort(util.compareFieldValues);
    util.sendEmbedFieldsMessage('Scrubbing Bubbles Army Sizes', fields, userID);
};

/**
 * Deletes previous arrived for duty message if it exists.
 */
exports.maybeDeletePreviousMessage = function (msg) {
    if (!previousMessage) {
        previousMessage = msg;
        return;
    }

    previousMessage.then((prevMsg) => {
        prevMsg.delete();
        previousMessage = msg;
    });
};

/**
 * Updates the lotto countdown for use in playing status.
 */
exports.updateLottoCountdown = function() {
	if (!config.lottoTime || util.isDevEnv()) { return; }
	bot.getClient().user.setPresence({game: {name: `lotto ${getTimeUntilLottoEnd().timeUntil}`}});
};

function isValidTime(monthDayTokens, hour) {
    function isInputNumbers() {
        return !isNaN(month) && !isNaN(day) && !isNaN(hour);
    }

    function isValBetweenMinAndMax(value, min, max) {
        return value > min && value < max;
    }

    if (monthDayTokens.length !== 2) { return false; }
    const month = monthDayTokens[0];
    const day = monthDayTokens[1];

    return isInputNumbers()
        && isValBetweenMinAndMax(month, 0, 13)
        && isValBetweenMinAndMax(day, 0, 32)
        && isValBetweenMinAndMax(hour, -1, 24);
}

exports.startLotto = function(user, userID, monthDay, hour) {
    if (config.lottoTime) { return; }

    const monthDayTokens = monthDay.split("/");

    if (!isValidTime(monthDayTokens, hour)) { return; }

    const lottoDate = new Date(
        new Date().getFullYear(), monthDayTokens[0] - 1, monthDayTokens[1], hour, 0);

    config.lottoTime = lottoDate.valueOf();
    util.exportJson(config, 'config');
    outputLottoInfo(userID, true);

    if (!util.isAdmin(userID)) {
        removePrizeFromInventory(userID, 'start-lotto', 3);
    }

    scheduler.scheduleLotto();
};

exports.stopLotto = function (userID, tierNumber, cmd) {
    delete config.lottoTime;
    util.exportJson(config, 'config');
    util.sendEmbedMessage('Beyond Lotto Stopped', `The lottery was stopped by ${util.mentionUser(userID)} with a Scrub Box prize.`);
    removePrizeFromInventory(userID, cmd, tierNumber);
};

exports.joinLotto = function(user, userID) {
    var entries = config.lottoEntries || [];

    if (entries.includes(userID)) {
        checkLotto(userID);
    } else {
        entries.push(userID);
        config.lottoEntries = entries;
        util.exportJson(config, 'config');
        util.sendEmbedMessage(`${user} has entered the Beyond Lotto`, `There are now ${entries.length} participants.`, userID);
    }
};

function getTimeUntilLottoEnd() {
    const endMoment = moment(config.lottoTime);

    return { timeUntil: endMoment.fromNow(), endDate: endMoment.format(c.FULL_DATE_TIME_FORMAT) };
}

function checkLotto(userID) {
    if (!config.lottoTime) {
        util.sendEmbedMessage('Beyond Lotto Information', 'There is no Beyond lotto currently running.', userID);
        return;
    }

    outputLottoInfo(userID);
}

exports.endLotto = function() {
	if (!config.lottoEntries || config.lottoEntries.length <= 1) { return; }

    const {fakeWinner, winner, winnerID} = getFakeAndRealWinner();
    const winningMsgs = [`...and ${winner} has risen from the filth to become...\nBEYOND!`,
        `Amongst the trashcans, ${winner} has been plucked from obscurity to become...\nBEYOND!`,
        `May your name once again be your own. Welcome to Beyond, ${winner}!`,
        `...and ${fakeWinner} is the winner in our hearts. However, the real winner is ${winner}!`,
        `Today the Gods of RNG have shined their light upon ${winner}!`];

    const winningMsg = winningMsgs[util.getRand(0, winningMsgs.length)];
    util.sendEmbedMessage('The Beyond Lotto Has Concluded', winningMsg, null, c.BEYOND_LOTTO_IMG);
    logger.info(`Beyond lotto winner = ${winner}`);

    const server = bot.getServer();
    const winningUser = server.members.find('id', winnerID);
    winningUser.addRole(server.roles.find('id', c.BEYOND_ROLE_ID));

    delete config.lottoTime;
    delete config.lottoEntries;
};

function outputLottoInfo(userID, isStartMsg) {
    const { timeUntil, endDate } = getTimeUntilLottoEnd();
    const title = isStartMsg ? 'Started' : 'Information';
    var entries = '';

    config.lottoEntries.forEach((userId) => {
        entries += `${util.getNick(userId)}\n`;
    });

    util.sendEmbedMessage(`Beyond Lotto ${title}`, `The lotto will end ${util.formatAsBoldCodeBlock(timeUntil)} on ${endDate} EST\n\n` +
        `**The following ${config.lottoEntries.length} users have entered:**\n${entries}`, userID);
}

function getFakeAndRealWinner() {
	var winnerID;
	var fakeWinnerID;
	while (winnerID === fakeWinnerID) {
		winnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
		fakeWinnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
    }
    return {
        fakeWinner: util.getNick(fakeWinnerID),
        winner: util.getNick(winnerID),
        winnerID: winnerID
    };
}

exports.getLedger = function() {
    return ledger;
};

exports.fakeSteal = function(amount, target, userID) {
    if (util.isLocked() || isNaN(amount)) { return; }

    const targetID = util.getIdFromMention(target);
    if (ledger[targetID] && ledger[targetID].armySize/3 >= amount) {
        util.lock();
        ledger[targetID].armySize -= amount;
        ledger[userID].armySize += amount;
        setTimeout(() => {
            ledger[targetID].armySize += amount;
            ledger[userID].armySize -= amount;
            util.unLock();
        }, 45000);
    }
};

exports.fakeStealAll = function() {
    if (util.isLocked()) { return; }

    util.lock();
    for (var id in ledger) {
        if (id === c.SCRUB_DADDY_ID) { continue; }

        const thirdOfArmy = Math.round(ledger[id].armySize/3);
        if (thirdOfArmy > 0) {
            ledger[id].armySize -= thirdOfArmy;
            ledger[c.AF_ID].armySize += thirdOfArmy;
            idToAmountStolen[id] = thirdOfArmy;
        }
    }
    util.sendEmbedMessage(null, null, null, c.STEAL_IMG);
    setTimeout(() => {
        for (var userID in idToAmountStolen) {
            ledger[userID].armySize += idToAmountStolen[userID];
            ledger[c.AF_ID].armySize -= idToAmountStolen[userID];
            util.unLock();
        }
    }, 60000);
};

exports.scrubBox = function(userID, tierNumber) {
    if (tierNumber > 3 || tierNumber < 1) { return; }

    const cost = c.TIER_COST[tierNumber - 1];

    if (!ledger[userID] || ledger[userID].armySize < cost) {
        return util.sendEmbedMessage('Insufficient Funds',
            `${util.mentionUser(userID)} You are too poor to afford a tier ${tierNumber} Scrub Box.`, userID);
    }

    removeFromArmy(userID, cost);

    var { title, prizeDescription, extraInfo } = addRandomPrizeAndGetInfo(tierNumber, userID);

	util.sendEmbedMessage(title, null, userID, 'https://i.imgur.com/mKwsQGi.gif')
	.then((msgSent) => {
		const updatedMsg = new Discord.RichEmbed({
			color: 0xffff00,
			title: title,
			description: `${util.mentionUser(userID)}, the Scrubbing Bubble gods have blessed you with:` +
				`\n\n${prizeDescription}\n\n${extraInfo}.`
		});
		setTimeout(() => {
			msgSent.edit('', updatedMsg);
		}, 6200);
	});
};

function addRandomPrizeAndGetInfo(tierNumber, userID) {
    const prizesInTier = c.PRIZE_TIERS[tierNumber - 1];
    const prizes = Object.keys(prizesInTier);
    const prize = prizes[util.getRand(0, prizes.length)];
    const prizeDescription = c.PRIZE_TO_DESCRIPTION[prize].replace('``', `\`${prizesInTier[prize]}\``);
    const title = `Scrubbing Bubble Loot Box - Tier ${tierNumber}`;
    var extraInfo = `Call \`.help ${prize}\` for usage info`;

    if (prize.endsWith('bubbles')) {
        addToArmy(userID, prizesInTier[prize]);
        extraInfo = getArmySizeMsg(userID);
    } else {
        addPrizeToInventory(userID, prize, tierNumber);
    }

    return { title, prizeDescription, extraInfo };
}

function addPrizeToInventory(userID, prize, tierNumber) {
    if (!ledger[userID]) {
        ledger[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    }
    if (!ledger[userID].inventory) {
        ledger[userID].inventory = {};
    }
    if (!ledger[userID].inventory[tierNumber]) {
        ledger[userID].inventory[tierNumber] = {};
    }

    if (!ledger[userID].inventory[tierNumber][prize]) {
        ledger[userID].inventory[tierNumber][prize] = 1;
    } else {
        ledger[userID].inventory[tierNumber][prize]++;
    }

    if (prize === 'add-emoji' && tierNumber === 3) {
        ledger[userID].inventory[tierNumber][prize] += 2;
    }
}

function removePrizeFromInventory(userID, prize, tierNumber) {
    const userInventory = ledger[userID].inventory;
    const tierData = userInventory[tierNumber];

    if (tierData[prize] > 1) {
        tierData[prize]--;
    } else {
        delete tierData[prize];
        if (Object.keys(tierData).length === 0) {
            delete userInventory[tierNumber];
        }
    }
}

exports.outputInventory = function(userID) {
    if (!ledger[userID] || !ledger[userID].inventory) {
        return util.sendEmbedMessage('No Inventory', `${util.mentionUser(userID)}, all you have is a rock.`, userID);
    }

    const inventory = ledger[userID].inventory;
    var fields = [];
    var results = [];
    for (var tier in inventory) {
        var tierFields = [];
        for (var action in inventory[tier]) {
            tierFields.push(util.buildField(action, inventory[tier][action]));
        }

        if (tierFields.length < 1) { continue; }

        fields = fields.concat(tierFields);
        results.push({
            name: `Tier ${tier}`,
            fields: tierFields
        });
    }

    if (fields.length < 1) { return; }

    fields.sort(util.compareFieldValues);
    const homePage = {
		name: `${util.getNick(userID)}'s Inventory`,
		fields: fields
    };

    util.sendDynamicMessage(userID, 'tier', results, homePage);
};

function getPrizeCount(userID, prize, tierNumber) {
    return get(ledger, `[${userID}].inventory[${tierNumber}][${prize}]`) || 0;
}

exports.hasPrize = function(userID, prize, tierNumber) {
    if (isNaN(tierNumber)) { return false; }

    if (0 === getPrizeCount(userID, prize, tierNumber)) {
        util.sendEmbedMessage('Prize not in inventory', `To gain access to the \`${prize}\` command, win it in a Scrub Box.`, userID);
        return false;
    }

    return true;
};

exports.maybeResetNames = function() {
    const lockedIdToLockInfo = loot.lockedIdToLockInfo;
    if (lockedIdToLockInfo === {}) { return; }

    const server = bot.getServer();

    for (var targetID in lockedIdToLockInfo) {
        const lockInfo = lockedIdToLockInfo[targetID];
        const target = server[`${lockInfo.type}s`].find('id', targetID);

        if (!target || moment().isAfter(moment(lockInfo.unlockTime))) {
            if (target) {
                maybeRename(lockInfo.type, target, lockInfo.oldName)
                    .then(() => {
                        updateRenamedList(lockInfo.oldName);
                    });
            }

            delete loot.lockedIdToLockInfo[targetID];
            util.exportJson(loot, 'loot');
            continue;
        }

        const targetName = target.nickname || target.name;

        if (targetName === lockInfo.newName || targetName === lockInfo.newName.split(' ').join('-')) { continue; }

        maybeRename(lockInfo.type, target, lockInfo.newName);
    }
};

function updateRenamedList(oldName, newName, endTime) {
    bot.getBotSpam().fetchMessage(c.RENAMED_LIST_MSG_ID)
        .then((message) => {
            const oldEmbed = message.embeds[0];
            var description;

            if (!newName) { // remove renaming
                const oldRenameRegex = new RegExp(`${oldName} =.*$`, 'gm');
                description = oldEmbed.description.replace(oldRenameRegex, '');

                if (description === '') {
                    description = c.NO_RENAMES_MSG;
                }
            } else { // Add renaming
                var baseDesc = oldEmbed.description || '';

                if (baseDesc.includes(c.NO_RENAMES_MSG)) {
                    baseDesc = '';
                }

                description = `${baseDesc}\n${oldName} = ${newName} \`${endTime}\`\n`;
            }

            const updatedMsg = new Discord.RichEmbed({
                color: 0xffff00,
                title: 'Renaming - End Time',
                description: description
            });

            message.edit('', updatedMsg);
        })
        .catch((err) => {
            logger.error(`Edit Renamed List Msg Error: ${err}`);
        });
}

exports.renameUserRoleOrChannel = function(type, targetID, args, tierNumber, userID, cmd, mentions) {
    const timePeriodTokens = c.PRIZE_TIERS[tierNumber - 1][`rename-${type}`].split(' ');
    const name = util.getTargetFromArgs(args, 3);
    var lockInfo = loot.lockedIdToLockInfo[targetID];
    var unlockTime;

    if (lockInfo) {
        unlockTime = moment(lockInfo.unlockTime);

        if (moment().isBefore(unlockTime)) {
            return util.sendEmbedMessage('Target Locked', `You may not rename the target until \`${unlockTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``);
        }
    }

    const formattedType = util.capitalizeFirstLetter(type);
    const mentionType = type === 'hank' ? 'User' : formattedType;
    const group = mentionType === 'User' ? 'member' : mentionType.toLowerCase();
    const target = mentions.id ? mentions : mentions[`${group}s`].values().next().value;
    const oldName = target.nickname || target.name;

    maybeRename(type, target, name)
        .then(() => {
            unlockTime = moment().add(timePeriodTokens[0], timePeriodTokens[1]);
            const formattedUnlockTime = unlockTime.format(c.MDY_HM_DATE_TIME_FORMAT);

            loot.lockedIdToLockInfo[targetID] = {
                unlockTime: unlockTime.valueOf(),
                oldName: oldName,
                newName: name,
                type: group,
            };
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.exportJson(loot, 'loot');
            util.sendEmbedMessage(`${formattedType} Renamed`,
                `Thou shalt be called ${util[`mention${mentionType}`](targetID)} until \`${formattedUnlockTime}\``, userID);
            updateRenamedList(oldName, name, formattedUnlockTime);
        })
        .catch((err) => {
            logger.error(`Edit Name Error: ${err}`);
        });
};

exports.addEmoji = function(message, name, tierNumber, userID, cmd) {
    if (message.attachments.length === 0) { return; }

    const attachment = message.attachments.array()[0];
    name = name || attachment.filename.split('.')[0].toLowerCase();

    message.guild.createEmoji(attachment.url, name)
        .then((emoji) => {
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.sendEmbedMessage('Emoji Added', `${new Array(9).fill(emoji).join('')}`);
        });
};

function maybeRename(type, target, name) {
    switch (type) {
        case 'hank':
        case 'member':
        case 'user':
            return target.setNickname(name);
        case 'channel':
            return target.setName(name);
        case 'role':
            return target.edit({ name: name });
    }
}

function addRainbowRole(userID, targetUser, tierNumber, cmd) { //eslint-disable-line
    const server = bot.getServer();
    var rainbowRole = server.roles.find('name', 'rainbow');

	if (!rainbowRole) {
		server.createRole({
			name: 'rainbow',
			position: server.roles.array().length - 3
		})
		.then((role) => {
			targetUser.addRole(role);
		});
	} else {
		targetUser.addRole(rainbowRole);
    }

    removePrizeFromInventory(userID, cmd, tierNumber);
}

function updateChannelTopicWithMagicWordCount(channelID) {
    const magicWords = loot.magicWords[channelID];
    const magicWordCount = magicWords ? Object.keys(magicWords).length : 0;
    const magicWordRegex = new RegExp(/^(:sparkles:|✨) [0-9]+ Magic Words (:sparkles:|✨) /);
    const channel = bot.getServer().channels.find('id', channelID);
    const oldTopic = channel.topic;
    var topic;

    if (magicWordCount === 0) {
        topic = oldTopic.replace(magicWordRegex, '');
    } else {
        topic = magicWordRegex.test(oldTopic) ? oldTopic.replace(/[0-9]+/, magicWordCount) : `✨ ${magicWordCount} Magic Words ✨ ${oldTopic}`;
    }

    channel.setTopic(topic)
        .catch((err) => {
            logger.error(`Edit Channel Topic for Magic Word Error: ${err}`);
        });
}

exports.checkForMagicWords = function(message) {
    const channelID = message.channel.id;
    var magicWordsToEndTime = loot.magicWords[channelID];
    if (!magicWordsToEndTime || message.author.bot) { return; }

    const magicWordsPattern = `\\b(${Object.keys(magicWordsToEndTime).join("|")})\\b`;
    const magicWordsRegex = new RegExp(magicWordsPattern, 'gi');
    const magicWordMatches = message.content.match(magicWordsRegex);

    if (!magicWordMatches) { return; }

    var banDays = magicWordMatches.length;
    magicWordMatches.forEach((magicWord) => {
        if (moment().isBefore(moment(magicWordsToEndTime[magicWord]))) { return; }

        if (Object.keys(magicWordsToEndTime).length === 1) {
            delete loot.magicWords[channelID];
        } else {
            delete magicWordsToEndTime[magicWord];
        }

        banDays--;
    });

    util.exportJson(loot, 'loot');
    updateChannelTopicWithMagicWordCount(channelID);

    if (banDays === 0) { return; }

    logger.info(`Banning ${util.getNick(message.author.id)}`
        + ` for saying the magic words "${magicWordMatches}" in ${util.mentionChannel(channelID)}`);
    util.banSpammer(message.author, message.channel, banDays, true);
};

exports.addMagicWord = function(word, tierNumber, channelID, userID, cmd) {
    const minLength = tierNumber + 2;

    // word must meet min length req for tier
    if (word.length < minLength) {
        return util.sendEmbedMessage('Insufficient Word Length', `Word must be at least ${minLength} letters for tier ${tierNumber}.`);
    }

    if (!loot.magicWords[channelID]) {
        loot.magicWords[channelID] = {};
    }

    const banDays = c.PRIZE_TIERS[tierNumber - 1][cmd].replace(/\D/g,'');
    const magicWordEndTime = moment().add(banDays, 'days');

    loot.magicWords[channelID][word] = magicWordEndTime.valueOf();
    updateChannelTopicWithMagicWordCount(channelID);

    const magicWordCount = Object.keys(magicWordEndTime).length;
    const totalWordsMsg = magicWordEndTime ? `. There are now ${magicWordCount} magic words for this channel.` : '';
    const endTimeMsg = `magic word is in effect until \`${magicWordEndTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``;

    util.sendEmbedMessage('Magic Word Set', `A new ${endTimeMsg}${totalWordsMsg}`, userID, null, null, null, channelID);
    util.getMembers().find('id', userID).createDM()
        .then((dm) => {
            dm.send(`When a user types \`${word}\` in ${util.mentionChannel(channelID)}, `
            + `they will receive a one day ban. The ${endTimeMsg}`);
        });
    removePrizeFromInventory(userID, cmd, tierNumber);
    util.exportJson(loot, 'loot');
};

exports.rock = function(userID) {
    util.sendEmbedMessage(null, null, userID, c.ROCK_IMG);
    maybeCreateLedgerEntry(userID);

    const userEntry = ledger[userID];

    userEntry.rocksDropped = userEntry.rocksDropped ? userEntry.rocksDropped + 1 : 1;
};

//Todo: use this for annoy
exports.maybeJoinRandomChannelAndPlaySoundbyte = function() {
	if (util.getRand(1, 21) > 13) {
		const soundByteChoices = ['tryagainlater', 'cmdnotrecognized', 'repeatthat', 'betconfirmed'];
		const voiceChannels = bot.getServer().channels.filterArray(
			(channel) => channel.type === 'voice' && channel.members.size !== 0);
		const chosenChannel = voiceChannels[util.getRand(0, voiceChannels.length)];
		const chosenSoundByte = soundByteChoices[util.getRand(0, soundByteChoices.length)];
		const chosenUserID = chosenChannel.members.first().id;

		if (chosenSoundByte === 'betconfimed') {
			betClean(chosenUserID, util.getRand(1, 11), 'clean');
        }

        chosenChannel.join()
            .then((connection) => {
                setTimeout(() => {
                    util.playSoundByte(chosenChannel, chosenSoundByte, chosenUserID, connection);
                }, util.getRand(2000, 9000));
            });
	}
};

function finalizeInvestment(userEntry, stock, shares, stockPrice, cost, userID) {
    var stockInfo = userEntry.stockToInfo[stock];

    if (!stockInfo) {
        userEntry.stockToInfo[stock] = {
            shares: shares,
            initialPrice: stockPrice,
            currentPrice: stockPrice,
            netArmyChange: 0
        };
    } else {
        stockInfo.shares += shares;
        stockInfo.currentPrice = stockPrice;
    }

    userEntry.armySize -= cost;
    util.sendEmbedMessage('📈 Solid Investment', `${util.mentionUser(userID)} your investment of ${util.formatAsBoldCodeBlock(cost)} Scrubbing Bubbles` +
        ` for ${util.formatAsBoldCodeBlock(shares)} shares of ${util.formatAsBoldCodeBlock(stock)} stock has been processed. ${getArmySizeMsg(userID)}\n` +
        'Your army will grow or shrink daily by `2 * ⌈stock close price - stock open price⌉ * #shares`. See this calculated daily change by calling `.stocks`', userID);
}

function buildInvestmentArgs(shares, stock, userID) {
    const scrubDaddyEntry = ledger[c.SCRUB_DADDY_ID];

    shares = isNaN(shares) ? 1 : Number(shares);
    stock = stock.toUpperCase();

    maybeCreateLedgerEntry(userID);

    if (!scrubDaddyEntry.stocks) {
        createScrubDaddyStocksEntry();
    }

    var userEntry = ledger[userID];
    if (!ledger[userID].stockToInfo) {
        userEntry.stockToInfo = {};
    }

    return { userEntry, shares, stock };
}

exports.invest = function(userID, stockName, desiredShares) {
    const { userEntry, shares, stock } = buildInvestmentArgs(desiredShares, stockName, userID);

    getStockUpdate(stock)
        .then((newStockInfo) => {
            if (!newStockInfo) {
                return util.sendEmbedMessage('📈 Stock not Found',
                    `Sorry ${util.mentionUser(userID)}, I could not find any stock matching \`${stock}\``, userID);
            }

            const stockPrice = newStockInfo.price;

            if (stockPrice < c.MIN_STOCK_PRICE) {
                return util.sendEmbedMessage('📈 Stock Too Cheap', `${util.mentionUser(userID)} you must` +
                    ` invest in a stock that costs a minimum of ${util.formatAsBoldCodeBlock(c.MIN_STOCK_PRICE)} Scrubbing Bubbles per share.`);
            }

            const cost = Math.ceil(stockPrice * shares);

            if (!isAbleToAffordBet(userID, cost)) {
                return util.sendEmbedMessage('📈 Unable to Afford Stock',
                    `${util.mentionUser(userID)} you will need ${util.formatAsBoldCodeBlock(cost)} Scrubbing Bubbles` +
                    ` to purchase ${util.formatAsBoldCodeBlock(shares)} shares of ${util.formatAsBoldCodeBlock(stock)} stock.`, userID);
            }

            finalizeInvestment(userEntry, stock, shares, stockPrice, cost, userID);
            exports.exportLedger();
        });
};

exports.sellShares = function(userID, stock, shares) {
    stock = stock.toUpperCase();

    const stockToInfo = get(ledger, `[${userID}].stockToInfo`);

    if (!stockToInfo) { return; }

    const stockInfo = stockToInfo[stock];
    const sharesOwned = stockInfo.shares;
    shares = isNaN(shares) ? sharesOwned : Number(shares);

    if (shares > sharesOwned) { return; }

    getStockUpdate(stock)
        .then((newStockInfo) => {
            const price = newStockInfo.price;

            if (!price) { return; }

            const payout = Math.ceil(price * shares);
            stockInfo.shares -= shares;
            ledger[userID].armySize += payout;
            util.sendEmbedMessage('📈 Scrubble Stock Liquidated',
                `${util.mentionUser(userID)} your ${util.formatAsBoldCodeBlock(shares)} share${util.maybeGetPlural(shares)}` +
                ` of ${util.formatAsBoldCodeBlock(stock)} stock sold for ${util.formatAsBoldCodeBlock(payout)} Scrubbing Bubbles. ${getArmySizeMsg(userID)}`, userID);

            if (stockInfo.shares === 0) {
                delete stockToInfo[stock];
            }
        });
};

function createScrubDaddyStocksEntry() {
    ledger[c.SCRUB_DADDY_ID].stocks = {
        stockToInfo: {},
        updateDate: moment().format(c.MDY_DATE_FORMAT)
    };
}

function updateUsersStockInfo(stockToInfo, stock, newStockInfo, userID) {
    const stockInfo = stockToInfo[stock];
    const armyChange = newStockInfo ? newStockInfo.armyChange : 1; // Default to 1 if error getting stock change from api
    var userEntry = ledger[userID];
    
    if (!userEntry.stats) {
        userEntry.stats = Object.assign({}, c.NEW_LEDGER_ENTRY.stats);
    }
    
    const oldNetArmyChangeStat = userEntry.stats.stocksNetArmyChange;
    
    userEntry.stats.stocksNetArmyChange = isNaN(oldNetArmyChangeStat) ? armyChange : oldNetArmyChangeStat + armyChange;
    userEntry.armySize += armyChange;
    stockInfo.netArmyChange += armyChange;

    if (newStockInfo) {
        stockInfo.currentPrice = newStockInfo.price;
    }
}

function updateUsersStocks(stockToInfo, userID, updatedStockToInfo) {
    Object.keys(stockToInfo).forEach((stock) => {
        const updatedStockInfo = updatedStockToInfo[stock]

        updateUsersStockInfo(stockToInfo, stock, updatedStockInfo, userID);
    });
}

function updateAllUserStocks(stockOwnerIdToInfo, updatedStockToInfo) {
    for (var userID in stockOwnerIdToInfo) {
        updateUsersStocks(stockOwnerIdToInfo[userID], userID, updatedStockToInfo);
    }
}

function waitIfRateLimitReached() {
    numStocksUpdated++;

    const waitMs = numStocksUpdated % 5 === 0 ? 60000 : 0;

    return new Promise((resolve) => setTimeout(() => resolve(), waitMs));
}

function updateCachedStocks(stocks) {
    if (stocks.length === 0) { return; }

    return getStockUpdate(stocks.pop())
        .then(waitIfRateLimitReached)
        .then(() => updateCachedStocks(stocks));
}

exports.updateStocks = function() {
    createScrubDaddyStocksEntry();

    var stockOwnerIdToInfo = {};
    var stocks = [];

    for (var userID in ledger) {
        const stockToInfo = ledger[userID].stockToInfo;

        if (!stockToInfo || Object.keys(stockToInfo).length === 0) { continue; }
        
        stockOwnerIdToInfo[userID] = stockToInfo;
        stocks.push(...Object.keys(stockToInfo));
    }

    numStocksUpdated = 0;
    stocks = [...new Set(stocks)]; //remove duplicates

    updateCachedStocks(stocks)
        .then(() => {
            const updatedStockToInfo = ledger[c.SCRUB_DADDY_ID].stocks.stockToInfo;

            outputStockChanges(updatedStockToInfo);
            updateAllUserStocks(stockOwnerIdToInfo, updatedStockToInfo);
            exports.exportLedger();
        })
};

function outputStockChanges(stockToInfo, userID) {
    if (Object.keys(stockToInfo).length === 0) { return; }

    const stocksOwner = userID ? `${util.getNick(userID)}'s` : '';
    const { updateDate } = ledger[c.SCRUB_DADDY_ID].stocks;
    const { stockChangeFields, netArmyChange } = buildStockChangeFieldsAndDetermineChange(stockToInfo);
    const { graphEmoji, footer } = buildArmyChangeFooterAndGraphEmoji(netArmyChange);

    util.sendEmbedFieldsMessage(`${graphEmoji} ${stocksOwner} Scrubble Stock Changes for ${updateDate}`,
        stockChangeFields, userID, footer);
}

exports.outputUsersStockChanges = function(userID) {
    const userStockToInfo = get(ledger, `[${userID}].stockToInfo`);
    const cachedStockToInfo = ledger[c.SCRUB_DADDY_ID].stocks.stockToInfo;

    if (!userStockToInfo || Object.keys(userStockToInfo).length === 0) {
        return outputStockPortfolioNotFoundMsg(userID);
    }

    var userStockToArmyChange = {};

    for (var stock in userStockToInfo) {
        const armyChange = cachedStockToInfo[stock].armyChange;
        const shares = userStockToInfo[stock].shares;
        const plural = util.maybeGetPlural(shares);

        userStockToArmyChange[`${stock} (${shares} share${plural})`] = { armyChange: Math.ceil(armyChange * shares) };
    }

    outputStockChanges(userStockToArmyChange, userID);
};

function buildArmyChangeFooterAndGraphEmoji(netArmyChange) {
    const graphEmoji = netArmyChange >= 0 ? '📈' : '📉';
    const footer = {
        icon_url: c.BUBBLE_IMAGES[0],
        text: `${determineChangeSymbol(netArmyChange)}${netArmyChange}`
    };

    return { graphEmoji, footer };
}

function outputStockPortfolioNotFoundMsg(userID) {
    return util.sendEmbedMessage('📈 Stock Portfolio Not Found', `${util.mentionUser(userID)} you don't have any investments.` +
        ` Call ${util.formatAsBoldCodeBlock('.help invest')} to learn how to invest in Scrubble Stocks.`, userID);
}

function buildStockChangeFieldsAndDetermineChange(stockToInfo) {
    var changeFields = [];
    var netArmyChange = 0;

    for (var stock in stockToInfo) {
        const armyChange = stockToInfo[stock].armyChange;
        const changeSymbol = determineChangeSymbol(armyChange);

        netArmyChange += armyChange;
        changeFields.push(util.buildField(stock,
            `${changeSymbol}${armyChange} ${c.SCRUBBING_BUBBLE_EMOJI}${util.maybeGetPlural(armyChange)}`));
    }

    return { netArmyChange: netArmyChange, stockChangeFields: changeFields };
}

function determineChangeSymbol(armyChange) {
    return armyChange > 0 ? '+' : '';
}

function determineStockUpdate(mostRecentQuote) {
    const price = Number(mostRecentQuote['05. price']);
    const change = Number(mostRecentQuote['09. change']);
    const armyChange = change < 0 ? Math.floor(change * 2) : Math.ceil(change * 2);

    return { armyChange, price };
}

function getStockUpdate(stock) {
    const { stocks } = ledger[c.SCRUB_DADDY_ID];
    const cachedStockInfo = stocks.stockToInfo[stock];

    if (cachedStockInfo) {
        return Promise.resolve(cachedStockInfo);
    }

    var options = {
		uri: `${c.STOCKS_BASE_URL}${stock}&apikey=${priv.stocksApiKey}`,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
    };

    return rp(options)
		.then((result) => {
            logger.info(`Stocks API Response: ${result}`);

            const mostRecentQuote = JSON.parse(result)["Global Quote"];
            if (!mostRecentQuote || Object.keys(mostRecentQuote).length === 0) { return; }

            const stockUpdate = determineStockUpdate(mostRecentQuote);

            stocks.stockToInfo[stock] = stockUpdate;

            return stockUpdate;
		})
		.catch(util.log);
}

exports.outputUserStockPortfolio = function(userID) {
    const userStockToInfo = get(ledger, `[${userID}].stockToInfo`);

    if (!userStockToInfo || Object.keys(userStockToInfo).length === 0) {
        return outputStockPortfolioNotFoundMsg(userID);
    }

    var { netArmyChange, output } = buildPortfolioTableBody(userStockToInfo);
    const { graphEmoji, footer } = buildArmyChangeFooterAndGraphEmoji(netArmyChange);

    util.sendEmbedMessage(`${graphEmoji} ${util.getNick(userID)}'s Scrubble Stock Portfolio`, output, userID, null, null, footer);
};

function buildPortfolioTableBody(userStockToInfo) {
    var { output, columnLengths } = buildTableHeader(['Stock', 'Shares', 'Init. Price', 'Curr. Price', 'Net Army Change']);
    var netArmyChange = 0;

    Object.keys(userStockToInfo).sort().forEach((stock) => {
        const stockInfo = userStockToInfo[stock];
        const shares = `${stockInfo.shares}`;
        const initialPrice = `${Math.ceil(stockInfo.initialPrice)}`;
        const currentPrice = `${Math.ceil(stockInfo.currentPrice)}`;
        const armyChange = `${determineChangeSymbol(stockInfo.netArmyChange)}${stockInfo.netArmyChange}`;

        netArmyChange += stockInfo.netArmyChange;
        output += buildColumn(stock, columnLengths[0])
            + buildColumn(shares, columnLengths[1])
            + buildColumn(initialPrice, columnLengths[2])
            + buildColumn(currentPrice, columnLengths[3])
            + buildColumn(armyChange, columnLengths[4], true);
    });
    
    output += '```**';

    return { netArmyChange, output };
}

function buildColumn(text, columnLength, isLastColumn) {
    if (text > columnLength) {
        text = text.slice(0, columnLength);
    }

    return isLastColumn ? `${text}\n` : `${text}${' '.repeat(columnLength - text.length)}${c.TABLE_COL_SEPARATOR}`;
}

function buildTableHeader(columnHeaders) {
    const header = columnHeaders.join(c.TABLE_COL_SEPARATOR);
    const columnLengths = columnHeaders.map((currHeader) => currHeader.length);
    const underline = columnLengths.map((length) => '═'.repeat(length)).join('═╬═');
    const output = `**\`\`\`${header}\n${underline}\n`;

    return { output, columnLengths };
}