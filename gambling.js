const c = require('./const.js');
const util = require('./utilities.js');
var fs = require('fs');
var get = require('lodash.get');
const Discord = require('discord.js');
var dropped = 0;
var ledger = require('./ledger.json');   //keeps track of how big of an army each member has as well as bet amounts
var previousMessage = {};

exports.exportLedger = function() {
    var json = JSON.stringify(ledger);    
    fs.writeFile('ledger.json', json, 'utf8', util.log);
}

/**
 * Discharges a scrub bubble from the provided user's army, so that another
 * member may enlist the bubble to their army.
 * 
 * @param {String} userID - the id of the user discharging a bubble
 */
exports.dischargeScrubBubble = function (userID, botSpam) {
    if (userID !== undefined && userID !== '132944096347160576') {
        if (ledger[userID] !== undefined && ledger[userID].armySize > 0) {
            ledger[userID].armySize--;
        } else {
            return;
        }
    }
    dropped++;
    var droppedImg = dropped;
    var msg = 'Bubble has'
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
		exports.dischargeScrubBubble(undefined, botSpamChannel);
	}
}

/**
 * Adds the given number of Scrubbing Bubbles to the provided user's army.
 * 
 * @param {String} userID - id of the user to add to
 * @param {Number} amount - amount to add
 */
function addToArmy(userID, amount) {
    if (ledger[userID] === undefined) {
        ledger[userID] = { armySize : 0, cleanBet : 0, raceBet : 0};
    }
    ledger[userID].armySize += amount;
}

exports.enlist = function(userID) {
    if (dropped > 0) {
        addToArmy(userID, dropped);
        const msg = '<@!' + userID + '>  ' + 'Your Scrubbing Bubbles army has grown by ' + dropped + '! You now have an army of ' + ledger[userID].armySize + '.' ;        
        util.sendEmbedMessage(null, msg);	
        previousMessage.delete();
        dropped = 0;
    } 
}

function isValidSide(side) {
    if (side === 'b' || side === 't')
        return true;
    return false;
}

function takeBetFromUser(userID, bet, type) {
    if (type === 'clean') {
        ledger[userID].armySize -= bet;
        ledger[userID].cleanBet = bet;
    } else if (type === 'race') {
        ledger[userID].armySize -= bet;
        ledger[userID].raceBet = bet;
    }
}

function resetLedgerAfterBet(userID, bet, type) {
    if (type === 'clean') {
        ledger[userID].cleanBet = 0;
    } else if (type === 'race') {
        ledger[userID].raceBet = 0;
    }
}

function getTypeNum(typeString) {
    if (typeString === 't')
        return 0; 
    if ( typeString === 'b')
        return 1;
}

function betClean(userID, bet, type, side) {    
    var wallet = ledger[userID];
    
    if ( wallet === undefined || wallet.armySize < bet ) {
        var msg = 'Your army is nonexistent'
        if (wallet !== undefined) {
            msg = 'Your ' + wallet.armySize + ' soliders would surely perish';
        }
        const description = '<@!' + userID + '>  ' + 'You do not have enough Scrubbing Bubbles to clean the bathroom. ' + msg;
        util.sendEmbedMessage(null,description);
    } else {
        var msg = '';
        var img = '';
        takeBetFromUser(userID, bet, type);
        
        if (util.getRand(0,2) === getTypeNum(side)) {
            const payout = bet*2;            
            img = 'https://i.imgur.com/LDSm2sg.png';
            msg = 'Congrats, your auxiliary army gained ' + payout + ' Scrubbing Bubbles after cleaning the bathroom and conquering the land!';
            addToArmy(userID, payout);        
        } else {
            var plural = '';
            if (bet > 1) {
                plural = 's';
            }
            img = 'https://i.imgur.com/gynZE1j.png';
            msg = 'Sorry bud, you lost ' + bet + ' Scrubbing Bubble' + plural + ' in the battle.';
        }
        util.sendEmbedMessage(null, '<@!' + userID + '>  ' + msg, img);
        resetLedgerAfterBet(userID, bet, type);
    }
}
exports.maybeBetClean = function(userID, args) {
    const bet = Number(args[1]);
    const side = args[2];
    
    if (bet === undefined || isNaN(bet) || side == undefined || !isValidSide(side) || bet < 1) {
        return;
    }

    betClean(userID, bet, 'clean', side);
}

exports.army = function(userID, args) {
    var msg = ' your';
    if (args[1] !== undefined) {
        if (args[1].match(/\d/g) !== null) {
            userID = args[1].match(/\d/g).join("")  
            msg = '\'s';
        }
    }
    const wallet = ledger[userID];
    if ( wallet !== undefined ) {
        var plural = '';
        if (wallet.armySize > 1) {
            plural = 's';
        }
        const description = '<@!' + userID + '>'+ msg +  ' army is ' + wallet.armySize +  ' Scrubbing Bubble' + plural + ' strong!';
        util.sendEmbedMessage(null,description);
    }
}

exports.armyRanks = function() {
    var fields = [];
    for (var userID in ledger) {
        fields.push(util.buildField(c.SCRUB_ID_TO_NICK[userID], ledger[userID].armySize));
    } 
    fields.sort(util.compareFieldValues);
    util.sendEmbedFieldsMessage('Scrubbing Bubbles Army Sizes', fields);
}

exports.maybeDeletePreviousMessage = function (msg) {
    c.LOG.info('<INFO> ' + util.getTimestamp() + '  arrive for duty msg found ');
    //delete previous message if >1 bubbles dropped
    if (dropped > 1) {
        previousMessage.delete();
    }
    previousMessage = msg;
}