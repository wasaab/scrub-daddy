var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var config = require('../resources/data/config.json');
var configKeys = Object.keys(config);

function configure(message, key, prompt, transformationFunc) {
    message.reply(prompt)

    bot.getBotSpam().awaitMessages(filter, { max: 1, time: 30000, errors: ['time'] })
	.then((collected) => {
		var response = collected.array()[0];
		var content = transformationFunc ? transformationFunc(response.conent) : response.content;
		config[key] = content;
		response.delete();
	})
	.catch((collected) => {
		c.LOG.info((`After 30 seconds, only ${collected.size} responses.`));
        message.reply('You need to reply.');
	});
}

function isPositiveReponse(text) {
	return ['yes', 'true', 'y', 'on'].includes(text);
}

// call .add-dynamic from within each VC you want to make dynamic.
function addDynamicVoiceChannel(message) {
	const voiceChannel = message.member.voiceChannel;
	config.GAME_CHANNEL_NAMES[voiceChannel.id] = voiceChannel.name;
	message.reply(`\`${voiceChannel.name}\` is now a dynamic voice channel.`);
}

// call .add-ban from within each VC you want to allow banning in
function createBanRole(message) {
	const voiceChannel = message.member.voiceChannel;

	message.guild.createRole({
		name: `Banned from ${voiceChannel.name}`,
		position: guild.roles.array().length - 3,
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

function createLogChannel(message) {
	const overwrites = [
		{
			allow: ['READ_MESSAGES'],
			id: message.author.id
		},
		{
			deny: ['READ_MESSAGES'],
			id: guild.defaultRole.id
		}
	];
	message.guild.createChannel('server-log', 'text', overwrites)
	.then((channel) => {
		config.LOG_CHANNEL_ID = channel.id;
	});
}

function createPurgatoryChannel(message) {
	message.guild.createChannel('Solitary Confinement', 'voice')
	.then((channel) => {
		config.PURGATORY_CHANNEL_ID = channel.id;
	});
}

function setup(message) {
	configure(message, 'prefix', 'Please choose a command prefix, e.g. `.`');
	configure(message, 'enableSoundbytes', isPositiveReponse);
	configure(message, 'BOT_SPAM_CHANNEL_ID',
		'Mention the text channel where user\'s are allowed to communicate with the bot. I recommend creating a new channel.'
		, util.getIdFromMention);
	configure(message, 'SCRUBS_CHANNEL_ID', 'Mention the main text channel.', util.getIdFromMention);
	configure(message, 'PLEBS_CHANNEL_ID', 'Mention the text channel that new members can see.', util.getIdFromMention);
	configure(message, 'SCRUBS_ROLE_ID', 'Mention the main user role', util.getIdFromMention);
	configure(message, 'BEYOND_ROLE_ID', 'Mention the elevated user role', util.getIdFromMention);
	configure(message, 'PLEB_ROLE_ID', 'Mention the new user role', util.getIdFromMention);
	config.AFK_CHANNEL_ID = message.guild.afkChannel.id;
	config.SCRUB_DADDY_ID = client.user.id;

	createLogChannel(message);
	createPurgatoryChannel(message);
}