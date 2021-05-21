const { Grid, GridCell, Triangle, Piece } = require('./classes.js');
const piecesJSON = require('./pieces');


/* TODO
 * Rename timer variables
 * Remove extra variables
 * Fix number of points for double (should be 300)
 */

class Game {
    constructor(level) {
        this.w = 8;
        this.h = 16;
        this.grid = new Grid(this.w, this.h);

        this.tritrisAmt = 0; //For statistics
        this.time = 0;

        this.alive = true;

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
        if (this.practice) this.softDropSpeed *= 4;
        this.lastMoveDown = Date.now() + 750;

        this.lastFrame = Date.now(); //Used to calculate deltaTime and for DAS

        this.entryDelay = msPerFrame * 14; //There is a 10 frame entry delay (the time btwn the last piece locking in, and the next spawning)
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

    update() {
        if (!this.alive) return;

        const now = Date.now();
        const deltaTime = now - this.lastFrame;
        this.time += deltaTime;

        //Play a line clear animation
        if (now <= this.animationTime) {
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
            this.lastMoveDown = now;
            if (!this.isValid(this.currentPiece)) {
                this.alive = false; //If the new piece is already blocked, game over
            }
        }

        //Piece Movement
        if (this.currentPiece !== null) {

        }

        this.lastFrame = Date.now();
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
                now > this.spawnNextPiece &&
                now > this.animationTime;
    }

    placePiece() {
        this.grid.addPiece(this.currentPiece);
        const row = this.currentPiece.getBottomRow();

        //Only clear lines if the next piece is not a triangle, or the next piece is a triangle, but it is a new triplet
        if (this.nextPieceIndex != 0 || this.nextSingles == 2) {
            this.clearLines(); //Clear any complete lines
        }

        const entryDelay = this.calcEntryDelay(row);
        this.spawnNextPiece = Date.now() + entryDelay;

        this.currentPiece = null; //There is an entry delay for the next piece
    }

    spawnPiece() {
        if (this.bag.length == []) {
            for (let i = 0; i < this.piecesJSON.length; i++) {
                this.bag.push(i); //Refill the bag with each piece
            }
        }
        this.currentPiece = this.nextPiece; //Assign the new current piece
        if (this.nextSingles > 0) {
            this.nextPieceIndex = 0; //This will make it spawn 3 single triangles in a row
            this.nextSingles--;
        } else {
            const bagIndex = Math.floor(Math.random() * this.bag.length);
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
            this.animationTime = Date.now() + this.maxAnimationTime;
            this.animatingLines = linesCleared; //Which lines are being animated (and cleared)
            if (linesCleared.length == 3) {
                //Tritris!
                this.flashTime = Date.now() + this.maxFlashTime;
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
            dir: this.horzDir + ',' + this.vertDir + ',' + this.rot
        }
    }
}

module.exports = { Game, Input };
