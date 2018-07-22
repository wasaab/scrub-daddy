var Discord = require('discord.js');
var moment = require('moment');
var Fuse = require('fuse.js');
var imdb = require('imdb-api');
var rt = require('lw5');

var c = require('./const.js');
var bot = require('./bot.js');
var util = require('./utilities.js');
var config = require('../resources/data/cofnig.json');
var ratings = require('../resources/data/ratings.json');
var ratingsResponses = 0;
var ratingsChannel = bot.getClient().find('id', c.RATINGS_CHANNEL_ID);

/**
 * Outputs a message explaining how to setup the ratings channel.
 */
function outputSetupChannelMsg() {
	util.sendEmbedMessage('The Ratings Channel Has Not Been Setup',
		'The server admin can create this channel by calling `.setup-ratings`');
}

/**
 * Gets the proper title from a string.
 * Source: https://stackoverflow.com/a/6475125
 *
 * @param {String} original - string to get proper title from
 */
function determineTitle(original) {
	var i, j, title;
	var title = original.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});

	// Certain minor words should be left lowercase unless
	// they are the first or last words in the string
	const lowers = ['A', 'An', 'The', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At',
	'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'Onto', 'To', 'With'];
	for (i = 0, j = lowers.length; i < j; i++)
		title = title.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'),
		function(txt) {
			return txt.toLowerCase();
		});

	// Certain words such as initialisms or acronyms should be left uppercase
	const uppers = ['Id', 'Tv'];
	for (i = 0, j = uppers.length; i < j; i++)
		title = title.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'),
		uppers[i].toUpperCase());

	return title;
}

/**
 * Gets a string of stars.
 *
 * @param {Number} count - number of stars to get
 */
function getStars(count) {
	var result = '';
	for (i=0; i < Math.floor(count); i++) {
		result += '⭐';
	}

	if (count % 1 !== 0) {
		result += '★'
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
 * @param {String} targetCategory - 'tv' or 'movie'
 * @param {Number} rating - rating for the title
 */
function determineRatingsOutput(titles, targetRatings, targetCategory, rating) {
	var output = '';
	titles.forEach((title, i) => {
		const currRating = targetRatings[targetCategory][title];
		var extraRating = '';
		if (Math.floor(currRating.rating) === rating) {
			if (currRating.time && moment().diff(moment(currRating.time), 'weeks') < 2) {
				title += ' 🆕'
			}
			output += `**${title}**\n`;
			if (targetCategory === 'movie' && currRating.rtRating) {
				extraRating += `🍅 **${currRating.rtRating}**	`;
			}
			if (currRating.imdbRating && currRating.imdbRating !== 'N/A') {
				extraRating += `**\`IMDB\`** **${currRating.imdbRating}**	`;
			}
			if (currRating.rating % 1 !== 0) {
				extraRating += `${getStars(1)} **${currRating.rating.toPrecision(2)}**`;
			}
			if (i !== titles.length - 1 && extraRating !== '') {
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
 */
function updateRatingAndDetermineAvg(category, title, userID, rating) {
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
			verifyReview(category, title, oldReview);
		}

		avgRating = determineRating(category, title);
		ratings[category][title].reviews[userID] = rating;
		ratings[category][title].rating = avgRating;

		// Update list review used to be in
		if (!unverifiedReview && Math.floor(avgRating) !== Math.floor(oldReview.rating)) {
			exports.outputRatings(Math.floor(oldReview.rating), category, null);
		}
	}

	// Update list review is now in
	if (isUnverified) {
		exports.outputRatings(Math.floor(avgRating), 'unverified', category);
	} else {
		exports.outputRatings(Math.floor(avgRating), category, null);
	}
	util.exportJson(ratings, 'ratings');

	return avgRating;
}

/**
 * Verifies a review.
 *
 * @param {String} category - the category the title is in
 * @param {String} title - title to verify
 * @param {Object} oldReview - review prior to update
 */
function verifyReview(category, title, oldReview) {
	ratings[category][title] = oldReview;
	delete ratings.unverified[category][title];
	// update unverified list
	exports.outputRatings(Math.floor(oldReview.rating), 'unverified', category);
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
		time: moment()
	};
	ratings.unverified[category][title].reviews[userID] = rating;
}

/**
 * Refreshes all of the ratings.
 *
 * @param {Boolean} inSetup - true if channel is in setup
 */
function refreshRatings(inSetup) {
	const categories = ['tv', 'movie'];

	function outputAllRatings(outputVerified, outputUnverified) {
		categories.forEach((category) => {
			for (var i=4; i > 0; i--) {
				if (outputVerified) {
					exports.outputRatings(i, category, null);
				}
				if (outputUnverified) {
					exports.outputRatings(i, 'unverified', category);
				}
			}
		});
	}

	if (inSetup) {
		outputAllRatings(true, false);
		setTimeout(() => {
			outputAllRatings(false, true);
		}, 3000);
	} else {
		outputAllRatings(true, true);
	}

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(),
		title: `Ratings Refreshed`,
		description: `All rating info is now up to date with user ratings, IMDB, and RT.`
	}));
}

/**
 * Exports and refreshes the ratings if all of the responses have come back.
 */
function maybeExportAndRefreshRatings() {
	if (ratingsResponses < 5) {
		ratingsResponses++;
	} else {
		util.exportJson(ratings, 'ratings');
		ratingsResponses = 0
		refreshRatings();
	}
}

/**
 * Updates the 3rd party ratings for every title in the category.
 *
 * @param {Object} category - reviews in the category
 * @param {Object[]} responses - responses from 3rd party sites
 * @param {String} site - site ratings are from
 */
function updateThirdPartyRatingsForCategory(site, responses, category) {
	responses.forEach((response) => {
		if (!response.success) { return; }
		const review = response.result;
		const title = site === 'rt' ? review.name : review.title;
		const score = site === 'rt' ? get(review, 'aggregateRating.ratingValue') : review.rating;
		if (!score) { return; }

		if (!category[title]) {
			util.logger.error(`<ERROR> ${util.getTimestamp()}  RT rating found, but no matching title for: ${title}`);
		} else {
			category[title][`${site}Rating`] = score;
			util.logger.info(`<INFO> ${util.getTimestamp()} ${site} Rating for ${title} = ${score}`);
		}
	})

	return category;
}

/**
 * Gets the 3rd party ratings for every title in the category.
 *
 * @param {Object} category - reviews in the category
 * @param {String} site - site to get ratings from
 */
function getThirdPartyRatingsForCategory(category, site) {
	var titles = Object.keys(category);
	var promises = [];

	titles.forEach((title) => {
		if (site === 'rt') {
			promises.push(rt(title, 0, 3000))
		} else {
			promises.push(imdb.get(title, {apiKey: 'fa354300', timeout: 10000}));
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
	const titles = getAllTitles();
	var fuse = new Fuse(titles, c.RATING_FUZZY_OPTIONS);
	const fuzzyResults = fuse.search(title);
	if (fuzzyResults.length !== 0) {
		const matchingTitle = titles[fuzzyResults[0]];
		util.logger.info(`<INFO> ${util.getTimestamp()}	Rating Info Title Match ${matchingTitle}`);
		const rating = ratings.movie[matchingTitle] || ratings.tv[matchingTitle]
		|| ratings.unverified.movie[matchingTitle] || ratings.unverified.tv[matchingTitle];
		return {
			title: matchingTitle,
			rating: rating
		}
	}
}

/**
 * Outputs a title not found message.
 *
 * @param {String} title - title that wasn't found
 * @param {String} userID - id of the user calling the command
 */
function titleNotFound(title, userID) {
	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: `Title not Found`,
		description: `There is no title matching "${title}" in any category`
	}));
}

/**
 * Gets all of the titles concatenated into a single array.
 */
function getAllTitles() {
	return Object.keys(ratings.movie).concat(
		Object.keys(ratings.tv),
		Object.keys(ratings.unverified.tv),
		Object.keys(ratings.unverified.movie)
	);
}

/**
 * Outputs the movies or tv shows with the rating provided.
 *
 * @param {Number} rating - numerical rating 1-4
 * @param {String} category - tv, movie, or unverified
 * @param {String=} subCategory - tv or movie
 * @param {Boolean} inSetup - true if channel is in setup
 */
exports.outputRatings = function(rating, category, subCategory, inSetup) {
	if (!ratingsChannel) { return outputSetupChannelMsg(); }

	const targetRatings = category === 'unverified' ? ratings.unverified : ratings;
	const targetCategory = subCategory || category;
	const categoryEmoji = targetCategory === 'tv' ? c.TV_EMOJI : c.MOVIE_EMOJI;
	const titles = Object.keys(targetRatings[targetCategory]).sort();
	const output = determineRatingsOutput(titles, targetRatings, targetCategory, rating);

	if (output === '') { return; }

	var msgToEdit = `${rating}_STAR_${targetCategory.toUpperCase()}_MSG_ID`;
	if (category === 'unverified') {
		msgToEdit =  `UNVERIFIED_${msgToEdit}`;
	}

	if (!inSetup) {
		ratingsChannel.fetchMessage(c[msgToEdit])
			.then((message) => {
				const updatedMsg = new Discord.RichEmbed({
					color: 0xffff00,
					title: message.embeds[0].title,
					description: output
				});
				message.edit('', updatedMsg);
			})
			.catch((err) => {
				util.logger.error(`<ERROR> ${util.getTimestamp()}  Edit Ratings Msg Error: ${err}`);
			});
	} else {
		// Send the category header message
		if (category === 'unverified' && subCategory === 'tv') {
			ratingsChannel.send('**UNVERIFIED**');
		}

		ratingsChannel.send(new Discord.RichEmbed({
			color: util.getUserColor(userID),
			title: `${categoryEmoji}	${getStars(rating)}`,
			description: titlesMsg
		}))
		.then((msg) => {
			config[msgToEdit] = msg.id;

			if (msgToEdit === 'UNVERIFIED_1_STAR_MOVIE_MSG_ID') {
				util.exportJson(config, 'config');
			}
		});
	}
}

/**
 * Updates the rating for a tv show or movie.
 *
 * @param {String} category - tv or movie
 * @param {Number} rating - numerical rating 1-4
 * @param {String[]} args - arguments passed to the command
 * @param {String} userID - id of user adding rating
 */
exports.rate = function(category, rating, args, userID) {
	if (category !== 'movie' && category !== 'tv') { return; }

	const categoryEmoji = category === 'tv' ? c.TV_EMOJI : c.MOVIE_EMOJI;
	const title = determineTitle(util.getTargetFromArgs(args, 3));
	var avgRating = updateRatingAndDetermineAvg(category, title, userID, rating);

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: `${categoryEmoji} ${title} - Rated ${getStars(rating)} by ${util.getNick(userID)}`,
		description: `Average Rating: ${getStars(avgRating)}`
	}));
}

/**
 * Displays the reviewers and ratings for the provided title.
 *
 * @param {String} targetTitle - title to get info for
 * @param {String} userID - id of user requesting info
 */
exports.ratingInfo = function(targetTitle, userID) {
	const { title, rating } = getRating(targetTitle);
	if (!title || !rating) { return; }

	var info = '';
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
	for (reviewer in rating.reviews) {
		info += `\n${util.getNick(reviewer)}	${getStars(rating.reviews[reviewer])}`
	}

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: title,
		description: info
	}));
}

/**
 * Renames a title.
 *
 * @param {String} category - category the title is in
 * @param {String[]} args - arguments provided to the command
 * @param {String} userID - id of calling user
 */
exports.rename = function(category, args, userID) {
	const renameOperation = util.getTargetFromArgs(args, 2);
	if (!renameOperation.includes('=')) { return; }

	const titles = renameOperation.split('=');
	const oldTitle = titles[0];
	const newTitle = titles[1];

	if (ratings[category][oldTitle]) {
		ratings[category][newTitle] = ratings[category][oldTitle];
		delete ratings[category][oldTitle];
		exports.outputRatings(Math.floor(ratings[category][newTitle].rating), category, null);
	} else if (ratings.unverified[category][oldTitle]) {
		ratings.unverified[category][newTitle] = ratings.unverified[category][oldTitle];
		delete ratings.unverified[category][oldTitle];
		exports.outputRatings(Math.floor(ratings.unverified[category][newTitle].rating), 'unverified', category);
	} else {
		ratingsChannel.send(`${util.mentionUser(userID)} \`${oldTitle}\` has not been rated.`)
		return;
	}

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: `${oldTitle} - Renamed by ${util.getNick(userID)}`,
		description: `New Title: ${newTitle}`
	}));

	util.exportJson(ratings, 'ratings');
}

/**
 * Updates the 3rd party ratings for all titles.
 */
exports.updateThirdPartyRatings = function() {
	const categories =  ['tv', 'movie'];

	categories.forEach((category) => {
		const sites = category === 'tv' ? ['imdb'] : ['rt', 'imdb'];
		sites.forEach((site) => {
			getThirdPartyRatingsForCategory(ratings[category], site)
				.then((responses) => {
					ratings[category] = updateThirdPartyRatingsForCategory(site, responses, ratings[category]);
					maybeExportAndRefreshRatings();
				});

			getThirdPartyRatingsForCategory(ratings.unverified[category], site)
				.then((responses) => {
					ratings.unverified[category] = updateThirdPartyRatingsForCategory(site, responses, ratings.unverified[category]);
					maybeExportAndRefreshRatings();
				});
		});
	});
}

/**
 * Changes the category of a title.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {String} currentCategory - current category
 * @param {String} newCategory - new category
 * @param {String} userID - id of calling user
 */
exports.changeCategory = function(args, currentCategory, newCategory, userID) {
	const title = util.getTargetFromArgs(args, 3);
	if (!getRating(title)) { return titleNotFound(title, userID); }

	if (ratings[currentCategory][title]) {
		const verifiedReview = ratings[currentCategory][title];
		ratings[newCategory][title] = verifiedReview;
		delete ratings[currentCategory][title];
		exports.outputRatings(Math.floor(verifiedReview.rating), currentCategory, null);
		exports.outputRatings(Math.floor(verifiedReview.rating), newCategory, null);
	} else if (ratings.unverified[currentCategory][title]) {
		const unverifiedReview = ratings.unverified[currentCategory][title];
		ratings.unverified[newCategory][title] = unverifiedReview;
		delete ratings.unverified[currentCategory][title];
		exports.outputRatings(Math.floor(unverifiedReview.rating), 'unverified', currentCategory);
		exports.outputRatings(Math.floor(unverifiedReview.rating), 'unverified', newCategory);
	} else {
		ratingsChannel.send(new Discord.RichEmbed({
			color: util.getUserColor(userID),
			title: `Title not Found`,
			description: `There is no title matching "${title}" in ${currentCategory}`
		}));
		return;
	}

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: `Category Changed`,
		description: `"${title}" has been moved from ${currentCategory} to ${newCategory}`
	}));
	util.exportJson(ratings, 'ratings');
}

/**
 * Deletes a title from the review list.
 *
 * @param {String[]} args - arguments provided to the command
 * @param {String} category - category title is in
 * @param {String} userID - id of calling user
 */
exports.delete = function(args, category, userID) {
	const title = util.getTargetFromArgs(args, 2);
	if (!getRating(title)) { return titleNotFound(title, userID); }

	util.logger.info(`<INFO> ${util.getTimestamp()} Deleting rating for "${title}" in ${category}`);
	if (ratings[category][title]) {
		const verifiedReviewRating = ratings[category][title].rating;
		delete ratings[category][title];
		exports.outputRatings(Math.floor(verifiedReviewRating), category);
	} else if (ratings.unverified[category][title]) {
		const unverifiedReviewRating = ratings.unverified[category][title].rating;
		delete ratings.unverified[category][title];
		exports.outputRatings(Math.floor(unverifiedReviewRating), 'unverified', category);
	} else {
		ratingsChannel.send(new Discord.RichEmbed({
			color: util.getUserColor(userID),
			title: `Title not Found`,
			description: `There is no title matching "${title}" in ${category}`
		}));
		return;
	}

	ratingsChannel.send(new Discord.RichEmbed({
		color: util.getUserColor(userID),
		title: `Rating Deleted`,
		description: `"${title}" has been deleted`
	}));
	util.exportJson(ratings, 'ratings');
}

/**
 * Sets up the ratings channel with initial ratings, key, and usage.
 *
 * @param {Object} message - message sent by user
 */
exports.setup = function(message) {
	message.guild.createChannel('tv-and-movies', 'text')
		.then((rateChannel) => {
			config.RATINGS_CHANNEL_ID = rateChannel.id;
			ratingsChannel = rateChannel;

			ratingsChannel.send(c.RATINGS_KEY);
			ratingsChannel.send(c.RATINGS_USAGE);

			// output initial ratings
			refreshRatings();
		});

	util.sendEmbedMessage('TV and Movies Ratings Channel Created',
		`Initial ratings have been generated in ${util.mentionChannel(config.RATINGS_CHANNEL_ID)}.`);
}