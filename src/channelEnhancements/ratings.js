var Discord = require('discord.js');
var inspect = require('util-inspect');
var moment = require('moment');
var Fuse = require('fuse.js');
var imdb = require('imdb-api');
var get = require('lodash.get');
var rp = require('request-promise');
var rt = require('lw5');

var c = require('../const.js');
var bot = require('../bot.js');
var util = require('../utilities/utilities.js');
var logger = require('../logger.js').botLogger;
var priv = require('../../../private.json');
var ratings = require('../../resources/data/ratings.json');
var ratingsResponses = 0;

/**
 * Gets the proper title from a string.
 * Source: https://stackoverflow.com/a/6475125
 *
 * @param {String} original - string to get proper title from
 */
function determineTitle(original) {
	var title = original.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});

	// Certain minor words should be left lowercase unless
	// they are the first or last words in the string
	const lowers = ['A', 'An', 'The', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At',
	'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'Onto', 'To', 'With'];

	for (var i = 0, j = lowers.length; i < j; i++) {
		title = title.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'),
		function(txt) {
			return txt.toLowerCase();
		});
	}

	// Certain words such as initialisms or acronyms should be left uppercase
	const uppers = ['Id', 'Tv'];
	for (i = 0, j = uppers.length; i < j; i++) {
		title = title.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'),
		uppers[i].toUpperCase());
	}

	return title;
}

/**
 * Gets a string of stars.
 *
 * @param {Number} count - number of stars to get
 */
function getStars(count) {
	var result = '';
	for (var i=0; i < Math.floor(count); i++) {
		result += '⭐';
	}

	if (count % 1 !== 0) {
		result += '★';
	}

	return result;
}

/**
 * Determines the average rating of a tv show or movie.
 *
 * @param {String} category - tv or movie
 * @param {String} title - title to get rating of
 */
function determineRating(category, title) {
	const reviews = ratings[category][title].reviews;
	const allRatings = Object.values(reviews);
	const ratingSum = allRatings.reduce((a, b) => a + b);

	return ratingSum / allRatings.length;
}

/**
 * Determines the ratings output for a given star count (1-4).
 *
 * @param {String[]} titles - titles to output ratings for
 * @param {Object} targetRatings - review group
 * @param {String} targetCategory - 'tv' or 'movies'
 * @param {Number} rating - rating for the title
 */
function determineRatingsOutput(titles, targetRatings, targetCategory, rating) {
	var output = '';
	titles.forEach((title, i) => {
		const currRating = targetRatings[targetCategory][title];
		var extraRating = '⠀⠀';
		var ratingNum = Number(currRating.rating);
		if (Math.floor(ratingNum) === rating) {
			if (currRating.time && moment().diff(moment(currRating.time), 'weeks') < 2) {
				title += ' 🆕';
			}
			output += `**${title}**\n`;
			if (targetCategory === 'movies' && currRating.rtRating) {
				extraRating += `🍅 **${currRating.rtRating}**	`;
			}
			if (currRating.imdbRating && currRating.imdbRating !== 'N/A') {
				extraRating += `**\`IMDB\`** **${currRating.imdbRating}**	`;
			}
			if (ratingNum % 1 !== 0) {
				extraRating += `${getStars(1)} **${ratingNum.toPrecision(2)}**`;
			}
			if ('⠀⠀' === extraRating) { return; }
			if (i !== titles.length - 1) {
				extraRating += '\n';
			}

			output += extraRating;
		}
	});

	return output;
}

/**
 * Updates a title's rating and determine's the average.
 *
 * @param {String} category - the category the title is in
 * @param {String} title - title to verify
 * @param {String} userID - user updating giving the review
 * @param {Number} rating - new rating given for the title
 * @param {Object} channel - review channel
 */
function updateRatingAndDetermineAvg(category, title, userID, rating, channel) {
	var oldReview = ratings[category][title];
	const unverifiedReview = ratings.unverified[category][title];
	var avgRating;
	var isUnverified = false;

	// If the title has never been rated or only rated by current reviewer
	if (!oldReview && (!unverifiedReview || unverifiedReview.reviews[userID])) {
		updateUnverifiedReview(category, title, rating, userID);
		avgRating = rating;
		isUnverified = true;
	} else {
		// If the title being rated was previously unverified, move it to verified
		if (unverifiedReview) {
			oldReview = unverifiedReview;
			verifyReview(category, title, oldReview, channel);
		}

		avgRating = determineRating(category, title);
		ratings[category][title].reviews[userID] = rating;
		ratings[category][title].rating = avgRating;

		// Update list review used to be in
		if (!unverifiedReview && Math.floor(avgRating) !== Math.floor(oldReview.rating)) {
			exports.outputRatings(Math.floor(oldReview.rating), category, true, channel);
		}
	}

	// Update list review is now in
	if (isUnverified) {
		exports.outputRatings(Math.floor(avgRating), category, false, channel);
	} else {
		exports.outputRatings(Math.floor(avgRating), category, true, channel);
	}
	util.exportJson(ratings, 'ratings');
	updateExternalRatingsJson();

	return avgRating;
}

/**
 * Verifies a review.
 *
 * @param {String} category - the category the title is in
 * @param {String} title - title to verify
 * @param {Object} oldReview - review prior to update
 * @param {Object} channel - review channel
 */
function verifyReview(category, title, oldReview, channel) {
	ratings[category][title] = oldReview;
	delete ratings.unverified[category][title];
	// update unverified list
	exports.outputRatings(Math.floor(oldReview.rating), category, false, channel);
}

/**
 * Updates a review of a title in the unverified list.
 *
 * @param {String} category - the category the title is in
 * @param {String} title - title to update
 * @param {Number} rating - rating given for the title
 * @param {String} userID - user updating giving the review
 */
function updateUnverifiedReview(category, title, rating, userID) {
	ratings.unverified[category][title] = {
		reviews: {},
		rating: rating,
		time: moment().toJSON()
	};
	ratings.unverified[category][title].reviews[userID] = rating;
}

/**
 * Refreshes all of the ratings.
 *
 * @param {Object} channel - channel to refresh ratings in
 */
function refreshRatings(channel, isCalledByStartup) {
	const categories = ['tv', 'movies'];
	categories.forEach((category) => {
		for (var i=1; i < 5; i++) {
			exports.outputRatings(i, category, true, channel);
			exports.outputRatings(i, category, false, channel);
		}
	});

	if (isCalledByStartup) { return; }

	util.sendEmbedMessage(`Ratings Refreshed`, `All rating info is now up to date with user ratings, IMDB, and RT.`,
		null, null, null, null, channel.id);
}

/**
 * Exports and refreshes the ratings if all of the responses have come back.
 *
 * @param {Object} channel - channel to refresh ratings in
 */
function maybeExportAndRefreshRatings(channel, titleToPartialTitleMatch, missingTitles, isCalledByStartup) {
	if (ratingsResponses < 5) {
		ratingsResponses++;
	} else {
		util.exportJson(ratings, 'ratings');
		updateExternalRatingsJson();
		ratingsResponses = 0;
		refreshRatings(channel, isCalledByStartup);
		logger.error(`\n\n3rd Party Ratings Partial Matches: ${inspect(titleToPartialTitleMatch)}`);
		logger.error(`\n\n3rd Party Ratings Not Matched: ${inspect(missingTitles)}`);
	}
}

/**
 * Gets the titles of the category with the flag emoji removed frome each.
 *
 * @param {Object} category - category to get titles of
 */
function getTitlesWithFlagEmojiRemoved(category) {
	return Reflect.ownKeys(category).map((key) => key.replace(' 🎌', ''));
}

/**
 * Updates the 3rd party ratings for every title in the category.
 *
 * @param {Object} category - reviews in the category
 * @param {Object[]} responses - responses from 3rd party sites
 * @param {String} site - site ratings are from
 */
function updateThirdPartyRatingsForCategory(site, responses, category) {
	var titles = getTitlesWithFlagEmojiRemoved(category);
	var titleToPartialMatch = {};
	var titlesNotFound = [];

	responses.forEach((response, responseIdx) => {
		const targetTitle = titles[responseIdx];
		if (!response.success) {
			titlesNotFound.push(targetTitle);
			//logger.error(`RT/IMDB Rating not found for title "${targetTitle}", Error: ${inspect(response.error)}`);
			return;
		}

		const review = response.result;
		var title = site === 'rt' ? review.name : review.title;
		const score = site === 'rt' ? get(review, 'aggregateRating.ratingValue') : review.rating;
		if (!score) { return; }

		if (!category[title] && !category[`${title} 🎌`]) {
			titleToPartialMatch[targetTitle] = title;
			//logger.error(`RT/IMDB rating found, but expected title of ${targetTitle} does not match result: ${title}`);
		} else {
			title = category[title] ? title : `${title} 🎌`;
			category[title][`${site}Rating`] = score;
			//logger.info(`${site} Rating for ${title} = ${score}`);
		}
	});

	return { updatedCategory: category, titleToPartialMatch: titleToPartialMatch, titlesNotFound: titlesNotFound };
}

/**
 * Gets the 3rd party ratings for every title in the category.
 *
 * @param {Object} category - reviews in the category
 * @param {String} site - site to get ratings from
 */
function getThirdPartyRatingsForCategory(category, site) {
	var titles = getTitlesWithFlagEmojiRemoved(category);
	var promises = [];

	titles.forEach((title) => {
		if (site === 'rt') {
			promises.push(rt(title, 0, 3000));
		} else {
			promises.push(imdb.get(title, {apiKey: priv.imdbApiKey, timeout: 10000}));
		}
	});

	const toResultObject = (promise) => {
		return promise
			.then(result => ({ success: true, result }))
			.catch(error => ({ success: false, error }));
	};

	return Promise.all(promises.map(toResultObject));
}

/**
 * Gets the rating for the provided title.
 *
 * @param {String} title - title to get rating of
 */
function getRating(title) {
	const categories = ['movies', 'tv', 'unverified.movies', 'unverified.tv'];
	var rating = {
		title: null,
		rating: null,
		category: null,
		isVerified: null
	};

	categories.some((category) => {
		const ratingsInCategory = get(ratings, category);
		const ratingsKeys = Object.keys(ratingsInCategory);
		const fuse = new Fuse(ratingsKeys, c.RATING_FUZZY_OPTIONS);
		const fuzzyResults = fuse.search(title);
		if (fuzzyResults.length === 0) { return false; }

		const matchingTitle = ratingsKeys[fuzzyResults[0]];
		const lastChar = title[title.length -1];
		if (!isNaN(lastChar) && !matchingTitle.endsWith(lastChar)) { return false; }

		rating.title = matchingTitle;
		rating.isVerified = !category.includes('.');
		rating.category =  rating.isVerified ? category : category.split('.')[1];
		rating.rating = ratingsInCategory[rating.title];


		return true;
	});

	return rating;
}

/**
 * Outputs a title not found message.
 *
 * @param {String} title - title that wasn't found
 * @param {Object} channel - channel command was called in
 * @param {String} userID - id of the user calling the command
 */
function titleNotFound(title, channel, userID) {
	util.sendEmbedMessage(`Title not Found`, `There is no title matching "${title}" in any category`,
		userID, null, null, null, channel.id);
}

/**
 * Outputs the movies or tv shows with the rating provided.
 *
 * @param {Number} rating - numerical rating 1-4
 * @param {String} category - tv, movies, or unverified
 * @param {Boolean} isVerified - whether or not the title is verified
 * @param {Object=} channel - text channelt to output ratings in
 */
exports.outputRatings = function(rating, category, isVerified, channel) {
	category = category === 'movie' ? 'movies' : category;
	const targetRatings = isVerified ? ratings : ratings.unverified;
	const titles = Object.keys(targetRatings[category]).sort();
	const output = determineRatingsOutput(titles, targetRatings, category, rating);

	if (output === '') { return; }

	if (channel) {
		const verification = isVerified ? '' : 'UNVERIFIED_';
		const msgToEdit = `${verification}${rating}_STAR_${category.toUpperCase()}_MSG_ID`;

		channel.fetchMessage(c[msgToEdit])
			.then((message) => {
				const updatedMsg = new Discord.RichEmbed({
					color: 0xffff00,
					title: message.embeds[0].title,
					description: output
				});
				message.edit('', updatedMsg);
			})
			.catch((err) => {
				logger.error(`Edit Ratings Msg Error: ${err}`);
			});
	} else {
		const categoryEmoji = c[`${category.toUpperCase()}_EMOJI`];
		util.sendEmbedMessage(`${categoryEmoji}	${getStars(rating)}`, output);
	}
};

/**
 * Updates the rating for a tv show or movie.
 *
 * @param {String} targetCategory - tv or movies
 * @param {Number} rating - numerical rating 1-4
 * @param {String[]} args - arguments passed to the command
 * @param {Object} channel - the channel the msg was sent from
 * @param {String} userID - id of user adding rating
 */
exports.rate = function(targetCategory, rating, args, channel, userID) {
	targetCategory = targetCategory === 'movie' ? 'movies' : targetCategory;
	var titleIdx = 3;
	if (targetCategory !== 'movies' && targetCategory !== 'tv') {
		if (isNaN(targetCategory)) { return; }

		rating = targetCategory;
		targetCategory = null;
		titleIdx = 2;
	}

	if (isNaN(rating)) { return; }

	const targetTitle = determineTitle(util.getTargetFromArgs(args, titleIdx));
	var { category, title } = getRating(targetTitle);
	if (!title && !targetCategory) { return; }


	if (category && targetCategory && category !== targetCategory) {
		return util.sendEmbedMessage(`Duplicate Titles Not Allowed`,
			`Try adding the year released, to make the title unique, e.g. \`${title} (${(new Date()).getFullYear()})\``,
			userID, null, null, null, channel.id);
	}

	targetCategory = targetCategory || category;
	title = title || targetTitle;
	var avgRating = updateRatingAndDetermineAvg(targetCategory, title, userID, Number(rating), channel);
	const categoryEmoji = c[`${targetCategory.toUpperCase()}_EMOJI`];

	util.sendEmbedMessage(`${categoryEmoji} ${title} - Rated ${getStars(rating)} by ${util.getNick(userID)}`,
		`Average Rating: ${getStars(avgRating)}`, userID, null, null, null, channel.id);
};

/**
 * Displays the reviewers and ratings for the provided title.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {String} userID - id of user requesting info
 */
exports.ratingInfo = function(args, userID) {
	const channel = bot.getClient().channels.find('id', c.RATINGS_CHANNEL_ID);
	const targetTitle = util.getTargetFromArgs(args, 1);
	const { title, rating, category, isVerified } = getRating(targetTitle);
	if (!title) { return titleNotFound(targetTitle, channel, userID); }

	const verification = isVerified ? '' : 'Unverified ';
	var info = `***${verification}${util.capitalizeFirstLetter(category)}***\n\n`;
	if (rating.rtRating) {
		info += `🍅 **${rating.rtRating}**	`;
	}
	if (rating.imdbRating && rating.imdbRating !== 'N/A') {
		info += `**\`IMDB\`** **${rating.imdbRating}**	`;
	}
	if (rating.rating % 1 !== 0) {
		info += `${getStars(1)} **${rating.rating.toPrecision(2)}**`;
	}
	info += '\n\n**Reviews**';
	for (var reviewer in rating.reviews) {
		info += `\n${util.getNick(reviewer)}	${getStars(rating.reviews[reviewer])}`;
	}

	util.sendEmbedMessage(title, info, userID, null, null, null, channel.id);
};

/**
 * Renames a title.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {String} userID - id of calling user
 * @param {Object} channel - channel called from
 */
exports.rename = function(args, userID, channel) {
	const renameOperation = util.getTargetFromArgs(args, 1);
	if (!renameOperation.includes('=')) { return; }

	const titles = renameOperation.split('=');
	const oldTitle = titles[0];
	const newTitle = titles[1];

	const { title, rating, category, isVerified } = getRating(oldTitle);
	if (!title) { return titleNotFound(oldTitle, channel, userID); }

	if (isVerified) {
		ratings[category][newTitle] = ratings[category][title];
		delete ratings[category][title];
	} else {
		ratings.unverified[category][newTitle] = ratings.unverified[category][title];
		delete ratings.unverified[category][title];
	}

	exports.outputRatings(Math.floor(rating.rating), category, isVerified, channel);

	util.sendEmbedMessage(`${title} - Renamed by ${util.getNick(userID)}`,
		`New Title: ${newTitle}`, userID, null, null, null, channel.id);
	util.exportJson(ratings, 'ratings');
	updateExternalRatingsJson();
};

/**
 * Updates the 3rd party ratings for all titles.
 */
exports.updateThirdPartyRatings = function(isCalledByStartup) {
	const channel = bot.getClient().channels.find('id', c.RATINGS_CHANNEL_ID);
	const categories =  ['tv', 'movies'];
	var titleToPartialTitleMatch = {
		movies: {
			rt: {},
			imdb: {}
		},
		tv: {
			imdb: {}
		}
	};
	var missingTitles = {
		movies: {
			rt: [],
			imdb: []
		},
		tv: {
			imdb: []
		}
	};

	function sumRatingErrors(titleToPartialMatch, titlesNotFound, category, site) {
		Object.assign(titleToPartialTitleMatch[category][site], titleToPartialMatch);
		missingTitles[category][site] = missingTitles[category][site].concat(titlesNotFound);
	}

	if (Object.keys(ratings).length === 0) { return; }

	categories.forEach((category) => {
		const sites = category === 'tv' ? ['imdb'] : ['rt', 'imdb'];
		sites.forEach((site) => {
			getThirdPartyRatingsForCategory(ratings[category], site)
				.then((responses) => {
					const { updatedCategory, titleToPartialMatch, titlesNotFound } = updateThirdPartyRatingsForCategory(site, responses, ratings[category]);
					sumRatingErrors(titleToPartialMatch, titlesNotFound, category, site);
					ratings[category] = updatedCategory;
					maybeExportAndRefreshRatings(channel, titleToPartialTitleMatch, missingTitles, isCalledByStartup);
				});

			getThirdPartyRatingsForCategory(ratings.unverified[category], site)
				.then((responses) => {
					const { updatedCategory, titleToPartialMatch, titlesNotFound } = updateThirdPartyRatingsForCategory(site, responses, ratings.unverified[category]);
					sumRatingErrors(titleToPartialMatch, titlesNotFound, category, site);
					ratings.unverified[category] = updatedCategory;
					maybeExportAndRefreshRatings(channel, titleToPartialTitleMatch, missingTitles, isCalledByStartup);
				});
		});
	});
};

/**
 * Changes the category of a title.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {Object} channel - channel called from
 * @param {String} userID - id of calling user
 */
exports.changeCategory = function(args, channel, userID) {
	const targetTitle = util.getTargetFromArgs(args, 1);
	const { title, rating, category, isVerified } = getRating(targetTitle);
	if (!title) { return titleNotFound(targetTitle, channel, userID); }

	const newCategory = category === 'tv' ? 'movies' : 'tv';
	if (isVerified) {
		ratings[newCategory][title] = rating;
		delete ratings[category][title];
	} else {
		ratings.unverified[newCategory][title] = rating;
		delete ratings.unverified[category][title];
	}

	const flooredRating = Math.floor(rating.rating);
	exports.outputRatings(flooredRating, category, isVerified, channel);
	exports.outputRatings(flooredRating, newCategory, isVerified, channel);

	util.sendEmbedMessage(`Category Changed`, `"${title}" has been moved from ${category} to ${newCategory}`,
		userID, null, null, null, channel.id);
	util.exportJson(ratings, 'ratings');
	updateExternalRatingsJson();
};

/**
 * Deletes a title from the review list.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {Object} channel - channel called from
 * @param {String} userID - id of calling user
 */
exports.delete = function(args, channel, userID) {
	const targetTitle = util.getTargetFromArgs(args, 1);
	const { title, rating, category, isVerified } = getRating(targetTitle);
	if (!title) { return titleNotFound(targetTitle, channel, userID); }

	//If not admin and the user is not the only reviewer of the title
	if (!util.isAdmin(userID) && (!rating.reviews[userID] || Object.keys(rating.reviews).length !== 1)) {
		return util.sendEmbedMessage(`Deletion Not Authorized`, `"${title}" can not be deleted, except by ${util.mentionUser(c.K_ID)},` +
				' as you are not the sole reviewer of this title.', userID, null, null, null, channel.id);
	}

	logger.info(`Deleting rating for "${title}" in ${category}`);
	if (isVerified) {
		delete ratings[category][title];
	} else {
		delete ratings.unverified[category][title];
	}

	exports.outputRatings(Math.floor(rating.rating), category, isVerified, channel);
	util.sendEmbedMessage(`Rating Deleted`, `"${title}" has been deleted`,
		userID, null, null, null, channel.id);
	util.exportJson(ratings, 'ratings');
	updateExternalRatingsJson();
};

function convertRatingsToTableData() {
	const categories = ['tv', 'movies'];
	var tableData = [];

	categories.forEach((category) => {
		tableData = tableData.concat(convertRatingsCategoryToTableData(category, true))
			.concat(convertRatingsCategoryToTableData(category, false));
	});

	return tableData;
}

function convertRatingsCategoryToTableData(category, isVerified) {
	const reviewsInCategory = isVerified ? ratings[category] : ratings.unverified[category];
	var tableData = [];

	for (var title in reviewsInCategory) {
		var rating = Object.assign({}, reviewsInCategory[title]);
		var reviewers = '';
		for (var reviewerID in rating.reviews) {
			const nickname = util.getNick(reviewerID);
			const ratingNum = rating.reviews[reviewerID];

			if (!nickname || isNaN(ratingNum)) { return; }

			reviewers += `${nickname} (${ratingNum}), `;
		}

		rating.reviews = reviewers.slice(0, -2);
		if (rating.rating) {
			rating.rating = rating.rating.toString();
		}
		if (rating.time) {
			rating.time = moment(rating.time).format('M/D/YY');
		}
		const reviewData = Object.assign({ title: title, category: category, verified: isVerified.toString()}, rating);
		tableData.push(reviewData);
	}

	return tableData;
}

function updateExternalRatingsJson() {
	const tableData = convertRatingsToTableData();
	var options= {
		uri: `https://api.myjson.com/bins/${priv.externalJsonID}`,
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(tableData)
	};
	rp(options)
		.then(() => {
			logger.info(`Reviews external json updated`);
		})
		.catch(util.log);
}