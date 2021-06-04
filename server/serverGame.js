const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
    }

    moveDown() {

    }

    gotInputs(inp) {
        console.log(inp);
        this.inputs[inp.id] = inp; //TODO Add validation here to prevent bugs and cheating
    }

    getData() { //TODO Redo this system
        return {
            gameData: this.lastestState
        }
    }
}

module.exports = ServerGame;
