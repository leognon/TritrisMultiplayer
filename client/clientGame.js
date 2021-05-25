const { Grid, Piece, Triangle } = require('../common/classes.js');
const { Game, Input } = require('../common/game.js');

class ClientGame extends Game {
    constructor() {
        super(0);
        //TODO Figure out redraw
        this.colors = [
            color(255, 0, 0), //Red boomerang
            color(0, 255, 0), //Green fortune cookie
            color(255, 255, 0), //Yellow pencil
            color(255, 0, 255), //Pink boomerang
            color(0, 255, 255), //Blue pencil
            color(250, 100, 25), //Orange Razor
            color(255), //White Ninja
        ];
        this.startTime = Date.now();
        this.inputs = [];
        this.inputId = 0;
        this.receviedInputId = 0;

        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.zWasPressed = false;
        this.xWasPressed = false;

        this.lastFrame = Date.now();
    }

    clientUpdate() {
        if (this.currentPiece) {
            const currentTime = Date.now() - this.startTime;
            if (keyIsDown(37) && !this.leftWasPressed) { //Left arrow
                this.inputs[this.inputId] = new Input(this.inputId, currentTime, -1, 0, 0);
                this.inputsId++;
                //this.currentPiece.move(-1, 0);
            }
            if (keyIsDown(39) && !this.rightWasPressed) { //Right arrow
                this.inputs[this.inputId] = new Input(this.inputId, currentTime, 1, 0, 0);
                this.inputId++
                //this.currentPiece.move(1, 0);
            }
            if (keyIsDown(90) && !this.zWasPressed) { //Z (Counter clock)
                this.inputs[this.inputId] = new Input(this.inputId, currentTime, 0, 0, -1);
                this.inputId++;
                //this.currentPiece.rotateLeft();
            }
            if (keyIsDown(88) && !this.xWasPressed) { //X (clockwise)
                this.inputs[this.inputId] = new Input(this.inputId, currentTime, 0, 0, 1);
                this.inputId++;
                //this.currentPiece.rotateRight();
            }
            //if (Math.random() < 0.05) console.log(this.inputs);
        }

        //this.currentInput = 0;
        //this.currentInput = -1;
        this.update(Date.now() - this.lastFrame);
        //this.clientReconcilliation(Date.now() - this.startTime);
        //if (mouseIsPressed) console.log('Time diff: ' + this.time + ' vs ' + (Date.now() - this.startTime));
        //this.updateToTime(Date.now() - this.startTime);

        this.leftWasPressed = keyIsDown(37);
        this.rightWasPressed = keyIsDown(39);
        this.zWasPressed = keyIsDown(90);
        this.xWasPressed = keyIsDown(88);

        this.lastFrame = Date.now();
    }

    clientReconcilliation(t) {
        //this.currentInputId = this.receviedInputId + 1; // this.acknowledgedInputId;

        //window.asdf += 'From ' + this.currentInputId + ' to ' + this.inputs.length + '\n';
        this.updateToTime(t);
    }

    gotData(data, myId) {
        //console.log('Got data');
        if (mouseIsPressed) {
            //console.log('Calling debugger');
            //debugger;
        }
        const myData = Object.values(data.players)[0];
        const myGameData = myData.gameData;
        //console.log('Diff: ', myGameData.time - (Date.now() - this.startTime));
            //TODO Client time is ahead of server time...
        //const now = Date.now();
        //debugger;
        //Clears any inputs that have already been recevied by the server
        this.receviedInputId = myData.receviedInputId;
        /*for (let i = 0; i < this.inputs.length; i++) {
            if (this.inputs[i].id == myData.receviedInputId) { //TODO This should become acknowledgedInputId??
                this.inputs = this.inputs.slice(i+1);
            }
        }*/ //TODO Uncomment this
        //TODO Make this not horrible code... this was all very rushed just to debug
        if (myGameData.currentPiece) {
            this.currentPiece = new Piece(this.piecesJSON[myGameData.currentPieceIndex]);
            this.currentPiece.pos = createVector(myGameData.currentPiece.pos.x, myGameData.currentPiece.pos.y);
            this.currentPiece.rotation = myGameData.currentPiece.rotation;
        } else {
            this.currentPiece = null;
        }
        if (myGameData.nextPiece) {
            this.nextPieceIndex = myGameData.nextPieceIndex;
            this.nextPiece = new Piece(this.piecesJSON[myGameData.nextPieceIndex]);
            this.nextPiece.pos = createVector(myGameData.nextPiece.pos.x, myGameData.nextPiece.pos.y);
            this.nextPiece.rotation = myGameData.nextPiece.rotation;
        } else {
            this.nextPiece = null;
        }
        this.grid = new Grid(myGameData.serializedGrid);

        this.tritrisAmt = myGameData.tritrisAmt;
        this.seed = myGameData.seed;
        //this.gen = myGameData.gen; //TODO This will by out of sync
        this.alive = myGameData.alive;
        this.level = myGameData.level;
        this.lines = myGameData.lines;
        this.nextSingles = myGameData.nextSingles;
        this.bag = myGameData.bag;
        this.pieceSpeed = myGameData.pieceSpeed;
        this.lastMoveDown = myGameData.lastMoveDown;

        this.spawnNextPiece = myGameData.spawnNextPiece;
        this.animationTime = myGameData.animationTime;
        this.animatingLines = myGameData.animatingLines;
        this.lastColCleared = myGameData.lastColCleared;
        this.flashTime = myGameData.flashTime;
        this.downPressedAt = myGameData.downPressedAt;

        //TODO I must serialize the game to send in a proper state so that it can be applied when recevied, then update the client to now from the gotten state

        //After being set to the authoratative server state, use client reconcilliation to update inputs the server hasn't seen yet
        this.startTime = myGameData.startTime; //TODO?????
        this.time = myGameData.time;
        this.currentInputId = this.receviedInputId + 1;
        this.clientReconcilliation(Date.now() - this.startTime);
        //this.currentInput = 0; //Make it redo all the inputs that haven't been done by the server
        //this.updateToTime(this.time + 1000); //TODO Testing
        //this.updateToTime(Date.now() - this.startTime);
        //this.currentInput = -1;
        this.lastFrame = Date.now();
        //this.updateFromStartToTime(Date.now() - this.startTime);
    }

    getInputs() {
        const data = this.inputs.map(i => i.encode());
        //console.log('Gettings inputs', this.inputs, data);
        return data;
    }

    show(x, y, w, h, paused, oldGraphics, showGridLines, showStats, showFlash) {
        //Play flashing animation
        const flashing = this.flashTime >= Date.now();
        if (!this.redraw && !flashing) return; //If not flashing, only draw when necessary

        if (flashing && showFlash) {
            const timePassed = this.flashTime - Date.now();
            const interval = Math.floor(this.flashAmount * timePassed / this.maxFlashTime);
            if (interval % 2 == 0) {
                background(150);
            } else {
                background(100);
            }
            this.redraw = true; //If flashing, redraw each frame
        } else {
            background(100);
        }

        noStroke();
        fill(0);
        rect(x, y, w, h);

        const cellW = w / this.w;
        const cellH = h / this.h;

        this.grid.show(x, y, w, h, this.colors, this.pieceImages, paused, showGridLines, oldGraphics);
        if (this.currentPiece && !paused) {
            this.currentPiece.show(x, y, cellW, cellH, this.colors, this.pieceImages, oldGraphics);
        }


        const txtSize = 20;
        textSize(txtSize);
        textAlign(LEFT, TOP);
        const padding = 10;
        const scorePos = createVector(x + w + cellW, y + cellH);
        let scoreDim;

        let normal = this.score % 100000;
        let dig = Math.floor(this.score / 100000);
        let formattedScore = normal.toString();
        if (dig > 0) {
            while (formattedScore.length < 5) formattedScore = '0' + formattedScore; //Make sure the length is correct
        }
        for (let i = formattedScore.length-3; i > 0; i -= 3) {
            formattedScore = formattedScore.slice(0, i) + " " + formattedScore.slice(i);
        } //Put a space every 3 characters (from the end)

        if (dig > 0) {
            let str = dig.toString();
            if (dig >= 10 && dig <= 35) str = String.fromCharCode('A'.charCodeAt(0) + dig - 10);
            formattedScore = str + formattedScore;
        }

        const scoreTxt = `Score ${formattedScore}`;
        const linesTxt = `Lines  ${this.lines}`;
        const levelTxt = `Level  ${this.level}`;
        const textW = max(
            textWidth(scoreTxt),
            textWidth(linesTxt),
            textWidth(levelTxt),
            4 * cellW
        );
        scoreDim = createVector(
            textW + padding + 10,
            txtSize * 4.5 + padding * 2
        );
        noFill();
        stroke(0);
        strokeWeight(3);
        //The box outline
        rect(scorePos.x, scorePos.y, scoreDim.x, scoreDim.y);
        noStroke();
        fill(0);
        text(scoreTxt, scorePos.x + padding, scorePos.y + padding);
        text(
            linesTxt,
            scorePos.x + padding,
            scorePos.y + padding + 1.75 * txtSize
        );
        text(
            levelTxt,
            scorePos.x + padding,
            scorePos.y + padding + 3.5 * txtSize
        );

        const nextPiecePos = createVector(
            scorePos.x,
            scorePos.y + scoreDim.y + cellH
        );
        const nextPieceDim = createVector(cellW * 3, cellW * 3);
        noFill();
        stroke(0);
        strokeWeight(3);
        rect(nextPiecePos.x, nextPiecePos.y, nextPieceDim.x, nextPieceDim.y);
        if (!paused && this.nextPiece) {
            if (this.nextSingles == 0) { //Show next piece normally
                this.nextPiece.showAt(
                    nextPiecePos.x,
                    nextPiecePos.y,
                    nextPieceDim.x,
                    nextPieceDim.y,
                    this.colors,
                    this.pieceImages,
                    oldGraphics
                );
            } else if (this.nextSingles == 2) { //Show 3 Ninjas coming up
                const spacingX = nextPieceDim.x / 7;
                const spacingY = nextPieceDim.y / 7;
                this.nextPiece.showAt(nextPiecePos.x - spacingX, nextPiecePos.y - spacingY, nextPieceDim.x, nextPieceDim.y, this.colors, this.pieceImages, oldGraphics);
                this.nextPiece.showAt(nextPiecePos.x, nextPiecePos.y, nextPieceDim.x, nextPieceDim.y, this.colors, this.pieceImages, oldGraphics);
                this.nextPiece.showAt(nextPiecePos.x + spacingX, nextPiecePos.y + spacingY, nextPieceDim.x, nextPieceDim.y, this.colors, this.pieceImages, oldGraphics);
            } else if (this.nextSingles == 1) { //Show 2 ninjas coming up
                const spacingX = nextPieceDim.x / 7;
                const spacingY = nextPieceDim.y / 7;
                this.nextPiece.showAt(nextPiecePos.x - spacingX/2, nextPiecePos.y - spacingY/2, nextPieceDim.x, nextPieceDim.y, this.colors, this.pieceImages, oldGraphics);
                this.nextPiece.showAt(nextPiecePos.x + spacingX/2, nextPiecePos.y + spacingY/2, nextPieceDim.x, nextPieceDim.y, this.colors, this.pieceImages, oldGraphics);
            }
        }

        if (showStats) {
            const statPos = createVector(
                scorePos.x,
                nextPiecePos.y + nextPieceDim.y + cellH
            );

            let tritrisPercent = Math.round(100 * 3*this.tritrisAmt / this.lines);
            if (this.lines == 0) tritrisPercent = '--';
            const tritrisPercentText = `Tri ${tritrisPercent}%`;

            const totalSec = Math.floor(this.time / 1000) % 60;
            const totalM = Math.floor(this.time / (1000*60));
            const startLevelText = `Time ${nf(totalM,2)}:${nf(totalSec,2)}`;

            const textW = max(
                textWidth(tritrisPercentText),
                textWidth(startLevelText),
                4 * cellW
            );

            const statDim = createVector(
                textW + padding + 10,
                txtSize * 2.75 + padding * 2
            );
            noFill();
            stroke(0);
            strokeWeight(3);
            //The box outline
            rect(statPos.x, statPos.y, statDim.x, statDim.y);
            noStroke();
            fill(0);
            text(tritrisPercentText, statPos.x + padding, statPos.y + padding);
            text(
                startLevelText,
                statPos.x + padding,
                statPos.y + padding + 1.75 * txtSize
            );
        }

        if (!flashing) this.redraw = false;
    }
}

module.exports = ClientGame;
