const { Input } = require('../common/game.js');
const ClientGame = require('../client/clientGame');

class OtherGame extends ClientGame {
    constructor() {
        super();
    }

    gotData(myData) {
        const myGameData = myData.gameData;
        this.goToGameState(myGameData);
    }
}

module.exports = OtherGame;
