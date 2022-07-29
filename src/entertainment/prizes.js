var Discord = require('discord.js');
var moment = require('moment');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
const { logger } = require('../logger.js');
var scheduler = require('../scheduler.js');
var gambling = require('./gambling.js');
var loot = require('../../resources/data/loot.json');
var config = require('../../resources/data/config.json');
const cmdHandler = require('../handlers/cmdHandler.js');

/**
 * Updates the lotto countdown for use in playing status.
 */
exports.updateLottoCountdown = function() {
    if (!config.lottoTime || util.isDevEnv()) { return; }

	bot.getClient()
        .user
        .setPresence({ game: { name: `lotto ${getTimeUntilLottoEnd().timeUntil}` } });
};

/**
 * Starts a lottery to enter Beyond role. Activated with a scrub box prize.
 *
 * @param {String} userID id of the user starting to lotto
 * @param {String} monthDay month and day to start lotto on in MM/DD format
 * @param {String} hour hour to start lotto on
 */
function startLotto(userID, monthDay, hour) {
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
}

/**
 * Stops the lottery to enter Beyond role. Activated with a scrub box prize.
 *
 * @param {String} userID id of the user stopping the lotto
 * @param {Number} tierNumber tier of the prize being activated
 * @param {String} cmd command called
 */
function stopLotto(userID, tierNumber, cmd) {
    delete config.lottoTime;
    util.exportJson(config, 'config');
    util.sendEmbedMessage(
        'Beyond Lotto Stopped',
        `The lottery was stopped by ${util.mentionUser(userID)} with a Scrub Box prize.`
    );
    removePrizeFromInventory(userID, cmd, tierNumber);
}

/**
 * Enters a user into the beyond role lottery.
 *
 * @param {String} user name of the user joining the lotto
 * @param {String} userID id of the user joining the lotto
 */
function joinLotto(user, userID) {
    const entries = config.lottoEntries || [];

    if (entries.includes(userID)) {
        checkLotto(userID);
    } else {
        entries.push(userID);
        config.lottoEntries = entries;
        util.exportJson(config, 'config');
        util.sendEmbedMessage(
            `${user} has entered the Beyond Lotto`,
            `There are now ${entries.length} participants.`,
            userID
        );
    }
}

/**
 * Gets the time until the beyond lotto ends.
 */
function getTimeUntilLottoEnd() {
    const endMoment = moment(config.lottoTime);

    return {
        timeUntil: endMoment.fromNow(),
        endDate: endMoment.format(c.FULL_DATE_TIME_FORMAT)
    };
}

/**
 * Notifies the user if no lotto is running or outputs information on the ongoing lotto.
 *
 * @param {String} userID id of the user checking the lotto
 */
function checkLotto(userID) {
    if (!config.lottoTime) {
        util.sendEmbedMessage(
            'Beyond Lotto Information',
            'There is no Beyond lotto currently running.',
            userID
        );
        return;
    }

    outputLottoInfo(userID);
}

/**
 * Ends the beyond lottery, outputting and promoting the winner.
 */
exports.endLotto = function() {
	if (!config.lottoEntries || config.lottoEntries.length <= 1) { return; }

    const { fakeWinner, winner, winnerID } = getFakeAndRealWinner();
    const winningMsgs = [`...and ${winner} has risen from the filth to become...\nBEYOND!`,
        `Amongst the trashcans, ${winner} has been plucked from obscurity to become...\nBEYOND!`,
        `May your name once again be your own. Welcome to Beyond, ${winner}!`,
        `...and ${fakeWinner} is the winner in our hearts. However, the real winner is ${winner}!`,
        `Today the Gods of RNG have shined their light upon ${winner}!`];
    const winningMsg = winningMsgs[util.getRand(0, winningMsgs.length)];

    util.sendEmbed({
        title: 'The Beyond Lotto Has Concluded',
        description: winningMsg,
        image: c.BEYOND_LOTTO_IMG
    });
    logger.info(`Beyond lotto winner = ${winner}`);

    const server = bot.getServer();
    const winningUser = server.members.find('id', winnerID);
    winningUser.addRole(server.roles.find('id', c.BEYOND_ROLE_ID));

    delete config.lottoTime;
    delete config.lottoEntries;
    util.exportJson(config, 'config');
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

    const description = `The lotto will end ${util.formatAsBoldCodeBlock(timeUntil)} on ${endDate} EST\n\n` +
        `**The following ${config.lottoEntries.length} users have entered:**\n${entries}`;

    util.sendEmbedMessage(`Beyond Lotto ${title}`, description, userID);
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
 * Generates and opens a scrub box.
 *
 * @param {String} userID id of the calling user
 * @param {Number} tierNumber tier of the box to open
 */
function scrubBox(userID, tierNumber, numBoxes = 1) {
    if (!util.isIntegerInBounds(tierNumber, 1, c.PRIZE_TIERS.length) || !Number.isInteger(Number(numBoxes))) { return; }

    const cost = c.TIER_COST[tierNumber - 1] * numBoxes;

    if (!gambling.getLedger()[userID] || gambling.getLedger()[userID].armySize < cost) {
        const description = `${util.mentionUser(userID)} You are too poor to afford ${numBoxes > 1 ? numBoxes : 'a'} `
            + `tier ${tierNumber} Scrub ${util.maybeGetPlural(numBoxes, 'Box')}.`;

        return util.sendEmbedMessage('Insufficient Funds', description, userID);
    }

    gambling.removeFromArmy(userID, cost);

    var { title, prizeDescMsg, armySizeMsg } = addAllPrizesAndGetInfo(numBoxes, tierNumber, userID);

    openScrubBox(title, prizeDescMsg, armySizeMsg, userID);
}

/**
 * Adds the provided number of scrub box prizes to the users inventory
 * and gets the prize info.
 *
 * @param {Number} numBoxes number of boxes to open
 * @param {Number} tierNumber tier of the box to open
 * @param {String} userID id of the calling user
 */
function addAllPrizesAndGetInfo(numBoxes, tierNumber, userID) {
    const prizeToInfo = populatePrizeToInfo(numBoxes, tierNumber, userID);

    const prizes = Object.keys(prizeToInfo);
    var prizeDescMsg = '';
    var armySizeMsg = '';
    var title = numBoxes > 1 ? `${numBoxes} ` : '';

    title += `Scrubbing Bubble Loot ${util.maybeGetPlural(numBoxes, 'Box')} - Tier ${tierNumber}`;
    prizes.sort((a, b) => prizeToInfo[b].count - prizeToInfo[a].count);
    prizes.forEach((prize, i) => {
        const prizeInfo = prizeToInfo[prize];
        const multiplier = prizeInfo.count > 1 ? `${prizeInfo.count}× ` : '';

        prizeDescMsg += prizes.length > 1 ? `**${i + 1}.**  ${multiplier}${prizeInfo.desc}\n\n` : `${prizeInfo.desc}\n\n`;

        if (prizeInfo.extraInfo.startsWith('Call `.help ')) {
            prizeDescMsg += `${' '.repeat(6)}${prizeInfo.extraInfo}.\n\n`;
        } else {
            armySizeMsg = prizeInfo.extraInfo;
        }
    });

    return { title, prizeDescMsg, armySizeMsg };
}

function populatePrizeToInfo(numBoxes, tierNumber, userID) {
    const prizeToInfo = {};

    for (let i = 0; i < numBoxes; i++) {
        const { prize, prizeDescription, extraInfo } = addRandomPrizeAndGetInfo(tierNumber, userID);

        if (prizeToInfo[prize]) {
            prizeToInfo[prize].count++;
            prizeToInfo[prize].extraInfo = extraInfo;
        } else {
            prizeToInfo[prize] = {
                desc: prizeDescription,
                extraInfo: extraInfo,
                count: 1
            };
        }
    }

    return prizeToInfo;
}

/**
 * Opens a scrub box.
 *
 * @param {String} title title of the prize message
 * @param {String} prizeDescription description of the prize
 * @param {String} armySizeMsg updated army size message
 * @param {String} userID id of the calling user
 */
function openScrubBox(title, prizeDescription, armySizeMsg, userID) {
    util.sendEmbed({title, userID, image: 'https://i.imgur.com/mKwsQGi.gif'})
        .then((msgSent) => {
            const updatedMsg = new Discord.RichEmbed({
                color: 0xffff00,
                title: title,
                description: `${util.mentionUser(userID)}, the Scrubbing Bubble gods have blessed you with:` +
                    `\n\n${prizeDescription}${armySizeMsg}`
            });
            setTimeout(() => {
                msgSent.edit('', updatedMsg);
            }, 6200);
        });
}

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
    const prizeDescription = c.PRIZE_TO_DESCRIPTION[prize].replace('``', `\`${util.comma(prizesInTier[prize])}\``);
    var extraInfo = `Call \`.help ${prize}\` for usage info`;

    if (prize.endsWith('bubbles')) {
        gambling.addToArmy(userID, prizesInTier[prize]);
        extraInfo = gambling.getArmySizeMsg(userID);
    } else {
        addPrizeToInventory(userID, prize, tierNumber);
    }

    return { prize, prizeDescription, extraInfo };
}

/**
 * Adds a prize to the user's inventory.
 *
 * @param {String} userID id of the user to give prize to
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function addPrizeToInventory(userID, prize, tierNumber) {
    gambling.maybeCreateLedgerEntry(userID);

    if (!gambling.getLedger()[userID].inventory) {
        gambling.getLedger()[userID].inventory = {};
    }

    const { inventory } = gambling.getLedger()[userID];

    if (!inventory[tierNumber]) {
        inventory[tierNumber] = {};
    }

    if (inventory[tierNumber][prize]) {
        inventory[tierNumber][prize]++;
    } else {
        inventory[tierNumber][prize] = 1;
    }

    if (prize === 'add-emoji' && tierNumber === 3) {
        inventory[tierNumber][prize] += 2;
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
function outputInventory(userID) {
    if (!gambling.getLedger()[userID]?.inventory) {
        return util.sendEmbedMessage(
            'No Inventory',
            `${util.mentionUser(userID)}, all you have is a rock.`,
            userID
        );
    }

    const { inventory } = gambling.getLedger()[userID];
    var fields = [];
    var results = [];

    for (let tier = 1; tier <= c.PRIZE_TIERS.length; tier++) {
        var tierFields = [];

        for (var action in inventory[tier]) {
            tierFields.push(util.buildField(action, inventory[tier][action]));
        }

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
}

/**
 * Gets the count of the prize in a user's inventory for a given tier.
 *
 * @param {String} userID id of the user to get prize count of
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function getPrizeCount(userID, prize, tierNumber) {
    return gambling.getLedger()?.[userID]?.inventory?.[tierNumber]?.[prize] ?? 0;
}

/**
 * Determines if a user has a prize in their inventory.
 *
 * @param {String} userID id of the user to check for prize
 * @param {String} prize name of the prize
 * @param {Number} tierNumber tier of the prize
 */
function hasPrize(userID, prize, tierNumber) {
    if (isNaN(tierNumber)) { return false; }

    if (0 === getPrizeCount(userID, prize, tierNumber)) {
        util.sendEmbedMessage(
            'Prize not in inventory',
            `To gain access to the \`${prize}\` command, win it in a Scrub Box.`,
            userID
        );

        return false;
    }

    return true;
}

/**
 * Resets names if unlock time is reached or the user has attempted
 * to manually rename themself while locked.
 */
exports.maybeResetNames = function() {
    const { lockedIdToLockInfo } = loot;

    if (lockedIdToLockInfo === {}) { return; }

    const server = bot.getServer();
    var isRenameExpired = false;

    for (var targetID in lockedIdToLockInfo) {
        const lockInfo = lockedIdToLockInfo[targetID];
        const target = server[`${lockInfo.type}s`].find('id', targetID);

        if (!target || moment().isAfter(moment(lockInfo.unlockTime))) {
            if (target) {
                rename(lockInfo.type, target, lockInfo.oldName);
            }

            delete loot.lockedIdToLockInfo[targetID];
            isRenameExpired = true;
            continue;
        }

        const targetName = target.displayName || target.name;

        if (targetName === lockInfo.newName || targetName === lockInfo.newName.split(' ').join('-')) { continue; }

        rename(lockInfo.type, target, lockInfo.newName);
    }

    if (isRenameExpired) {
        util.exportJson(loot, 'loot');
        updateRenamedList();
    }
};

/**
 * Renames users if it's their birthday.
 */
exports.maybeRenameBirthdayUsers = () => {
    const userIdToMetadata = util.getUserIdToMetadata();

	Object.keys(userIdToMetadata).forEach((userID) => {
		const { nickname, birthday } = userIdToMetadata[userID];

		if (!moment().isSame(moment(birthday), 'day')) { return; }

        const birthdayUser = util.getMembers().find('id', userID);

        if (birthdayUser.displayName === nickname) { return; }

        renameUserRoleOrChannel(
            c.MENTION_TYPE.user,
            userID,
            nickname,
            1,
            userID,
            null,
            birthdayUser
        );
	});
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
 * @param {String} newName new name to use for target
 * @param {Number} tierNumber tier of the prize
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 * @param {Object[]} mentions mentions in the message
 */
function renameUserRoleOrChannel(type, targetID, newName, tierNumber, userID, cmd, mentions) {
    var lockInfo = loot.lockedIdToLockInfo[targetID];

    if (lockInfo && cmd) {
        const unlockTime = moment(lockInfo.unlockTime);

        if (moment().isBefore(unlockTime)) {
            return util.sendEmbedMessage(
                'Target Locked',
                `You may not rename the target until \`${unlockTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``
            );
        }
    }

    const formattedType = util.capitalizeFirstLetter(type);
    const mentionType = type === 'hank' ? 'User' : formattedType;
    const group = mentionType === 'User' ? 'member' : mentionType.toLowerCase();
    const target = mentions.id ? mentions : mentions[`${group}s`].values().next().value;
    const oldName = target.displayName || target.name;

    rename(type, target, newName)
        .then(() => {
            const { endTime, formattedEndTime } = getPrizeEndTime(tierNumber, `rename-${type}`);

            loot.lockedIdToLockInfo[targetID] = {
                unlockTime: endTime.valueOf(),
                oldName: oldName,
                newName: newName,
                type: group,
            };

            if (cmd) {
                removePrizeFromInventory(userID, cmd, tierNumber);
            }

            util.exportJson(loot, 'loot');
            util.sendEmbedMessage(
                `${formattedType} Renamed`,
                `Thou shalt be called ${util[`mention${mentionType}`](targetID)} until \`${formattedEndTime}\``,
                userID
            );
            updateRenamedList();
        })
        .catch((err) => {
            logger.error(`Edit Name Error: ${err}`);
        });
}

/**
 * Renames the provided user, role, or channel if the calling user
 * has the rename prize.
 *
 * @param {Object} message	message that called the rename command
 * @param {String[]} args	the arguments passed by the user
 */
function maybeRename(message, args) {
    const [ cmd, tier, targetMention ] = args;
    const mentionType = cmd.split('-')[1];
    const tierNumber = Number(tier);
    const userID = message.member.id;
    const newName = util.getTargetFromArgs(args, 3);

    if (!hasPrize(userID, cmd, tierNumber)) { return; }

    if ('hank' === mentionType) {
        renameUserRoleOrChannel(
            mentionType,
            c.H_ID,
            'hang',
            tierNumber,
            userID,
            cmd,
            message.guild.members.find('id', c.H_ID)
        );
    } else if (newName && util.isMention(targetMention, c.MENTION_TYPE[mentionType])){
        renameUserRoleOrChannel(
            mentionType,
            util.getIdFromMention(targetMention),
            newName,
            tierNumber,
            userID,
            cmd,
            message.mentions
        );
    }
}

/**
 * Adds a user provided emoji to the server.
 *
 * @param {Object} message message sent by user
 * @param {String} name name of the emoji to add
 * @param {Number} tierNumber tier of the prize
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 */
function addEmoji(message, name, tierNumber, userID, cmd) {
    if (message.attachments.length === 0) { return; }

    const attachment = message.attachments.array()[0];
    name = name || attachment.filename.split('.')[0].toLowerCase();

    message.guild.createEmoji(attachment.url, name)
        .then((emoji) => {
            removePrizeFromInventory(userID, cmd, tierNumber);
            util.sendEmbedMessage('Emoji Added', `${new Array(9).fill(emoji).join('')}`);
        })
        .catch((err) => {
            const fileIssueMsgMatches = err.message.match(/File.*\./);
            var fileIssueMsg = fileIssueMsgMatches ? fileIssueMsgMatches[0] : 'The image format may not be supported.';
            const fileSize = util.formatAsBoldCodeBlock(`${(attachment.filesize / 1024).toFixed(2)} kb`);

            fileIssueMsg = maybeFormatFileIssueMsgForSize(fileIssueMsg);
            logger.error(`Unable to add ${fileSize} kb emoji.`, err);
            util.sendEmbedMessage(
                'Unable to Add Emoji',
                `${fileIssueMsg}\nFile size: ${fileSize}`
            );
        });
}

/**
 * Formats file issue message for max file size exceeded.
 *
 * @param {string} fileIssueMsg message to format
 * @returns {string} the formatted message
 */
function maybeFormatFileIssueMsgForSize(fileIssueMsg) {
    const maxFileSizeMatches = fileIssueMsg.match(/[0-9]{3,5}\.?[0-9]{0,2} [A-z]{2}/);

    if (maxFileSizeMatches) {
        const [ maxFileSize ] = maxFileSizeMatches;

        fileIssueMsg = fileIssueMsg.replace(maxFileSize, util.formatAsBoldCodeBlock(maxFileSize));
    }

    return fileIssueMsg;
}

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
function rename(type, target, name) {
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
 * Updates the magic word count in the channel's topic.
 *
 * @param {String} channelID id of the channel to update
 */
function updateChannelTopicWithMagicWordCount(channelID) {
    const magicWords = loot.magicWords[channelID];
    const magicWordCount = magicWords ? Object.keys(magicWords).length : 0;
    const magicWordRegex = new RegExp(/^(:sparkles:|✨) [0-9]+ Magic Word(s)? (:sparkles:|✨) /);
    const channel = bot.getServer().channels.find('id', channelID);
    const oldTopic = channel.topic;
    var topic = oldTopic.replace(magicWordRegex, '');

    if (magicWordCount !== 0) {
        topic = `✨ ${magicWordCount} Magic Word${util.maybeGetPlural(magicWordCount)} ✨ ${topic}`;
    }

    channel.setTopic(topic)
        .then((updatedChannel) => {
            logger.info(`${util.mentionChannel(updatedChannel.id)}'s topic set to: ${updatedChannel.topic}`);
        })
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

    removeExpiredMagicWords(channelID);
    updateChannelTopicWithMagicWordCount(channelID);
    util.exportJson(loot, 'loot');

    if (!loot.magicWords[channelID]) { return; }

    const magicWordsPattern = `\\b(${Object.keys(magicWordsToEndTime).join("|")})\\b`;
    const magicWordsRegex = new RegExp(magicWordsPattern, 'gi');
    const magicWordMatches = message.content.match(magicWordsRegex);

    if (!magicWordMatches) { return; }

    const banDays = magicWordMatches.length;

    if (banDays === 0) { return; }

    logger.info(`Banning ${util.getNick(message.author.id)}`
        + ` for saying the magic words "${magicWordMatches}" in ${util.mentionChannel(channelID)}`);
    util.banSpammer(message.author, message.channel, banDays, true);
};

function removeExpiredMagicWords(channelID) {
    const magicWordsToEndTime = loot.magicWords[channelID];

    Object.keys(magicWordsToEndTime).forEach((magicWord) => {
        if (moment().isBefore(moment(magicWordsToEndTime[magicWord]))) { return; }

        if (Object.keys(magicWordsToEndTime).length === 1) {
            delete loot.magicWords[channelID];
        } else {
            delete magicWordsToEndTime[magicWord];
        }
    });
}

/**
 * Adds a magic word, that when typed by a user will temporarily ban them from the channel.
 *
 * @param {String} word the magic word
 * @param {Number} tierNumber tier of the prize
 * @param {String} channelID id of the channel to add the magic word to
 * @param {String} userID id of the calling user
 * @param {String} cmd command called
 */
function addMagicWord(word, tierNumber, channelID, userID, cmd) {
    const minLength = tierNumber + 2;

    // word must meet min length req for tier
    if (word.length < minLength) {
        return util.sendEmbedMessage(
            'Insufficient Word Length',
            `Word must be at least ${minLength} letters for tier ${tierNumber}.`
        );
    }

    if (!loot.magicWords[channelID]) {
        loot.magicWords[channelID] = {};
    }

    const banDays = c.PRIZE_TIERS[tierNumber - 1][cmd].replace(/\D/g,'');
    const magicWordEndTime = moment().add(banDays, 'days');

    loot.magicWords[channelID][word] = magicWordEndTime.valueOf();
    removeExpiredMagicWords(channelID);
    updateChannelTopicWithMagicWordCount(channelID);

    const magicWordCount = Object.keys(loot.magicWords[channelID]).length;
    const totalWordsMsg = magicWordCount > 1 ? `. There are now ${magicWordCount} magic words for this channel.` : '';
    const endTimeMsg = `new magic word is in effect until \`${magicWordEndTime.format(c.MDY_HM_DATE_TIME_FORMAT)}\``;

    util.sendEmbedMessageToChannel(
        'Magic Word Set',
        `A ${endTimeMsg}${totalWordsMsg}`,
        channelID,
        userID,
    );
    util.getMembers()
        .find('id', userID)
        .createDM()
        .then((dm) => {
            dm.send(`When a user types \`${word}\` in ${util.mentionChannel(channelID)}, `
            + `they will receive a one day ban. The ${endTimeMsg}`);
        });
    removePrizeFromInventory(userID, cmd, tierNumber);
    util.exportJson(loot, 'loot');
}

/**
 * Drops a rock image in chat.
 *
 * @param {String} userID id of the calling user
 */
function rock(userID) {
    util.sendEmbed({ userID, image: c.ROCK_IMG });
    gambling.maybeCreateLedgerEntry(userID);

    const userEntry = gambling.getLedger()[userID];

    userEntry.rocksDropped = userEntry.rocksDropped ? userEntry.rocksDropped + 1 : 1;
}

//Todo: use this for annoy
/**
 * Has a chance of joining a random channel and playing a soundbite.
 */
exports.maybeJoinRandomChannelAndPlaySoundbite = function() {
	if (util.getRand(1, 21) > 13) {
		const soundBiteChoices = ['tryagainlater', 'cmdnotrecognized', 'repeatthat', 'betconfirmed'];
		const voiceChannels = bot.getServer().channels.filterArray(
			(channel) => channel.type === 'voice' && channel.members.size !== 0);
		const chosenChannel = voiceChannels[util.getRand(0, voiceChannels.length)];
		const chosenSoundBite = soundBiteChoices[util.getRand(0, soundBiteChoices.length)];
		const chosenUserID = chosenChannel.members.first().id;

		if (chosenSoundBite === 'betconfimed') {
			gambling.betClean(chosenUserID, util.getRand(1, 11));
        }

        chosenChannel.join()
            .then((connection) => {
                setTimeout(() => {
                    // util.playSoundBite(chosenChannel, chosenSoundBite, chosenUserID, connection); //Todo: Update this call to use proper args for new code
                }, util.getRand(2000, 9000));
            });
	}
};


/**
 * Adds the rainbow role to a user.
 *
 * @param {String} userID id of the calling user
 * @param {Object} targetUser user to add role to
 * @param {Number} tierNumber tier of the prize
 * @param {String} cmd command called
 */
 function addRainbowRole(userID, targetUser, tierNumber, cmd) {
    const server = bot.getServer();
    const rainbowRole = server.roles.find('name', 'rainbow');

	if (rainbowRole) {
        targetUser.addRole(rainbowRole).then(util.updateRainbowRoleColor);
    } else {
		server.createRole({
			name: 'rainbow',
			position: server.roles.array().length - 4
		})
		.then((role) => {
			targetUser.addRole(role).then(util.updateRainbowRoleColor);
		});
    }

    if (!loot.rainbowRoleMemberIdToEndTime) {
        loot.rainbowRoleMemberIdToEndTime = {};
    }

    const { endTime, formattedEndTime } = getPrizeEndTime(tierNumber, cmd);
    const description = `${util.mentionUser(userID)} Your role's color will `
        + `change until ${util.formatAsBoldCodeBlock(formattedEndTime)}!`;

    loot.rainbowRoleMemberIdToEndTime[userID] = endTime.valueOf();
    removePrizeFromInventory(userID, cmd, tierNumber);
    logger.info(`Rainbow role active for ${util.getNick(userID)} until ${formattedEndTime}`);
    util.sendEmbedMessage(`🌈 Rainbow Role Activated`, description, userID);
    util.exportJson(loot, 'loot');
}

/**
 * Joins the Billionaire's club.
 *
 * @param {Object} message - the message that triggered the command
 * @param {Object} message.member - the member joining the club
 * @param {[cmd]: [String]} cmd - the cmd called
 */
function joinBillionairesClub({ member }, [cmd]) {
    const { id: userID } = member;

    if (!hasPrize(userID, cmd, 4)) { return; }

    const { endTime, formattedEndTime } = getPrizeEndTime(4, cmd);
    const billionaireRole = bot.getServer().roles.find('id', c.BILLIONAIRE_ROLE_ID);

    if (!loot.billionaireIdToEndTime) {
        loot.billionaireIdToEndTime = {};
    }

    loot.billionaireIdToEndTime[userID] = endTime.valueOf();
    member.addRole(billionaireRole);
    removePrizeFromInventory(userID, cmd, 4);
    logger.info(`Billionaire's club admits ${util.getNick(userID)} until ${formattedEndTime}`);

    const maxWeeksCount = Math.round(gambling.getLedger()[userID].armySize / c.TIER_COST[3]);
    const desc = `${util.mentionUser(userID)}, Your wealth will be acknowledged until ${util.formatAsBoldCodeBlock(formattedEndTime)}`
        + `\n\nWelcome to The Billionaire's Club ${util.mentionChannel(c.BILLIONAIRE_CHANNEL_ID)}!\n`
        + `You can afford ${util.formatAsBoldCodeBlock(util.comma(maxWeeksCount))} more week${util.maybeGetPlural(maxWeeksCount)} of membership.`;
    const joinImg = c.BILLIONAIRE_JOIN_IMAGES[util.getRand(0, c.BILLIONAIRE_JOIN_IMAGES.length)];

    util.sendEmbedMessage('🤑💵   , , ,   💰💸', desc, userID);
    util.sendAuthoredMessage(joinImg, userID, c.BILLIONAIRE_CHANNEL_ID);
    util.exportJson(loot, 'loot');
}

/**
 * Removes role if time has expired on the prize.
 */
function maybeRemoveRoleFromUsers(memberIdToRoleEndTime, role) {
    const roleMembers = role.members.array();

    if (roleMembers.length === 0) { return; }

    roleMembers.forEach((member) => {
        const endTime = memberIdToRoleEndTime[member.id];

        if (!endTime || moment().isAfter(moment(endTime))) {
            delete memberIdToRoleEndTime[member.id];
            member.removeRole(role);
            util.exportJson(loot, 'loot');
        }
    });
}

/**
 * Removes rainbow role if time has expired on the prize.
 */
function maybeRemoveRainbowRoleFromUsers() {
    const rainbowRole = bot.getServer().roles.find('name', 'rainbow');
    maybeRemoveRoleFromUsers(loot.rainbowRoleMemberIdToEndTime, rainbowRole);

    if (0 !== rainbowRole.members.array().length) { return; }

    util.clearRainbowRoleUpdateInterval();
}

/**
 * Removes prize roles from users if the time has expired on their prize.
 */
exports.maybeRemovePrizeRolesFromUsers = () => {
    const billionaireRole = bot.getServer().roles.find('id', c.BILLIONAIRE_ROLE_ID);

    maybeRemoveRoleFromUsers(loot.billionaireIdToEndTime, billionaireRole);
    maybeRemoveRainbowRoleFromUsers();
};

/**
 * Builds the prize tier ascii table body.
 *
 * @param {String} userID id of the calling user
 */
function outputPrizeTiersTable(userID) {
    const tierCostHeaders = c.TIER_COST.slice(0, -1).map((tierCost, i) => `${i + 1} (${tierCost})`);
    var { output, columnLengths } = util.buildTableHeader(['Prize            ', ...tierCostHeaders, '4 (100B)   ']);

    Object.keys(c.PRIZE_TO_DESCRIPTION).forEach((prize) => {
        var tableRow = util.buildColumn(prize, columnLengths[0]);

        c.PRIZE_TIERS.forEach((prizeTier, i) => {
            const prizeInfo = prizeTier[prize] || '';
            const isLastColumn = i === c.PRIZE_TIERS.length - 1;

            tableRow += util.buildColumn(`${prizeInfo}`, columnLengths[i + 1], isLastColumn);
        });

        output += tableRow;
    });

    output += '```**';

    util.sendEmbedMessage(`Scrub Box Prize Tiers`, output, userID);
}


function determinePrizeArgs(args, message) {
    const cmd = args[0];
    const userID = message.member.id;
    const tierNumber = Number(args[1]);

    return { userID, cmd, tierNumber };
}

exports.registerCommandHandlers = () => {
    cmdHandler.registerCommandHandler('rename-user', maybeRename);
    cmdHandler.registerCommandHandler('rename-role', maybeRename);
    cmdHandler.registerCommandHandler('rename-channel', maybeRename);
    cmdHandler.registerCommandHandler('rename-hank', maybeRename);
    cmdHandler.registerCommandHandler('add-emoji', (message, args) => {
        const { userID, cmd, tierNumber } = determinePrizeArgs(args, message);

        if (!hasPrize(userID, cmd, tierNumber)) { return; }

        addEmoji(message, args[2], tierNumber, userID, cmd);
    });
    cmdHandler.registerCommandHandler('annoy', (message, args) => {
        const { userID, cmd, tierNumber } = determinePrizeArgs(args, message);

        // TODO: create
        if (!hasPrize(userID, cmd, tierNumber)) { return; }
    });
    cmdHandler.registerCommandHandler('inventory', (message, args) => {
        const { userID } = determinePrizeArgs(args, message);

        outputInventory(userID);
    });
    cmdHandler.registerCommandHandler('billionaires-club', joinBillionairesClub);
    cmdHandler.registerCommandHandler('lotto', (message, args) => {
        const { userID } = determinePrizeArgs(args, message);

        joinLotto(util.getNick(userID), userID);
    });
    cmdHandler.registerCommandHandler('magic-word', (message, args) => {
        const { userID, cmd, tierNumber } = determinePrizeArgs(args, message);

        if (!hasPrize(userID, cmd, tierNumber)) { return; }

        message.delete();
        addMagicWord(args[2], tierNumber, message.channel.id, userID, cmd);

    });
    cmdHandler.registerCommandHandler('move-user', (message, args) => {
        const { userID, cmd, tierNumber } = determinePrizeArgs(args, message);

        // TODO: create
        if (!hasPrize(userID, cmd, tierNumber)) { return; }
    });
    cmdHandler.registerCommandHandler('prizes', ({ member }) => outputPrizeTiersTable(member.id));
    cmdHandler.registerCommandHandler('rainbow-role', (message, args) => {
        const { userID, cmd, tierNumber } = determinePrizeArgs(args, message);

        if (!hasPrize(userID, cmd, tierNumber)) { return; }

        addRainbowRole(userID, message.member, tierNumber, cmd);
    });
    cmdHandler.registerCommandHandler('rock', (message, args) => {
        const { userID } = determinePrizeArgs(args, message);

        rock(userID);
        message.delete();
    });
    cmdHandler.registerCommandHandler('scrub-box', (message, args) => {
        if (!args[1] || isNaN(args[1])) { return; }

        const { userID, tierNumber } = determinePrizeArgs(args, message);

        scrubBox(userID, tierNumber, args[2]);
    });
    cmdHandler.registerCommandHandler('start-lotto', (message, args) => {
        const { userID, cmd } = determinePrizeArgs(args, message);

        if (args.length < 3 || (!hasPrize(userID, cmd, 3) && !util.isAdmin(userID))) { return; }

        startLotto(userID, args[1], args[2]);
    });
    cmdHandler.registerCommandHandler('stop-lotto', (message, args) => {
        const { userID, cmd } = determinePrizeArgs(args, message);

        if (!hasPrize(userID, cmd, 3)) { return; }

        stopLotto(userID, 3, cmd);
    });
};