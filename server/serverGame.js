const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super(10);
    }

    gotInputs(inputs) {
        this.inputs.push(...inputs);
    }

    getData() {
        return this;
    }
}

module.exports = ServerGame;
