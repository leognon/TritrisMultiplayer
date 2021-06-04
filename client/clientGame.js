const { Grid, Piece, Triangle } = require('../common/classes.js');
const config = require('../common/config.js');
const { Game, Input } = require('../common/game.js');

class ClientGame extends Game {
    constructor() {
        super();

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

        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.zWasPressed = false;
        this.xWasPressed = false;

        this.inputsQueue = []; //Fill up a queue of inputs to be sent to the server at regular intervals
        this.lastFrame = Date.now();
        this.inputId = 0;
        this.lastSentInput = 0;
    }

    clientUpdate() {
        let move = false;
        let horzDir = 0;
        let rot = 0;
        let moveDown = false;
        if (keyIsDown(37) && !this.leftWasPressed) { //Left arrow
            horzDir = -1;
            move = true;
        }
        if (keyIsDown(39) && !this.rightWasPressed) { //Right arrow
            horzDir = 1;
            move = true;
        }
        if (keyIsDown(90) && !this.zWasPressed) { //Z (Counter clock)
            rot = -1;
            move = true;
        }
        if (keyIsDown(88) && !this.xWasPressed) { //X (clockwise)
            rot = 1;
            move = true;
        }
        if (keyIsDown(40)) {
            moveDown = true;
            move = true;
        }
        const currentTime = Date.now() - this.startTime; //TODO Instead of the real world time it should use this.time because that is what the player sees
        const inp = new Input(this.inputId, currentTime, horzDir, moveDown, rot);

        //If the player made a move or haven't made a move in a while, send an input to keep the server updated
        const hasInput = move ? true : false; // || Date.now() - this.startTime > this.lastSentInput + config.CLIENT_PING_EVERY;
        if (hasInput) { //The lastSentInput is like a ping
            this.addInput(inp);
            this.lastSentInput = currentTime;
            this.inputId++;
        }

        const deltaTime = Date.now() - this.lastFrame;
        this.update(deltaTime, hasInput ? inp : null, true);

        this.leftWasPressed = keyIsDown(37);
        this.rightWasPressed = keyIsDown(39);
        this.zWasPressed = keyIsDown(90);
        this.xWasPressed = keyIsDown(88);

        this.lastFrame = Date.now();
    }

    moveDown() {
        let shouldMoveDown = this.time >= this.lastMoveDown + this.pieceSpeed;
        if (this.currentPiece !== null && shouldMoveDown) {
            const inp = new Input(this.inputId++, Date.now()-this.startTime, 0, 1, 0);
            //console.log('Moving down at ' + this.time, inp);
            this.addInput(inp);
            const placePiece = this.movePiece(0, 0, true);
            if (placePiece) this.placePiece();
            this.lastMoveDown = this.time;
        }
    }

    addInput(inp) {
        this.inputsQueue.push(inp);
        this.inputs.push(inp);
    }

    gotData(data, myId) {
        const myData = Object.values(data.players)[0];
        const myGameData = myData.gameData;

        //Remove inputs already processed by the server
        this.doneInputId = myGameData.doneInputId;
        for (let i = this.inputs.length-1; i >= 0; i--) {
            if (this.inputs[i].id <= this.doneInputId) {
                this.inputs.splice(i, 1); //Removed inputs the server has already completed
            }
        }

        this.seed = myGameData.seed;
        //this.gen = myGameData.gen; //TODO This will by out of sync
        this.bag = myGameData.bag;
        this.nextSingles = myGameData.nextSingles;

        if (myGameData.currentPieceSerialized) this.currentPiece = new Piece(myGameData.currentPieceSerialized);
        else this.currentPiece = null;

        this.nextPieceIndex = myGameData.nextPieceIndex;
        if (this.nextPieceIndex !== null) this.nextPiece = new Piece(this.piecesJSON[this.nextPieceIndex]);
        else this.nextPiece = null;

        this.grid = new Grid(myGameData.serializedGrid);

        this.tritrisAmt = myGameData.tritrisAmt;
        this.alive = myGameData.alive;
        this.level = myGameData.level;
        this.lines = myGameData.lines;
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
        //this.startTime = myGameData.startTime; //This will mess up other time zones
        //console.log('Got data. Time diff: ' + (this.time - myGameData.time));
        this.time = myGameData.time;

        this.serverGrid = new Grid(myGameData.serializedGrid); //TODO Remove this. This is was the server sees for debugging
        this.serverCurrentPiece = null;
        if (myGameData.currentPieceSerialized) {
            this.serverCurrentPiece = new Piece(myGameData.currentPieceSerialized);
        }
        this.serverNextPiece = null;
        if (myGameData.nextPieceIndex) {
            this.serverNextPiece = new Piece(this.piecesJSON[myGameData.nextPieceIndex]);
        }

        //console.log('Going to current time ' + (Date.now() - this.startTime));
        this.updateToTime(Date.now() - this.startTime); //Recatch-up the game
        //console.log('Caught up');
        this.lastFrame = Date.now();
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

        if (this.serverGrid) {
            noStroke();
            fill(0);
            rect(x + w + 150, y, w, h);
            this.serverGrid.show(x + w + 150, y, w, h, this.colors, this.pieceImages, paused, showGridLines, oldGraphics);
            if (this.serverCurrentPiece) {
                this.serverCurrentPiece.show(x + w + 150, y, cellW, cellH, this.colors, this.pieceImages, oldGraphics);
            }
            if (this.serverNextPiece) {
                this.serverNextPiece.showAt(x + w + w + 150 + 50, y + 50, 150, 150, this.colors, this.pieceImages, oldGraphics);
            }
        }
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
