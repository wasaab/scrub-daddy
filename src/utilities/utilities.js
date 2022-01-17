const adminUtil = require('./adminUtil.js');
const infoUtil = require('./entertainmentAndInfoUtil.js');
const baseUtil = require('./baseUtil.js');
const messagingUtil = require('./messagingUtil.js');
const userUtil = require('./userUtil.js');

module.exports = {
    ...adminUtil,
    ...infoUtil,
    ...baseUtil,
    ...messagingUtil,
    ...userUtil,
    registerCommandHandlers: () => {
        const cmdUtils = [adminUtil, infoUtil, messagingUtil, userUtil];
    
        cmdUtils.forEach((handler) => {
            handler.registerCommandHandlers();
        });
    }
};