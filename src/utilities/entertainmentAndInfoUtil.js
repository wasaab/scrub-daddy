var Discord = require('discord.js');
var rp = require('request-promise');
var fs = require('fs');
var path = require('path');
var inspect = require('util-inspect');
const { spawnSync } = require('child_process');
const { jsdom } = require('jsdom');

const { logger } = require('../logger.js');
var bot = require('../bot.js');
var c = require('../const.js');
const cmdHandler = require('../handlers/cmdHandler.js');

const { exportJson, getRand, getMembers, getNick, mentionRole } = require('./baseUtil.js');
const { sendDynamicMessage, sendEmbedMessage, sendEmbedMessageToChannel, getUserIDToColor, sendAuthoredMessage } = require('./messagingUtil.js');

var config = require('../../resources/data/config.json');
var catFacts = require('../../resources/data/catfacts.json');
var userIDToSBUsage = require('../../resources/data/userSBUsage.json');
var soundBiteToVolume = require('../../resources/data/soundbites.json');
var soundBites = Object.keys(soundBiteToVolume).sort();

/**
 * Outputs help dialog to explain command usage.
 */
function help(userID) {
	const homePage = {
		name: '`📖 Help Categories`',
		fields: c.HELP_CATEGORIES_PROMPT
	};

	sendDynamicMessage(userID, 'category', c.HELP_CATEGORIES, homePage);
}

/**
 * Outputs the help message for the provided command.
 *
 * @param {String} cmd - the command to get help for
 * @param {String} userID - the userID requesting help
 */
function outputHelpForCommand(cmd, userID) {
	if (!cmd) { return; }

	c.HELP_CATEGORIES.forEach((category) => {
		category.fields.forEach((command) => {
			if (command.name.substring(1).startsWith(cmd)) {
				sendEmbedMessage(command.name, command.value, userID);
			}
		});
	});
}

/**
 * Outputs help for the provided command or all commands if none specified.
 *
 * @param {Object} message	message that called the help command
 * @param {String[]} args	the arguments passed by the user
 */
function outputHelpForOneOrAllCommands(message, args) {
	const commandName = args[1];

    if (commandName) {
        outputHelpForCommand(cmdHandler.findClosestCommandMatch(commandName), message.member.id);
    } else {
        help(message.member.id);
    }

    message.delete();
}

/**
 * Shows any tip that includes the provided keyword in its title.
 *
 * @param {Object} message	message that called the tips command
 * @param {String[]} args	the arguments passed by the user
 */
function showTips(message, args) {
	const keyword = args[1];
	const matchingTips = c.TIPS.filter((tip) => tip.title.toLowerCase().includes(keyword));
	const outputTips = matchingTips.length === 0 ? c.TIPS : matchingTips;

	outputTips.forEach((tip) => {
		tip.color = getUserIDToColor()[message.member.id] || tip.color;
		bot.getBotSpam().send(new Discord.RichEmbed(tip));
	});
}

/**
 * Gets a random cat fact.
 */
function getRandomCatFact() {
	const factIdx = getRand(0, catFacts.facts.length);

	return `${catFacts.facts[factIdx]}\n 🐈 Meeeeee-WOW!`;
}

/**
 * Outputs a cat fact.
 *
 * @param {Object} message	message that called the catfact command
 */
function outputCatFact(message) {
	sendEmbedMessage('Did you know?', getRandomCatFact(), message.member.id);
	message.delete();
}

/**
 * Messages a fact to all Cat Facts subscribers.
 */
function messageCatFactsSubscribers() {
	catFacts.subscribers.forEach((userID, i) => {
		const user = getMembers().find('id', userID);

		if (!user) {
			catFacts.subscribers.splice(i, 1);
			exportJson(catFacts, 'catfacts');
			return;
		}

		user.createDM()
			.then((dm) => {
				dm.send(`Thanks for being a loyal subscriber to Cat Facts!\nDid you know?\n${getRandomCatFact()}`);
			});
	});
}

/**
 * Gets a random billionaire fact.
 */
function getRandomBillionaireFact() {
	const billionaireFact = getRandomCatFact()
		.split('\n')[0] // remove cat related ending
		.replace(/cat|kitten/g, 'billionaire')
		.replace(/Cat|Kitten/g, 'Billionaire');

	return `${mentionRole(c.BILLIONAIRE_ROLE_ID)}, ${billionaireFact}\n\n 💰 ***ka-ching!***`;
}

/**
 * Outputs a cat fact.
 */
function outputBillionaireFact() {
	sendEmbedMessageToChannel('Did you know?', getRandomBillionaireFact(), c.BILLIONAIRE_CHANNEL_ID);
}

/**
 * Outputs the provided list of sound bytes.
 *
 * @param {String[]} sbNames - sound byte names to output
 * @param {String} title -  title for message
 * @param {String} userID - id of the user who's favorites are to be displayed
 */
function outputSoundBitesList(sbNames, title, userID) {
	var list = '';

	sbNames.forEach((sound) => {
		list += `\`${sound}\`	`;
	});

	sendEmbedMessage(`🎶 ${title} Sound Bytes`, list, userID);
}

/**
 * Outputs the user's most frequently used sound bytes.
 *
 * @param {Object} message	message that called the fav soundbite command
 */
function outputFavoriteSoundBites(message) {
	const userID = message.member.id;
	const sbUsage = userIDToSBUsage[userID];

	if (!sbUsage) {
		sendEmbedMessage('You have no soundbite history', '...What did you expect?', userID);
		return;
	}

	var sortedSBUsage = Object.keys(sbUsage).sort((a, b) => -(sbUsage[a] - sbUsage[b]));
	outputSoundBitesList(sortedSBUsage, `${getNick(userID)}'s Favorite`, userID);
}

/**
 * Plays the target soundbite in the command initiator's voice channel.
 *
 * @param {Object} message	message that called the play soundbite command
 * @param {String[]} args	the arguments passed by the user
 */
function playSoundBite(message, args) {
	function playSound(connection) {
		const filePath = process.platform.startsWith('win')
			? `./resources/audio/${targetSoundbite}.mp3`
			: path.join(__dirname, '../../resources', 'audio', `${targetSoundbite}.mp3`);
		// const stream = fs.createReadStream(filePath);

		connection.once('ready', () => {
			const dispatcher = connection.playFile(filePath);

			dispatcher.on('error', (err) => {
				logger.error(`Unable to play soundbite: ${err}`);
			});

			setTimeout(() => {
				logger.info(`Soundbite - ${targetSoundbite} playing at ${dispatcher.volumeDecibels} decibels`);
			}, 1000);

			dispatcher.setVolumeDecibels(c.VOLUME_TO_DB[soundBiteToVolume[targetSoundbite] - 1]);
			dispatcher.on('end', () => {
				channel.leave();
			});
		});
	}

	const channel = message.member.voiceChannel;
	const userID = message.member.id;
	const targetSoundbite = args[1];

	// if (voiceConnection) { return playSound(voiceConnection); } //Todo: voiceConnection was a param of playSound in prior (working) version. remove or use.
	if (!targetSoundbite) { return outputSoundBitesList(soundBites, 'Available', userID); }
	if (!soundBites.includes(targetSoundbite)) { return; }

	channel.join()
		.then((connection) => {
			playSound(connection);
		})
		.catch((err) => {
			logger.error(`Error playing soundbite: ${inspect(err)}`);
		});

	var sbUsage = userIDToSBUsage[userID];

	if (!sbUsage) {
		sbUsage = {};
	}

	if (sbUsage[targetSoundbite]) {
		sbUsage[targetSoundbite]++;
	} else {
		sbUsage[targetSoundbite] = 1;
	}

	userIDToSBUsage[userID] = sbUsage;
}

/**
 * Adds the attached soundbite iff the attachment exists and is an mp3 file.
 *
 * @param {Object} message	message that called the add soundbite command
 */
function maybeAddSoundBite(message) {
	if (message.attachments.length === 0) { return; }

	const userID = message.member.id;
	const file = message.attachments.array()[0];
	const nameData = file.filename.split('.');
	const fileName = nameData[0].toLowerCase();
	const ext = nameData[1];

	if (ext !== 'mp3') {
		return sendEmbedMessage(
			'🎶 Invalid File',
			`You must attach a .mp3 file with the description set to \`${config.prefix}add-sb\``,
			userID
		);
	}

	const options = {
		url: file.url,
		encoding: null
	};

	rp(options)
		.then((mp3File) => {
			fs.writeFileSync(`./resources/audio/${file.filename.toLowerCase()}`, mp3File);
			sendEmbedMessage(
				'🎶 Sound Byte Successfully Added',
				`You may now hear the sound byte by calling \`${config.prefix}sb ${fileName}\` from within a voice channel.`,
				userID
			);
			soundBiteToVolume[fileName] = 10;
			updateSoundBiteToVolume();
		})
		.catch((err) => {
			sendEmbedMessage(
				'🎶 File Cannot Be Downloaded',
				'There was an issue downloading the file provided. It may be too large.',
				userID
			);
			logger.error(`Download Soundbite Error: ${err}`);
		});
}

function updateSoundBiteToVolume() {
	soundBites = Object.keys(soundBiteToVolume).sort();
	exportJson(soundBiteToVolume, 'soundbites');
}

/**
 * Updates the volume for the provided sound byte.
 *
 * @param {Object} message	message that called the set volume command
 * @param {String[]} args	the arguments passed by the user
 */
function setVolume(message, args) {
	if (args.length !== 3 || isNaN(args[2])) { return; }

	const userID = message.member.id;
	const userName = getNick(userID);
	const soundBite = args[1];
	const volume = Number(args[2]);

	if (!soundBites.includes(soundBite)) {
		return sendEmbedMessage(
			`The provided soundbite "${soundBite}" does not exist.`,
			'Call `*sb` to see the full list of sound bytes.',
			userID
		);
	}

	if (volume < 0 || volume > 10) {
		return sendEmbedMessage(
			'Invalid Volume Selection',
			`The volume must be 1-10. ${volume} is not a valid selection.`,
			userID
		);
	}

	const oldVolume = soundBiteToVolume[soundBite];
	var msg;

	soundBiteToVolume[soundBite] = volume;

	if (volume > oldVolume) {
		msg = `It is now set to **${volume}**(+${volume - oldVolume}), because it wasn't loud enough for ${userName}.`;
		updateSoundBiteToVolume();
	} else if (volume < oldVolume) {
		msg = `It is now set to **${volume}**(${volume - oldVolume}), because it hurt ${userName}'s little ears.`;
		updateSoundBiteToVolume();
	} else {
		msg = `jk, ${userName} didn't know it was already set to ${volume}.`;
	}

	sendEmbedMessage(`Volume for ${soundBite} has been updated!`, msg, userID);
}

/**
 * Posts a twitter video if status url with video is found in message.
 *
 * @param {Object} message message to check for twitter media link
 */
function maybePostTwitterMedia(message) {
	const twitterStatusUrl = message.content.match(c.TWITTER_STATUS_URL_PATTERN)?.[0];

	if (!twitterStatusUrl) { return; }

	const reqOptions = {
		method: 'POST',
		url: 'https://www.savetweetvid.com/downloader',
		formData: {
			url: twitterStatusUrl
		}
	};

	rp(reqOptions)
		.then((resultHtml) => {
			const videoUrl = jsdom(resultHtml)?.querySelector('tbody a')?.href;

			if (!videoUrl) { return; }

			sendAuthoredMessage(`[](${videoUrl})`, message.member.id, message.channel.id);
		})
		.catch((err) => {
			logger.error(`Unable to load twitter downloader: ${err}`);
		});
}

/**
 * Determines if the provided error represents media not found at the requested endpoint.
 *
 * @param {Object} error the error returned by reddit
 * @param {Number} error.statusCode the status code of the response
 * @returns {Boolean} true iff forbidden status code found
 */
function isMediaNotFoundError({ statusCode }) {
	return statusCode === 403;
}

/**
 * Finds the highest quality video available for the provided video url.
 *
 * @param {String} videoUrl url of the reddit video
 * @param {Number[]} lowerQualities the lower video qualities to try as fallbacks
 *
 * @returns {Object} the highest quality video url and buffer
 */
function findHighestQualityVideo(videoUrl, lowerQualities = [240, 360, 480]) {
	return rp(videoUrl, { encoding: null })
		.then((buffer) => ({
			url: videoUrl,
			buffer
		}))
		.catch((err) => {
			if (lowerQualities.length === 0) {
				if (!videoUrl.endsWith('.mp4')) { return; }

				return findHighestQualityVideo(videoUrl.replace(/_.*/, '_720'));
			}

			if (isMediaNotFoundError(err)) {
				const nextBestQualityUrl = videoUrl.replace(/_([0-9]{3})/, `_${lowerQualities.pop()}`);

				return findHighestQualityVideo(nextBestQualityUrl, lowerQualities);
			}

			logger.error('Unable to load reddit video:', err);
		});
}

function convertCommentsUrlToEmbedUrl(commentsUrl) {
	return `${commentsUrl.replace(/((www|old)\.)?reddit/, 'www.redditmedia')}?embed=true`;
}

async function determineVideoEmbedUrl(videoUrl) {
	const postId = videoUrl.match(/\/(\w+)\//)[1];
	const commentsRedirectUrl = `https://www.reddit.com/video/${postId}`;
	const reqOptions = {
		uri: commentsRedirectUrl,
		simple: false,
		followRedirect: false,
		resolveWithFullResponse: true
	};

	try {
		const { headers } = await rp(reqOptions);

		return headers.location ? convertCommentsUrlToEmbedUrl(headers.location) : commentsRedirectUrl;
	} catch (err) {
		logger.error('Unable to determine reddit comments url: ', err);

		return commentsRedirectUrl;
	}
}

async function sendMutedVideoWithLinkToEmbed(video, embedUrl, message) {
	if (!video.silent && !embedUrl) {
		embedUrl = await determineVideoEmbedUrl(video.url);
	}

	const errorMsg = video.silent ? '' : `Too large to embed. [Click here](${embedUrl}) for sound.\n`;

	sendAuthoredMessage(`🔇 ${errorMsg}[](${video.url})`, message.member.id, message.channel.id);
}

/**
 * Posts a reddit video to the same channel message with url was sent in.
 *
 * @param {Object} video the video to send
 * @param {String} videoName name of the video
 * @param {Object} message message sent containing the video url
 * @param {String=} filePath path to the video file if not sending via buffer
 * @param {String} embedUrl video embed url
 */
async function sendVideo(video, videoName, message, filePath, embedUrl) {
	const file = {
		attachment: filePath ?? video.buffer,
		name: videoName
	};
	const soundIcon = video.silent ? '🔇' : '';
	const err = await sendAuthoredMessage(soundIcon, message.member.id, message.channel.id, file);

	if (err?.message === 'Request entity too large') {
		sendMutedVideoWithLinkToEmbed(video, embedUrl, message);
	}
}

/**
 * Posts a silent reddit video to the same channel message with url was sent in.
 *
 * @param {String} videoUrl url of the video
 * @param {String} videoName name of the video
 * @param {Object} message message sent containing the video url
 */
async function sendSilentVideo(videoUrl, videoName, message) {
	const video = await findHighestQualityVideo(videoUrl);

	if (!video) { return; }

	if (video.url.endsWith('.mp4')) {
		sendAuthoredMessage(`🔇 [](${video.url})`, message.member.id, message.channel.id);
	} else { // some reddit media urls lack an ext so discord won't treat the link as an embedded video
		video.silent = true;
		sendVideo(video, videoName, message);
	}
}

/**
 * Posts a reddit video to the same channel message with url was sent in.
 *
 * @param {String} videoUrl url of the reddit video
 * @param {String} postId id of the reddit post with the video
 * @param {String} videoName name of the video
 * @param {Object} message message sent containing the video url
 * @param {String} embedUrl video embed url
 */
function postRedditVideo(videoUrl, postId, videoName, message, embedUrl) {
	rp(videoUrl.replace('_720', '_audio'), { encoding: null })
		.then(async (audio) => {
			const videoDirPath = './resources/videos/';
			const audioFilePath = `${videoDirPath}${postId}_audio.mp4`;

			fs.writeFileSync(audioFilePath, audio);

			const video = await findHighestQualityVideo(videoUrl);

			if (!video) { return; }

			const videoFilePath = `${videoDirPath}${postId}_video.mp4`;

			fs.writeFileSync(videoFilePath, video.buffer);

			const mergedFilePath = `${videoDirPath}${postId}.mp4`;

			spawnSync('ffmpeg', ['-i', videoFilePath, '-i', audioFilePath, '-vcodec', 'copy', '-acodec', 'copy', mergedFilePath]);

			await sendVideo(video, videoName, message, mergedFilePath, embedUrl);

			fs.unlinkSync(audioFilePath);
			fs.unlinkSync(videoFilePath);
			fs.unlinkSync(mergedFilePath);
		})
		.catch((err) => {
			if (!isMediaNotFoundError(err)) {
				logger.error('Unable to load reddit audio:', err);
			}

			sendSilentVideo(videoUrl, videoName, message);
		});
}

/**
 * Posts a reddit gif to the same channel message with url was sent in.
 *
 * @param {String} gifUrl url of the gif
 * @param {Object} message message sent containing the gif url
 */
function postRedditGif(gifUrl, message) {
	rp(gifUrl, { encoding: null })
		.then(async (video) => {
			const file = {
				attachment: video,
				name: 'i.redd.it.mp4'
			};

			await sendAuthoredMessage('🔇', message.member.id, message.channel.id, file);
		})
		.catch((err) => {
			if (isMediaNotFoundError(err)) { return; }

			logger.error('Unable to load reddit gif:', err);
		});
}

/**
 * Finds the image url from a reddit media embed page.
 *
 * @param {Object} document DOM of reddit media embed page
 *
 * @returns {String} the image url if found
 */
function findImageUrl(document) {
	return document.querySelector('.media-preview-content a')
		?.getAttribute('href');
}

/**
 * Finds the gif url from a reddit media embed page.
 *
 * @param {Object} document DOM of reddit media embed page
 *
 * @returns {String} the gif url if found
 */
function findGifUrl(document) {
	return document.querySelector('video source')
		?.getAttribute('src');
}

/**
 * Finds the video url from a reddit media embed page.
 *
 * @param {Object} document DOM of reddit media embed page
 *
 * @returns {String} the video url if found
 */
function findVideoUrl(document) {
	return document.querySelector('div[data-seek-preview-url]')
		?.getAttribute('data-seek-preview-url')
		?.replace(/_[0-9]+/, '_720');
}

/**
 * Posts gif or video from a reddit post's comments url.
 *
 * @param {String} commentsUrl url of the post's comments
 * @param {Object} message message that contained the url
 */
function postRedditMediaFromComments(commentsUrl, message) {
	const videoEmbedUrl = convertCommentsUrlToEmbedUrl(commentsUrl);

	rp(videoEmbedUrl)
		.then((resultHtml) => {
			const document = jsdom(resultHtml);
			const videoUrl = findVideoUrl(document);

			if (videoUrl) {
				const videoName = `${videoEmbedUrl.split('/')[7]}.mp4`;

				postRedditVideo(videoUrl, videoUrl.split('/')[3], videoName, message, videoEmbedUrl);
				return;
			}

			const gifUrl = findGifUrl(document);

			if (gifUrl) {
				postRedditGif(gifUrl, message);
				return;
			}

			const imgUrl = findImageUrl(document);

			if (!imgUrl) { return; }

			sendAuthoredMessage(`[](${imgUrl})`, message.member.id, message.channel.id);
		})
		.catch((err) => {
			logger.error('Unable to load embedded reddit video:', err);
		});
}

/**
 * Posts reddit gif or video if reddit media url is found in message.
 * Accepts links to gif, video, or comments, in all possible formats.
 *
 * This is to overcome the way reddit hosts video and images, which does
 * not allow embedding in Discord.
 *
 * @param {Object} message message to check for reddit media link
 */
function maybePostRedditMedia(message) {
	const videoUrlMatches = message.content.match(c.REDDIT_URL_PATTERN.video);

	if (videoUrlMatches) {
		postRedditVideo(`${videoUrlMatches[0]}/DASH_720.mp4`, videoUrlMatches[1], 'v.redd.it.mp4', message);
		return;
	}

	const gifUrlMatches = message.content.match(c.REDDIT_URL_PATTERN.gif);

	if (gifUrlMatches) {
		postRedditGif(gifUrlMatches[0], message);
		return;
	}

	const commentUrlMatches = message.content.match(c.REDDIT_URL_PATTERN.comments);

	if (!commentUrlMatches) { return; }

	postRedditMediaFromComments(commentUrlMatches[0], message);
}

/**
 * Posts reddit/twitter video or gif if media url is found in message.
 *
 * @param {Object} message message to check for media link
 */
function maybePostExternalMedia(message) {
	if (message.author.bot) { return; }

	if (message.content.includes('twitter')) {
		maybePostTwitterMedia(message);
	} else {
		maybePostRedditMedia(message);
	}
}

exports.maybePostExternalMedia = maybePostExternalMedia;
exports.messageCatFactsSubscribers = messageCatFactsSubscribers;
exports.outputBillionaireFact = outputBillionaireFact;
exports.outputHelpForCommand = outputHelpForCommand;
exports.playSoundBite = playSoundBite;
exports.registerCommandHandlers = () => {
	cmdHandler.registerCommandHandler('catfacts', outputCatFact);
	cmdHandler.registerCommandHandler('help', outputHelpForOneOrAllCommands);
	cmdHandler.registerCommandHandler('h', outputHelpForOneOrAllCommands);
	cmdHandler.registerCommandHandler('tips', showTips);

	if (config.soundBitesEnabled) {
		cmdHandler.registerCommandHandler('sb', playSoundBite);
		cmdHandler.registerCommandHandler('add-sb', maybeAddSoundBite);
		cmdHandler.registerCommandHandler('sb-add', maybeAddSoundBite);
		cmdHandler.registerCommandHandler('fav-sb', outputFavoriteSoundBites);
		cmdHandler.registerCommandHandler('volume', setVolume);
	}
};