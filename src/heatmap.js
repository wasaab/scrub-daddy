var xmlserializer = require('xmlserializer');
var svg_to_png = require('svg-to-png');
var imgur = require('imgur');
var path = require('path');
var fs = require('fs');
var d3 = require('d3');
var c = require('./const.js');
var util = require('./utilities.js');

var jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { window } = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
const { document } = new JSDOM(`<!DOCTYPE html><html><body></body></html>`).window;
var imgUrl = '';

function XMLSerializer() {
}

XMLSerializer.prototype.serializeToString = function (node) {
    return xmlserializer.serializeToString(node);
};

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

var dayLabels = svg.selectAll(".dayLabel")
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

var timeLabels = svg.selectAll(".timeLabel")
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

function convertSvgToPng() {
    svg_to_png.convert(path.join(__dirname.slice(0, -4), 'heatMap.svg'), path.join(__dirname.slice(0, -4), 'heatOutput.png'))
    .then(() => {
        c.LOG.info(`<INFO> ${util.getTimestamp()} png created: ${fs.existsSync( path.join( __dirname.slice(0, -4), "heatOutput.png"))}`);
        imgur.uploadFile('./*.png/*.png')
        .then(function (json) {
            c.LOG.info(`<INFO> ${util.getTimestamp()} heat map url: ${json.data.link}`);
            imgUrl = json.data.link;
        })
        .catch(function (err) {
            c.LOG.error(`<ERROR> ${util.getTimestamp()} uploading to imgur failed - ${err.message}`);
        });
    });
}

function writeSvgToFile() {
    var svgString = getSVGString(svg.node());
    svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="430" style="background: rgba(54, 57, 62, 0.74);" xmlns:xlink="http://www.w3.org/1999/xlink"><style xmlns="http://www.w3.org/1999/xhtml" type="text/css"/>    <g transform="translate(30,50)"> ${svgString.split('type="text/css"></style>')[1]} </svg>`;
    fs.writeFile('heatMap.svg', svgString, 'utf8', function(error, response) {
        if (error) {
            c.LOG.error(`<API ERROR> ${util.getTimestamp()}  ERROR: ${error}`);			
        } else if (response) {
            c.LOG.info(`<API RESPONSE> ${util.getTimestamp()}  ${inspect(response)}`);
        }
    });  
    setTimeout(convertSvgToPng, 1000);
}

var heatmapChart = function (tsvFile) {
    const filePath = path.join(__dirname.slice(3, -4), 'graphs', 'heatmapData.tsv');
    d3.tsv(`file:///${filePath}`,
        function (d) {
            return {
                day: +d.day,
                hour: +d.hour,
                value: +d.value
            };
        },
        function (error, data) {
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
        });
    setTimeout(writeSvgToFile, 100);
};

function getSVGString(svgNode) {
    svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgNode);
    svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
    svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix
    svgString = svgString.replace('xlink">', 'xlink"> <style type="text/css"></style>')

    return svgString;
}

exports.generateHeatMap = function() {
    heatmapChart('heatmapData.tsv');    
}

exports.getUpdatedHeatMapUrl = function() {
    return imgUrl;
}