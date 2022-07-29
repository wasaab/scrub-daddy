const path = require('path');
const D3Node = require('d3-node');
const { d3, document } = new D3Node();
const util = require('../utilities/utilities.js');
const imgConverter = require('./imageConverter.js');
const cmdHandler = require('../handlers/cmdHandler.js');

const margin = {
  top: 50,
  right: 0,
  bottom: 100,
  left: 30
};
const width = 960 - margin.left - margin.right;
const height = 430 - margin.top - margin.bottom;
const gridSize = Math.floor(width / 24);
const legendElementWidth = gridSize * 2;
const colors = ["#EB653A", "#F0433A", "#C9283E", "#820333", "#540032", "#2E112D"];
const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const times = [
  "12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a",
  "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"
];
let svg;

function formatDay(day, dayIdx) {
  return day.map((hour, hourIdx) => {
    const avgCount = Math.round(hour.playerCount / hour.sampleSize);

    if (dayIdx === 0) {
      dayIdx = 7; // end with sunday
    }

    return {
      day: dayIdx,
      hour: hourIdx,
      value: avgCount
    };
  });
}

function outputHeatMap(userID) {
  setTimeout(() => {
    imgConverter.writeSvgToFileAsPng(960, 430, 'rgba(54, 57, 62, 0.74)', 'heatMap', svg)
      .then(() => {
        util.sendEmbed({
          title: '🔥 Player Count Heat Map',
          image: 'attachment://heatMap.png',
          file: './resources/images/heatMap.png',
          userID
        });
      });
  }, 100);
}

function addCards(data, colorScale, isDebug) {
  const cards = svg.selectAll(".hour")
    .data(data, ({ day, hour }) => `${day}:${hour}`);

  cards.enter().append("rect")
    .attr("x", ({ hour }) => hour * gridSize)
    .attr("y", ({ day }) => (day - 1) * gridSize)
    .attr("rx", 4)
    .attr("ry", 4)
    .attr("style", ({ value }) => `stroke: #36393e; stroke-width: 2px; fill: ${colorScale(value)};`)
    .attr("width", gridSize)
    .attr("height", gridSize);

  if (isDebug) {
    // add value text to cards
    cards.enter().append("text")
      .text(({ value }) => value)
      .attr("x", ({ hour }) => hour * gridSize + 15)
      .attr("y", ({ day }) => (day - 1) * gridSize + 25)
      .attr("style", 'fill: white;');
  }

  cards.exit().remove();
}

function getUniqueQuantiles(colorScale) {
  let previousQuantile = 0;
  const uniqueQuantiles = [previousQuantile];

  colorScale.quantiles().forEach((q) => {
    const quantile = Math.round(q);

    if (quantile !== previousQuantile) {
      uniqueQuantiles.push(quantile);
      previousQuantile = quantile;
    }
  });

  return uniqueQuantiles;
}

function addLegend(colorScale) {
  const legend = svg.selectAll(".legend")
    .data(getUniqueQuantiles(colorScale));

  legend.enter().append("g")
    .attr("class", "legend");

  legend.enter().append("rect")
    .attr("x", function (d, i) {
      return legendElementWidth * i;
    })
    .attr("y", height)
    .attr("width", legendElementWidth)
    .attr("height", (gridSize / 2) + 11)
    .attr("style", (d, i) => `fill: ${colors[i]};`);

  legend.enter().append("text")
    .text((d) => `≥ ${Math.round(d)}`)
    .attr("style", 'font-size: 22pt; font-family: Consolas, courier; fill: white;')
    .attr("x", (d, i) => (legendElementWidth * i) + 10)
    .attr("y", height + gridSize + 32);

  legend.exit().remove();
}

function getFormattedData(data) {
  return data.reduce((formattedData, day, dayIdx) => {
    const combinedEntries = 1 === dayIdx ? formatDay(formattedData, 0) : formattedData;

    return combinedEntries.concat(formatDay(day, dayIdx));
  });
}
function heatmapChart(dataFileName, userID, isDebug) {
  const filePath = path.resolve('resources/data', dataFileName).replace('C:\\', '');

  d3.json(`file:///${filePath}`, (err, data) => {
    if (err || !data) { return; }

    data = getFormattedData(data);

    const colorScale = determineColorScale(data);

    addCards(data, colorScale, isDebug);
    addLegend(colorScale);
    outputHeatMap(userID);
  });
}

function generateHeatMap(message, [, flag]) {
  heatmapChart('rawHeatMapData.json', message.member.id, flag === '-d');
}

function determineColorScale(data) {
  const highestVal = d3.max(data, ({ value }) => value);

  return d3.scaleQuantile()
    .domain([0, highestVal + 1])
    .range(colors.slice(0, highestVal - 1));
}

function addTimeLabels() {
  svg.selectAll(".timeLabel")
    .data(times)
    .enter()
    .append("text")
    .text((time) => time)
    .attr("x", (d, i) => (i * gridSize) + (gridSize / 2))
    .attr("y", -6)
    .attr("style", 'text-anchor: middle; fill: white;')
    .attr("class", "timeLabel mono axis");

}

function addDayLabels() {
  svg.selectAll(".dayLabel")
    .data(days)
    .enter()
    .append("text")
    .text((d) => d)
    .attr("x", 0)
    .attr("y", (d, i) => i * gridSize)
    .attr("style", 'text-anchor: end; fill: white;')
    .attr("transform", `translate(-6,${gridSize / 1.5})`)
    .attr("class", "dayLabel mono axis");
}

function initHeatmapSvg() {
  svg = d3.select(document.body).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  addDayLabels();
  addTimeLabels();
}

initHeatmapSvg();

exports.registerCommandHandlers = () => {
  cmdHandler.registerCommandHandler('heatmap', generateHeatMap);
};