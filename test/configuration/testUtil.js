const Discord = require('discord.js');
const c = require('../../src/const.js');
const { logger } = require('../../src/logger.js');

const testRun = process.argv.includes('test/**/?(**)/*.js');
var mockCurrentTime;
var sentMessages = [];
var stockToMockApiResponse = {};

exports.isTestRun = function() {
	return testRun;
};

exports.getMockCurrentTime = function() {
	return mockCurrentTime;
};

exports.setMockCurrentTime = function(time) {
	mockCurrentTime = time;
};

exports.mockServer = function(eventHandler) {
    const util = require('../../src/utilities/utilities.js');

    eventHandler.setChannels(createMockServer());
	eventHandler.registerCommandHandlers();
    util.updateMembers();
};

function interceptMessage(message) {
    sentMessages.push(message);
    logger.send(JSON.stringify(message));

    return new Promise((resolve) => resolve({ delete: () => null }));
}

exports.getSentMessages = function() {
    return sentMessages;
};

exports.getLastMessageSent = function() {
    return sentMessages[sentMessages.length - 1];
};

exports.resetStockToMockApiResp = function() {
    stockToMockApiResponse = {};
};

exports.addStockToMock = function(stock, response) {
    stockToMockApiResponse[stock] = response;
};

exports.getMockStockApiResp = function(uri) {
    const symbol = uri.match('symbol=(.{1,5})&')[1];

    return Promise.resolve(stockToMockApiResponse[symbol]);
};

function createMockServer() {
	return {
		channels: createMockChannels(),
		members: createMockMembers()
	};
}

function createMockMembers() {
	const avatarUrl = 'http://fake.com/fake.png';
	const mockMembers = new Discord.Collection();

	for (var i = 1; i < 5; i++) {
		const mockUser = {
			displayAvatarURL: avatarUrl,
			avatarURL: avatarUrl,
			id: `${i}`.repeat(18),
			username: `testName${i}`,
			bot: false
		};
		const mockMember = new Discord.GuildMember({}, {
			id: mockUser.id,
			displayName: `tester${i}`,
			name: mockUser.username,
			user: mockUser
		});

		mockMembers.set(mockMember.id, mockMember);
	}

	return mockMembers;
}

function createMockWebhook() {
	return new Promise((resolve) => resolve({
		send: interceptMessage,
		delete: () => new Promise((resolveDel) => resolveDel())
	}));
}

function createMockChannels() {
	const channelIds = [c.BOT_SPAM_CHANNEL_ID, c.SCRUBS_CHANNEL_ID, c.PURGATORY_CHANNEL_ID,
		c.LOG_CHANNEL_ID, c.CAR_PARTS_CHANNEL_ID];
	const mockChannels = new Discord.Collection();

	channelIds.forEach((channelId) => {
		mockChannels.set(channelId, {
			id: channelId,
			send: interceptMessage,
			createWebhook: createMockWebhook
		});
	});

	return mockChannels;
}