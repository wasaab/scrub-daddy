const { setWorldConstructor } = require("cucumber");
const gambling = require('../../src/entertainment/gambling.js');
const testUtil = require('../configuration/testUtil.js');
const c = require('../../src/const.js');

class TestWorld {
  constructor() {
    this.testChannelId = c.BOT_SPAM_CHANNEL_ID;
    this.testUser = {
        id: '1'.repeat(18),
        displayName: "tester1"
    };
    this.messages = [];
  }

  buildMessage(content) {
    return {
        content: content,
        member: {
            id: this.testUser.id
        },
        channel: {
            id: this.testChannelId
        },
        delete: () => null
    };
  }

  getLastMessageSent() {
    return testUtil.getLastMessageSent();
  }

  getTestUserLedgerEntry() {
    return gambling.getLedger()[this.testUser.id];
  }
}

setWorldConstructor(TestWorld);

module.exports = TestWorld;