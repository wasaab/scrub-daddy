var rp = require('request-promise');
var moment = require('moment');
const c = require('../const.js');
const util = require('../utilities/utilities.js');
const mergeImg = require('merge-img');
const Jimp = require('jimp');
const { JSDOM } = require('jsdom');
var forumData = require('../../resources/data/carForum.json');
var updatedForumIdToLastCrawlTime = {};
const dateFormat = 'MM-DD-YYYY';
const baseUrl = 'https://www.2addicts.com';
const baseForumPath = `${baseUrl}/forums/forumdisplay.php?f=`;
const forumIdToName = {
    '551': 'Engine / Drivetrain / Exhaust / Bolt-ons',
    '547': 'Wheels and Tires Items',
    '549': 'Exterior Parts',
    '550': 'Interior Parts',
    '548': 'Suspension / Brakes / Chassis / Spacers'
};
var channel;

/**
 * Notifies the user via DM of a part for sale matching one of their keywords.
 *
 * @param {String} userID - id of the user to notify
 * @param {String[]} keywords - keywords that were specified by user
 * @param {String} match - the words that matched the keywords
 * @param {String} url - url of matching classified listing
 */
function notify(userID, keywords, match, url) {
    util.getMembers()
        .find('id', userID)
        .createDM()
        .then((dm) => {
            dm.send('I heard you might be looking for this: ' +
                `${url}\nKeywords: ${keywords}, match: ${match}`);
        });
}

/**
 * Ignores a post if it has a trash reaction.
 *
 * @param {Object} message - the message to potentially ignore
 */
function maybeIgnorePost(message) {
    if (!message.reactions.has(c.TRASH_REACTION)) { return; }

    const post = message.embeds[0];

    forumData.ignoredPosts.push(post.url.split('/')[4]);
    util.sendEmbedMessage('Post Ignored', `You will no longer see updates for the following post:\n${post.title}`,
        message.member.id, null, null, null, channel.id, null, post.url);
    message.delete();
    util.exportJson(forumData, 'carForum');
}

/**
 * Ignores all posts that have trash reactions.
 */
exports.ignorePosts = function() {
	channel.fetchMessages({limit: 50})
        .then((foundMessages) => {
            foundMessages.array().forEach((msg) => {
                maybeIgnorePost(msg);
            });
        });
};

/**
 * Outputs the forum header if the current post is the first in the forum.
 *
 * @param {Number} i - the current post index
 * @param {String} forumID - id of the forum the post is in
 * @param {Object} postMoment - the moment object representing post time
 */
function maybeOutputForumHeader(i, forumID, postMoment) {
    if (i !== 1) { return; }

    updatedForumIdToLastCrawlTime[forumID] = postMoment.valueOf();
    channel.send(`**${forumIdToName[forumID]}**\n\`\`\`${'-'.repeat(61)}\`\`\``);
}

/**
 * Determines tags to react to the post with, representing the contents.
 *
 * @param {String} postText - text of the post to determine tags of
 */
function determineTags(postText) {
    var tags = [];

    for (var tag in c.TAG_TO_TEXT) {
        if (postText.match(new RegExp(c.TAG_TO_TEXT[tag].join('|'), 'gi'))) {
            tags.push(tag);
        }
    }

    return tags;
}

/**
 * Outputs the post and forum header if it is the first post.
 *
 * @param {String} title - the title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Number} i - the index of the post
 * @param {String} forumID - the id of the forum the post was made in
 * @param {Object} postMoment - the moment object representing post time
 * @param {boolean} textOnly - true iff the post has no attachments
 */
function outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment, textOnly) {
    const formattedTitle = title.text;
    const priceEle = postDoc.querySelector('div.bpitemprice');
    const descriptionEle = postDoc.querySelector('.bpclassmain') || postDoc.querySelector('.thePostItself');
    const description = descriptionEle.textContent.slice(0, 2047);
    const tags = determineTags(`${formattedTitle} ${description}`);
    const attachPath = textOnly ? null : 'attachment://postCollage.png';
    const imgPath = textOnly ? null : './resources/images/postCollage.png';
    var price = priceEle ? priceEle.getAttribute('raw') : 'N/A';

    price = '-2' === price ? 'SOLD' : `$${price}`;

    maybeOutputForumHeader(i, forumID, postMoment);
    util.sendEmbedMessage(`\n\`${price}\`    **${formattedTitle}**`, description, null, attachPath,
        null, null, channel.id, imgPath, `${baseUrl}/forums/${title.getAttribute('href')}`, postMoment.toDate())
        .then((msgSent) => {
            tags.forEach((tag) => {
                msgSent.react(tag);
            });
        });
}

/**
 * Merges all images in the post into a collage, then outputs the post.
 *
 * @param {Promise[]} imgResponses - image buffers
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Number} i - the index of the post
 * @param {String} forumID - the id of the forum the post was made in
 * @param {Object} postMoment - the moment object representing post time
 */
function mergeAndOutput(imgResponses, title, postDoc, i, forumID, postMoment) {
    var images = [];

    imgResponses.forEach((imgResponse) => {
        if (!imgResponse.success) { return; }

        images.push(imgResponse.result);
    });

    if (!images) { return outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment, true); }

    mergeImg(images, { direction: false })
        .then((img) => {
            img.write('./resources/images/postCollage.png',
                () => outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment));
        })
        .catch(util.log);
}


/**
 * Scales the image, so it can fit in the collage.
 *
 * @param {Object} response - reponse from image download request
 * @param {Promise[]} imgPromises - image buffers
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Number} i - the index of the post
 * @param {String} forumID - the id of the forum the post was made in
 * @param {Object} postMoment - the moment object representing post time
 */
function scaleImage(response, imgPromises, imageUrls, title, postDoc, i, forumID, postMoment) {
    response.result.scaleToFit(500, Jimp.AUTO, null, (err, resizedImg) => {
        imgPromises.push(resizedImg.getBufferAsync(Jimp.MIME_JPEG));

        if (imgPromises.length !== imageUrls.length) { return; }

        util.handleAllPromises(imgPromises)
            .then((responses) => {
                mergeAndOutput(responses, title, postDoc, i, forumID, postMoment);
            });
    });
}

/**
 * Scales all images in the post, so they can fit in the collage.
 *
 * @param {Object[]} responses - reponses from image download requests
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Number} i - the index of the post
 * @param {String} forumID - the id of the forum the post was made in
 * @param {Object} postMoment - the moment object representing post time
 */
function scaleImages(responses, imageUrls, title, postDoc, i, forumID, postMoment) {
    var imgPromises = [];

    responses.forEach((response) => {
        if (!response.success) { return; }

        scaleImage(response, imgPromises, imageUrls, title, postDoc, i, forumID, postMoment);
    });
}

/**
 * Downloads all of the images in the post.
 *
 * @param {String[]} imageUrls - urls of all images in the post
 * @returns {Promise} the image buffers
 */
function downloadImages(imageUrls) {
    var promises = [];

	imageUrls.forEach((url) => {
        promises.push(Jimp.read(url));
	});

	return util.handleAllPromises(promises);
}

/**
 * Builds a post as a discord message.
 *
 * @param {String} title - title of the post
 * @param {Object} postDoc - the document of the post
 * @param {Number} i - the index of the post
 * @param {String[]} imageUrls - urls of all images in the post
 * @param {String} forumID - the id of the forum the post was made in
 * @param {Object} postMoment - the moment object representing post time
 */
function buildPost(title, postDoc, i, imageUrls, forumID, postMoment) {
    if (imageUrls.length === 0) {
        return outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment, true);
    }

    downloadImages(imageUrls)
        .then((responses) => {
            scaleImages(responses, imageUrls, title, postDoc, i, forumID, postMoment);
        });
}

/**
 * Gets the urls of every image in the post, attached or linked.
 *
 * @param {Object} postDoc - the document of the post
 */
function getImageUrls(postDoc) {
    const attachedImages = [...postDoc.querySelectorAll('img.attach')]
        .map((img) => `${baseUrl}/forums/${img.getAttribute('src')}`);
    const hostedImages = [...postDoc.querySelectorAll('.bpclassmain img')]
        .map((img) => img.getAttribute('src'));

    return attachedImages.concat(hostedImages);
}

/**
 * Determines the moment the post was last updated.
 *
 * @param {Object} time - post updated time element from the page
 */
function determinePostMoment(time) {
    var date = time.previousSibling.wholeText.trim();

    if ('Yesterday' === date) {
        date = moment().subtract(1, 'days').format(dateFormat);
    } else if ('Today' === date) {
        date = moment().format(dateFormat);
    }

    return moment(`${date} ${time.textContent}`, `${dateFormat} hh:mm A`);
}

/**
 * Gets the info of the post.
 *
 * @param {String[]} titles - titles of posts in the forum
 * @param {Object[]} time - post updated time elements from the page
 * @param {Number} i - the index of the current post
 * @param {String} forumID - the id of the forum the post was made in
 */
function getPostInfo(titles, times, i, forumID) {
    if (titles.length < 1) { return; }

    const title = titles.pop();
    const time = times.pop();
    var isFinished = false;

    return rp(`${baseUrl}/forums/${title.getAttribute('href')}`)
        .then((postHtml) => {
            const postDoc = new JSDOM(postHtml, { url: baseUrl }).window.document;

            if (!postDoc || i > 15) { return; }

            const postMoment = determinePostMoment(time);

            if (postMoment.isSameOrBefore(moment(forumData.forumIdToLastCrawlTime[forumID]))) {
                isFinished = true;
                return;
            }

            buildPost(title, postDoc, i, getImageUrls(postDoc), forumID, postMoment);
        })
        .catch(util.log)
        .finally(() => {
            if (isFinished) { return; }

            return getPostInfo(titles, times, i + 1, forumID);
        });
}

/**
 * Converts the target node list to an array.
 *
 * @param {String} selector - selector to find element with
 */
function getNodeListAsArray(selector) {
    return [].slice.call(document.querySelectorAll(selector)).reverse();
}

/**
 * Scrapes titles and post updated timestamps from the page.
 *
 * @param {Object} document - the document of the page being scraped
 * @param {String} forumID - the id of the forum to scrape posts in
 */
function scrapeTitlesAndTimestamps(document, forumID) {
    var titles = getNodeListAsArray(`#threadbits_forum_${forumID} a[id^='thread_title']`);
    const lastPostTimes = getNodeListAsArray(`#threadbits_forum_${forumID} .time`);

    titles = titles.filter((title, i) => {
        if (forumData.ignoredPosts.includes(title.getAttribute('href'))) {
            lastPostTimes.splice(i, 1);
            return false;
        }

        return true;
    });

    return { titles, lastPostTimes };
}

/**
 * Gets a post in the specified forum.
 *
 * @param {String} forumID - Id of the forum to get post in
 */
function getPostInForum(forumID) {
    return rp(`${baseForumPath}${forumID}`)
        .then((html) => {
            const { window } = new JSDOM(html, { url: 'https://www.2addicts.com' });
            const document = window.document;
            const { titles, lastPostTimes } = scrapeTitlesAndTimestamps(document, forumID);

            return getPostInfo(titles, lastPostTimes, 1, forumID);
        })
        .catch(util.log);
}

/**
 * Gets posts in the specified forums if any still need processing.
 *
 * @param {String[]} forumIds - Ids of the forums to get posts in
 */
function maybeGetPostsInForum(forumIds) {
    if (forumIds.length !== 0) { return getPostsInForums(forumIds); }

    setTimeout(() => {
        forumData.forumIdToLastCrawlTime = Object.assign(
            forumData.forumIdToLastCrawlTime, updatedForumIdToLastCrawlTime);
        util.exportJson(forumData, 'carForum');
    }, 3000);
}

/**
 * Gets posts in the specified forums..
 *
 * @param {String[]} forumIds - Ids of the forums to get posts in
 */
function getPostsInForums(forumIds) {
    const forumID = forumIds.pop();

    return getPostInForum(forumID)
        .then(() => maybeGetPostsInForum(forumIds));

}

/**
 * Crawls the car forum looking for posts of interest.
 */
exports.crawlCarForum = () => {
    channel.send(`**${moment().format('ddd MMM Do   hh:mm A')}** \`\`\` \`\`\``);
    getPostsInForums(Object.keys(forumIdToName));
};

/**
 * Sets the car parts channel.
 *
 * @param {Object} carPartsChannel - channel where car parts are posted
 */
exports.setCarPartsChannel = (carPartsChannel) => {
    channel = carPartsChannel;
};


