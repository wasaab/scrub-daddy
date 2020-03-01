const { Given, Then } = require('cucumber');
const { assert } = require('chai');
const get = require('lodash.get');

const testUtil = require('../../configuration/testUtil.js');
const gambling = require('../../../src/entertainment/gambling.js');

/**
 * Builds a mock stock api response.
 *
 * @param {String} symbol stock's symbol
 * @param {String} price price of the stock
 * @param {string} dailyChange daily change of stock
 */
function buildStockMock(symbol, price, dailyChange) {
    return JSON.stringify({
        'Global Quote': {
            '01. symbol': symbol,
            '05. price': price,
            '09. change': dailyChange
        }
    });
}

Given('I have {int} soldiers in my army', function (myArmySize) {
    gambling.setLedger({});
    delete gambling.getLedger()[this.testUser.id];
    gambling.addToArmy(this.testUser.id, myArmySize);
    testUtil.resetStockToMockApiResp();
});

Given('{int} share of {string} stock costs {string}', function (shares, stock, price) {
    testUtil.addStockToMock(stock, buildStockMock(stock, price));
});

Given('{int} share of {string} stock costs {string} and had a change of {float}', function (shares, stock, price, change) {
    testUtil.addStockToMock(stock, buildStockMock(stock, price, change));
});

Then('I should have {int} shares of {string} stock', function (expectedShares, stock) {
    const actualShares = get(this.getTestUserLedgerEntry(), `stockToInfo[${stock}].shares`) || 0;

    assert.strictEqual(actualShares, expectedShares);
});