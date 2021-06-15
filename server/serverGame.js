const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
        this.lastInputSent = -1;
        this.lastSentTime = -1;
    }

    gotInputs(inps) {
        if (inps.length == 0) return;
        let latestTime = 0;
        for (let encodedInp of inps) {
            const inp = Input.decode(encodedInp);
            this.addInput(inp);
            if (inp.time > latestTime) latestTime = inp.time;
        }
        this.updateFromStartToTime(latestTime);
    }

    addInput(inp) {
        this.inputs[inp.id] = inp; //TODO Add validation here to prevent bugs and cheating
    }

    getGameStateAndInputs() {
        let data = {
            changed: false,
            gameData: {
                time: (Date.now() - this.startTime),
            },
            inputs: this.getCurrentInputs()
        };
        if (this.latestState.time > this.lastSentTime) {
            data.changed = true;
            data.gameData = this.latestState;
            this.lastSentTime = this.latestState.time;
        }
        return data;
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
            gameData: this.latestState
        }
    }
}

module.exports = ServerGame;
