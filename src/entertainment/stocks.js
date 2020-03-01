var moment = require('moment');
var get = require('lodash.get');
var rp = require('request-promise');

var c = require('../const.js');
var util = require('../utilities/utilities.js');
var testUtil = require('../../test/configuration/testUtil.js');
var logger = require('../logger.js').botLogger;
var gambling = require('./gambling.js');

var priv = require('../../../private.json');
var numStocksUpdated = 0;

/**
 * Finalizes a stock investment.
 *
 * @param {Object} userEntry user's ledger entry
 * @param {String} stock stock being invested in
 * @param {Number} shares shares bought
 * @param {Number} stockPrice price of a share
 * @param {Number} cost cost of transaction
 * @param {String} userID id of user investing
 */
function finalizeInvestment(userEntry, stock, shares, stockPrice, cost, userID) {
    var stockInfo = userEntry.stockToInfo[stock];

    if (!stockInfo) {
        userEntry.stockToInfo[stock] = {
            shares: shares,
            initialPrice: stockPrice,
            currentPrice: stockPrice,
            netArmyChange: 0
        };
        logger.info('stock: ' + stock);
        logger.info(JSON.stringify(userEntry.stockToInfo));
    } else {
        stockInfo.shares = stockInfo.shares + shares;
        stockInfo.currentPrice = stockPrice;
    }

    userEntry.armySize -= cost;
    util.sendEmbedMessage('📈 Solid Investment', `${util.mentionUser(userID)} your investment of ` +
        `${util.formatAsBoldCodeBlock(cost)} Scrubbing Bubbles for ${util.formatAsBoldCodeBlock(shares)}` +
        ` shares of ${util.formatAsBoldCodeBlock(stock)} stock has been processed. ${gambling.getArmySizeMsg(userID)}\n` +
        'Your army will grow or shrink daily by `2 * ⌈stock close price - stock open price⌉ * #shares`.' +
        ' See this calculated daily change by calling `.stocks`', userID);
}

/**
 * Builds the investment arguments.
 *
 * @param {Number} shares shares being bought
 * @param {String} stock stock being invested in
 * @param {String} userID id of user investing
 */
function buildInvestmentArgs(shares, stock, userID) {
    gambling.maybeCreateLedgerEntry(userID);
    gambling.maybeCreateLedgerEntry(c.SCRUB_DADDY_ID);

    const scrubDaddyEntry = gambling.getLedger()[c.SCRUB_DADDY_ID];

    shares = isNaN(shares) ? 1 : Number(shares);
    stock = stock.toUpperCase();

    if (!Number.isInteger(shares) || shares < 1) {
        shares = 1;
    }

    if (!scrubDaddyEntry.stocks) {
        createScrubDaddyStocksEntry();
    }

    var userEntry = gambling.getLedger()[userID];

    if (!userEntry.stockToInfo) {
        userEntry.stockToInfo = {};
    }

    return { userEntry, shares, stock };
}

/**
 * Invests in a stock.
 *
 * @param {String} userID id of user investing
 * @param {String} stockName stock being invested in
 * @param {String} desiredShares number of shares desired
 */
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
                return util.sendEmbedMessage('📈 Stock Too Cheap', `${util.mentionUser(userID)} you must invest in ` +
                    `a stock that costs a minimum of ${util.formatAsBoldCodeBlock(c.MIN_STOCK_PRICE)} Scrubbing Bubbles per share.`);
            }

            const cost = Math.ceil(stockPrice * shares);

            if (!gambling.isAbleToAffordBet(userID, cost)) {
                return util.sendEmbedMessage('📈 Unable to Afford Stock',
                    `${util.mentionUser(userID)} you will need ${util.formatAsBoldCodeBlock(cost)} Scrubbing Bubbles` +
                    ` to purchase ${util.formatAsBoldCodeBlock(shares)} shares of ${util.formatAsBoldCodeBlock(stock)} stock.`, userID);
            }

            finalizeInvestment(userEntry, stock, shares, stockPrice, cost, userID);
            gambling.exportLedger();
        });
};

/**
 * Sells shares of a stock.
 *
 * @param {String} userID id of user selling shares
 * @param {String} stock stock being sold
 * @param {Number} shares number of shares being sold
 */
exports.sellShares = function(userID, stock, shares) {
    stock = stock.toUpperCase();

    const stockToInfo = get(gambling.getLedger(), `[${userID}].stockToInfo`);

    if (!stockToInfo) { return; }

    const stockInfo = stockToInfo[stock];

    if (!stockInfo) { return; }

    const sharesOwned = stockInfo.shares;
    shares = isNaN(shares) ? sharesOwned : Number(shares);

    if (shares < 1 || shares > sharesOwned) { return; }

    getStockUpdate(stock)
        .then((newStockInfo) => {
            const price = newStockInfo.price;

            if (!price) { return; }

            const payout = Math.ceil(price * shares);
            stockInfo.shares -= shares;
            gambling.getLedger()[userID].armySize += payout;
            util.sendEmbedMessage('📈 Scrubble Stock Liquidated',
                `${util.mentionUser(userID)} your ${util.formatAsBoldCodeBlock(shares)} share${util.maybeGetPlural(shares)}` +
                ` of ${util.formatAsBoldCodeBlock(stock)} stock sold for ${util.formatAsBoldCodeBlock(payout)} Scrubbing Bubbles. ` +
                `${gambling.getArmySizeMsg(userID)}`, userID);

            if (stockInfo.shares === 0) {
                delete stockToInfo[stock];
            }
        });
};

/**
 * Creates the bot's stocks entry.
 */
function createScrubDaddyStocksEntry() {
    gambling.getLedger()[c.SCRUB_DADDY_ID].stocks = {
        stockToInfo: {},
        updateDate: moment().format(c.MDY_DATE_FORMAT)
    };
}

/**
 * Updates the provided users stock info.
 *
 * @param {Object} stockToInfo map of stock to info
 * @param {String} stock stock being updated
 * @param {Object} newStockInfo info being used
 * @param {String} userID id of user to update stock info for
 */
function updateUsersStockInfo(stockToInfo, stock, newStockInfo, userID) {
    var userEntry = gambling.getLedger()[userID];
    const stockInfo = stockToInfo[stock];
    const armyChangePerShare = newStockInfo ? newStockInfo.armyChange : 1; // Default to 1 if error getting stock change from api
    const armyChange = Math.ceil(armyChangePerShare * stockInfo.shares);

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

/**
 * Updates all of the user's stocks.
 *
 * @param {Object} stockToInfo map of stock to info
 * @param {String} userID id of user to update stock info for
 * @param {Object} updatedStockToInfo updated map of stock to info
 */
function updateUsersStocks(stockToInfo, userID, updatedStockToInfo) {
    Object.keys(stockToInfo).forEach((stock) => {
        const updatedStockInfo = updatedStockToInfo[stock];

        updateUsersStockInfo(stockToInfo, stock, updatedStockInfo, userID);
    });
}

/**
 * Updates the stocks of all users.
 *
 * @param {Object} stockOwnerIdToInfo map of stock owner id to stock info
 * @param {Object} updatedStockToInfo updated map of stock to info
 */
function updateAllUserStocks(stockOwnerIdToInfo, updatedStockToInfo) {
    for (var userID in stockOwnerIdToInfo) {
        updateUsersStocks(stockOwnerIdToInfo[userID], userID, updatedStockToInfo);
    }
}

/**
 * Rate limiter for stocks api. 5 req/min.
 */
function waitIfRateLimitReached() {
    numStocksUpdated++;

    const waitMs = numStocksUpdated % 5 === 0 ? 60000 : 0;

    return new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * Updates the cached stocks.
 *
 * @param {Object[]} stocks stocks to get updates for
 */
function updateCachedStocks(stocks) {
    if (stocks.length === 0) { return; }

    return getStockUpdate(stocks.pop())
        .then(waitIfRateLimitReached)
        .then(() => updateCachedStocks(stocks));
}

/**
 * Updates all stocks.
 */
exports.updateStocks = function() {
    createScrubDaddyStocksEntry();

    var stockOwnerIdToInfo = {};
    var stocks = [];

    for (var userID in gambling.getLedger()) {
        const stockToInfo = gambling.getLedger()[userID].stockToInfo;

        if (!stockToInfo || Object.keys(stockToInfo).length === 0) { continue; }

        stockOwnerIdToInfo[userID] = stockToInfo;
        stocks.push(...Object.keys(stockToInfo));
    }

    numStocksUpdated = 0;
    stocks = [...new Set(stocks)]; //remove duplicates


    toggleStocksLock();
    updateCachedStocks(stocks)
        .then(() => {
            const updatedStockToInfo = gambling.getLedger()[c.SCRUB_DADDY_ID].stocks.stockToInfo;

            outputStockChanges(updatedStockToInfo);
            updateAllUserStocks(stockOwnerIdToInfo, updatedStockToInfo);
            gambling.exportLedger();
            toggleStocksLock();
        });
};

/**
 * Locks stock functionality during sensitive 5pm rate limited update from api.
 */
function toggleStocksLock() {
    const toggleTo = util.isLocked('invest') ? 'unLock' : 'lock';

    util[toggleTo]('invest');
    util[toggleTo]('sellShares');
    util[toggleTo]('outputUsersStockChanges');
}

/**
 * Outputs the user's daily stock changes.
 *
 * @param {Object} stockToInfo map of stock to info
 * @param {String} userID id of user to output stock changes for
 */
function outputStockChanges(stockToInfo, userID) {
    if (Object.keys(stockToInfo).length === 0) { return; }

    const stocksOwner = userID ? `${util.getNick(userID)}'s` : '';
    const { updateDate } = gambling.getLedger()[c.SCRUB_DADDY_ID].stocks;
    const { stockChangeFields, netArmyChange } = buildStockChangeFieldsAndDetermineChange(stockToInfo);
    const { graphEmoji, footer } = buildArmyChangeFooterAndGraphEmoji(netArmyChange);

    util.sendEmbedFieldsMessage(`${graphEmoji} ${stocksOwner} Scrubble Stock Changes for ${updateDate}`,
        stockChangeFields, userID, footer);
}

/**
 * Outputs the provided user's daily stock changes if they have a stock portfolio.
 *
 * @param {String} userID id of user to output stock changes for
 */
exports.maybeOutputUsersStockChanges = function(userID) {
    const userStockToInfo = get(gambling.getLedger(), `[${userID}].stockToInfo`);
    const cachedStockToInfo = gambling.getLedger()[c.SCRUB_DADDY_ID].stocks.stockToInfo;

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

/**
 * Builds the army change footer and graph emoji.
 *
 * @param {Number} netArmyChange net army change from stock investment
 */
function buildArmyChangeFooterAndGraphEmoji(netArmyChange) {
    const graphEmoji = netArmyChange >= 0 ? '📈' : '📉';
    const footer = {
        icon_url: c.BUBBLE_IMAGES[0], //eslint-disable-line
        text: `${determineChangeSymbol(netArmyChange)}${netArmyChange}`
    };

    return { graphEmoji, footer };
}

/**
 * Ouputs the stock portfolio not found message.
 *
 * @param {String} userID id of user who has no stock portfolio
 */
function outputStockPortfolioNotFoundMsg(userID) {
    return util.sendEmbedMessage('📈 Stock Portfolio Not Found', `${util.mentionUser(userID)} you don't have any investments.` +
        ` Call ${util.formatAsBoldCodeBlock('.help invest')} to learn how to invest in Scrubble Stocks.`, userID);
}

/**
 * Builds the stocks daily change fields and determines net army change.
 *
 * @param {Object} stockToInfo map of stock to info
 */
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

/**
 * Determines the change symbol ('+' or '').
 *
 * @param {Number} armyChange change in army size
 */
function determineChangeSymbol(armyChange) {
    return armyChange > 0 ? '+' : '';
}

/**
 * Determines the stock update.
 *
 * @param {Object} mostRecentQuote stock api quote response
 */
function determineStockUpdate(mostRecentQuote) {
    const price = Number(mostRecentQuote['05. price']);
    const change = Number(mostRecentQuote['09. change']);
    const armyChange = change < 0 ? Math.floor(change * 2) : Math.ceil(change * 2);

    return { armyChange, price };
}

/**
 * Requests the stock update from the api or injects mock api for testing.
 *
 * @param {Object} options request options
 */
function requestStockUpdateFromApi(options) {
    return testUtil.isTestRun() ? testUtil.getMockStockApiResp(options.uri) : rp(options);
}

/**
 * Gets the stock update.
 *
 * @param {String} stock stock to get update for
 */
function getStockUpdate(stock) {
    const { stocks } = gambling.getLedger()[c.SCRUB_DADDY_ID];
    const cachedStockInfo = stocks.stockToInfo[stock];

    if (cachedStockInfo && moment().diff(cachedStockInfo.time, 'minutes') < 15) {
        return Promise.resolve(cachedStockInfo);
    }

    var options = {
		uri: `${c.STOCKS_BASE_URL}${stock}&apikey=${priv.stocksApiKey}`,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
    };

    return requestStockUpdateFromApi(options)
		.then((result) => {
            logger.info(`Stocks API Response: ${result}`);

            const mostRecentQuote = JSON.parse(result)["Global Quote"];
            if (!mostRecentQuote || Object.keys(mostRecentQuote).length === 0) { return; }

            const stockUpdate = determineStockUpdate(mostRecentQuote);

            stockUpdate.time = moment().valueOf();
            stocks.stockToInfo[stock] = stockUpdate;

            return stockUpdate;
		})
		.catch(util.log);
}

/**
 * Outputs the provided user's stock portfolio.
 *
 * @param {String} userID id of user to output stock portfolio of
 */
exports.outputUserStockPortfolio = function(userID) {
    const userStockToInfo = get(gambling.getLedger(), `[${userID}].stockToInfo`);

    if (!userStockToInfo || Object.keys(userStockToInfo).length === 0) {
        return outputStockPortfolioNotFoundMsg(userID);
    }

    var { netArmyChange, output } = buildPortfolioTableBody(userStockToInfo);
    const { graphEmoji, footer } = buildArmyChangeFooterAndGraphEmoji(netArmyChange);

    util.sendEmbedMessage(`${graphEmoji} ${util.getNick(userID)}'s Scrubble Stock Portfolio`,
        output, userID, null, null, footer);
};

/**
 * Builds the stock portfolio ascii table body.
 *
 * @param {Object} userStockToInfo map of stock user owns to info on it
 */
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

/**
 * Builds a column for an ascii table.
 *
 * @param {String} text column's text content
 * @param {Number} columnLength column length
 * @param {Boolean} isLastColumn whether or not it is the last column being built
 */
function buildColumn(text, columnLength, isLastColumn) {
    if (text > columnLength) {
        text = text.slice(0, columnLength);
    }

    return isLastColumn ? `${text}\n` : `${text}${' '.repeat(columnLength - text.length)}${c.TABLE_COL_SEPARATOR}`;
}

/**
 * Builds an ascii table header.
 *
 * @param {String[]} columnHeaders column headers of the table
 */
function buildTableHeader(columnHeaders) {
    const header = columnHeaders.join(c.TABLE_COL_SEPARATOR);
    const columnLengths = columnHeaders.map((currHeader) => currHeader.length);
    const underline = columnLengths.map((length) => '═'.repeat(length)).join('═╬═');
    const output = `**\`\`\`${header}\n${underline}\n`;

    return { output, columnLengths };
}