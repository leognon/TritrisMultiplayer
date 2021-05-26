const { Grid, GridCell, Triangle, Piece } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
        this.inputs = [];
        this.nextInputId = 0; //The next input to be performed on the server
    }

    update(deltaTime) {
        if (deltaTime == undefined) deltaTime = Date.now() - this.lastFrame;
        this.lastFrame = Date.now();
        //if (!this.alive) return;
        this.time += deltaTime;

        //Play a line clear animation
        /*if (this.time <= this.animationTime) {
            //Line clear animation. Not needed on server
        } else if (this.animatingLines.length > 0) {
            //After a line clear animation has just been completed
            //Readjust the entry delay to accommodate for the animation time
            this.spawnNextPiece += this.maxAnimationTime;
            this.lines += this.animatingLines.length;

            //Increase the level after a certain amt of lines, then every 10 lines
            if (this.shouldIncreaseLevel()) {
                this.level++;
                this.setSpeed();
            }
            this.score += this.scoreWeights[this.animatingLines.length] * (this.level + 1);
            if (this.animatingLines.length == 3)
                this.tritrisAmt++;

            for (const row of this.animatingLines) {
                this.grid.removeLine(row);
            }
            this.animatingLines = [];
        }*/

        //Spawn the next piece after entry delay
        if (this.shouldSpawnPiece()) {
            this.spawnPiece();
            this.lastMoveDown = this.time;
            if (!this.isValid(this.currentPiece)) {
                this.alive = false; //If the new piece is already blocked, game over
            }
        }

        //Piece Movement
        //TODO Figure out how to make this whole thing a while loop. Or just don't increase deltaTime if inputs are being played...
        if (this.currentPiece !== null) {
            if (this.nextInputId < this.inputs.length) {
                const inp = this.inputs[this.nextInputId];
                if (inp.time <= this.time) { //It is time for the input to be performed
                    const placePiece = this.movePiece(inp.horzDir, inp.rot, inp.vertDir);
                    if (placePiece) {
                        this.placePiece();
                        this.lastMoveDown = this.time;
                    }
                    this.nextInputId++;
                }
            }
            //Move down based on timer
            let shouldMoveDown = this.time >= this.lastMoveDown + this.pieceSpeed;
            if (this.currentPiece !== null && shouldMoveDown) {
                const placePiece = this.movePiece(0, 0, true);
                if (placePiece) this.placePiece();
                this.lastMoveDown = this.time;
            }
        }
    }

    gotInputs(inp) {
        this.inputs[inp.id] = inp;
    }

    getData() { //TODO Redo this system
        return {
            gameData: this.getGameState(),
        }
    }
}

module.exports = ServerGame;
