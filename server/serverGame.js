const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super(0);
    }

    gotInputs(inputs) {
        for (const inp of inputs) {
            this.inputs[inp.id] = inp;
        }
        //this.inputs.push(...inputs);
    }

    getData() { //TODO Redo this system
        return {
            gameData: this.getGameState(),
            receviedInputId: this.receviedInputId
        }
    }
}

module.exports = ServerGame;
