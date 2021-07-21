const { Input } = require('../common/game.js');
const ClientGame = require('../client/clientGame');

class MyGame extends ClientGame {
    constructor(seed, level, name) {
        super(seed, level, name);

        const frameRate = 60.0988; //frames per second
        const msPerFrame = 1000 / frameRate;
        this.das = 0;
        this.dasMax = msPerFrame * 16;
        this.dasCharged = msPerFrame * 10;

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

        this.soundsToPlay = {
            move: false,
            fall: false,
            clear: false,
            tritris: false,
            levelup: false,
            topout: false,
        }
    }

    clientUpdate() {
        const deltaTime = Date.now() - this.lastFrame;
        this.time += deltaTime;

        //Dont update if not alive or during countdown
        if (!this.alive || Date.now() < this.startTime) {
            this.lastFrame = Date.now();
            return;
        }

        if (this.time <= this.animatingUntil) {
            this.playLineClearingAnimation();
        } else if (this.animatingLines.length > 0) {
            let playSound = this.updateScoreAndLevel(); //After a line clear, update score and level and removed the lines from the grid
            if (playSound)
                this.soundsToPlay.levelup = true;
        }

        if (this.shouldSpawnPiece()) {
            this.spawnPiece();
            this.lastMoveDown = this.time;
            if (!this.isValid(this.currentPiece)) {
                this.alive = false;
                this.soundsToPlay.topout = true;
            }
            this.redraw = true;
            this.soundsToPlay.fall = true;
        }

        if (this.currentPiece !== null) {
            //If either left is pressed or right is pressed and down isn't
            const { horzDirection, rotation, moveDown, softDrop } = this.getCurrentInputs();
            if (horzDirection != 0 || rotation != 0 || moveDown) {
                this.redraw = true; //A piece has moved, so the game must be redrawn
                const moveData = this.movePiece(horzDirection, rotation, moveDown);

                if (moveData.playSound) {
                    this.soundsToPlay.move = true;
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

                const currentTime = this.time;
                const inp = new Input(this.inputId++, currentTime, horzDirection, moveDown, rotation, softDrop);
                this.addInput(inp);

                //If the piece was able to just move down, reset the timer
                if (moveDown) {
                    if (softDrop) this.pushDownPoints++; //Pushing down
                    else this.pushDownPoints = 0;
                    this.lastMoveDown = this.time;
                }
                if (moveData.placePiece) {
                    this.score += this.pushDownPoints;
                    this.pushDownPoints = 0;

                    //Place the piece
                    const numLinesCleared = this.placePiece();
                    if (numLinesCleared == 3)
                        this.soundsToPlay.tritris = true;
                    else if (numLinesCleared > 0)
                        this.soundsToPlay.clear = true;

                    this.zCharged = false; //After a piece is placed, don't rotate the next piece
                    this.xCharged = false;
                }
            }
        }

        this.lastFrame = Date.now();
    }

    getCurrentInputs() {
        const deltaTime = Date.now() - this.lastFrame;

        let oneKeyPressed = keyIsDown(this.controls.left) != keyIsDown(this.controls.right);
        if (keyIsDown(this.controls.down)) oneKeyPressed = false; //Cannot move left/right and press down at the same time

        let shouldMoveHorz = false;
        if (oneKeyPressed) {
            this.das += deltaTime;
            if ((keyIsDown(this.controls.left) && !this.leftWasPressed) || //Just started pressing left
                (keyIsDown(this.controls.right) && !this.rightWasPressed)) { //Just started pressing right
                //If it was tapped, move and reset das
                shouldMoveHorz = true;
                this.das = 0;
            } else if (this.das >= this.dasMax) { //Key has been held long enough to fully charge
                shouldMoveHorz = true; //Key is being held, keep moving
                this.das = this.dasCharged;
            }
        }

        let horzDirection = 0;
        if (shouldMoveHorz) {
            if (keyIsDown(this.controls.left)) horzDirection = -1;
            if (keyIsDown(this.controls.right)) horzDirection = 1;
        }

        //If the user just pressed rotate or they have been holding it and it's charged
        const zPressed = keyIsDown(this.controls.counterClock) && (!this.zWasPressed || this.zCharged);
        const xPressed = keyIsDown(this.controls.clock) && (!this.xWasPressed || this.xCharged);
        let rotation = 0;
        if (zPressed && xPressed) rotation = 2; //A 180 rotation
        else if (xPressed) rotation = 1;
        else if (zPressed) rotation = -1;

        let softDrop = false;
        let pieceSpeed = this.pieceSpeed; //The default piece speed based on the current level
        if (keyIsDown(this.controls.down)) {
            //Pressing down moves at 19 speed
            pieceSpeed = min(pieceSpeed, this.softDropSpeed);
            softDrop = true;
        }
        let moveDown = this.time >= this.lastMoveDown + pieceSpeed;

        this.leftWasPressed = keyIsDown(this.controls.left);
        this.rightWasPressed = keyIsDown(this.controls.right);
        this.zWasPressed = keyIsDown(this.controls.counterClock); //If Z was pressed
        this.xWasPressed = keyIsDown(this.controls.clock); //If X was pressed
        if (!keyIsDown(this.controls.counterClock)) this.zCharged = false; //If the player is pressing anymore, they no longer want to rotate, so don't charge
        if (!keyIsDown(this.controls.clock)) this.xCharged = false;

        return {
            horzDirection, rotation, moveDown, softDrop
        };
    }

    addInput(inp) {
        this.inputsQueue.push(inp);
        this.inputs.push(inp);
    }

    gotGameState(myData) {
        const myGameData = myData.gameData;

        //Remove inputs already processed by the server
        this.doneInputId = myGameData.doneInputId;
        for (let i = this.inputs.length-1; i >= 0; i--) {
            if (this.inputs[i].id <= this.doneInputId) {
                this.inputs.splice(i, 1); //Removed inputs the server has already completed
            }
        }

        this.goToGameState(myGameData);

        this.updateToTime(Date.now() - this.startTime, false); //Recatch-up the game
        this.lastFrame = Date.now();
        this.redraw = true;
    }

    getInputs() {
        let inps = [];
        for (let inp of this.inputsQueue) {
            inps.push(inp.encode());
        }
        this.inputsQueue = []; //Discard inputs that no longer need to be sent
        return inps;
    }

    playSounds(sounds) {
        for (const s in sounds) {
            if (this.soundsToPlay[s]) {
                sounds[s].play();
                this.soundsToPlay[s] = false;
            }
        }
    }

}

module.exports = MyGame;
