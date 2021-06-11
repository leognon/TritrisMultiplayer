const { Input } = require('../common/game.js');
const ClientGame = require('../client/clientGame');

class MyGame extends ClientGame {
    constructor() {
        super();

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
        this.inputId = 0;

        this.lastFrame = Date.now();
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

    addInput(inp) {
        this.inputsQueue.push(inp);
        this.inputs.push(inp);
    }

    gotData(myData) {
        const myGameData = myData.gameData;

        //Remove inputs already processed by the server
        this.doneInputId = myGameData.doneInputId;
        for (let i = this.inputs.length-1; i >= 0; i--) {
            if (this.inputs[i].id <= this.doneInputId) {
                this.inputs.splice(i, 1); //Removed inputs the server has already completed
            }
        }

        this.goToGameState(myGameData);

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

}

module.exports = MyGame;
