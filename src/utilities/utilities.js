const utils = {
    adminUtil: require('./adminUtil.js'),
    infoUtil: require('./entertainmentAndInfoUtil.js'),
    baseUtil: require('./baseUtil.js'),
    messagingUtil: require('./messagingUtil.js'),
    userUtil: require('./userUtil.js')
};

/**
 * Builds the updated export json for the util mixin.
 */
function buildExports() { //eslint-disable-line
    var result = '';

    for (var subUtil in utils) {
        result += '\n';
        Object.keys(utils[subUtil]).forEach((funcName) => { //eslint-disable-line
            result += `${funcName}: utils.${subUtil}.${funcName},\n`;
        });
    }

    result = result.slice(0, -2);
    console.log(result); //eslint-disable-line
}


// VS Code workaround to retain JSDoc tooltips and autocomplete for mixins.
module.exports = {
    addMessageToReviewQueue: utils.adminUtil.addMessageToReviewQueue,
    backupJson: utils.adminUtil.backupJson,
    banSpammer: utils.adminUtil.banSpammer,
    enableServerLogRedirect: utils.adminUtil.enableServerLogRedirect,
    handleMuteAndDeaf: utils.adminUtil.handleMuteAndDeaf,
    isAdmin: utils.adminUtil.isAdmin,
    isDevEnv: utils.adminUtil.isDevEnv,
    listBackups: utils.adminUtil.listBackups,
    maybeBanSpammer: utils.adminUtil.maybeBanSpammer,
    maybeUnbanSpammers: utils.adminUtil.maybeUnbanSpammers,
    outputCmdsMissingHelpDocs: utils.adminUtil.outputCmdsMissingHelpDocs,
    outputUpdatedHelpCategoriesPrompt: utils.adminUtil.outputUpdatedHelpCategoriesPrompt,
    restartBot: utils.adminUtil.restartBot,
    restoreJsonFromBackup: utils.adminUtil.restoreJsonFromBackup,
    reviewMessages: utils.adminUtil.reviewMessages,
    toggleServerLogRedirect: utils.adminUtil.toggleServerLogRedirect,
    updateReadme: utils.adminUtil.updateReadme,

    help: utils.infoUtil.help,
    maybeAddSoundByte: utils.infoUtil.maybeAddSoundByte,
    messageCatFactsSubscribers: utils.infoUtil.messageCatFactsSubscribers,
    outputCatFact: utils.infoUtil.outputCatFact,
    outputFavoriteSoundBytes: utils.infoUtil.outputFavoriteSoundBytes,
    outputHelpForCommand: utils.infoUtil.outputHelpForCommand,
    playSoundByte: utils.infoUtil.playSoundByte,
    setVolume: utils.infoUtil.setVolume,
    showTips: utils.infoUtil.showTips,

    buildField: utils.baseUtil.buildField,
    capitalizeFirstLetter: utils.baseUtil.capitalizeFirstLetter,
    comma: utils.baseUtil.comma,
    compareFieldValues: utils.baseUtil.compareFieldValues,
    deepClone: utils.baseUtil.deepClone,
    exportJson: utils.baseUtil.exportJson,
    formatAsBoldCodeBlock: utils.baseUtil.formatAsBoldCodeBlock,
    getAvatar: utils.baseUtil.getAvatar,
    getIdFromMention: utils.baseUtil.getIdFromMention,
    getMembers: utils.baseUtil.getMembers,
    getNick: utils.baseUtil.getNick,
    getRand: utils.baseUtil.getRand,
    getScrubIdToNick: utils.baseUtil.getScrubIdToNick,
    getTargetFromArgs: utils.baseUtil.getTargetFromArgs,
    getTrueDisplayName: utils.baseUtil.getTrueDisplayName,
    handleAllPromises: utils.baseUtil.handleAllPromises,
    isLocked: utils.baseUtil.isLocked,
    isMention: utils.baseUtil.isMention,
    lock: utils.baseUtil.lock,
    maybeGetPlural: utils.baseUtil.maybeGetPlural,
    maybeRemoveFromArray: utils.baseUtil.maybeRemoveFromArray,
    mentionChannel: utils.baseUtil.mentionChannel,
    mentionRole: utils.baseUtil.mentionRole,
    mentionUser: utils.baseUtil.mentionUser,
    shuffleArray: utils.baseUtil.shuffleArray,
    unLock: utils.baseUtil.unLock,
    updateMembers: utils.baseUtil.updateMembers,

    addInitialNumberReactions: utils.messagingUtil.addInitialNumberReactions,
    awaitAndHandleReaction: utils.messagingUtil.awaitAndHandleReaction,
    deleteMessages: utils.messagingUtil.deleteMessages,
    deleteQuoteTipMsg: utils.messagingUtil.deleteQuoteTipMsg,
    exportQuotes: utils.messagingUtil.exportQuotes,
    getUserIDToColor: utils.messagingUtil.getUserIDToColor,
    getQuotes: utils.messagingUtil.getQuotes,
    log: utils.messagingUtil.log,
    maybeInsertQuotes: utils.messagingUtil.maybeInsertQuotes,
    maybeReact: utils.messagingUtil.maybeReact,
    maybeReplicateLol: utils.messagingUtil.maybeReplicateLol,
    maybeUpdateDynamicMessage: utils.messagingUtil.maybeUpdateDynamicMessage,
    quoteUser: utils.messagingUtil.quoteUser,
    sendAuthoredEmbed: utils.messagingUtil.sendAuthoredEmbed,
    sendAuthoredMessage: utils.messagingUtil.sendAuthoredMessage,
    sendDynamicMessage: utils.messagingUtil.sendDynamicMessage,
    sendEmbedFieldsMessage: utils.messagingUtil.sendEmbedFieldsMessage,
    sendEmbedMessage: utils.messagingUtil.sendEmbedMessage,

    addInvitedByRole: utils.userUtil.addInvitedByRole,
    addToList: utils.userUtil.addToList,
    addToReviewRole: utils.userUtil.addToReviewRole,
    clearRainbowRoleUpdateInterval: utils.userUtil.clearRainbowRoleUpdateInterval,
    createAlias: utils.userUtil.createAlias,
    createChannelInCategory: utils.userUtil.createChannelInCategory,
    createGroup: utils.userUtil.createGroup,
    createList: utils.userUtil.createList,
    getGroup: utils.userUtil.getGroup,
    isChannelOwner: utils.userUtil.isChannelOwner,
    leaveTempChannel: utils.userUtil.leaveTempChannel,
    maybeGetAlias: utils.userUtil.maybeGetAlias,
    mentionChannelsPowerUsers: utils.userUtil.mentionChannelsPowerUsers,
    modifyGroup: utils.userUtil.modifyGroup,
    outputAliases: utils.userUtil.outputAliases,
    outputTempChannelsLeftByUser: utils.userUtil.outputTempChannelsLeftByUser,
    rejoinTempChannel: utils.userUtil.rejoinTempChannel,
    removeFromReviewRole: utils.userUtil.removeFromReviewRole,
    setBirthday: utils.userUtil.setBirthday,
    setUserColor: utils.userUtil.setUserColor,
    subscribeToCatFacts: utils.userUtil.subscribeToCatFacts,
    showLists: utils.userUtil.showLists,
    shuffleScrubs: utils.userUtil.shuffleScrubs,
    unalias: utils.userUtil.unalias,
    updateRainbowRoleColor: utils.userUtil.updateRainbowRoleColor,
    updateServerInvites: utils.userUtil.updateServerInvites
};