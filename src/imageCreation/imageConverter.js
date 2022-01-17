var xmlserializer = require('xmlserializer');
var svgToPng = require('svg-to-png');
var fs = require('fs');
var path = require('path');
const imageDir = path.join(__dirname, '../../resources/images/');

function XMLSerializer() {
    //Empty constructor
}

XMLSerializer.prototype.serializeToString = function (node) {
    return xmlserializer.serializeToString(node);
};

function buildSvgFilePath(fileName) {
    return path.join(imageDir, `${fileName}.svg`);
}

function convertSvgToPng(fileName) {
    return svgToPng.convert(buildSvgFilePath(fileName), imageDir);
}

function getSVGString(svgNode) {
    svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgNode)
        .replace(/(\w+)?:?xlink=/g, 'xmlns:xlink=') // Fix root xlink without namespace
        .replace(/NS\d+:href/g, 'xlink:href') // Safari NS namespace fix
        .replace('xlink">', 'xlink"> <style type="text/css"></style>');

    return svgString;
}

exports.buildSvg = function(svg, width, height, bgColor) {
    const svgString = getSVGString(svg.node());
    const bgColorAttribute = bgColor ? ` style="background-color: ${bgColor};"` : '';
    const dimensionAttributes = bgColor
        ? `width="${width}" height="${height}"`
        : `preserveAspectRatio="xMinYMin meet" viewBox="0 0 ${width} ${height}"`;

    return `<svg xmlns="http://www.w3.org/2000/svg" ${dimensionAttributes}${bgColorAttribute}`
        + ` xmlns:xlink="http://www.w3.org/1999/xlink"><style xmlns="http://www.w3.org/1999/xhtml" type="text/css"/>`
        + `    <g transform="translate(30,50)"> ${svgString.split('type="text/css"></style>')[1]} </svg>`;
};

exports.writeSvgToFileAsPng = function(width, height, bgColor, fileName, svg) {
    const svgString = exports.buildSvg(svg, width, height, bgColor);

    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
    }

    fs.writeFileSync(buildSvgFilePath(fileName), svgString, 'utf8');

    return convertSvgToPng(fileName);
};