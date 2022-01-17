const { setWorldConstructor } = require("cucumber");
const testUtil = require('../configuration/testUtil.js');
const bot = require('../../src/bot.js');
const gambling = require('../../src/entertainment/gambling.js');
const c = require('../../src/const.js');

class TestWorld {
  constructor() {
    this.testChannelId = c.BOT_SPAM_CHANNEL_ID;
    this.testUser = {
        id: '1'.repeat(18),
        displayName: "tester1"
    };
    this.messages = [];
    this.client = bot.getClient();
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