const { Grid, GridCell, Triangle, Piece } = require('./classes.js');
const RandomGenerator = require('random-seed');
const piecesJSON = require('./pieces.js');


/* TODO
 * Rename timer variables
 * Remove extra variables
 * Fix number of points for double (should be 300)
 */

class Game {
    constructor(level, seed = 123) {
        this.w = 8;
        this.h = 16;
        this.grid = new Grid(this.w, this.h);

        this.tritrisAmt = 0; //For statistics
        this.startTime = Date.now();
        this.time = 0;

        this.seed = seed;
        this.gen = new RandomGenerator(this.seed);

        this.alive = true;

        //this.history = [];
        this.inputs = [];
        this.receviedInputId = -1;
        this.currentInputId = 0;

        if (level < 0) level = 0;
        if (level > 29) level = 29;
        if (level >= 20 && level <= 28) level = 19; //Can only start on 0-19 or 29
        this.startLevel = level;
        this.level = level;
        this.lines = 0;
        this.score = 0;
        this.scoreWeights = { 1: 100, 2: 400, 3: 1200 };
        //TODO The weights should be 1: 100, 2: 300, 3: 1200!!!!!!!!!!!!!!

        //this.piecesType = 3; //How many triangles are in each piece
        //if (piecesJSON.pieces.length > 7) this.piecesType = 4; //Quadtris

        this.piecesJSON = piecesJSON;

        const frameRate = 60.0988; //frames per second
        const msPerFrame = 1000 / frameRate;
        this.entryDelays = [
            10 * msPerFrame,
            12 * msPerFrame,
            14 * msPerFrame, //Numbers from https://tetris.wiki/Tetris_(NES,_Nintendo)
            16 * msPerFrame,
            18 * msPerFrame,
        ];

        this.currentPiece = null; //The current piece starts as null
        this.currentPieceIndex = null;
        this.nextPiece = null; //The next piece starts as a random piece that isn't a single triangles
        this.nextPieceIndex = null;
        this.nextSingles = 0;
        this.bag = [];
        this.spawnPiece(); //Sets the next piece
        this.firstPieceIndex = this.nextPieceIndex; //Used for saving games
        this.spawnPiece(); //Make next piece current, and pick new next

        this.levelSpeeds = {
            0: 48,
            1: 43, //From https://tetris.wiki/Tetris_(NES,_Nintendo)
            2: 38,
            3: 33,
            4: 28,
            5: 23,
            6: 18,
            7: 13,
            8: 8,
            9: 6,
            10: 5, //Level 10-12
            13: 4, //13 - 15
            16: 3, //16 - 18
            19: 2, //19 - 28
            29: 1, //29+
        };
        for (let lvl of Object.keys(this.levelSpeeds)) {
            this.levelSpeeds[lvl] *= msPerFrame; //Make sure the are in the correct units
        }
        this.pieceSpeed = 0;
        this.setSpeed(); //This will correctly set pieceSpeed depending on which level it's starting on

        this.softDropSpeed = msPerFrame * 2;
        this.lastMoveDown = this.time + 750;

        //this.lastFrame = Date.now(); //Used to calculate deltaTime and for DAS

        this.spawnNextPiece = 0;

        this.animationTime = 0;
        this.animatingLines = [];
        this.maxAnimationTime = 20 * msPerFrame;
        this.lastColCleared = 0;
        this.maxFlashTime = 20 * msPerFrame;
        this.flashTime = 0;
        this.flashAmount = 4;

        this.downPressedAt = 0; //Used to calculate how many cells a piece traveled when down was pressed
    }

    //Replays the entire game from start to t
    updateFromStartToTime(t) {
        this.goToStart();
        this.updateToTime(t);
    }

    //Plays from the current state to time t
    updateToTime(t) {
        while (this.time <= t) {
            let deltaTime = Math.max(this.pieceSpeed - 3, 1); //TODO Figure this out
            this.update(deltaTime);
        }
    }

    goToStart() { //Resets the game so it can be replayed up to any time necessary
        this.grid = new Grid(this.w, this.h);
        this.tritrisAmt = 0; //For statistics
        this.time = 0;

        this.gen = new RandomGenerator(this.seed);

        this.alive = true;

        this.currentInputId = 0;

        this.level = this.startLevel;
        this.lines = 0;
        this.score = 0;

        this.currentPiece = null; //The current piece starts as null
        this.currentPieceIndex = null;
        this.nextPiece = null; //The next piece starts as a random piece that isn't a single triangles
        this.nextPieceIndex = null;
        this.nextSingles = 0;
        this.bag = [];
        this.spawnPiece(); //Sets the next piece
        this.firstPieceIndex = this.nextPieceIndex; //Used for saving games
        this.spawnPiece(); //Make next piece current, and pick new next

        this.setSpeed(); //This will correctly set pieceSpeed depending on which level it's starting on

        this.lastMoveDown = this.time + 750;

        //this.lastFrame = Date.now(); //Used to calculate deltaTime and for DAS

        this.spawnNextPiece = 0;

        this.animationTime = 0;
        this.animatingLines = [];
        this.lastColCleared = 0;
        this.flashTime = 0;

        this.downPressedAt = 0; //Used to calculate how many cells a piece traveled when down was pressed
    }

    getGameState() {
        return new GameState(this);
    }

    update(deltaTime) {
        //if (!this.alive) return;
        this.time += deltaTime;

        //Play a line clear animation
        if (this.time <= this.animationTime) {
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
        }

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
            //Move based on the inputs the client gave
            if (this.currentInputId < this.inputs.length) {
                //console.log(this.inputs);
                const input = this.inputs[this.currentInputId];
                //console.log('Checking input ' + input.id + ' with time ' + input.time + ' current time is '
                    //+ this.time + ' realworld time is ' + (Date.now()-this.startTime));
                if (input.time <= this.time) { //The input should be played
                    //console.log('Applying id ' + input.id);
                    //Move the piece according to the recorded input
                    const placePiece = this.movePiece(input.horzDir, input.rot, input.vertDir);
                    if (placePiece) {
                        this.placePiece();
                    }
                    if (input.vertDir) {
                        this.lastMoveDown = this.time;
                    }
                    this.receviedInputId = input.id;
                    this.currentInputId++;
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

    shouldIncreaseLevel() {
        if (this.level == this.startLevel) {
            //This formula is from https://tetris.wiki/Tetris_(NES,_Nintendo)
            if (this.lines >= (this.startLevel + 1) * 10 || this.lines >= max(100, this.startLevel * 10 - 50)) {
                return true;
            }
        } else {
            //If the tens digit increases (Ex from 128 to 131)
            const prevLineAmt = Math.floor((this.lines - this.animatingLines.length) / 10);
            const newLineAmt = Math.floor(this.lines / 10);
            if (newLineAmt > prevLineAmt) return true;
        }
        return false;
    }

    shouldSpawnPiece() {
        return this.currentPiece == null &&
                this.time > this.spawnNextPiece &&
                this.time > this.animationTime;
    }

    placePiece() {
        this.grid.addPiece(this.currentPiece);
        const row = this.currentPiece.getBottomRow();

        //Only clear lines if the next piece is not a triangle, or the next piece is a triangle, but it is a new triplet
        if (this.nextPieceIndex != 0 || this.nextSingles == 2) {
            this.clearLines(); //Clear any complete lines
        }

        const entryDelay = this.calcEntryDelay(row);
        this.spawnNextPiece = this.time + entryDelay;

        this.currentPiece = null; //There is an entry delay for the next piece
    }

    spawnPiece() {
        if (this.bag.length == []) {
            for (let i = 0; i < this.piecesJSON.length; i++) {
                this.bag.push(i); //Refill the bag with each piece
            }
        }
        this.currentPiece = this.nextPiece; //Assign the new current piece
        this.currentPieceIndex = this.nextPieceIndex;
        if (this.nextSingles > 0) {
            this.nextPieceIndex = 0; //This will make it spawn 3 single triangles in a row
            this.nextSingles--;
        } else {
            const bagIndex = this.gen.range(this.bag.length); //Math.floor(Math.random() * this.bag.length);
            this.nextPieceIndex = this.bag.splice(bagIndex, 1)[0]; //Pick 1 item and remove it from bag
            if (this.nextPieceIndex == 0) {
                //If it randomly chose to spawn 1 triangle, spawn 2 more
                this.nextSingles = 2;
            }
        }

        //this.currentSnapshot.setNext(this.nextPieceIndex);
        this.nextPiece = new Piece(this.piecesJSON[this.nextPieceIndex]);
    }

    clearLines() {
        let linesCleared = this.grid.clearLines();
        if (linesCleared.length > 0) {
            //this.currentSnapshot.setLines(linesCleared);
            //Set the time for when to stop animating
            this.animationTime = this.time + this.maxAnimationTime;
            this.animatingLines = linesCleared; //Which lines are being animated (and cleared)
            if (linesCleared.length == 3) {
                //Tritris!
                this.flashTime = this.time + this.maxFlashTime;
            }
        }
    }

    setSpeed() {
        let lvl = this.level;
        if (this.level > 29) lvl = 29;
        if (this.level < 0) lvl = 0;
        while (true) {
            if (this.levelSpeeds.hasOwnProperty(lvl)) {
                this.pieceSpeed = this.levelSpeeds[lvl];
                break;
            } //Finds the correct range for the level speed
            lvl--;
            if (lvl < 0) {
                //Uh oh, something went wrong
                console.error('Level Speed could not be found!');
                break;
            }
        }
    }

    movePiece(horzDirection, rotation, moveDown) {
        //Apply all transformations
        const vertDirection = moveDown ? 1 : 0;
        this.currentPiece.move(horzDirection, vertDirection);
        if (rotation == -1) this.currentPiece.rotateLeft();
        if (rotation == 1) this.currentPiece.rotateRight();
        if (rotation == 2) this.currentPiece.rotate180();

        //Try with all transformations
        let valid = this.isValid(this.currentPiece);
        if (valid) {
            //The piece (possibly) moved horizontally, rotated and moved down

            //this.currentSnapshot.addMove(this.totalTime, horzDirection, moveDown, rotation);
            return false; //Don't place the piece
        }
        //If blocked, undo horz move and maybe wall-charge
        this.currentPiece.move(-horzDirection, 0);
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //If the piece was block when moving horz, then wall charge
            //this.currentSnapshot.addMove(this.totalTime, 0, moveDown, rotation);
            return false;
        }

        //If not valid, undo rotation
        if (rotation == 1) this.currentPiece.rotateLeft();
        if (rotation == -1) this.currentPiece.rotateRight();
        if (rotation == 2) this.currentPiece.rotate180();
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //The piece was blocked by rotating
            //this.currentSnapshot.addMove(this.totalTime, 0, moveDown, 0);
            return false; //Don't place the piece
        }

        //If it reaches here, the piece was blocked by moving down and should be placed
        if (moveDown) this.currentPiece.move(0, -1); //Move the piece back up
        //The extra if statement is incase the pieces are at the top and spawn in other pieces
        return true; //Place the piece
    }

    calcEntryDelay(y) {
        if (y >= 18) return this.entryDelays[0];
        if (y >= 14) return this.entryDelays[1];
        if (y >= 10) return this.entryDelays[2];
        if (y >= 6) return this.entryDelays[3];
        return this.entryDelays[4];
    }

    isValid(piece) {
        if (piece.outOfBounds(this.w, this.h)) return false;
        return this.grid.isValid(piece);
    }
}

class GameState {
    constructor(game) {
        this.w = game.w;
        this.h = game.h;
        this.serializedGrid = game.grid.serialized();
        this.tritrisAmt = game.tritrisAmt;
        this.startTime = game.startTime; //TODO This might be unnecessary
        this.time = game.time;
        this.seed = game.seed;
        this.gen = new RandomGenerator(this.seed); //TODO These will be out of sync!!!!!!!!!!!!!

        this.alive = game.alive;

        this.level = game.level;
        this.lines = game.lines;
        this.score = game.score;
        this.currentPiece = game.currentPiece; //TODO Rework how the current and next piece are sent
        this.currentPieceIndex = game.currentPieceIndex;
        this.nextPiece = game.nextPiece;
        this.nextPieceIndex= game.nextPieceIndex;
        this.nextSingles = game.nextSingles;
        this.bag = game.bag;

        this.pieceSpeed = game.pieceSpeed;
        this.lastMoveDown = game.lastMoveDown;

        this.spawnNextPiece = game.spawnNextPiece;
        this.animationTime = game.animationTime;
        this.animatingLines = game.animatingLines;
        this.lastColCleared = game.lastColCleared;
        this.flashTime = game.flashTime;

        this.downPressedAt = game.downPressedAt;
    }

    serialize() {
        return this;
    }
}

class Input {
    constructor(id, time, horzDir, vertDir, rot) {
        this.id = id;
        this.time = time;
        this.horzDir = horzDir;
        this.vertDir = vertDir;
        this.rot = rot;
    }

    encode() {
        return {
            id: this.id,
            time: this.time, //TODO encode the direction using bits to be much more compact
            horzDir: this.horzDir,
            vertDir: this.vertDir,
            rot: this.rot
            //dir: this.horzDir + ',' + this.vertDir + ',' + this.rot
        }
    }
}

module.exports = { Game, Input };
