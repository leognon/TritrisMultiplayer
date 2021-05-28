const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
    }

    gotInputs(inp) {
        console.log(inp);
        this.inputs[inp.id] = inp;
    }

    getData() { //TODO Redo this system
        return {
            gameData: this.getGameState(),
        }
    }
}

module.exports = ServerGame;
