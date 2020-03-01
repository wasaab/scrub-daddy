const { Given, When, Then } = require('cucumber');
const { assert } = require('chai');
const c = require('../../../src/const.js');
const gambling = require('../../../src/entertainment/gambling.js');
const cmdHandler = require('../../../src/handlers/cmdHandler.js');
var initialArmySize = 0;

function initMockLedger(otherArmySize) {
    gambling.setLedger({});
    gambling.addToArmy(c.SCRUB_DADDY_ID, 100);

    for (var i = 2; i < 5; i++) {
        const mockUserId = `${i}`.repeat(18);

        gambling.addToArmy(mockUserId, otherArmySize);
    }
}

Given('I have {int} soldiers in my army and others have {int}', function (myArmySize, otherArmySize) {
    initMockLedger(otherArmySize);
    initialArmySize = myArmySize;
    delete gambling.getLedger()[this.testUser.id];
    gambling.addToArmy(this.testUser.id, myArmySize);
});

When('I call {string}', function (string) {
    cmdHandler.handle(this.buildMessage(string));
});

Then('I should have an army size change of {int}', function (int) {
    assert.oneOf(this.getTestUserLedgerEntry().armySize, [initialArmySize + int, initialArmySize - int]);
});

Then('I should have an army size of {int}', function (int) {
    assert.strictEqual(this.getTestUserLedgerEntry().armySize, int);
});

Then('the user with id {string} should have an army size of {int}', function (string, int) {
    assert.strictEqual(gambling.getLedger()[string].armySize, int);
});

Then('others should have an army size of {int}', function (int) {
    for (var i = 2; i < 5; i++) {
        const mockUserId = `${i}`.repeat(18);

        assert.strictEqual(gambling.getLedger()[mockUserId].armySize, int);
    }
});