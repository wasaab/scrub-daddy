var Discord = require('discord.js');
var moment = require('moment');
var get = require('lodash.get');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;
var scheduler = require('../scheduler.js');
var gambling = require('./gambling.js');
var loot = require('../../resources/data/loot.json');
var config = require('../../resources/data/config.json');

/**
 * Updates the lotto countdown for use in playing status.
 */
exports.updateLottoCountdown = function() {
    if (!config.lottoTime || util.isDevEnv()) { return; }

	bot.getClient().user.setPresence({game: {name: `lotto ${getTimeUntilLottoEnd().timeUntil}`}});
};

/**
 * Starts a lottery to enter Beyond role. Activated with a scrub box prize.
 *
 * @param {String} userID id of the user starting to lotto
 * @param {String} monthDay month and day to start lotto on in MM/DD format
 * @param {String} hour hour to start lotto on
 */
exports.startLotto = function(userID, monthDay, hour) {
    if (config.lottoTime) { return; }

    const lottoTime = moment(`${monthDay} ${hour}`, 'MM/DD HH');

    if (!lottoTime.isValid()) { return; }

    config.lottoTime = lottoTime.valueOf();
    util.exportJson(config, 'config');
    outputLottoInfo(userID, true);

    if (!util.isAdmin(userID)) {
        removePrizeFromInventory(userID, 'start-lotto', 3);
    }

    scheduler.scheduleLotto();
};

/**
 * Stops the lottery to enter Beyond role. Activated with a scrub box prize.
 *
 * @param {String} userID id of the user stopping the lotto
 * @param {Number} tierNumber tier of the prize being activated
 * @param {String} cmd command called
 */
exports.stopLotto = function (userID, tierNumber, cmd) {
    delete config.lottoTime;
    util.exportJson(config, 'config');
    util.sendEmbedMessage('Beyond Lotto Stopped',
        `The lottery was stopped by ${util.mentionUser(userID)} with a Scrub Box prize.`);
    removePrizeFromInventory(userID, cmd, tierNumber);
};

/**
 * Enters a user into the beyond role lottery.
 *
 * @param {String} user name of the user joining the lotto
 * @param {String} userID id of the user joining the lotto
 */
exports.joinLotto = function(user, userID) {
    var entries = config.lottoEntries || [];

    if (entries.includes(userID)) {
        checkLotto(userID);
    } else {
        entries.push(userID);
        config.lottoEntries = entries;
        util.exportJson(config, 'config');
        util.sendEmbedMessage(`${user} has entered the Beyond Lotto`,
            `There are now ${entries.length} participants.`, userID);
    }
};

/**
 * Gets the time until the beyond lotto ends.
 */
function getTimeUntilLottoEnd() {
    const endMoment = moment(config.lottoTime);

    return { timeUntil: endMoment.fromNow(), endDate: endMoment.format(c.FULL_DATE_TIME_FORMAT) };
}

/**
 * Notifies the user if no lotto is running or outputs information on the ongoing lotto.
 *
 * @param {String} userID id of the user checking the lotto
 */
function checkLotto(userID) {
    if (!config.lottoTime) {
        util.sendEmbedMessage('Beyond Lotto Information', 'There is no Beyond lotto currently running.', userID);
        return;
    }

    outputLottoInfo(userID);
}

/**
 * Ends the beyond lottery, outputting and promoting the winner.
 */
exports.endLotto = function() {
	if (!config.lottoEntries || config.lottoEntries.length <= 1) { return; }

    const {fakeWinner, winner, winnerID} = getFakeAndRealWinner();
    const winningMsgs = [`...and ${winner} has risen from the filth to become...\nBEYOND!`,
        `Amongst the trashcans, ${winner} has been plucked from obscurity to become...\nBEYOND!`,
        `May your name once again be your own. Welcome to Beyond, ${winner}!`,
        `...and ${fakeWinner} is the winner in our hearts. However, the real winner is ${winner}!`,
        `Today the Gods of RNG have shined their light upon ${winner}!`];

    const winningMsg = winningMsgs[util.getRand(0, winningMsgs.length)];
    util.sendEmbedMessage('The Beyond Lotto Has Concluded', winningMsg, null, c.BEYOND_LOTTO_IMG);
    logger.info(`Beyond lotto winner = ${winner}`);

    const server = bot.getServer();
    const winningUser = server.members.find('id', winnerID);
    winningUser.addRole(server.roles.find('id', c.BEYOND_ROLE_ID));

    delete config.lottoTime;
    delete config.lottoEntries;
};

/**
 * Outputs the current Beyond role lotto info.
 *
 * @param {String} userID id of user requesting lotto info
 * @param {Boolean} isStartMsg true iff this info is to be included in the lotto started message
 */
function outputLottoInfo(userID, isStartMsg) {
    const { timeUntil, endDate } = getTimeUntilLottoEnd();
    const title = isStartMsg ? 'Started' : 'Information';
    var entries = '';

    config.lottoEntries.forEach((userId) => {
        entries += `${util.getNick(userId)}\n`;
    });

    util.sendEmbedMessage(`Beyond Lotto ${title}`, `The lotto will end ${util.formatAsBoldCodeBlock(timeUntil)} on ${endDate} EST\n\n` +
        `**The following ${config.lottoEntries.length} users have entered:**\n${entries}`, userID);
}

/**
 * Determines a fake and a real Beyond role lotto winner.
 */
function getFakeAndRealWinner() {
	var winnerID;
    var fakeWinnerID;

	while (winnerID === fakeWinnerID) {
		winnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
		fakeWinnerID = config.lottoEntries[util.getRand(0, config.lottoEntries.length)];
    }

    return {
        fakeWinner: util.getNick(fakeWinnerID),
        winner: util.getNick(winnerID),
        winnerID: winnerID
    };
}

/**
 * Opens a scrub box.
 *
 * @param {String} userID id of the calling user
 * @param {Number} tierNumber tier of the box to open
 */
exports.scrubBox = function(userID, tierNumber) {
    if (!Number.isInteger(tierNumber) || tierNumber > 3 || tierNumber < 1) { return; }

    const cost = c.TIER_COST[tierNumber - 1];

    if (!gambling.getLedger()[userID] || gambling.getLedger()[userID].armySize < cost) {
        return util.sendEmbedMessage('Insufficient Funds',
            `${util.mentionUser(userID)} You are too poor to afford a tier ${tierNumber} Scrub Box.`, userID);
    }
    gambling.removeFromArmy(userID, cost);

    var { title, prizeDescription, extraInfo } = addRandomPrizeAndGetInfo(tierNumber, userID);

	util.sendEmbedMessage(title, null, userID, 'https://i.imgur.com/mKwsQGi.gif')
	.then((msgSent) => {
		const updatedMsg = new Discord.RichEmbed({
			color: 0xffff00,
			title: title,
			description: `${util.mentionUser(userID)}, the Scrubbing Bubble gods have blessed you with:` +
				`\n\n${prizeDescription}\n\n${extraInfo}.`
		});
		setTimeout(() => {
			msgSent.edit('', updatedMsg);
		}, 6200);
	});
};

/**
 * Adds a random prize to the user's inventory and gets the info.
 *
 * @param {Number} tierNumber tier of the prize
 * @param {String} userID id of the user to give prize to
 */
function addRandomPrizeAndGetInfo(tierNumber, userID) {
    const prizesInTier = c.PRIZE_TIERS[tierNumber - 1];
    const prizes = Object.keys(prizesInTier);
    const prize = prizes[util.getRand(0, prizes.length)];
    const prizeDescription = c.PRIZE_TO_DESCRIPTION[prize].replace('``', `\`${prizesInTier[prize]}\``);
    const title = `Scrubbing Bubble Loot Box - Tier ${tierNumber}`;
    var extraInfo = `Call \`.help ${prize}\` for usage info`;

    if (prize.endsWith('bubbles')) {
        gambling.addToArmy(userID, prizesInTier[prize]);
        extraInfo = gambling.getArmySizeMsg(userID);
    } else {
        addPrizeToInventory(userID, prize, tierNumber);
    }

    return { title, prizeDescription, extraInfo };
}

/**
 * Adds a prize to the user's inventory.
 *
 * @param {String} userID id of the user to give prize to
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function addPrizeToInventory(userID, prize, tierNumber) {
    if (!gambling.getLedger()[userID]) {
        gambling.getLedger()[userID] = Object.assign({}, c.NEW_LEDGER_ENTRY);
    }
    if (!gambling.getLedger()[userID].inventory) {
        gambling.getLedger()[userID].inventory = {};
    }
    if (!gambling.getLedger()[userID].inventory[tierNumber]) {
        gambling.getLedger()[userID].inventory[tierNumber] = {};
    }

    if (!gambling.getLedger()[userID].inventory[tierNumber][prize]) {
        gambling.getLedger()[userID].inventory[tierNumber][prize] = 1;
    } else {
        gambling.getLedger()[userID].inventory[tierNumber][prize]++;
    }

    if (prize === 'add-emoji' && tierNumber === 3) {
        gambling.getLedger()[userID].inventory[tierNumber][prize] += 2;
    }
}

/**
 * Removes a prize from the user's inventory.
 *
 * @param {String} userID id of the user to remove prize from
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function removePrizeFromInventory(userID, prize, tierNumber) {
    const userInventory = gambling.getLedger()[userID].inventory;
    const tierData = userInventory[tierNumber];

    if (tierData[prize] > 1) {
        tierData[prize]--;
    } else {
        delete tierData[prize];
        if (Object.keys(tierData).length === 0) {
            delete userInventory[tierNumber];
        }
    }
}

/**
 * Outputs the inventory of a user.
 *
 * @param {String} userID id of the user to output inventory for
 */
exports.outputInventory = function(userID) {
    if (!gambling.getLedger()[userID] || !gambling.getLedger()[userID].inventory) {
        return util.sendEmbedMessage('No Inventory', `${util.mentionUser(userID)}, all you have is a rock.`, userID);
    }

    const inventory = gambling.getLedger()[userID].inventory;
    var fields = [];
    var results = [];

    for (var tier in inventory) {
        var tierFields = [];
        for (var action in inventory[tier]) {
            tierFields.push(util.buildField(action, inventory[tier][action]));
        }

        if (tierFields.length < 1) { continue; }

        fields = fields.concat(tierFields);
        results.push({
            name: `Tier ${tier}`,
            fields: tierFields
        });
    }

    if (fields.length < 1) { return; }

    fields.sort(util.compareFieldValues);
    const homePage = {
		name: `${util.getNick(userID)}'s Inventory`,
		fields: fields
    };

    util.sendDynamicMessage(userID, 'tier', results, homePage);
};

/**
 * Gets the count of the prize in a user's inventory for a given tier.
 *
 * @param {String} userID id of the user to get prize count of
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function getPrizeCount(userID, prize, tierNumber) {
    return get(gambling.getLedger(), `[${userID}].inventory[${tierNumber}][${prize}]`) || 0;
}

/**
 * Determines if a user has a prize in their inventory.
 *
 * @param {String} userID id of the user to check for prize
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
exports.hasPrize = function(userID, prize, tierNumber) {
    if (isNaN(tierNumber)) { return false; }

    if (0 === getPrizeCount(userID, prize, tierNumber)) {
        util.sendEmbedMessage('Prize not in inventory', `To gain access to the \`${prize}\`` +
            ' command, win it in a Scrub Box.', userID);
        return false;
    }

    return true;
};

/**
 * Resets names if unlock time is reached or the user has attempted
 * to manually rename themself while locked.
 */
exports.maybeResetNames = function() {
    const lockedIdToLockInfo = loot.lockedIdToLockInfo;
    if (lockedIdToLockInfo === {}) { return; }

    const server = bot.getServer();
    var isRenameExpired = false;

    for (var targetID in lockedIdToLockInfo) {
        const lockInfo = lockedIdToLockInfo[targetID];
        const target = server[`${lockInfo.type}s`].find('id', targetID);

        if (!target || moment().isAfter(moment(lockInfo.unlockTime))) {
            if (target) {
                maybeRename(lockInfo.type, target, lockInfo.oldName);
            }

            delete loot.lockedIdToLockInfo[targetID];
            isRenameExpired = true;
            continue;
        }

        const targetName = target.displayName || target.name;

        if (targetName === lockInfo.newName || targetName === lockInfo.newName.split(' ').join('-')) { continue; }

        maybeRename(lockInfo.type, target, lockInfo.newName);
    }

    if (isRenameExpired) {
        util.exportJson(loot, 'loot');
        updateRenamedList();
    }
};

/**
 * Builds the updated renamed message.
 */
function buildUpdatedRenameMsg() {
    const lockIdToInfo = loot.lockedIdToLockInfo;
    var lockedIds = Object.keys(lockIdToInfo);
    var renamesMsg = '';

    if (0 === lockedIds.length) {
        renamesMsg = c.NO_RENAMES_MSG;
    } else {
        lockedIds = lockedIds.sort((a, b) => lockIdToInfo[a].unlockTime - lockIdToInfo[b].unlockTime);

        lockedIds.forEach((lockedId) => {
            const { oldName, newName, unlockTime } = lockIdToInfo[lockedId];
            const formattedEndTime = moment(unlockTime).format(c.MDY_HM_DATE_TIME_FORMAT);

            renamesMsg += `${oldName} = ${newName} \`${formattedEndTime}\`\n`;
        });
    }

    return new Discord.RichEmbed({
        color: 0xffff00,
        title: 'Renaming - End Time',
        description: renamesMsg
    });
}

/**
 * Updates the list of renamed users.
 */
function updateRenamedList() {
    bot.getBotSpam().fetchMessage(c.RENAMED_LIST_MSG_ID)
        .then((message) => {
            message.edit('', buildUpdatedRenameMsg());
        })
        .catch((err) => {
            logger.error(`Edit Renamed List Msg Error: ${err}`);
        });
}

/**
 * Renames a user role or channel.
 *
 * @param {String} type target type (user, role, channel, or hank)
 * @param {String} targetID id of the target
 * @param {String[]} args args passed to the command
 * @param {Number} tierNumber tier of the prize
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 * @param {Object[]} mentions mentions in the message
 */
exports.renameUserRoleOrChannel = function(type, targetID, args, tierNumber, userID, cmd, mentions) {
    const name = util.getTargetFromArgs(args, 3);
    var lockInfo = loot.lockedIdToLockInfo[targetID];

    if (lockInfo) {
        const unlockTime = moment(lockInfo.unlockTime);

        if (moment().isBefore(unlockTime)) {
            return util.sendEmbedMessage('Target Locked', 'You may not rename the target until' +
                ` \`${unlockTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``);
        }
    }

    const formattedType = util.capitalizeFirstLetter(type);
    const mentionType = type === 'hank' ? 'User' : formattedType;
    const group = mentionType === 'User' ? 'member' : mentionType.toLowerCase();
    const target = mentions.id ? mentions : mentions[`${group}s`].values().next().value;
    const oldName = target.displayName || target.name;

    maybeRename(type, target, name)
        .then(() => {
            const { endTime, formattedEndTime } = getPrizeEndTime(tierNumber, `rename-${type}`);

            loot.lockedIdToLockInfo[targetID] = {
                unlockTime: endTime.valueOf(),
                oldName: oldName,
                newName: name,
                type: group,
            };
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.exportJson(loot, 'loot');
            util.sendEmbedMessage(`${formattedType} Renamed`,
                `Thou shalt be called ${util[`mention${mentionType}`](targetID)} until \`${formattedEndTime}\``, userID);
            updateRenamedList();
        })
        .catch((err) => {
            logger.error(`Edit Name Error: ${err}`);
        });
};

/**
 * Adds a user provided emoji to the server.
 *
 * @param {Object} message message sent by user
 * @param {String} name name of the emoji to add
 * @param {Number} tierNumber tier of the prize
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 */
exports.addEmoji = function(message, name, tierNumber, userID, cmd) {
    if (message.attachments.length === 0) { return; }

    const attachment = message.attachments.array()[0];
    name = name || attachment.filename.split('.')[0].toLowerCase();

    message.guild.createEmoji(attachment.url, name)
        .then((emoji) => {
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.sendEmbedMessage('Emoji Added', `${new Array(9).fill(emoji).join('')}`);
        });
};

/**
 * Gets the end time of a prize.
 *
 * @param {Number} tierNumber tier of the prize
 * @param {String} prize name of the prize
 */
function getPrizeEndTime(tierNumber, prize) {
    const timePeriodTokens = c.PRIZE_TIERS[tierNumber - 1][prize].split(' ');
    const endTime = moment().add(timePeriodTokens[0], timePeriodTokens[1]);
    const formattedEndTime = endTime.format(c.MDY_HM_DATE_TIME_FORMAT);

    return { endTime, formattedEndTime };
}

/**
 * Renames a user, role, or channel.
 *
 * @param {String} type target type (user, role, channel, or hank)
 * @param {Object} targetID target of the rename
 * @param {String} name new name
 */
function maybeRename(type, target, name) {
    switch (type) {
        case 'hank':
        case 'member':
        case 'user':
            return target.setNickname(name);
        case 'channel':
            return target.setName(name);
        case 'role':
            return target.edit({ name: name });
    }
}

/**
 * Removes rainbow role if time has expired on the prize.
 */
exports.maybeRemoveRainbowRoleFromUsers = function() {
    const rainbowRoleMemberIdToEndTime = loot.rainbowRoleMemberIdToEndTime;
    const rainbowRole = bot.getServer().roles.find('name', 'rainbow');
    const rainbowRoleMembers = rainbowRole.members.array();

    if (rainbowRoleMembers.length === 0) { return; }

    rainbowRoleMembers.forEach((member) => {
        const endTime = rainbowRoleMemberIdToEndTime[member.id];

        if (!endTime || moment().isAfter(moment(endTime))) {
            delete loot.rainbowRoleMemberIdToEndTime[member.id];
            member.removeRole(rainbowRole);
            util.exportJson(loot, 'loot');
        }
    });

    if (0 !== rainbowRole.members.array().length) { return; }

    logger.info('No users with rainbow role. Clearing color update interval.')
    util.clearRainbowRoleUpdateInterval();
};

/**
 * Adds the rainbow role to a user.
 *
 * @param {String} userID id of the calling user
 * @param {Object} targetUser user to add role to
 * @param {Number} tierNumber tier of the prize
 * @param {String} cmd command called
 */
exports.addRainbowRole = function(userID, targetUser, tierNumber, cmd) {
    const server = bot.getServer();
    var rainbowRole = server.roles.find('name', 'rainbow');

	if (!rainbowRole) {
		server.createRole({
			name: 'rainbow',
			position: server.roles.array().length - 4
		})
		.then((role) => {
			targetUser.addRole(role).then(util.updateRainbowRoleColor);
		});
	} else {
        targetUser.addRole(rainbowRole).then(util.updateRainbowRoleColor);
    }

    if (!loot.rainbowRoleMemberIdToEndTime) {
        loot.rainbowRoleMemberIdToEndTime = {};
    }

    const { endTime, formattedEndTime } = getPrizeEndTime(tierNumber, cmd);

    loot.rainbowRoleMemberIdToEndTime[userID] = endTime.valueOf();
    removePrizeFromInventory(userID, cmd, tierNumber);
    logger.info(`Rainbow role active for ${util.getNick(userID)} until ${formattedEndTime}`);
    util.sendEmbedMessage(`🌈 Rainbow Role Activated`, `${util.mentionUser(userID)} Your role's color` +
        ` will change until ${util.formatAsBoldCodeBlock(formattedEndTime)}!`, userID);
    util.exportJson(loot, 'loot');
};

/**
 * Updates the magic word count in the channel's topic.
 *
 * @param {String} channelID id of the channel to update
 */
function updateChannelTopicWithMagicWordCount(channelID) {
    const magicWords = loot.magicWords[channelID];
    const magicWordCount = magicWords ? Object.keys(magicWords).length : 0;
    const magicWordRegex = new RegExp(/^(:sparkles:|✨) [0-9]+ Magic Words (:sparkles:|✨) /);
    const channel = bot.getServer().channels.find('id', channelID);
    const oldTopic = channel.topic;
    var topic;

    if (magicWordCount === 0) {
        topic = oldTopic.replace(magicWordRegex, '');
    } else {
        topic = magicWordRegex.test(oldTopic) ? oldTopic.replace(/[0-9]+/, magicWordCount) : `✨ ${magicWordCount} Magic Words ✨ ${oldTopic}`;
    }

    channel.setTopic(topic)
        .catch((err) => {
            logger.error(`Edit Channel Topic for Magic Word Error: ${err}`);
        });
}

/**
 * Checks the message for magic words.
 *
 * @param {Object} message message to check
 */
exports.checkForMagicWords = function(message) {
    const channelID = message.channel.id;
    var magicWordsToEndTime = loot.magicWords[channelID];
    if (!magicWordsToEndTime || message.author.bot) { return; }

    const magicWordsPattern = `\\b(${Object.keys(magicWordsToEndTime).join("|")})\\b`;
    const magicWordsRegex = new RegExp(magicWordsPattern, 'gi');
    const magicWordMatches = message.content.match(magicWordsRegex);

    if (!magicWordMatches) { return; }

    var banDays = magicWordMatches.length;
    magicWordMatches.forEach((magicWord) => {
        if (moment().isBefore(moment(magicWordsToEndTime[magicWord]))) { return; }

        if (Object.keys(magicWordsToEndTime).length === 1) {
            delete loot.magicWords[channelID];
        } else {
            delete magicWordsToEndTime[magicWord];
        }

        banDays--;
    });

    util.exportJson(loot, 'loot');
    updateChannelTopicWithMagicWordCount(channelID);

    if (banDays === 0) { return; }

    logger.info(`Banning ${util.getNick(message.author.id)}`
        + ` for saying the magic words "${magicWordMatches}" in ${util.mentionChannel(channelID)}`);
    util.banSpammer(message.author, message.channel, banDays, true);
};

/**
 * Adds a magic word, that when typed by a user will temporarily ban them from the channel.
 *
 * @param {String} word the magic word
 * @param {Number} tierNumber tier of the prize
 * @param {String} channelID id of the channel to add the magic word to
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 */
exports.addMagicWord = function(word, tierNumber, channelID, userID, cmd) {
    const minLength = tierNumber + 2;

    // word must meet min length req for tier
    if (word.length < minLength) {
        return util.sendEmbedMessage('Insufficient Word Length',
            `Word must be at least ${minLength} letters for tier ${tierNumber}.`);
    }

    if (!loot.magicWords[channelID]) {
        loot.magicWords[channelID] = {};
    }

    const banDays = c.PRIZE_TIERS[tierNumber - 1][cmd].replace(/\D/g,'');
    const magicWordEndTime = moment().add(banDays, 'days');

    loot.magicWords[channelID][word] = magicWordEndTime.valueOf();
    updateChannelTopicWithMagicWordCount(channelID);

    const magicWordCount = Object.keys(magicWordEndTime).length;
    const totalWordsMsg = magicWordEndTime ? `. There are now ${magicWordCount} magic words for this channel.` : '';
    const endTimeMsg = `magic word is in effect until \`${magicWordEndTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``;

    util.sendEmbedMessage('Magic Word Set', `A new ${endTimeMsg}${totalWordsMsg}`, userID, null, null, null, channelID);
    util.getMembers().find('id', userID).createDM()
        .then((dm) => {
            dm.send(`When a user types \`${word}\` in ${util.mentionChannel(channelID)}, `
            + `they will receive a one day ban. The ${endTimeMsg}`);
        });
    removePrizeFromInventory(userID, cmd, tierNumber);
    util.exportJson(loot, 'loot');
};

/**
 * Drops a rock image in chat.
 *
 * @param {String} userID id of the calling user
 */
exports.rock = function(userID) {
    util.sendEmbedMessage(null, null, userID, c.ROCK_IMG);
    gambling.maybeCreateLedgerEntry(userID);

    const userEntry = gambling.getLedger()[userID];

    userEntry.rocksDropped = userEntry.rocksDropped ? userEntry.rocksDropped + 1 : 1;
};

//Todo: use this for annoy
/**
 * Has a chance of joining a random channel and playing a soundbyte.
 */
exports.maybeJoinRandomChannelAndPlaySoundbyte = function() {
	if (util.getRand(1, 21) > 13) {
		const soundByteChoices = ['tryagainlater', 'cmdnotrecognized', 'repeatthat', 'betconfirmed'];
		const voiceChannels = bot.getServer().channels.filterArray(
			(channel) => channel.type === 'voice' && channel.members.size !== 0);
		const chosenChannel = voiceChannels[util.getRand(0, voiceChannels.length)];
		const chosenSoundByte = soundByteChoices[util.getRand(0, soundByteChoices.length)];
		const chosenUserID = chosenChannel.members.first().id;

		if (chosenSoundByte === 'betconfimed') {
			gambling.betClean(chosenUserID, util.getRand(1, 11));
        }

        chosenChannel.join()
            .then((connection) => {
                setTimeout(() => {
                    util.playSoundByte(chosenChannel, chosenSoundByte, chosenUserID, connection);
                }, util.getRand(2000, 9000));
            });
	}
};