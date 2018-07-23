const fs = require('fs');
const get = require('lodash.get');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var private = require('../../private.json');
var config = require('../resources/data/config.json');
var configKeys = Object.keys(config);

function configure(configArgs, message, key, prompt, transformationFunc) {
	const filter = (m) => {
		if (m.author.id === message.author.id) { return m; }
	};

	var promptMsg;
	message.reply(prompt)
		.then((msg) => {
			promptMsg = msg;
		});
    message.channel.awaitMessages(filter, { max: 1, time: 180000, errors: ['time'] })
		.then((collected) => {
			var response = collected.array()[0];

			if (response.content !== 'none') {
				var content = transformationFunc ? transformationFunc(response.content) : response.content;
				config[key] = content;
			}

			response.delete();
			promptMsg.delete();

			if (configArgs.length === 0) {
				message.reply('Dynamic voice channels will change their name to whichever game the majority of connected users are playing.'
					+ ' If you would like to convert voice channels to dynamic, join each and call `.add-dynamic`.');
				message.reply('Setup will be complete when you call `.done`');
				return;
			}

			return configure(configArgs, ...configArgs.pop());
		})
		.catch((collected) => {
			util.logger.info((`After 3 minutes, only ${collected.size} responses.`));
			message.reply('You need to reply.');
		});
}

function isPositiveReponse(text) {
	return ['yes', 'true', 'y', 'on'].includes(text);
}

exports.addDynamicVoiceChannel = function(message) {
	const voiceChannel = message.member.voiceChannel;
	config.GAME_CHANNEL_NAMES[voiceChannel.id] = voiceChannel.name;
	message.reply(`\`${voiceChannel.name}\` is now a dynamic voice channel.`);
}

function createBanRole(message, voiceChannel) {
	voiceChannel = voiceChannel || message.member.voiceChannel;

	bot.getClient().guilds.first().createRole({
		name: `Banned from ${voiceChannel.name}`,
		position: message.guild.roles.array().length - 3,
	})
	.then((role) => {
		config.CHANNEL_ID_TO_BAN_ROLE_ID[voiceChannel.id] = role.id;

		voiceChannel.overwritePermissions(role, {
			CONNECT: false,
			SPEAK: false
		})
		.then(() => console.log('Done!'))
		.catch(console.error);
	})
}

function createBanRoles(message) {
	bot.getClient().channels.forEach((channel) => {
		if (channel.type !== 'voice') { return; }

		createBanRole(message, channel);
	});
}

function createLogChannel(message) {
	const overwrites = [
		{
			allow: ['READ_MESSAGES'],
			id: message.author.id
		},
		{
			deny: ['READ_MESSAGES'],
			id: message.guild.defaultRole.id
		}
	];

	message.guild.createChannel('server-log', 'text', overwrites)
	.then((channel) => {
		config.LOG_CHANNEL_ID = channel.id;
	});
}

exports.createPurgatoryChannel = function(message) {
	return message.guild.createChannel('Solitary Confinement', 'voice')
		.then((channel) => {
			config.PURGATORY_CHANNEL_ID = channel.id;
			return channel;
		});
}

function createTempCategory(message) {
	message.guild.createChannel('Temp Channels', 'category')
	.then((channel) => {
		config.CATEGORY_ID.Temp = channel.id;
	});
}

function createNewMemberInfo(message) {
	message.guild.createChannel('new-member-info', 'text')
		.then((channel) => {
			config.NEW_MEMBER_INFO_CHANNEL_ID = channel.id;
			const afkChannel = bot.getClient().channels.find('id', config.AFK_CHANNEL_ID);
			if (!afkChannel) { return; }

			config.NEW_MEMBER_INFO.replace('Where he at doe?', afkChannel.name);
		});
}

exports.setup = function(message) {
	var configArgs = [
		[message, 'prefix', 'Please choose a command prefix, e.g. `.`'],
		[message, 'enableSoundbytes', 'Enable soundbyte functionality?', isPositiveReponse],
		[message, 'K_ID', `Mention the server admin e.g. ${util.mentionUser(message.author.id)}`, util.getIdFromMention],
		[message, 'BOT_SPAM_CHANNEL_ID', `Mention the text channel where user\'s are allowed to communicate with the bot.`
			+  `I recommend creating a new channel. e.g. ${util.mentionChannel(message.channel.id)}`, util.getIdFromMention],
		[message, 'SCRUBS_CHANNEL_ID', `Mention the main text channel. e.g. ${util.mentionChannel(message.channel.id)}`, util.getIdFromMention],
		[message, 'NEW_MEMBER_CHANNEL_ID', `Mention the text channel that new members can see.`
			+  ` This can be the same as the previous channel.  e.g. ${util.mentionChannel(message.channel.id)}`, util.getIdFromMention],
		[message, 'SCRUBS_ROLE_ID', `Mention the main user role e.g. ${util.mentionRole(message.guild.roles.first().id)}`, util.getIdFromMention],
		[message, 'NEW_MEMBER_ROLE_ID', `Mention the new user role. This can be the same as the previous role. e.g. ${util.mentionRole(message.guild.roles.first().id)}`, util.getIdFromMention],
		[message, 'BEYOND_ROLE_ID', `Mention the elevated user role. Write \`none\` if all roles are equal. e.g. ${util.mentionRole(message.guild.roles.first().id)}`, util.getIdFromMention]
	].reverse();

	private.serverID = message.guild.id;
	//fs.writeFile('../../private.json', JSON.stringify(private), 'utf8', util.log);

	config.AFK_CHANNEL_ID = get(message, 'guild.afkChannel.id');
	config.SCRUB_DADDY_ID = bot.getClient().user.id;

	createLogChannel(message);
	exports.createPurgatoryChannel(message);
	createTempCategory(message);
	createNewMemberInfo(message);
	createBanRoles(message);

	configure(configArgs, ...configArgs.pop())
}

exports.done = function(message) {
	config.IN_SETUP = false;
	util.exportJson(config, 'config');
	message.reply(`Setup will be complete after you restart the bot. You can call \`${config.prefix}restart\` in ${util.mentionChannel(config.BOT_SPAM_CHANNEL_ID)}`);
	message.reply(`You will then be able to call \`${config.prefix}setup-ratings\` in ${util.mentionChannel(config.BOT_SPAM_CHANNEL_ID)} to create the tv and movies ratings channel.`);
}