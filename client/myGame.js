import { Input } from '../common/game.js';
import ClientGame from '../client/clientGame';

export default class MyGame extends ClientGame {
    constructor(name, myControls, settings) {
        super(name, settings);

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
        this.controls = myControls;

        this.inputsQueue = []; //Fill up a queue of inputs to be sent to the server at regular intervals
        this.inputId = 0;

        this.lastFrame = Date.now();
    }

    clientUpdate(p5) {
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
            const { horzDirection, rotation, moveDown, softDrop } = this.getCurrentInputs(p5);
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

    getCurrentInputs(p5) {
        const deltaTime = Date.now() - this.lastFrame;

        let oneKeyPressed = p5.keyIsDown(this.controls.left.key) != p5.keyIsDown(this.controls.right.key);
        if (p5.keyIsDown(this.controls.down.key)) oneKeyPressed = false; //Cannot move left/right and press down at the same time

        let shouldMoveHorz = false;
        if (oneKeyPressed) {
            this.das += deltaTime;
            if ((p5.keyIsDown(this.controls.left.key) && !this.leftWasPressed) || //Just started pressing left
                (p5.keyIsDown(this.controls.right.key) && !this.rightWasPressed)) { //Just started pressing right
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
            if (p5.keyIsDown(this.controls.left.key)) horzDirection = -1;
            if (p5.keyIsDown(this.controls.right.key)) horzDirection = 1;
        }

        //If the user just pressed rotate or they have been holding it and it's charged
        const zPressed = p5.keyIsDown(this.controls.counterClock.key) && (!this.zWasPressed || this.zCharged);
        const xPressed = p5.keyIsDown(this.controls.clock.key) && (!this.xWasPressed || this.xCharged);
        let rotation = 0;
        if (zPressed && xPressed) rotation = 2; //A 180 rotation
        else if (xPressed) rotation = 1;
        else if (zPressed) rotation = -1;

        let softDrop = false;
        let pieceSpeed = this.pieceSpeed; //The default piece speed based on the current level
        if (p5.keyIsDown(this.controls.down.key)) {
            //Pressing down moves at 19 speed
            pieceSpeed = Math.min(pieceSpeed, this.softDropSpeed);
            softDrop = true;
        }
        let moveDown = this.time >= this.lastMoveDown + pieceSpeed;

        this.leftWasPressed = p5.keyIsDown(this.controls.left.key);
        this.rightWasPressed = p5.keyIsDown(this.controls.right.key);
        this.zWasPressed = p5.keyIsDown(this.controls.counterClock.key); //If Z was pressed
        this.xWasPressed = p5.keyIsDown(this.controls.clock.key); //If X was pressed
        if (!p5.keyIsDown(this.controls.counterClock.key)) this.zCharged = false; //If the player is pressing anymore, they no longer want to rotate, so don't charge
        if (!p5.keyIsDown(this.controls.clock.key)) this.xCharged = false;

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
        //TODO???? Should lastFrame not be set here because that might cause deltaTime to "skip" time
        //In testing it was causing minor lagbacks (especially on 19)

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
}
