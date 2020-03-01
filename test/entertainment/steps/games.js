const { Given, When, Then } = require('cucumber');
const { assert } = require('chai');

const util = require('../../../src/utilities/utilities.js');
const testUtil = require('../../configuration/testUtil.js');
const games = require('../../../src/entertainment/games.js');
const moment = require('moment');

Given('no games have been played today', function() {
    games.clearTimeSheet();
});

When('{int} players play {float} hours of {string}', function (int, float, string) {
    const members = util.getMembers().array()
        .sort((a, b) => a.user.id > b.user.id)
        .slice(0, int);

    const stopPlayingTime = moment();
    const startPlayingTime = moment().subtract(float, 'hours').valueOf();

    members.forEach((member) => {
        testUtil.setMockCurrentTime(startPlayingTime);
        games.updateTimesheet(member.displayName, member.id, 'Beyond', undefined, string);
        testUtil.setMockCurrentTime(stopPlayingTime.valueOf());
        games.updateTimesheet(member.displayName, member.id, 'Beyond', string, undefined);
    });
});

Then('I should see a message with field at index {int} named {string} and value {string}', function (fieldIdx, name, value) {
    const actual = this.getLastMessageSent().fields[fieldIdx];
    const expected = buildField(name, value);

    assert.deepEqual(actual, expected);
});

Given('no users have opted into playtime tracking', function () {
    games.optOutAllUsers();
});

function buildField(name, value) {
    return {
        name: name,
        value: `${value}`,
        inline: 'true'
    };
}