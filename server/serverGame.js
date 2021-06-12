const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
        this.lastInputSent = -1;
    }

    gotInputs(inps) {
        for (let encodedInp of inps) {
            this.addInput(Input.decode(encodedInp));
        }
    }

    addInput(inp) {
        this.inputs[inp.id] = inp; //TODO Add validation here to prevent bugs and cheating
    }

    getGameStateAndInputs() {
        return {
            gameData: this.lastestState,
            inputs: this.getCurrentInputs()
        }
    }

    getCurrentInputs() {
        let notSent = this.inputs.filter(inp => inp.id > this.lastInputSent);

        if (notSent.length > 0)
            this.lastInputSent = notSent[notSent.length-1].id;

        return notSent.map(inp => inp.encode());
    }


    //Gets the current game state to be applied to myGame
    getGameState() { //TODO Redo this system
        return {
            gameData: this.lastestState
        }
    }
}

module.exports = ServerGame;
