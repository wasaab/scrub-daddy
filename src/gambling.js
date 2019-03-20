var Discord = require('discord.js');
var moment = require('moment');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');

var loot = require('../resources/data/loot.json');
var ledger = require('../resources/data/ledger.json');   //keeps track of how big of an army each member has as well as bet amounts
var config = require('../resources/data/config.json');
const private = require('../../private.json');

var dropped = 0;
var previousMessage;
const idToAmountStolen = {};

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
        const msg = `${targetMention}  Your Scrubbing Bubbles army has grown by ${numBubbles}! You now have an army of ${ledger[targetID].armySize}.`;
        util.sendEmbedMessage(`Scrubbing Bubbles Gifted By ${userName}`, msg, targetID);
    }
};

/**
 * Discharges a scrub bubble from the provided user's army, so that another
 * member may enlist the bubble to their army.
 *
 * @param {String} userID - the id of the user discharging a bubble
 * @param {Number} numBubbles - the number of bubbles to discharge
 */
exports.dischargeScrubBubble = function(userID, numBubbles) {
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
 * drops a scrub bubble in bot-spam with a 30% chance.
 */
exports.maybeDischargeScrubBubble = function() {
    if (util.isDevEnv()) { return; }

    var num = util.getRand(1,11);
    if (num > 7) {
        exports.dischargeScrubBubble(null);
    }
};

exports.reserve = function(userID) {
    const baseTitle = 'Request for Reserve Scrubbing Bubbles';
    const lastReserveTime = ledger[userID].lastReserveTime;

    if (lastReserveTime && moment().diff(moment(lastReserveTime), 'days') < 1) {
        util.sendEmbedMessage(`${baseTitle} Denied`,
            `${util.mentionUser(userID)}, you have to wait a day to request more soldiers.`);
    } else {
        addToArmy(userID, 5);
        const msg = `${util.mentionUser(userID)} 5 Scrubbing Bubbles have been called to active duty! You now have an army of ${ledger[userID].armySize}.`;
        util.sendEmbedMessage(`${baseTitle} Approved`, msg, userID);
        ledger[userID].lastReserveTime = moment().valueOf();
        exports.exportLedger();
    }
}

/**
 * Removes the given number of Scrubbing Bubbles from the provided user's army.
 *
 * @param {String} userID - id of the user to remove from
 * @param {Number} amount - amount to remove
 */
function removeFromArmy(userID, amount) {
    ledger[userID].armySize -= amount;
    ledger[userID].totalDischarged += amount;
}

/**
 * Adds the given number of Scrubbing Bubbles to the provided user's army.
 *
 * @param {String} userID - id of the user to add to
 * @param {Number} amount - amount to add
 */
function addToArmy(userID, amount) {
    if (!ledger[userID]) {
        ledger[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    }
    ledger[userID].armySize += amount;
    ledger[userID].totalEnlisted += amount;
    if (ledger[userID].armySize > ledger[userID].recordArmy) {
        ledger[userID].recordArmy = ledger[userID].armySize;
    }
}

/**
 * enlists a scrubbing bubble in userID's army.
 */
exports.enlist = function(userID, message) {
    if (dropped > 0) {
        addToArmy(userID, dropped);
        const msg = `${util.mentionUser(userID)}  Your Scrubbing Bubbles army has grown by ${dropped}! You now have an army of ${ledger[userID].armySize}.`;
        util.sendEmbedMessage(null, msg, userID);
        exports.maybeDeletePreviousMessage();
        message.delete();
        dropped = 0;
    }
};

/**
 * returns true iff the side provided is valid.
 *
 * @param {String} side - the side to battle
 */
function isValidSide(side) {
    return (side === 'b' || side === 't')
}

/**
 * Takes the user's bet from the ledger.
 *
 * @param {String} userID - the id of the user betting
 * @param {number} bet - the bet amount
 * @param {String} type - the type of bet
 */
function takeBetFromUser(userID, bet, type) {
    if (type === 'clean') {
        ledger[userID].armySize -= bet;
        ledger[userID].scrubsBet += bet;
        ledger[userID].cleanBet = bet;
    } else if (type === 'race') {
        ledger[userID].armySize -= bet;
        ledger[userID].scrubsBet += bet;
        ledger[userID].raceBet = bet;
    }
}

/**
 * Resets the ledger's bets to 0.
 *
 * @param {String} userID - the id of the user betting
 * @param {String} type - the type of bet
 */
function resetLedgerAfterBet(userID, type) {
    if (type === 'clean') {
        ledger[userID].cleanBet = 0;
    } else if (type === 'race') {
        ledger[userID].raceBet = 0;
    }
}

/**
 * Gets 0 for t and 1 for b.
 *
 * @param {String} typeString - type of battle
 */
function getTypeNum(typeString) {
    if (typeString === 't')
        return 0;
    if (typeString === 'b')
        return 1;
}

/**
 * Adds to the given user's gaming streak stats.
 *
 * @param {String} currentStreak - current win/loss streak
 * @param {String} highestStreak - highest win/loss streak
 * @param {String} oppositeStreak - opposite of current streak
 * @param {String} user - gambling user
 */
function addToGamblingStreaks(currentStreak, highestStreak, oppositeStreak, user) {
    ledger[user][currentStreak]++;
    ledger[user][oppositeStreak] = 0;

    if (ledger[user][currentStreak] > ledger[user][highestStreak]){
        ledger[user][highestStreak] = ledger[user][currentStreak];
    }
}

/**
 * Adds to to the user's gambling stats.
 *
 * @param {String} outcome - outcome of the battle 'Won' or 'Lost'
 * @param {number} amount - amount the user won or lost
 * @param {String} user - the user to add stats to
 */
function addToGamblingStats(outcome, amount, user) {
    var plural = 'Losses';
    var opposite = 'Won';

    if (outcome === 'Won') {
        plural = 'Wins';
        opposite = 'Lost';
    }

    const stat = `highest${outcome}`;
    if (amount > ledger[user][stat]) {
        ledger[user][stat] = amount;
    }

    addToGamblingStreaks(`streak${plural}`, `maxStreak${plural}`, `streak${opposite}`, user);
    ledger[user][`scrubs${outcome}`] += amount;
    ledger[user][`total${plural}`]++;
}

/**
 * Handles !clean command. Takes the bet from the user and
 * keeps it if they lose. If they win, twice the bet is given to the user.
 *
 * @param {String} userID - the id of the user betting
 * @param {number} bet - the bet amount
 * @param {String} type - the type of bet
 * @param {String} side - the side to battle
 */
function betClean(userID, bet, type, side) {
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

        if (util.getRand(0,2) === getTypeNum(side)) {
            const payout = bet*2;
            img = c.CLEAN_WIN_IMG;
            msg = `Congrats, your auxiliary army gained ${payout} Scrubbing Bubbles after cleaning the bathroom and conquering the land!`;
            addToArmy(userID, payout);
            //addToGamblingStats('Wins', 'Won', payout, userID);
        } else {
            img = c.CLEAN_LOSE_IMG;
            msg = `Sorry bud, you lost ${bet} Scrubbing Bubble${util.maybeGetPlural(bet)} in the battle.`;
            //addToGamblingStats('Losses', 'Lost', bet, userID);
        }
        util.sendEmbedMessage(null, `${util.mentionUser(userID)}  ${msg}`, userID, img);
        resetLedgerAfterBet(userID, bet, type);
    }
}

/**
 * Calls betClean if the bet is valid.
 */
exports.maybeBetClean = function(userID, args, message) {
    const bet = Number(args[1]);
    const side = 't';

    if (!bet || !side || !isValidSide(side) || bet < 1) {
        return;
    }

    betClean(userID, bet, 'clean', side);
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
    const wallet = ledger[userID];
    if (wallet) {
        var description = '';
        if (args[0] === 'army') {
            description = `${util.mentionUser(userID)}${msg} army is ${wallet.armySize} Scrubbing Bubble${util.maybeGetPlural(wallet.armySize)} strong!`;
        } else {
            description = `${util.mentionUser(userID)}${msg} Stats (starting from 10/31/17):\n` +
                `Current Army Size: ${wallet.armySize} Scrubs\n` +
                `Record Army Size: ${wallet.recordArmy} Scrubs\n` +
                `Lifetime Scrubs Won: ${wallet.scrubsWon} Scrubs\n` +
                `Lifetime Scrubs Lost: ${wallet.scrubsLost} Scrubs\n` +
                `Biggest Bet Won: ${wallet.highestWon} Scrubs\n` +
                `Biggest Bet Lost: ${wallet.highestLost} Scrubs\n` +
                `Total Bets Won: ${wallet.totalWins} Wins\n` +
                `Total Bets Lost: ${wallet.totalLosses} Losses\n` +
                `Total Scrubs Discharged: ${wallet.totalDischarged} Scrubs\n` +
                `Total Scrubs Enlisted: ${wallet.totalEnlisted} Scrubs`;
        }
        util.sendEmbedMessage(null, description, userID);
    }
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

function isValidTime(monthDayTokens, hour) {
    if (monthDayTokens.length !== 2) { return false; }
    const month = monthDayTokens[0];
    const day = monthDayTokens[1];

    return !isNaN(month) && !isNaN(day) && !isNaN(hour) &&
        month > 0 && month < 13 &&
        day > 0 && day < 32 &&
        hour > -1 && hour < 24
}

exports.startLotto = function(user, userID, monthDay, hour) {
    if (config.lottoTime) { return; }

    const monthDayTokens = monthDay.split("/");
    if (isValidTime(monthDayTokens, hour)) {
        config.lottoTime = {
            month: monthDayTokens[0],
            day: monthDayTokens[1],
            hour: hour
        }
        util.exportJson(config, 'config');
    }
    util.sendEmbedMessage('Beyond Lotto Started', `The lotto will end on ${monthDay} @ ${hour}:00 EST(24-hour format)`)

    if (!util.isAdmin(userID)) {
        removePrizeFromInventory(userID, 'start-lotto', 3);
    }
};

exports.stopLotto = function (userID, tierNumber, cmd) {
    delete config.lottoTime;
    util.exportJson(config, 'config');
    util.sendEmbedMessage('Beyond Lotto Stopped', `The lottery was stopped by ${util.mentionUser(userID)} with a Scrub Box prize.`)
    removePrizeFromInventory(userID, cmd, tierNumber);
}

exports.joinLotto = function(user, userID) {
    var entries = config.lottoEntries || [];
    if (entries.includes(userID)) {
        util.sendEmbedMessage(`You Have Already Entered The Lotto`, `${user}, allow me to show you the current lotto information...`, userID);
        exports.checkLotto(userID);
    } else {
        entries.push(userID);
        config.lottoEntries = entries;
        util.exportJson(config, 'config');
        util.sendEmbedMessage(`${user} has entered the Beyond Lotto`, `There are now ${entries.length} participants.`, userID);
    }
};

exports.getTimeUntilLottoEnd = function() {
    const present = moment();
    const endTime = Object.assign({}, config.lottoTime);
    endTime.year = present.year();
    endTime.month--;
    const endMoment = moment(endTime);
    const endDate = endMoment.format('LLLL');
    const timeUntil = endMoment.fromNow();

    return { timeUntil: timeUntil, endDate: endDate };
}

exports.checkLotto = function(userID) {
    if (!config.lottoEntries) {
        util.sendEmbedMessage('Beyond Lotto Information', 'There are currently no entries for the Beyond Lotto.', userID);
        return;
    }
    if (!config.lottoTime) {
        util.sendEmbedMessage('Beyond Lotto Information', 'There is no Beyond lotto currently running.', userID);
        return;
    }

    var entries = '';
    const scrubIDToNick = util.getScrubIdToNick();
    config.lottoEntries.forEach((entry) => {
        entries += `${scrubIDToNick[entry]}\n`
    })

    const { timeUntil, endDate } = exports.getTimeUntilLottoEnd();
    util.sendEmbedMessage('Beyond Lotto Information',
        `The lotto will end \`${timeUntil}\` on ${endDate} EST\n\n` +
        `**The following ${config.lottoEntries.length} users have entered:**\n${entries}`, userID);
};

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
    util.logger.info(`<INFO> ${util.getTimestamp()}  Beyond lotto winner = ${winner}`);

    const server = bot.getClient().guilds.find('id', private.serverID);
    const winningUser = server.members.find('id', winnerID);
    winningUser.addRole(server.roles.find('id', c.BEYOND_ROLE_ID));

    delete config.lottoTime;
    delete config.lottoEntries;
};

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
        }, 45000)
    }
}

exports.fakeStealAll = function() {
    if (util.isLocked()) { return; }

    util.lock();
    for (var id in ledger) {
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
}

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
}

function addRandomPrizeAndGetInfo(tierNumber, userID) {
    const prizesInTier = c.PRIZE_TIERS[`tier${tierNumber}`];
    const prizes = Object.keys(prizesInTier);
    const prize = prizes[util.getRand(0, prizes.length)];
    const prizeDescription = c.PRIZE_TO_DESCRIPTION[prize].replace('``', `\`${prizesInTier[prize]}\``);
    const title = `Scrubbing Bubble Loot Box - Tier ${tierNumber}`;
    var extraInfo = `Call \`.help ${prize}\` for usage info`;

    if (prize.endsWith('bubbles')) {
        addToArmy(userID, prizesInTier[prize]);

        const armySize = ledger[userID].armySize;
        extraInfo = `You now have an army of ${armySize} Scrubbing Bubble${util.maybeGetPlural(armySize)}`;
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
    ledger[userID].inventory[tierNumber][prize]--;
}

exports.outputInventory = function(userID) {
    if (!ledger[userID] || !ledger[userID].inventory) { return; }

    const inventory = ledger[userID].inventory;
    var fields = [];
    var results = [];
    for (var tier in inventory) {
        var tierFields = [];
        for (var action in inventory[tier]) {
            const actionCount = inventory[tier][action];
            if (actionCount === 0) { continue; }

            tierFields.push(util.buildField(action, actionCount));
        }

        if (tierFields.length < 1) { return; }

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
}

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
}

exports.maybeResetNames = function(client) {
    const lockedIdToLockInfo = loot.lockedIdToLockInfo;
    if (lockedIdToLockInfo === {}) { return; }

    const guild = client.guilds.find('id', private.serverID);

    for (var targetID in lockedIdToLockInfo) {
        const lockInfo = lockedIdToLockInfo[targetID];
        const target = guild[`${lockInfo.type}s`].find('id', targetID);

        if (!target || moment().isAfter(moment(lockInfo.unlockTime))) {
            if (target) {
                maybeRename(lockInfo.type, target, lockInfo.oldName);
            }

            delete loot.lockedIdToLockInfo[targetID];
            util.exportJson(loot, 'loot');
            continue;
        }

        const targetName = target.nickname || target.name;

        if (targetName === lockInfo.newName || targetName === lockInfo.newName.split(' ').join('-')) { continue; }

        maybeRename(lockInfo.type, target, lockInfo.newName);
    }
}

exports.renameUserRoleOrChannel = function(type, targetID, args, tierNumber, userID, cmd, mentions) {
    const timePeriodTokens = c.PRIZE_TIERS[`tier${tierNumber}`][`rename-${type}`].split(' ');
    const name = util.getTargetFromArgs(args, 3);
    var lockInfo = loot.lockedIdToLockInfo[targetID];
    var unlockTime;

    if (lockInfo) {
        unlockTime = moment(lockInfo.unlockTime);

        if (moment().isBefore(unlockTime)) {
            return util.sendEmbedMessage('Target Locked', `You may not rename the target until \`${unlockTime.format('M/DD/YY hh:mm A')}\``)
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
            loot.lockedIdToLockInfo[targetID] = {
                unlockTime: unlockTime.valueOf(),
                oldName: oldName,
                newName: name,
                type: group,
            };
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.exportJson(loot, 'loot');
            util.sendEmbedMessage(`${formattedType} Renamed`,
                `Thou shalt be called ${util[`mention${mentionType}`](targetID)} until \`${unlockTime.format('M/DD/YY hh:mm A')}\``, userID);
        })
        .catch((err) => {
            util.logger.error(`<ERROR> ${util.getTimestamp()}  Edit Name Error: ${err}`);
        })
}

exports.addEmoji = function(message, name, tierNumber, userID, cmd) {
    if (message.attachments.length == 0) { return; }

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

function addRainbowRole(userID, targetUser, tierNumber, cmd) {
    var rainbowRole = guild.roles.find('name', 'rainbow');

	if (!rainbowRole) {
		guild.createRole({
			name: 'rainbow',
			position: guild.roles.array().length - 3
		})
		.then((role) => {
			targetUser.addRole(role);
		})
	} else {
		targetUser.addRole(rainbowRole);
    }

    removePrizeFromInventory(userID, cmd, tierNumber);
}

exports.checkForMagicWords = function(message) {
    const magicWordsToEndTime = loot.magicWords[message.channel.id];
    if (!magicWordsToEndTime) { return; }

    const magicWordsPattern = `\\b(${Object.keys(magicWordsToEndTime).join("|")})\\b`;
    const magicWordsRegex = new RegExp(magicWordsPattern, 'gi');
    const magicWordMatches = message.content.match(magicWordsRegex);

    if (!magicWordMatches) { return; }

    var banDays = magicWordMatches.length;
    magicWordMatches.forEach((magicWord) => {
        if (moment().isBefore(moment(magicWordsToEndTime[magicWord]))) { return; }

        delete magicWordsToEndTime[magicWord];
        util.exportJson(loot, 'loot');
        banDays--;
    })

    if (banDays === 0) { return; }

    util.banSpammer(message.author, message.channel, banDays, true);
}

exports.addMagicWord = function(word, tierNumber, channelID, userID, cmd) {
    const minLength = tierNumber + 3;

    // word must meet min length req for tier
    if (word.length < minLength) {
        return util.sendEmbedMessage('Insufficient Word Length', `Word must be at least ${minLength} letters for tier ${tierNumber}.`)
    }

    if (!loot.magicWords[channelID]) {
        loot.magicWords[channelID] = {};
    }

    const banDays = c.PRIZE_TIERS[`tier${tierNumber}`][cmd].replace(/\D/g,'');
    const magicWordEndTime = moment().add(banDays, 'days');
    loot.magicWords[channelID][word] = magicWordEndTime.valueOf();
    util.sendEmbedMessage('Magic Word Set',
        `When a user types \`${word}\` in ${util.mentionChannel(channelID)}, they will receive a one day ban. `
        + `The magic word is in effect until \`${magicWordEndTime.format('M/DD/YY hh:mm A')}\``);
    util.exportJson(loot, 'loot');
    removePrizeFromInventory(userID, cmd, tierNumber);
}