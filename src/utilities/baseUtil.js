var fs = require('fs');

var bot = require('../bot.js');
var c = require('../const.js');

var scrubIdToNick = {};
var scrubIdToAvatar = {};
var members = [];
var locks = {};		//function locks

/**
 * Builds an embed field object with name and value.
 *
 * @param {String} name - the name
 * @param {Number} value - the value
 */
function buildField(name, value, inline) {
	inline = inline || 'true';

	return {
		name: name,
		value: value,
		inline: inline
	};
}

/**
 * Comparator for two field objects. Compares values.
 *
 * @param {Object} a - first field
 * @param {Object} b - second field
 */
function compareFieldValues(a,b) {
	const aNum = Number(a.value.toString().replace(/,/g, ''));
	const bNum = Number(b.value.toString().replace(/,/g, ''));

	if (aNum > bNum) {
		return -1;
	}

	if (aNum < bNum) {
		return 1;
	}

	return 0;
}

/**
 * Gets a random number between min and max.
 * The the minimum is inclusive and the maximum is exclusive.
 *
 * @param {Number} min - the minimum
 * @param {Number} max - the maximum
 */
function getRand(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);

	return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Determines if the provided number is an integer within the provided inclusive bounds.
 *
 * @param {number} num the number to check
 * @param {number} min minimum bound (inclusive)
 * @param {number} max maximum bound (inclusive)
 * @returns {boolean} whether the integer is within the bounds
 */
 function isIntegerInBounds(num, min, max) {
  return Number.isInteger(num) && num >= min && num <= max;
}

/**
 * Creates a deep clone of the provided object.
 *
 * @param {Object} target - object to clone
 */
function deepClone(target) {
	return JSON.parse(JSON.stringify(target));
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));

      [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Capitalizes the first letter of the provided string.
 *
 * @param {String} original - the string to captitalize first letter of
 */
function capitalizeFirstLetter(original) {
	return original.charAt(0).toUpperCase() + original.slice(1);
}

/**
 * Writes the provided content to a file with the name provided.
 *
 * @param {Object} content - data to write to the file
 * @param {String} fileName - name of the file
 */
function exportJson(content, fileName) {
	fs.writeFileSync(`./resources/data/${fileName}.json`, JSON.stringify(content));
}

/**
 * Waits for all promises to resolve and marks them with success or failure.
 *
 * @param {Promise[]} promises - the promises to handle
 */
function handleAllPromises(promises) {
    const toResultObject = (promise) => {
        return promise
            .then((result) => ({ success: true, result }))
            .catch((error) => ({ success: false, error }));
    };

    return Promise.all(promises.map(toResultObject));
}

/**
 * Updates the member list and scrubIDtoNick.
 */
function updateMembers() {
	members = bot.getServer().members;
	members.forEach((member) => {
		scrubIdToNick[member.id] = getTrueDisplayName(member.displayName);
		scrubIdToAvatar[member.id] = member.user.displayAvatarURL.split('?')[0];
	});
}

/**
 * Gets the nickname of the user with the provided id.
 *
 * @param {String} userID - id of user to get nickname of
 */
function getNick(userID) {
	return scrubIdToNick[userID];
}

/**
 * Gets the avatar of the user with the provided id.
 *
 * @param {String} userID - id of user to get avatar of
 */
function getAvatar(userID) {
	return scrubIdToAvatar[userID];
}

/**
 * returns an 's' or 'es' iff count > 1.
 *
 * @param {Number} count count of thing to pluralize
 * @param {String=} word the word to pluralize
 */
function maybeGetPlural(count, word) {
	if (Math.abs(count) === 1) {
		return word || '';
	}

	return word ? `${word}${getPluralEnding(word)}` : getPluralEnding(word);
}

/**
 * returns an 's' or 'es' depending on what letters the word ends with
 *
 * @param {String} word the word to get the pluralized ending of
 */
function getPluralEnding(word) {
	return new RegExp(/(ch|sh|s|x|z)$/).test(word) ? 'es' : 's';
}

/**
 * Comma separates a number.
 *
 * @param {Number} num the number to comma separate
 */
function comma(num) {
	if (null == num) { return; }

    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

/**
 * Formats the provided number.
 * Adds commas if at least 1000.
 * Precision 3 with unit if at least 1 trillion.
 *
 * @param {Number} num - number to format
 * @returns {String} the formatted number
 */
function formatLargeNumber(num) {
	const formattedNum = comma(num);
	const numberTokens = formattedNum.split(',');

	if (numberTokens.length > 4) {
		return `${numberTokens[0]} ${c.LARGE_NUM_UNITS[numberTokens.length - 5]}`;
	}

    return formattedNum;
}

function formatAsBoldCodeBlock(text) {
	return `**\`${text}\`**`;
}

function formatLargeNumberAsCodeBlock(num) {
	return formatAsBoldCodeBlock(formatLargeNumber(num));
}

function formatNumber(text) {
	return `**\`${comma(text)}\`**`;
}

function isMention(text, mentionType) {
	const typeSymbol = mentionType ? c.MENTION_TYPE_TO_SYMBOL[mentionType] : '(@[!&]?|#)';

	if (!text) { return false; }

	return RegExp(`^<${typeSymbol}[0-9]{18}>$`).test(text);
}

/**
 * Gets a user's id from the provided mention.
 *
 * @param {String} userMention - a mention of a user
 */
function getIdFromMention(userMention) {
	return userMention.match(/\d/g).join('');
}

/**
 * Creates a user mention with the provided ID.
 *
 * @param {String} userID - the id of the user to mention
 */
function mentionUser(userID) {
	return `<@!${userID}>`;
}

/**
 * Creates a role mention with the provided ID.
 *
 * @param {String} roleID - the id of the role to mention
 */
function mentionRole(roleID) {
	return `<@&${roleID}>`;
}

/**
 * Creates a channel mention with the provided ID.
 *
 * @param {String} channelID - the id of the channel to mention
 */
function mentionChannel(channelID) {
	return `<#${channelID}>`;
}

/**
 * Gets the name of the calling function or the provided function.
 *
 * @param {String} funcName - the name of the function
 */
function getCallerOrProvided(funcName) {
	return funcName || arguments.callee.caller.caller.name;
}

/**
 * Locks the provided function, stopping it from being callable.
 *
 * @param {String} funcName - the name of the function
 */
function lock(funcName) {
	locks[getCallerOrProvided(funcName)] = true;
}

/**
 * Unlocks the provided function, allowing it to be called.
 *
 * @param {String} funcName - the name of the function
 */
function unLock(funcName) {
	locks[getCallerOrProvided(funcName)] = false;
}

/**
 * Checks if the provided function is currently locked from calls.
 *
 * @param {String} funcName - the name of the function
 */
function isLocked(funcName) {
	return locks[getCallerOrProvided(funcName)];
}

/**
 * Builds a target which could be one word or multiple.
 *
 * @param {String[]} args - command args passed in by user
 * @param {number} startIdx - the start index of your target within args
 */
function getTargetFromArgs(args, startIdx) {
	var target = args[startIdx];

	for (var i = startIdx + 1; i < args.length; i++) {
		target += ` ${args[i]}`;
	}

	return target;
}

/**
 * Removes the provided element from the array if found.
 *
 * @param {*[]} array - the array to remove an element from
 * @param {*} element - the element to remove
 */
function maybeRemoveFromArray(array, element) {
	var index = array.indexOf(element);

	if (index > -1) {
		array.splice(index, 1);
	}
}

/**
 * Gets the member's actual display name, without playing status box-letters.
 *
 * @param {Object} nickname - the nickname to strip playing status from
 */
function getTrueDisplayName(nickname) {
	return nickname.split(' ▫ ')[0];
}

exports.buildField = buildField;
exports.capitalizeFirstLetter = capitalizeFirstLetter;
exports.comma = comma;
exports.compareFieldValues = compareFieldValues;
exports.deepClone = deepClone;
exports.exportJson = exportJson;
exports.formatAsBoldCodeBlock = formatAsBoldCodeBlock;
exports.formatLargeNumber = formatLargeNumber;
exports.formatLargeNumberAsCodeBlock = formatLargeNumberAsCodeBlock;
exports.formatNumber = formatNumber;
exports.getAvatar = getAvatar;
exports.getIdFromMention = getIdFromMention;
exports.getMembers = () => members;
exports.getNick = getNick;
exports.getRand = getRand;
exports.getTargetFromArgs = getTargetFromArgs;
exports.getTrueDisplayName = getTrueDisplayName;
exports.handleAllPromises = handleAllPromises;
exports.isIntegerInBounds = isIntegerInBounds;
exports.isLocked = isLocked;
exports.isMention = isMention;
exports.lock = lock;
exports.maybeGetPlural = maybeGetPlural;
exports.maybeRemoveFromArray = maybeRemoveFromArray;
exports.mentionChannel = mentionChannel;
exports.mentionRole = mentionRole;
exports.mentionUser = mentionUser;
exports.shuffleArray = shuffleArray;
exports.unLock = unLock;
exports.updateMembers = updateMembers;