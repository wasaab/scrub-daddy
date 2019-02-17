var rp = require('request-promise');
var moment = require('moment');
const fs = require('fs');
const c = require('./const.js');
const util = require('./utilities.js');
const mergeImg = require('merge-img');
const Jimp = require('jimp');
var jsdom = require('jsdom');
const { JSDOM } = jsdom;
var forumIdToLastCrawlTime = require('../resources/data/carForum.json');
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

function handleAllPromises(promises) {
    const toResultObject = (promise) => {
        return promise
        .then(result => ({ success: true, result }))
        .catch(error => ({ success: false, error }));
    };

    return Promise.all(promises.map(toResultObject));
}

function maybeOutputForumHeader(i, forumID, postMoment) {
    if (i === 1) {
        updatedForumIdToLastCrawlTime[forumID] = postMoment.valueOf();
        channel.send(`**${forumIdToName[forumID]}**\n\`\`\``
            + `-------------------------------------------------------------\`\`\``);
    }
}

// Todo: Consider allowing tags to be added via command
// In a separate message, mention certain users when a match is found (or dm)
function determineTags(postText) {
    var tags = [];

    for (var tag in c.TAG_TO_TEXT) {
        if (postText.match(new RegExp(c.TAG_TO_TEXT[tag].join('|'), 'gi'))) {
            tags.push(tag);
        }
    }

    return tags;
}

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
        })
}

function mergeAndOutput(imgResponses, title, postDoc, i, forumID, postMoment) {
    var images = [];

    imgResponses.forEach((imgResponse, responseIdx) => {
        if (!imgResponse.success) { return; }

        images.push(imgResponse.result);
    });

    if (!images) { return outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment, true); }

    mergeImg(images, { direction: false })
    .then((img) => {
        img.write('./resources/images/postCollage.png',
            () => outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment));
    })
    .catch(err => {
        console.error(err);
    });
}


function scaleImage(response, imgPromises, imageUrls, title, postDoc, i, forumID, postMoment) {
    response.result.scaleToFit(500, Jimp.AUTO, null, (err, resizedImg) => {
        imgPromises.push(resizedImg.getBufferAsync(Jimp.MIME_JPEG));

        if (imgPromises.length !== imageUrls.length) { return; }

        handleAllPromises(imgPromises)
        .then((responses) => {
            mergeAndOutput(responses, title, postDoc, i, forumID, postMoment)
        });
    });
}

function scaleImages(responses, imageUrls, title, postDoc, i, forumID, postMoment) {
    var imgPromises = [];

    responses.forEach((response, responseIdx) => {
        if (!response.success) { return; }

        scaleImage(response, imgPromises, imageUrls, title, postDoc, i, forumID, postMoment);
    });
}

function downloadImages(imageUrls) {
    var promises = [];

	imageUrls.forEach((url) => {
        promises.push(Jimp.read(url))
	});

	return handleAllPromises(promises);
}

function buildPost(title, postDoc, i, imageUrls, forumID, postMoment) {
    if (imageUrls.length === 0) {
        return outputPostAndMaybeForumHeader(title, postDoc, i, forumID, postMoment, true);
    }

    downloadImages(imageUrls)
        .then((responses) => {
            scaleImages(responses, imageUrls, title, postDoc, i, forumID, postMoment);
        });
}

function getImageUrls(postDoc) {
    const attachedImages = [...postDoc.querySelectorAll('img.attach')].map((img) => `${baseUrl}/forums/${img.getAttribute('src')}`);
    const hostedImages = [...postDoc.querySelectorAll('.bpclassmain img')].map((img) => img.getAttribute('src'));

    return attachedImages.concat(hostedImages);
}

function determinePostMoment(time) {
    var date = time.previousSibling.wholeText.trim();

    if ('Yesterday' === date) {
        date = moment().subtract(1, 'days').format(dateFormat);
    } else if ('Today' === date) {
        date = moment().format(dateFormat);
    }

    return moment(`${date} ${time.textContent}`, `${dateFormat} hh:mm A`);
}


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

            if (postMoment.isSameOrBefore(moment(forumIdToLastCrawlTime[forumID]))) {
                isFinished = true;
                return;
            }

            buildPost(title, postDoc, i, getImageUrls(postDoc), forumID, postMoment);
        })
        .catch((postErr) => {
            console.error(postErr);
        })
        .finally(() => {
            if (isFinished) { return; }

            return getPostInfo(titles, times, i + 1, forumID);
        });
}

function getPostInForum(forumID) {
    return rp(`${baseForumPath}${forumID}`)
        .then((html) => {
            const { window } = new JSDOM(html, { url: 'https://www.2addicts.com' });
            const document = window.document;
            const titles = [].slice.call(document.querySelectorAll(`#threadbits_forum_${forumID} a[id^='thread_title']`)).reverse()
            const lastPostTimes = [].slice.call(document.querySelectorAll(`#threadbits_forum_${forumID} .time`)).reverse();

            return getPostInfo(titles, lastPostTimes, 1, forumID);
        })
        .catch((err) => {
            console.error(err);
        });
}

function getPostsInForums(forumIds) {
    const forumID = forumIds.pop();

    return getPostInForum(forumID)
        .then(() => {
            if (forumIds.length === 0) {
                setTimeout(() => {
                    forumIdToLastCrawlTime = Object.assign(forumIdToLastCrawlTime, updatedForumIdToLastCrawlTime);
                    fs.writeFileSync(`./resources/data/carForum.json`, JSON.stringify(forumIdToLastCrawlTime), 'utf8');
                }, 3000);
                return;
            }

            return getPostsInForums(forumIds);
        });

}

exports.crawlCarForum = () => {
    channel.send(`**${moment().format('ddd MMM Do   hh:mm A')}** \`\`\` \`\`\``);
    getPostsInForums(Object.keys(forumIdToName));
};

exports.setCarPartsChannel = (carPartsChannel) => {
    channel = carPartsChannel;
};