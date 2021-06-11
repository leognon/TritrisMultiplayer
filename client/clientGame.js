const { Grid, Piece, Triangle } = require('../common/classes.js');
const config = require('../common/config.js');
const RandomGenerator = require('random-seed');
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

        const frameRate = 60.0988; //frames per second
        const msPerFrame = 1000 / frameRate;
        this.das = 0;
        this.dasMax = msPerFrame * 16;
        this.dasCharged = msPerFrame * 10;

        this.downWasPressed = false;

        this.leftWasPressed = false;
        this.rightWasPressed = false;
        this.zWasPressed = false;
        this.zCharged = false;
        this.xWasPressed = false;
        this.xCharged = false;
        this.controls = {
            clock: 88,
            counterClock: 90,
            down: 40,
            left: 37,
            restart: 27,
            right: 39,
            start: 13
        }

        this.inputsQueue = []; //Fill up a queue of inputs to be sent to the server at regular intervals
        this.lastFrame = Date.now();
        this.inputId = 0;
    }

    clientUpdate() {
        const deltaTime = Date.now() - this.lastFrame;
        this.time += deltaTime;

        if (this.time <= this.animationTime) {
            this.playLineClearingAnimation();
        } else if (this.animatingLines.length > 0) {
            this.updateScoreAndLevel(); //After a line clear, update score and level and removed the lines from the grid
        }


        if (this.shouldSpawnPiece()) {
            this.spawnPiece();
            this.lastMoveDown = this.time;
            if (!this.isValid(this.currentPiece)) {
                this.alive = false;
            }
        }

        if (this.currentPiece !== null) {
            //If either left is pressed or right is pressed and down isn't
            let oneKeyPressed = keyIsDown(this.controls.left) != keyIsDown(this.controls.right);
            if (!this.practice && keyIsDown(this.controls.down)) {
                oneKeyPressed = false; //Allows down and left/right to be pressed in practice, but not in a real game
            }
            let move = false;
            if (oneKeyPressed) {
                this.das += deltaTime;
                if (
                    (keyIsDown(this.controls.left) && !this.leftWasPressed) ||
                    (keyIsDown(this.controls.right) && !this.rightWasPressed)
                ) {
                    //If it was tapped, move and reset das
                    move = true;
                    this.das = 0;
                } else if (this.das >= this.dasMax) {
                    move = true; //Key is being held, keep moving
                    this.das = this.dasCharged;
                }
            }

            let horzDirection = 0;
            if (move) {
                if (keyIsDown(this.controls.left)) horzDirection = -1;
                if (keyIsDown(this.controls.right)) horzDirection = 1;
            }

            const zPressed = keyIsDown(this.controls.counterClock) && (!this.zWasPressed || this.zCharged);
            const xPressed = keyIsDown(this.controls.clock) && (!this.xWasPressed || this.xCharged);
            let rotation = 0;
            if (zPressed && xPressed) rotation = 2;
            else if (xPressed) rotation = 1;
            else if (zPressed) rotation = -1;

            let pieceSpeed = this.pieceSpeed;
            if (keyIsDown(this.controls.down)) {
                //Pressing down moves twice as fast, or as fast as the min
                pieceSpeed = min(pieceSpeed, this.softDropSpeed);
            }
            if (keyIsDown(this.controls.down) && !this.downWasPressed) {
                this.downPressedAt = this.currentPiece.pos.y; //Save when the piece was first pressed down
            }
            let moveDown = this.time >= this.lastMoveDown + pieceSpeed;
            if (moveDown) {
                //TODO Level 19+ speeds will always register as push down????
                const timeSinceLastMoveDown = this.time - this.lastMoveDown;
                const diffFromSoftDrop = Math.abs(timeSinceLastMoveDown - this.softDropSpeed);
                if (diffFromSoftDrop <= this.softDropAccuracy && this.level < 19) { //Accounts for varying framerate
                    this.pushDownPoints++; //Pushing down
                } else {
                    this.pushDownPoints = 0;
                }
            }
            if (horzDirection != 0 || rotation != 0 || moveDown) {
                this.redraw = true; //A piece has moved, so the game must be redrawn
                const moveData = this.movePiece(horzDirection, rotation, moveDown);

                if (moveData.playSound) {
                    //Play move sound
                }
                if (moveData.chargeDas) {
                    this.das = this.dasMax;
                }
                if (moveData.rotated) {
                    this.zCharged = false;
                    this.xCharged = false;
                } else if (rotation != 0) {
                    //Player tried to rotate but was blocked, so charge rotation
                    if (rotation == 1 || rotation == 2) this.xCharged = true;
                    if (rotation == -1 || rotation == 2) this.zCharged = true;
                }

                const currentTime = Date.now() - this.startTime; //TODO Instead of the real world time it should use this.time because that is what the player sees
                const inp = new Input(this.inputId++, currentTime, horzDirection, moveDown, rotation);
                this.addInput(inp);

                if (moveData.placePiece) {
                    this.score += this.pushDownPoints;
                    this.pushDownPoints = 0;

                    //Place the piece
                    this.placePiece();

                    this.zCharged = false; //After a piece is placed, don't rotate the next piece
                    this.xCharged = false;
                } else {
                    //If the piece was able to just move down, reset the timer
                    if (moveDown) this.lastMoveDown = this.time;
                }
            }
        }

        this.downWasPressed = keyIsDown(this.controls.down);
        this.leftWasPressed = keyIsDown(this.controls.left);
        this.rightWasPressed = keyIsDown(this.controls.right);
        this.zWasPressed = keyIsDown(this.controls.counterClock); //If Z was pressed
        this.xWasPressed = keyIsDown(this.controls.clock); //If X was pressed
        if (!keyIsDown(this.controls.counterClock)) this.zCharged = false; //If the player is pressing anymore, they no longer want to rotate, so don't charge
        if (!keyIsDown(this.controls.clock)) this.xCharged = false;

        this.lastFrame = Date.now();
    }

    playLineClearingAnimation() {
        const percentDone = (this.animationTime - this.time) / this.maxAnimationTime;
        const clearingCol = Math.floor(percentDone * this.w);
        for (const row of this.animatingLines) {
            //Clear as many cols as necessary
            for (let col = this.w; col >= clearingCol; col--) {
                //Clear from middle to left (triangle by traingle)
                const colPos = Math.floor(col / 2);
                if (col % 2 == 1) this.grid.removeRightTri(row, colPos);
                else this.grid.removeLeftTri(row, colPos);

                //Clear from middle to right
                const otherColPos = this.w - 1 - colPos;
                if (col % 2 == 0)
                    this.grid.removeRightTri(row, otherColPos);
                else this.grid.removeLeftTri(row, otherColPos);
            }
        }
        //this.redraw = true;
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

        this.goToGameState(myGameData);

        this.serverGrid = new Grid(myGameData.serializedGrid); //TODO Remove this. This is was the server sees for debugging
        this.serverCurrentPiece = null;
        if (myGameData.currentPieceSerialized) {
            this.serverCurrentPiece = new Piece(myGameData.currentPieceSerialized);
        }
        this.serverNextPiece = null;
        if (myGameData.nextPieceIndex) {
            this.serverNextPiece = new Piece(this.piecesJSON[myGameData.nextPieceIndex]);
        }

        this.updateToTime(Date.now() - this.startTime); //Recatch-up the game
        this.lastFrame = Date.now();
    }

    getInputs() {
        let inps = [];
        for (let inp of this.inputsQueue) {
            inps.push(inp.encode());
        }
        this.inputsQueue = []; //Discard inputs that no longer need to be sent
        return inps;
    }

    show(x, y, w, h, paused, oldGraphics, showGridLines, showStats, showFlash) {
        //Play flashing animation
        const flashing = this.flashTime >= this.time;
        if (!this.redraw && !flashing) return; //If not flashing, only draw when necessary

        if (flashing && showFlash) {
            const timePassed = this.flashTime - this.time;
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
