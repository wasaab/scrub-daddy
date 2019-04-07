var path = require('path');
var d3 = require('d3');
var util = require('../utilities/utilities.js');
var imgConverter = require('./imageConverter.js');

var jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { document } = new JSDOM(`<!DOCTYPE html><html><body></body></html>`).window;

var margin = {
        top: 50,
        right: 0,
        bottom: 100,
        left: 30
    },
    width = 960 - margin.left - margin.right,
    height = 430 - margin.top - margin.bottom,
    gridSize = Math.floor(width / 24),
    legendElementWidth = gridSize * 2,
    buckets = 9,
    colors = ["#EB653A", "#F0433A", "#C9283E", "#820333", "#540032", "#2E112D"],//, "#291028", "#220e21", "#190A19"], // alternatively colorbrewer.YlGnBu[9]
    days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    times = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p", "12a"];

var svg = d3.select(document.body).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

svg.selectAll(".dayLabel")
    .data(days)
    .enter().append("text")
    .text(function (d) {
        return d;
    })
    .attr("x", 0)
    .attr("y", function (d, i) {
        return i * gridSize;
    })
    .attr("style", 'text-anchor: end; fill: white;')
    .attr("transform", "translate(-6," + gridSize / 1.5 + ")")
    .attr("class", function (d, i) {
        return ((i >= 0 && i <= 4) ? "dayLabel mono axis" : "dayLabel mono axis");
    });

svg.selectAll(".timeLabel")
    .data(times)
    .enter().append("text")
    .text(function (d) {
        return d;
    })
    .attr("x", function (d, i) {
        return i * gridSize;
    })
    .attr("y", 0)
    .attr("style", 'text-anchor: middle; fill: white;')
    .attr("transform", "translate(" + gridSize / 2 + ", -6)")
    .attr("class", function (d, i) {
        return ((i >= 7 && i <= 16) ? "timeLabel mono axis" : "timeLabel mono axis");
    });

function heatmapChart(dataFileName, userID) {
    const filePath = path.join(__dirname.slice(3, -4), 'resources', 'data', dataFileName);
    d3.json(`file:///${filePath}`, (data) => {
        if (!data) { return; }

        data = data.reduce((formattedData, day, dayIdx) => {
            var combinedEntries = 1 === dayIdx ? formatDay(formattedData, 0) : formattedData;
            return combinedEntries.concat(formatDay(day, dayIdx));
        });

        var colorScale = d3.scaleQuantile()
            .domain([0, buckets - 1, d3.max(data, function (d) {
                return d.value;
            })])
            .range(colors);

        var uniqueQuantiles = [];
        var previousQuantile = -1;
        colorScale.quantiles().forEach((q) => {
            if (Math.round(q) !== Math.round(previousQuantile)) {
                uniqueQuantiles.push(q);
                previousQuantile = q;
            }
        });

        var cards = svg.selectAll(".hour")
            .data(data, function (d) {
                return d.day + ':' + d.hour;
            });

        cards.append("title");

        cards.enter().append("rect")
            .attr("x", function (d) {
                return (d.hour) * gridSize;
            })
            .attr("y", function (d) {
                return (d.day - 1) * gridSize;
            })
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("style", function (d) {
                if (d.value === 5)
                    return `stroke: #36393e; stroke-width: 2px; fill: ${colorScale(6)};`;
                return `stroke: #36393e; stroke-width: 2px; fill: ${colorScale(d.value)};`;
            })
            .attr("width", gridSize)
            .attr("height", gridSize);

        cards.select("title").text(function (d) {
            return d.value;
        });

        cards.exit().remove();

        var legend = svg.selectAll(".legend")
            .data([0].concat(uniqueQuantiles), function (d) {
                return d;
            });

        legend.enter().append("g")
            .attr("class", "legend");

        legend.enter().append("rect")
            .attr("x", function (d, i) {
                return legendElementWidth * i;
            })
            .attr("y", height)
            .attr("width", legendElementWidth)
            .attr("height", (gridSize / 2) + 11)
            .attr("style", function (d, i) {
                return `fill: ${colors[i]};`;
            });

        legend.enter().append("text")
            .attr("style", 'font-size: 22pt; font-family: Consolas, courier; fill: white;')
            .text(function (d) {
                return "≥ " + Math.round(d);
            })
            .attr("x", function (d, i) {
                return (legendElementWidth * i) + 10;
            })
            .attr("y", height + gridSize + 32);

        legend.exit().remove();
        outputHeatMap(userID);
    });
}

exports.generateHeatMap = function(userID) {
    heatmapChart('rawHeatMapData.json', userID);
};

function outputHeatMap(userID) {
    setTimeout(() => {
        imgConverter.writeSvgToFileAsPng(960, 430, 'rgba(54, 57, 62, 0.74)', 'heatMap', svg)
            .then(() => {
                util.sendEmbedMessage('🔥 Player Count Heat Map', null, userID, 'attachment://heatMap.png', null, null, null, './resources/images/heatMap.png');
            });
    }, 100);
}

function formatDay(day, dayIdx) {
    return day.map((hour, hourIdx) => {
        const avgCount = Math.round(hour.playerCount / hour.sampleSize);
        //convert from moment's day format to graph's day format
        var formattedHour = hourIdx - 1;
        if (dayIdx === 0) {
            dayIdx = 7;
        }
        if (formattedHour === -1) {
            formattedHour = 23;
        }
        return {
            day: dayIdx,
            hour: formattedHour,
            value: avgCount
        };
    });
}