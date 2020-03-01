const { Given, Then } = require('cucumber');
const { assert } = require('chai');
const c = require('../../../src/const.js');
const util = require('../../../src/utilities/utilities.js');

Given('the {string} command exists', function (string) {
    assert.oneOf(string, c.COMMANDS);
});

Given('there are {int} other members in my server', function (int) {
    assert.isAtLeast(util.getMembers().size,int);
});

Then('I should see a message with content {string}', function (string) {
    const lastMessageSent = this.getLastMessageSent();
    const content = lastMessageSent.description || lastMessageSent;

    assert.strictEqual(content, string);
});