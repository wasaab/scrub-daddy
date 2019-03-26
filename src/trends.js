var moment = require('moment');
var jsdom = require('jsdom');
var path = require('path');
var d3 = require('d3');
var c = require('./const.js');
var util = require('./utilities.js');
var imgUtils = require('./imageUtils.js');

const { JSDOM } = jsdom;
const { document } = new JSDOM(`<!DOCTYPE html><html><body></body></html>`).window;
const fullSvgWidth = 1500;
const fullSvgHeight = fullSvgWidth / 2;
const margin = {top: 30, right: 20, bottom: 70, left: 50},
    width = fullSvgWidth - margin.left - margin.right,
    height = fullSvgHeight - margin.top - margin.bottom;
const x = d3.scaleTime().range([0, width - 2]); //-2 to avoid cutting off final month label
const y = d3.scaleLinear().range([height, 0]);
var svg;

function createSvgCanvas() {
    return d3.select(document.body)
        .style('font', '12px Arial')
        .append('svg')
            .attr('width', fullSvgWidth)
            .attr('height', fullSvgHeight)
            .style('background-color', 'darkgray')
            .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
}


function generateGraph(userID, countKey, targetGames) {
    svg = createSvgCanvas();
    const filePath = path.join(__dirname.slice(3, -4), 'resources', 'data', 'gameHistory.json');

    d3.json(`file:///${filePath}`, function(rawLogs) {
        var { logs, maxY } = formatLogsAndDetermineMaxY(rawLogs, countKey, targetGames);

        // Scale the range of the data
        x.domain(d3.extent(logs, function(d) { return d.time; }));
        y.domain([0, d3.max(logs, function(d) { return d[countKey]; })]);

        // Nest the entries by game
        var dataNest = d3.nest()
            .key((entry) => isGamePlayerCountGraph(countKey) ? entry.game : moment(entry.time).format(c.MDY_DATE_FORMAT))
            .entries(logs);

        if (!isGamePlayerCountGraph(countKey)) {
            dataNest.key = 'Peak Player Count';
        } else if (!targetGames) {
            dataNest = dataNest.filter((entriesForGame) => entriesForGame.values.length > 200);
        }

        // console.log(dataNest);

        appendLinesAndLegend(dataNest, countKey);
        appendXAxis();
        appendYAxis(maxY);
    });

    setTimeout(() => {
        imgUtils.writeSvgToFile(fullSvgWidth, fullSvgHeight + 30, 'darkgray', 'trend', svg)
            .then(() => {
                util.sendEmbedMessage('Player Count Trends', null, userID, 'attachment://trend.png',
                    null, null, null, './resources/images/trend.png');
            });
    }, 100);
}

function appendLinesAndLegend(dataNest, countKey) {
    const color = d3.scaleOrdinal(d3.schemeCategory10);   // set the colour scale
    const legend = determineLegendAttr(dataNest, !isGamePlayerCountGraph(countKey));
    var countline = d3.line()
        .x(function(d) { return x(d.time); })
        .y(function(d) { return y(d[countKey]); });

    if (isGamePlayerCountGraph(countKey)) {
        dataNest.forEach((groupedByGame, i) => {
            var groupedByDate = d3.nest()
                .key((entry) => moment(entry.time).format(c.MDY_DATE_FORMAT))
                .entries(groupedByGame.values);

            appendLineAndTitle(dataNest, countKey, countline, color, legend, i, groupedByDate, groupedByGame)
        });
    } else {
        appendLineAndTitle(dataNest, countKey, countline, color, legend, 0);
    }
}

function appendLineAndTitle(dataNest, countKey, countline, color, legend, i, groupedByDate, groupedByGame) {
    if (!groupedByGame) {
        groupedByGame = groupedByDate = dataNest;
    }

    padGroupWithZeroEntries(groupedByDate, countKey);
    groupedByGame.values = filterForDailyPeaks(groupedByDate, countKey);
    appendLine(groupedByGame, color, countline);
    appendTitleToLegend(legend, dataNest, color, i, groupedByGame);
}

function padGroupWithZeroEntries(groupedByDate, countKey) {
    var prevEntryTime;

    for (var idx = 0; idx < groupedByDate.length; idx++) {
        const dateLog = groupedByDate[idx];
        const entryTime = moment(dateLog.key, 'MM/DD/YY');
        const daysBetweenEntries = entryTime.diff(prevEntryTime, 'days') - 1;
        const baseZeroEntry = isGamePlayerCountGraph(countKey) ?
            { game: dateLog.values[0].game, count: 0 } : { playerCount: 0 };

        if (daysBetweenEntries >= 1) {
            for (var i = 0; i < daysBetweenEntries; i++, idx++) {
                const zeroEntryTime = prevEntryTime.add(1, 'days');

                groupedByDate.splice(idx, 0, {
                    key: zeroEntryTime.format(c.MDY_DATE_FORMAT),
                    values: [Object.assign({ time: zeroEntryTime.toDate() }, baseZeroEntry)]
                });
            }
        }

        prevEntryTime = entryTime;
    }
}

function determineLegendAttr(dataNest, isSingleTitle) {
    const legendSpace = isSingleTitle ? width : width / dataNest.length; // spacing for legend
    var legendFontSize = Math.round(legendSpace / 5); //used to always be 16

    if (legendFontSize > 25) {
        legendFontSize = 25;
    }

    return { space: legendSpace, fontSize: legendFontSize };
}

function isGamePlayerCountGraph(countKey) {
    return 'count' === countKey;
}

function formatLogsAndDetermineMaxY(logs, countKey, targetGames) {
    if (isGamePlayerCountGraph(countKey)) {
        logs = logs.reduce((entries, currEntry) => {
            var combinedEntries = entries.gameData || entries;
            return combinedEntries.concat(currEntry.gameData);
        });

        if (targetGames) {
            logs = logs.filter((entry) => targetGames.includes(entry.game.toLowerCase()));
        }
    }

    var maxY = 0;
    logs.forEach((log) => {
        if (log[countKey] > maxY) {
            maxY = log[countKey];
        }

        log.time = new Date(log.time.slice(0, -5));
    });

    return { logs, maxY };
}

function filterForDailyPeaks(groupedByDate, countKey) {
    return groupedByDate.map((dateLog) => {
        dateLog.values = dateLog.values.reduce((peak, gameLog) => {
            return gameLog[countKey] >= peak[countKey] ? gameLog : peak;
        });

        return dateLog.values;
    });
}

function appendYAxis(maxY) {
    svg.append('g')
        .style('stroke-width', 1)
        .style('shape-rendering', 'crispEdges')
        .style('font-size', '16px')
        .call(d3.axisLeft().scale(y).ticks(maxY));
}

function appendXAxis() {
    svg.append('g')
        .style('stroke-width', 1)
        .style('shape-rendering', 'crispEdges')
        .style('font-size', '16px')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom().scale(x).ticks(7));
}

function appendTitleToLegend(legend, dataNest, color, i, groupedByGame) {
    svg.append('text')
        .attr('x', (legend.space / 2) + i * legend.space) // spacing
        .attr('y', i % 2 && dataNest.length > 5 ? height + (margin.bottom / 2) + legend.fontSize + 15 : height + (margin.bottom / 2) + 10)
        .style('font-size', `${legend.fontSize}px`)
        .style('font-weight', 'bold')
        .style('text-anchor', 'middle')
        .style('fill', () => groupedByGame.color = color(groupedByGame.key))
        .text(groupedByGame.key);
}

function appendLine(dataNest, color, countline) {
    svg.append('path')
        .style('stroke-width', 2)
        .style('fill', 'none')
        .style('stroke', () => dataNest.color = color(dataNest.key))
        .attr('d', countline(dataNest.values));
}

exports.outputGameTrendsGraph = function(args, userID) {
    const targetGames = args.length === 1 ? null : util.getTargetFromArgs(args, 1).toLowerCase().split(/(?:, |,)+/);
    generateGraph(userID, 'count', targetGames);
};

exports.ouputTotalPlayerCountGraph = function(userID) {
    generateGraph(userID, 'playerCount');
};