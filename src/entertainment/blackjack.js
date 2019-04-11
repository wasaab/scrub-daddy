/**
 * Discord BlackJack Bot
 *
 * @author Alec Fox
 */

const c = require("../const.js");
const g = require("./gambling.js");
const util = require("../utilities/utilities.js");

var suits = ["Spades", "Hearts", "Diamonds", "Clubs"];
var values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
var deck = new Array();

var cardSuit = '';
var cardNumber = 0;

/**
 * Gets the ledger entry of the provided user.
 *
 * @param {String} userID - id of the user to get the ledger entry of
 * @returns {Object} ledger entry
 */
function getUserEntry(userID) {
    return g.getLedger()[userID];
}

/** Adds Scrubbing Bubbles winnings to user's army
 *
 * @param {number} userID - user ID of player
 * @param {number} amount - amount of Scrubbing Bubbles won
 *
 */
function addToArmy(userID, amount) {
    getUserEntry(userID).armySize += amount;
}
/** resets game of Blackjack
 *
 * @param {number} userID - user ID of player
 *
 */
function resetGame(userID) {
    getUserEntry(userID).bjGameOver = true;
    getUserEntry(userID).bjGameStarted = false;
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
    if (!getUserEntry(userID)) {
        g.getLedger()[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    }

    getUserEntry(userID).bjGameOver = false;
    getUserEntry(userID).player.hand = [];
    getUserEntry(userID).dealer.hand = [];
    getUserEntry(userID).player.points = 0;
    getUserEntry(userID).dealer.points = 0;
    getUserEntry(userID).player.aces = 0;
    getUserEntry(userID).dealer.aces = 0;
    getUserEntry(userID).player.acesCount = 0;
    getUserEntry(userID).dealer.acesCount = 0;
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
    if (getUserEntry(userID)[player].points > 21) {
        for (var i = 0; i < getUserEntry(userID)[player].hand.length; i++) {
            if (getUserEntry(userID)[player].hand[i].Value.indexOf('11') === 0) {
                getUserEntry(userID)[player].aces += 1;
            }
        }
        while (getUserEntry(userID)[player].aces > 0 && getUserEntry(userID)[player].points > 21
            && getUserEntry(userID)[player].aces > getUserEntry(userID)[player].acesCount) {
            getUserEntry(userID)[player].points -= 10;
            getUserEntry(userID)[player].aces = 0;
            getUserEntry(userID)[player].acesCount += 1;
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
    getUserEntry(userID)[player].hand.push(card);
    var points = card.Weight;
    getUserEntry(userID)[player].points += points;
    cardSuit = card.Suit;
    cardNumber = card.Value;
    checkAces(userID, player);
    if (player === "player") {
        util.sendEmbedMessage(userName + " 's score: ", getUserEntry(userID)[player].points, userID, c[cardSuit][cardNumber - 2], true);
    } else {
        util.sendEmbedMessage(player + " 's score: ", getUserEntry(userID)[player].points, userID, c[cardSuit][cardNumber - 2], true);
    }
}

function endGame(userID, payout) {
    addToArmy(userID, payout);
    resetGame(userID);
}

/**
 * Checks for outcome of blackjack game
 *
 * @param {number} userID - User's ID of player
 * @param {string} userName - Username of player
 *
**/
function checkOutcome(userID, userName, isPlayerStaying) {
    const userEntry = getUserEntry(userID);
    const bet = userEntry.bjBet;
    const dealerPoints = userEntry.dealer.points;
    const playerPoints = userEntry.player.points;

    if (playerPoints > 21) {
        util.sendEmbedMessage(userName + ' Busted! You lost ' + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
        endGame(userID, 0);
    } else if (playerPoints === 21) {
        const payout = userEntry.player.hand.length === 2 ? bet * 3 : bet * 2;
        util.sendEmbedMessage(userName + ' got BlackJack!', 'You win ' + payout + ' Scrubbing Bubbles!', userID, null);
        endGame(userID, payout);
    } else if (dealerPoints > 21) {
        util.sendEmbedMessage(userName + ' you win ' + bet*2 + ' Scrubbing Bubbles!', 'The Dealer busted!', userID, null);
        endGame(userID, bet*2);
    } else if (isPlayerStaying) {
        checkStayOutcome(dealerPoints, playerPoints, userName, bet, userID);
    }
}

function checkStayOutcome(dealerPoints, playerPoints, userName, bet, userID) {
    if (dealerPoints <= 21 && dealerPoints > playerPoints) {
        util.sendEmbedMessage(userName + " you lose " + bet + ' Scrubbing Bubbles!', 'The Dealer Wins!', userID, null);
        endGame(userID, 0);
    } else if (dealerPoints >= 17) {
        if (dealerPoints < playerPoints) {
            util.sendEmbedMessage(userName + ' you win ' + bet * 2 + ' Scrubbing Bubbles!', 'Congrats, my dude!', userID, null);
            endGame(userID, bet * 2);
        } else if (dealerPoints === playerPoints) {
            util.sendEmbedMessage('It\'s a tie!', 'There are no winners this time.', userID, null);
            endGame(userID, bet);
        }
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
    if (bet > getUserEntry(userID).armySize) {
        util.sendEmbedMessage(userName + ' your army is not big enough!', null, userID, null);
        getUserEntry(userID).bjGameStarted = false;
        return;
    }
    getUserEntry(userID).bjBet = bet;
    getUserEntry(userID).armySize -= bet;
    if (!getUserEntry(userID).bjGameStarted) {
        getUserEntry(userID).bjGameStarted = true;
        shuffle();
        createPlayers(userID);
        for (var i = 1; i <= 2; i++) {
            dealCards(userID, "player", userName);
        }
        dealCards(userID, "dealer");
        checkOutcome(userID, userName);

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
    if (!getUserEntry(userID) || !getUserEntry(userID).player) {
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
    const combinedOldHands = getUserEntry(userID).player.hand.concat(getUserEntry(userID).dealer.hand);
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
    if (getUserEntry(userID).player.points < 21 && !getUserEntry(userID).bjGameOver) {
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

    if (getUserEntry(userID).player.points > 0 && !getUserEntry(userID).bjGameOver) {
        maybeRestoreOldDeck(userID);
        while (dealerShouldHit(userID)) {
            dealCards(userID, "dealer");
            checkOutcome(userID, userName, true);
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
    if (!getUserEntry(userID).bjGameStarted) {
        dealHands(userID, userName, bet);
    } else {
        util.sendEmbedMessage(userName + " you already have a game in progress!", null, userID, null);
    }
    g.exportLedger();
};

function dealerShouldHit(userID) {
    const dealerPoints = getUserEntry(userID).dealer.points;
    const userPoints = getUserEntry(userID).player.points;
    return  dealerPoints <= userPoints && dealerPoints < 17;
}
