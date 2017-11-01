var get = require('lodash.get');
var fs = require('fs');

var c = require('./const.js');
var util = require('./utilities.js');
var ledger = require('./ledger.json');   //keeps track of how big of an army each member has as well as bet amounts

var dropped = 0;
var previousMessage = {};

/**
 * exports the ledger to a json file.
 */
exports.exportLedger = function() {
    var json = JSON.stringify(ledger);
    fs.writeFile('ledger.json', json, 'utf8', util.log);
}

/**
 * Discharges a scrub bubble from the provided user's army, so that another
 * member may enlist the bubble to their army.
 * 
 * @param {String} userID - the id of the user discharging a bubble
 * @param {String} botSpam - bot-spam channel
 */
exports.dischargeScrubBubble = function (userID, botSpam) {
    if (userID && userID !== 'dev') {
        if (ledger[userID] && ledger[userID].armySize > 0) {
            ledger[userID].armySize--;
            ledger[userID].totalDischarged++;
        } else {
            return;
        }
    }
    dropped++;
    var droppedImg = dropped;
    var msg = 'Bubble has';
    if (dropped > 1) {
        msg = 'Bubbles have';
        if (dropped > 21) {
            droppedImg = 21;
        }
    }

    const title = dropped + ' Scrubbing ' + msg + ' arrived for duty!';
    util.sendEmbedMessage(title, null, c.BUBBLE_IMAGES[droppedImg-1]);
}

/**
 * drops a scrub bubble in bot-spam with a 20% chance.
 * CONSIDER CHANGING THIS TO BE BASED ON MESSAGES NOT PRESENCE
 */
exports.maybeDischargeScrubBubble = function(botSpamChannel) {
    var num = util.getRand(1,11);
    if (num > 8) {
        exports.dischargeScrubBubble(null, botSpamChannel);
    }
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
    if (ledger[userID].armySize > ledger[userID].recordArmy) {
        ledger[userID].recordArmy = ledger[userID].armySize;
    }
}

/**
 * enlists a scrubbing bubble in userID's army.
 */
exports.enlist = function(userID) {
    if (dropped > 0) {
        addToArmy(userID, dropped);
        ledger[userID].totalEnlisted += dropped;
        const msg = '<@!' + userID + '>  ' + 'Your Scrubbing Bubbles army has grown by ' + dropped + '! You now have an army of ' + ledger[userID].armySize + '.';
        util.sendEmbedMessage(null, msg);
        previousMessage.delete();
        dropped = 0;
    }
}

/**
 * returns true iff the side provided is valid.
 * 
 * @param {String} side - the side to battle
 */
function isValidSide(side) {
    if (side === 'b' || side === 't')
        return true;
    return false;
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
    exports.exportLedger();
}

/**
 * Adds to to the user's gambling stats.
 * 
 * @param {String} outcome - outcome of the battle 'Won' or 'Lost'
 * @param {number} amount - amount the user won or lost
 * @param {String} user - the user to add stats to
 */
function addToGamblingStats(outcome, amount, user) {
    var plural = 'Lost';
    var opposite = 'Won';

    if (outcome === 'Won') {
        plural = 'Won';
        opposite = 'Lost';
    }

    const stat = 'highest'+outcome;
    if (amount > ledger[user][stat]) {
        ledger[user][stat] = amount;
    }
   
    addToGamblingStreaks('streak'+plural, 'highestStreak'+plural, 'streak'+opposite, user);
    ledger[user]['scrubs'+outcome] += amount;
    ledger[user]['total'+outcome]++;
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
            msg = 'Your ' + wallet.armySize + ' soldier' + maybeGetPlural(wallet.armySize) + ' would surely perish.';
        }
        const description = '<@!' + userID + '>  ' + 'You do not have enough Scrubbing Bubbles to clean the bathroom. ' + msg;
        util.sendEmbedMessage(null,description);
    } else {
        var img = '';
        takeBetFromUser(userID, bet, type);

        if (util.getRand(0,2) === getTypeNum(side)) {
            const payout = bet*2;
            img = c.CLEAN_WIN_IMG;
            msg = 'Congrats, your auxiliary army gained ' + payout + ' Scrubbing Bubbles after cleaning the bathroom and conquering the land!';
            addToArmy(userID, payout);
            addToGamblingStats('Won', payout, userID);
        } else {
            img = c.CLEAN_LOSE_IMG;
            msg = 'Sorry bud, you lost ' + bet + ' Scrubbing Bubble' + maybeGetPlural(bet) + ' in the battle.';
            addToGamblingStats('Lost', bet, userID);
        }
        util.sendEmbedMessage(null, '<@!' + userID + '>  ' + msg, img);
        resetLedgerAfterBet(userID, bet, type);
    }
}

/**
 * Calls betClean if the bet is valid.
 */
exports.maybeBetClean = function(userID, args) {
    const bet = Number(args[1]);
    const side = args[2];

    if (!bet || !side || !isValidSide(side) || bet < 1) {
        return;
    }

    betClean(userID, bet, 'clean', side);
}

/**
 * Outputs the user's army size or their gambling stats.
 */
function outputUserGamblingData(userID, args) {
    var msg = ' your';
    if (args[1]) {
        if (args[1].match(/\d/g) !== null) {
            userID = args[1].match(/\d/g).join('');
            msg = '\'s';
        }
    }
    const wallet = ledger[userID];
    if (wallet) {
        var description = '';
        if (args[0] === 'army') {
            description = '<@!' + userID + '>'+ msg +  ' army is ' + wallet.armySize +  ' Scrubbing Bubble' + maybeGetPlural(wallet.armySize) + ' strong!';
        } else {
            description = '<@!' + userID + '>' + msg + ' Stats (starting from 10/31/17): ' + 
                          '\nCurrent Army Size: ' + wallet.armySize + ' Scrubs' +
                          '\nRecord Army Size: ' + wallet.recordArmy + ' Scrubs' +
                          '\nLifetime Scrubs Won: ' + wallet.scrubsWon + ' Scrubs' +
                          '\nLifetime Scrubs Lost: ' + wallet.scrubsLost + ' Scrubs' +
                          '\nTotal Scrubs Bet: ' + wallet.scrubsBet + ' Scrubs' +
                          '\nBiggest Bet Won: ' + wallet.highestWon + ' Scrubs' +
                          '\nBiggest Bet Lost: ' + wallet.highestLost + ' Scrubs' +
                          '\nTotal Bets Won: ' + wallet.totalWon + ' Wins' +
                          '\nTotal Bets Lost: ' + wallet.totalLost + ' Losses' +
                          '\nTotal Scrubs Discharged: ' + wallet.totalDischarged + ' Scrubs' +
                          '\nTotal Scrubs Enlisted: ' + wallet.totalEnlisted + ' Scrubs' +
                          '\nCurrent Win Streak: ' + wallet.StreakWon + ' Wins' +
                          '\nCurrent Lose Streak: ' + wallet.StreakLost + ' Losses' +
                          '\nHighest Win Streak: ' + wallet.highestStreakWon + ' Wins' +
                          '\nHighest Lose Streak: ' + wallet.highestStreakLost + ' Losses'; 
        }
        util.sendEmbedMessage(null, description);
    }
}


/**
 * Outputs the user's army size.
 */
exports.army = function(userID, args) {
    outputUserGamblingData(userID, args);
}

/**
 * Outputs the user's gambling stats.
 */
exports.stats = function (userID, args) {
    outputUserGamblingData(userID, args);    
}

/**
 * Outputs all member's army sizes in order.
 */
exports.armyRanks = function() {
    var fields = [];
    const scrubIDToNick = util.getScrubIDToNick();
    for (var userID in ledger) {
        fields.push(util.buildField(scrubIDToNick[userID], ledger[userID].armySize));
    }
    fields.sort(util.compareFieldValues);
    util.sendEmbedFieldsMessage('Scrubbing Bubbles Army Sizes', fields);
}

/**
 * Deletes previous Scrub Daddy message if it is an arrived for duty message.
 */
exports.maybeDeletePreviousMessage = function (msg) {
    //delete previous message if >1 bubbles dropped
    if (dropped > 1) {
        previousMessage.delete();
    }
    previousMessage = msg;
}