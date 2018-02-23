/**
 * Discord BlackJack Bot
 * 
 * @author Alec Fox
 */

var fs = require('fs');
const c = require("./const.js");
const g = require("./gambling.js");
const util = require("./utilities.js");

var suits = ["Spades", "Hearts", "Diamonds", "Clubs"];
var values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
var deck = new Array();

var cardSuit = '';
var cardNumber = 0;

/** Adds Scrubbing Bubbles winnings to user's army
 * 
 * @param {number} userID - user ID of player
 * @param {number} amount - amount of Scrubbing Bubbles won
 * 
 */
function addToArmy(userID, amount) {
    g.getLedger()[userID].armySize += amount;
}
/** resets game of Blackjack
 * 
 * @param {number} userID - user ID of player
 * 
 */
function resetGame(userID) {
    g.getLedger()[userID].gameOver = true;
    g.getLedger()[userID].gameStarted = false;
    g.exportLedger();
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
function createPlayers(userID) {
    if (!g.getLedger()[userID]) {
        g.getLedger()[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    } else if (!g.getLedger()[userID].player) {
        g.getLedger()[userID].player = {};
        g.getLedger()[userID].dealer = {};
    }
    g.getLedger()[userID].gameOver = false;
    g.getLedger()[userID].player.hand = new Array();
    g.getLedger()[userID].dealer.hand = new Array();
    g.getLedger()[userID].player.points = 0;
    g.getLedger()[userID].dealer.points = 0;
    g.getLedger()[userID].player.aces = 0;
    g.getLedger()[userID].dealer.aces = 0;
    g.getLedger()[userID].player.acesCount = 0;
    g.getLedger()[userID].dealer.acesCount = 0;
    g.exportLedger();
}
/**
 * Checks to see if Aces should be worth 11 points or 1 point
 * 
 * @param {number} userID - User's ID of player 
 * @param {string} player - player or dealer identifier
 * 
 */
function checkAces(userID, player) {
    if (g.getLedger()[userID][player].points > 21) {
        for (var i = 0; i < g.getLedger()[userID][player].hand.length; i++) {
            if (g.getLedger()[userID][player].hand[i].Value.indexOf('11') === 0) {
                g.getLedger()[userID][player].aces += 1;
            }
        }
        while (g.getLedger()[userID][player].aces > 0 && g.getLedger()[userID][player].points > 21 
            && g.getLedger()[userID][player].aces > g.getLedger()[userID][player].acesCount) {
            g.getLedger()[userID][player].points -= 10;
            g.getLedger()[userID][player].aces = 0;
            g.getLedger()[userID][player].acesCount += 1;
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
function dealCards(userID, player, userName) {
    var card = deck.pop();
    g.getLedger()[userID][player].hand.push(card);
    var points = card.Weight;
    g.getLedger()[userID][player].points += points;
    cardSuit = card.Suit;
    cardNumber = card.Value;
    checkAces(userID, player);
    if (player === "player") {
        util.sendEmbedMessage(userName + " 's score: ", g.getLedger()[userID][player].points, userID, c[cardSuit][cardNumber - 2], true);
    } else {
        util.sendEmbedMessage(player + " 's score: ", g.getLedger()[userID][player].points, userID, c[cardSuit][cardNumber - 2], true);
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
    var bet = g.getLedger()[userID].bjBet;
    var amount;
    if (g.getLedger()[userID].player.points > 21) {
        util.sendEmbedMessage(userName + ' Busted! You lost ' + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
        resetGame(userID);
    }
    if (g.getLedger()[userID].player.points === 21) {
        amount = bet * 3;
        addToArmy(userID, amount);
        util.sendEmbedMessage(userName + ' got BlackJack!', 'You win ' + amount + ' Scrubbing Bubbles!', userID, null);
        resetGame(userID);
    }
    if (g.getLedger()[userID].dealer.points > 21) {
        amount = bet * 2;
        addToArmy(userID, amount);
        util.sendEmbedMessage(userName + ' you win ' + amount + ' Scrubbing Bubbles!', 'The Dealer busted!', userID, null);
        resetGame(userID);
    }
    if (g.getLedger()[userID].dealer.points <= 21 && g.getLedger()[userID].dealer.points > g.getLedger()[userID].player.points) {
        util.sendEmbedMessage(userName + " you lose " + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
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
    if (bet > g.getLedger()[userID].armySize) {
        util.sendEmbedMessage(userName + ' your army is not big enough!', null, userID, null);
        g.getLedger()[userID].gameStarted = false;
        return;
    }
    g.getLedger()[userID].bjBet = bet;
    g.getLedger()[userID].armySize -= bet;
    if (!g.getLedger()[userID].gameStarted) {
        g.getLedger()[userID].gameStarted = true;
        shuffle();
        createPlayers(userID);
        for (var i = 1; i <= 2; i++) {
            dealCards(userID, "player", userName);
        }
        checkOutcome(userID, userName, );

    } else {
        util.sendEmbedMessage(userName + ' you need to finish your game in progress!', null, userID, null);
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
    if (!g.getLedger()[userID] || !g.getLedger()[userID].player) {
        createPlayers(userID, userName);
    }
}

/**
 * Restores the old deck if a game was ongoing.
 * 
 * @param {number} userID - User's ID of player 
 */
function maybeRestoreOldDeck(userID) {
    if (deck.length !== 0) { return; }
    shuffle();
    const combinedOldHands = g.getLedger()[userID].player.hand.concat(g.getLedger()[userID].dealer.hand);
    deck = deck.filter(function(card) {
        return !combinedOldHands.includes(card);
    });
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
    if (g.getLedger()[userID].player.points < 21 && !g.getLedger()[userID].gameOver) {
        maybeRestoreOldDeck(userID);
        dealCards(userID, "player", userName);
        checkOutcome(userID, userName);
    } else {
        util.sendEmbedMessage(userName + " you need to start a new game!", null, userID, null);
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
    if (g.getLedger()[userID].player.points > 0 && !g.getLedger()[userID].gameOver) {
        maybeRestoreOldDeck(userID);
        dealCards(userID, "dealer");
        while (g.getLedger()[userID].dealer.points <= g.getLedger()[userID].player.points) {
            dealCards(userID, "dealer");
            checkOutcome(userID, userName);
        }
    } else {
        util.sendEmbedMessage(userName + " you need to start a new game!", null, userID, null);
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
    const bet = Number(args[1]);
    if (!bet || !Number.isInteger(bet) || bet < 0) {
        util.sendEmbedMessage(userName + " that's an invalid bet.", null, userID, null);
        return;
    }
    if (!g.getLedger()[userID].gameStarted) {
        dealHands(userID, userName, bet);
    } else {
        util.sendEmbedMessage(userName + " you already have a game in progress!", null, userID, null);
    }
    g.exportLedger();
};