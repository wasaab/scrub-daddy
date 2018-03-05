var moment = require('moment');
var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var ledger = require('../resources/data/ledger.json');   //keeps track of how big of an army each member has as well as bet amounts
var config = require('../resources/data/config.json');

var dropped = 0;
var previousMessage;

/**
 * exports the ledger to a json file.
 */
exports.exportLedger = function() {
    var json = JSON.stringify(ledger);
    fs.writeFile('./resources/data/ledger.json', json, 'utf8', util.log);
};

/**
 * Discharges a scrub bubble from the provided user's army, so that another
 * member may enlist the bubble to their army.
 * 
 * @param {String} userID - the id of the user discharging a bubble
 */
exports.dischargeScrubBubble = function (userID, numBubbles) {
    numBubbles = numBubbles && !isNaN(numBubbles) ? Number(numBubbles) : 1;
    if (userID) {
        if (numBubbles < 1 || !(ledger[userID] && ledger[userID].armySize >= numBubbles)) { return; }
        ledger[userID].armySize -= numBubbles;
        ledger[userID].totalDischarged += numBubbles;
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
 * drops a scrub bubble in bot-spam with a 20% chance.
 * CONSIDER CHANGING THIS TO BE BASED ON MESSAGES NOT PRESENCE
 */
exports.maybeDischargeScrubBubble = function() {
    if (util.isDevEnv()) { return; }
    var num = util.getRand(1,11);
    if (num > 8) {
        exports.dischargeScrubBubble(null);
    }
};

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
        ledger[userID].totalEnlisted += dropped;
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
 * returns an 's' iff count > 1.
 * 
 * @param {number} count 
 */
function maybeGetPlural(count) {
    if (count > 1)
        return 's';
    return '';
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
            msg = `Your ${wallet.armySize} soldier${maybeGetPlural(wallet.armySize)} would surely perish.`;
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
            msg = `Sorry bud, you lost ${bet} Scrubbing Bubble${maybeGetPlural(bet)} in the battle.`;
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
            description = `${util.mentionUser(userID)}${msg} army is ${wallet.armySize} Scrubbing Bubble${maybeGetPlural(wallet.armySize)} strong!`;
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
    const scrubIDToNick = util.getScrubIDToNick();
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

function exportConfig() {
    var json = JSON.stringify(config);
    fs.writeFile('./resources/data/config.json', json, 'utf8', util.log);
}

exports.startLotto = function(user, userID, monthDay, hour) {
    if (config.lottoTime && userID !== c.K_ID) { return; }

    const monthDayTokens = monthDay.split("/");
    if (isValidTime(monthDayTokens, hour)) {
        config.lottoTime = {
            month: monthDayTokens[0],
            day: monthDayTokens[1],
            hour: hour
        }
        exportConfig();
    }
    util.sendEmbedMessage('Beyond Lotto Started', `The lotto will end on ${monthDay} @ ${hour}:00 EST(24-hour format)`)
};

exports.joinLotto = function(user, userID) {
    var entries = config.lottoEntries || [];
    if (entries.includes(userID)) {
        util.sendEmbedMessage(`You Have Already Entered The Lotto`, `${user}, allow me to show you the current lotto information...`, userID);
        exports.checkLotto(userID);
    } else {
        entries.push(userID);
        config.lottoEntries = entries;
        exportConfig();
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
    config.lottoEntries.forEach((entry) => {
        entries += `${bot.getScrubIDToNick()[entry]}\n`
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
    c.LOG.info(`<INFO> ${util.getTimestamp()}  Beyond lotto winner = ${winner}`);    

    const server = bot.getClient().guilds.find('id', c.SERVER_ID);
    const winningUser = server.members.find('id', winnerID);
    winningUser.addRole(server.roles.find('id', c.BEYOND_ROLE_ID));
};

function getFakeAndRealWinner() {
	var winnerID;
	var fakeWinnerID;
	while (winnerID === fakeWinnerID) {
		winnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
		fakeWinnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
    }
    return { 
        fakeWinner: bot.getScrubIDToNick()[fakeWinnerID],
        winner: bot.getScrubIDToNick()[winnerID],
        winnerID: winnerID
    };
}

exports.getLedger = function() {
    return ledger;
};

exports.fakeSteal = function(amount, target, userID) {
    const targetID = util.getIdFromMention(target);

    if (ledger[targetID] && ledger[targetID].armySize >= amount) {
        ledger[targetID] -= amount;
        ledger[userID] += amount;
        setTimeout(() => {
            ledger[targetID] += amount;
            ledger[userID] -= amount;
        }, 45000)
    }
}