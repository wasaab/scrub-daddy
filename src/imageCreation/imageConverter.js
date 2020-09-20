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

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgNode);
    svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
    svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix
    svgString = svgString.replace('xlink">', 'xlink"> <style type="text/css"></style>');

    return svgString;
}

exports.writeSvgToFileAsPng = function(width, height, bgColor, fileName, svg) {
    var svgString = getSVGString(svg.node());
    svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background-color: ${bgColor};"`
        + ` xmlns:xlink="http://www.w3.org/1999/xlink"><style xmlns="http://www.w3.org/1999/xhtml" type="text/css"/>`
        + `    <g transform="translate(30,50)"> ${svgString.split('type="text/css"></style>')[1]} </svg>`;

    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
    }

    fs.writeFileSync(buildSvgFilePath(fileName), svgString, 'utf8');

    return convertSvgToPng(fileName);
};