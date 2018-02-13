/**
 * Discord BlackJack Bot
 * 
 * @author Alec Fox
 */

var fs = require('fs');
const c = require("./const.js");
const util = require("./utilities.js");
const ledger = require('../resources/data/ledger.json');

var suits = ["Spades", "Hearts", "Diamonds", "Clubs"];
var values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
var deck = new Array();

var cardSuit = '';
var cardNumber = 0;

/**
 * exports the ledger to a json file.
 * 
 */
exports.exportLedger = function () {
    var json = JSON.stringify(ledger);
    fs.writeFile('./resources/data/ledger.json', json, 'utf8', util.log);
};
/** Adds Scrubbing Bubbles winnings to user's army
 * 
 * @param {number} userID - user ID of player
 * @param {number} amount - amount of Scrubbing Bubbles won
 * 
 */
function addToArmy(userID, amount) {
    ledger[userID].armySize += amount;
}
/** resets game of Blackjack
 * 
 * @param {number} userID - user ID of player
 * 
 */
function resetGame(userID) {
    ledger.blackJack[userID].gameOver = true;
    ledger.blackJack[userID].gameStarted = false;
    exports.exportLedger();
}
//creats deck of 52 standard playing cards
function createDeck() {
    deck = new Array();
    for (var i = 0; i < values.length; i++) {
        for (var x = 0; x < suits.length; x++) {
            var weight = parseInt(values[i]);
            if (weight > 11 && weight < 15)
                weight = 10;
            var card = { Value: values[i], Suit: suits[x], Weight: weight };
            deck.push(card);
        }
    }
}
//shuffles deck of 52 playing cards
function shuffle() {
    createDeck();
    for (var i = 0; i < 1000; i++) {
        var location1 = Math.floor((Math.random() * deck.length));
        var location2 = Math.floor((Math.random() * deck.length));
        var tmp = deck[location1];
        deck[location1] = deck[location2];
        deck[location2] = tmp;
    }
}
/**creats new instance of the player (resets ledger)
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} userName - Username of player 
 * 
 **/
function createPlayers(userID, userName) {
    if (!ledger[userID]) {
        ledger[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    } else if (!ledger[userID].player) {
        ledger[userID].player = {};
        ledger[userID].dealer = {};
    }
    ledger[userID].gameOver = false;
    ledger[userID].name = userName;
    ledger[userID].player.hand = new Array();
    ledger[userID].dealer.hand = new Array();
    ledger[userID].player.points = 0;
    ledger[userID].dealer.points = 0;
    ledger[userID].player.aces = 0;
    ledger[userID].dealer.aces = 0;
    ledger[userID].player.acesCount = 0;
    ledger[userID].dealer.acesCount = 0;
    ledger[userID].bjBet = 0;
    exports.exportLedger();
}
/**
 * Checks to see if Aces should be worth 11 points or 1 point
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} player - player or dealer identifier
 * 
 */
function checkAces(userID, player) {
    if (ledger[userID][player].points > 21) {
        for (var i = 0; i < ledger[userID][player].hand.length; i++) {
            if (ledger[userID][player].hand[i].Value.indexOf('11') === 0) {
                ledger[userID][player].aces += 1;
            }
        }
        while (ledger[userID][player].aces > 0 && ledger[userID][player].points > 21 
            && ledger[userID][player].aces > ledger[userID][player].acesCount) {
            ledger[userID][player].points -= 10;
            ledger[userID][player].aces = 0;
            ledger[userID][player].acesCount += 1;
        }
    }
}
/** 
 * Deals cards from the deck to the player's hand
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} player - player or dealer identifier
 * 
**/
function dealCards(userID, player) {
    var userName = ledger[userID].name;
    var card = deck.pop();
    ledger[userID][player].hand.push(card);
    var points = card.Weight;
    ledger[userID][player].points += points;
    cardSuit = card.Suit;
    cardNumber = card.Value;
    checkAces(userID, player);
    if (player === "player") {
        util.sendEmbedMessageThumbnail(userName + " 's score: ", ledger[userID][player].points, userID, c[cardSuit][cardNumber - 2]);
    } else {
        util.sendEmbedMessageThumbnail(player + " 's score: ", ledger[userID][player].points, userID, c[cardSuit][cardNumber - 2]);
    }
}
/** 
 * Checks for outcome of blackjack game
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} userName - Username of player 
 * 
**/
function checkOutcome(userID, userName) {
    var bet = ledger[userID].bjBet;
    var amount;
    if (ledger[userID].player.points > 21) {
        util.sendEmbedMessageThumbnail(userName + ' Busted! You lost ' + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
        resetGame(userID);
    }
    if (ledger[userID].player.points === 21) {
        amount = bet * 3;
        addToArmy(userID, amount);
        util.sendEmbedMessageThumbnail(userName + ' got BlackJack!', 'You win ' + amount + ' Scrubbing Bubbles!', userID, null);
        resetGame(userID);
    }
    if (ledger[userID].dealer.points > 21) {
        amount = bet * 2;
        addToArmy(userID, amount);
        util.sendEmbedMessageThumbnail(userName + ' you win ' + amount + ' Scrubbing Bubbles!', 'The Dealer busted!', userID, null);
        resetGame(userID);
    }
    if (ledger[userID].dealer.points <= 21 && ledger[userID].dealer.points > ledger[userID].player.points) {
        util.sendEmbedMessageThumbnail(userName + " you lose " + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
        resetGame(userID);
    }
}
/** 
 * Deals starting hands for blackjack and creates array for new player
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} userName - Username of player 
 * 
**/
function dealHands(userID, userName, bet) {
    if (bet > ledger[userID].armySize) {
        util.sendEmbedMessageThumbnail(userName + ' your army is not big enough!', null, userID, null);
        ledger[userID].gameStarted = false;
        return;
    }
    ledger[userID].bjBet = bet;
    ledger[userID].armySize -= bet;
    if (!ledger[userID].gameStarted) {
        ledger[userID].gameStarted = true;
        shuffle();
        createPlayers(userID, userName);
        for (var i = 1; i <= 2; i++) {
            dealCards(userID, "player");
        }
        checkOutcome(userID, userName, );

    } else {
        util.sendEmbedMessageThumbnail(userName + ' you need to finish your game in progress!', null, userID, null);
    }
}

/**
 * Populates the blackjack fields for the provided user in the ledger 
 * iff they don't already exist.
 * 
 * @param {String} userID  - the id of the user
 * @param {String} userName - the name of the user
 */
function maybePopulateBlackjackUserFields(userID, userName) {
    if (!ledger[userID] || !ledger[userID].player) {
        createPlayers(userID, userName);
    }
}
/** 
 * Adds card from top of deck to player's hand
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} userName - Username of player 
 * 
**/
exports.hitMe = function (userID, userName) {
    maybePopulateBlackjackUserFields(userID, userName);
    if (ledger[userID].player.points < 21 && !ledger[userID].gameOver) {
        dealCards(userID, "player");
        checkOutcome(userID, userName);
    } else {
        util.sendEmbedMessageThumbnail(userName + " you need to start a new game!", null, userID, null);
    }
};
/** 
 * Finalizes Player's hand and intitiates dealer's turn
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} userName - Username of player 
 * 
**/
exports.stay = function (userID, userName) {
    maybePopulateBlackjackUserFields(userID, userName);
    if (ledger[userID].player.points > 0 && !ledger[userID].gameOver) {
        dealCards(userID, "dealer");
        while (ledger[userID].dealer.points <= ledger[userID].player.points) {
            dealCards(userID, "dealer");
            checkOutcome(userID, userName);
        }
    } else {
        util.sendEmbedMessageThumbnail(userName + " you need to start a new game!", null, userID, null);
    }
};
/**Checks to see if the bet is a valid number
 * 
 * @param {number} userID -user ID of player
 * @param {string} userName -username of player
 * @param {array} args -array of user's message after command
 * 
 */
exports.checkUserData = function (userID, userName, args) {
    maybePopulateBlackjackUserFields(userID, userName);
    const bet = Number(args[0]);
    if (!bet || !Number.isInteger(bet) || bet < 0) {
        util.sendEmbedMessageThumbnail(userName + " that's an invalid bet.", null, userID, null);
        return;
    }
    if (!ledger[userID].gameStarted) {
        dealHands(userID, userName, bet);
    } else {
        util.sendEmbedMessageThumbnail(userName + " you already have a game in progress!", null, userID, null);
    }
};
