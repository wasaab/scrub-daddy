/**
 * Gets and outputs the time played for the game by the user(s) provided in args.
 * 
 * @param {String[]} args - input arguments from the user
 */
function maybeOutputTimePlayed(args) {
	const nameAndTargetData = getGameNameAndTarget(args);
	var target = nameAndTargetData.target;
	var game = nameAndTargetData.game;
	var timePlayed = '';

	logger.info('<INFO> ' + getTimestamp() + '  Time Called - game: ' + game + ' target: ' + target);				
    if (target.match(/\d/g) !== null) {
        target = target.match(/\d/g).join("")
    } 
    var timePlayedData = getCumulativeTimePlayed(game,target);
    if (Object.keys(timePlayedData.gameToTime).length !== 0) {
        outputCumulativeTimePlayed(timePlayedData.gameToTime);	
    } else {
        timePlayed = timePlayedData.total
    }
	
	//If the user has played the game, then output the hours played.
	if (timePlayed !== '') {
        var fields = [];
        var title = 'Hours Played'
		fields.push(buildField(game,timePlayed.toFixed(1)));
		sendEmbedMessage(title, fields);
		logger.info('<INFO> ' + getTimestamp() + '  ' + title + ': ' + util.inspect(fields, false, null));
	}
}