import { Grid, Piece } from './classes.js';
import RandomGenerator from 'random-seed';
import { tritrisJSON, quadtrisJSON } from './pieces.js';
import gameTypes from '../common/gameTypes.js';

/* TODO

Optional score differential
    Make the colors still show the difference
Add sound effect for countdown when game is starting
Make 4 players display like 3 players (without any small)

change your color based on who is in the lead (show leaders name in gold?)

Fix LAG!!!!!!!!!!!!!!!!
    Maybe it is caused by React
        Try downgrading to the version dreadnought and I tested
    If you phase, it moves the next piece

Show game history and winners

If the person receiving garbage is disconnected, could there be a desync?
    On the server, the garbage will be placed within a few seconds
    On they disconnected client, the garbage will be placed much later
    Once reconnected, the authoritative state will correct

Click off tab before topping out?


Get a tritris while disconnected??? Does it instantly send the garbage unfairly??
    It sends all the lines with no warning

Add all settings in room

[X] Better score display - Show score differential
[ ] Fix number of points for double (should be 300)
[ ] Figure out deltaTime stuff - Don't update deltaTime after receiving data on myGame?
[ ] Make server more authoritative. Validate inputs, ensure piece falls consistently
[ ] Round decimals to make game more deterministic
[ ] Add version numbers
    [X] Disconnect message if server changed
    [ ] Remember last version so update dialogues and popup
[ ] More gamemodes
    [X] Win condition for each gamemode
    [ ] B-Type
    [X] 4x8
    [ ] Bitris
    [ ] Invisible-Tris
    [ ] No next
    [ ] Different Types of RNG
        [ ] 7-bag
        [ ] 14-bag
        [ ] True Random
        [ ] No Ninja
        [ ] Mastery Mode (Ninjas get less frequent)
    [ ] Versus Mode
        [X] Different Display
            [X] Since score doesn't matter, show other stats?
            [ ] Pieces per second
            [ ] Tapping speed
        [ ] Send garbage
            [X] Double sends 1 line, Tritris sends 3 lines
            [ ] Spins send lines?
            [ ] A tritris with multiple phases adds difficulty
            [X] Perfect Clear
            [ ] Combos
                [ ] Back to back tritris
            [ ] Depending on how difficult the send was, make garbage received difficult
                [X] Random open column
                [ ] Open columns in different places
        [ ] 180 button
How should level starts be chosen?
Database
    Save games / replay games
    Accounts
        Sign in with Google?
        Ranked matches - ELO
    Donate
        Get custom skins
        More lobby customization
            Customize pieces and counts (like get 5 ninjas or 2 razors)
            Custom board size

 */

export class Game {
    constructor(settings) {
        this.gameType = settings.gameType;

        this.w = 8;
        this.h = 16;
        if (settings.use4x8) {
            this.w = 4;
            this.h = 8;
        }

        this.seed = settings.seed;
        this.gen = new RandomGenerator(this.seed);
        this.numGens = 0; //Used to know how many steps to advance the rng from the initial state when the client recieves an update

        this.grid = new Grid(this.w, this.h);

        if (this.gameType == gameTypes.B_TYPE) {
            const bTypeGen = new RandomGenerator(settings.bTypeSeed);
            const percentGarbage = 0.9;
            const garbageHeight = 6;
            this.grid.insertBType(bTypeGen, garbageHeight, percentGarbage);
        }

        this.tritrisAmt = 0; //For statistics
        const countDownLength = 3 * 1000;
        this.startTime = Date.now() + countDownLength; //A 5 second countdown before the game starts
        this.time = -countDownLength;

        this.alive = true;

        let lvl = parseInt(settings.startLevel);
        if (lvl < 0) lvl = 0;
        if (lvl > 29) lvl = 29;
        if (lvl >= 20 && lvl <= 28) lvl = 19; //Can only start on 0-19 or 29
        this.startLevel = lvl;
        this.level = this.startLevel;
        this.lines = 0;
        this.versusTimePerStartLevel = 2 * 60 * 1000; //1.5 minutes on the start level
        this.versusTimePerLevel = 30 * 1000; //Then 30 seconds on each level after
        this.score = 0;
        this.scoreWeights = { 1: 100, 2: 200*2, 3: 400*3, 4: 800*4 };

        if (settings.quadtris)
            this.piecesJSON = quadtrisJSON;
        else
            this.piecesJSON = tritrisJSON;

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
        this.nextPieceCount = 0; //For the ninja, will spawn multiple
        this.bag = [];
        this.spawnPiece(); //Sets the next piece
        this.spawnPiece(); //Make next piece current, and pick new next
        this.pieceHasMoved = false; //If the current piece has moved. If it doesn't move and the current piece is placed, you lose

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

        this.softDropSpeed = msPerFrame * 2; //The speed when holding down
        this.pushDownPoints = 0; //The current amount of push down points. Increases when holding down, but resets if released
        this.lastMoveDown = 750; //When the last move down was. Originally a 750ms delay for the first piece

        this.spawnNextPiece = 0;

        this.animatingUntil = 0; //How long until the line clear animation is done
        this.animatingLines = []; //Which lines are being cleared/animated
        this.maxAnimationTime = 20 * msPerFrame; //How long the animation should last

        //There are 2 types of blocking garbage
        //Line clears
            //Clearing X lines will block X lines. If there are leftover lines, those will be converted by the garbageWeight table to be sent
        //Bonus clears
            //A perfect clear will give 5 additional blocking lines. If X of those are used to blocked, the remaining ones are sent
        this.garbageWeights = {
            0: 0,
            1: 0, //A single sends nothing
            2: 1, //A double sends 1 line
            3: 3, //A tritris sends 3 lines of garbage
            4: 5,  //A quadtris sends 5 lines of garbage
        }
        this.bonusGarbageWeights = {
            perfectClear: 5
        }

        this.garbageToSendId = 0;
        this.garbageToSend = [];
        this.garbageReceived = []; //All of the garbage that this game has ever received. Since garbage is received externally, this does not change with latestState
        this.totalGarbageEverReceived = 0;
        this.doneGarbageId = -1; //The id of the garbage that has been added to the meter
        this.garbageDelayTime = 5000; //Once garbage is received, it wont be placed for at least a few seconds
        this.garbageMeterWaiting = []; //Lines of garbage that are still waiting to be inserted
        this.garbageMeterReady = []; //Lines of garbage the will be inserted when the piece is placed

        this.leastAmountOfGarbage = this.grid.countGarbageRows(); //A persistent value for B-type winning. Once a line of garbage is cleared, it will be changed forever

        this.inputs = [];
        this.doneInputId = -1; //The higheset input id that has been completed
        this.latestState = new GameState(this); //The game state with the highest input id completed

        this.initialGameState = new GameState(this);
    }

    goToStart() { //Resets the game so it can be replayed up to any time necessary
        this.goToGameState(this.initialGameState);
    }

    goToGameState(state) {
        this.gen = new RandomGenerator(this.seed);
        this.numGens = state.numGens;
        for (let i = 0; i < this.numGens; i++)
            this.gen.range(1); //Advance the internal state of the random number generator to match

        this.bag = [...state.bag];

        if (state.currentPieceSerialized) this.currentPiece = new Piece(state.currentPieceSerialized);
        else this.currentPiece = null;

        this.nextPieceIndex = state.nextPieceIndex;
        if (this.nextPieceIndex !== null) this.nextPiece = new Piece(this.piecesJSON[this.nextPieceIndex], this.w);
        else this.nextPiece = null;
        this.nextPieceCount = state.nextPieceCount;

        this.grid = new Grid(state.serializedGrid);

        this.tritrisAmt = state.tritrisAmt;
        this.alive = state.alive;
        this.score = state.score;
        this.level = state.level;
        this.lines = state.lines;
        this.pieceSpeed = state.pieceSpeed;
        this.pushDownPoints = state.pushDownPoints;
        this.lastMoveDown = state.lastMoveDown;
        this.pieceHasMoved = state.pieceHasMoved;

        this.spawnNextPiece = state.spawnNextPiece;
        this.animatingUntil = state.animatingUntil;
        this.animatingLines = state.animatingLines;

        this.garbageToSendId = state.garbageToSendId;
        this.garbageToSend = [];
        for (const g of state.garbageToSend) {
            this.garbageToSend.push(Garbage.deserialize(g));
        }
        this.doneGarbageId = state.doneGarbageId;

        this.garbageMeterWaiting = state.garbageMeterWaiting.map(g => Garbage.deserialize(g));
        this.garbageMeterReady = state.garbageMeterReady.map(g => Garbage.deserialize(g));

        this.time = state.time;
    }

    updateToTime(t, gravity) { //Go from the current time to t and do all inputs that happened during that time
        if (t < 0) {
            this.time = t; //Just set the time to the desired time.
            return; //Nothing can happen before 0 so no need to play inputs
        }
        if (this.time > t) {
            //console.log('Cannot go backwards to ' + t + ' from ' + this.time);
        }
        let nextInputId = this.inputs.length; //The id of the next input that should be played. If none should be played, it will be inputs.length

        for (let i = 0; i < this.inputs.length; i++) {
            //If there is an input (its possible an element of the array is null) and its time is greater than the current time
            if (this.inputs[i] && this.inputs[i].time > this.time) {
                nextInputId = i; //Find which input has not been played yet
                break;
            }
        }

        while (this.time < t && this.alive) {
            let deltaTime = this.pieceSpeed; // this.pieceSpeed/100; //TODO Figure out deltaTime stuff in the server
            if (this.time + deltaTime > t) {
                deltaTime = t - this.time; //Ensure the time does not go over the desired time
            }
            let input = null; //The next input to be performed
            let hasNextInput = (nextInputId < this.inputs.length); //If there is another input to be performed
            if (hasNextInput) { //TODO Prevent cheating and ensure only inputs within a reasonable amount of time are allowed and make sure the time is increasing with the id
                let nextInputTime = this.inputs[nextInputId].time; //When the next input is
                let nextInputDeltaTime = nextInputTime - this.time; //How long from now until the next input
                if (nextInputDeltaTime <= deltaTime) { //If the next input is sooner than the current deltaTime
                    deltaTime = nextInputDeltaTime; //Then go to exactly that time to perform the input
                    input = this.inputs[nextInputId];
                    nextInputId++; //Move onto the next input. There is a chance the currentPiece is null and the input will be skipped
                }
            }
            //const gravity = !input && nextInputId >= this.inputs.length; //If there are no more inputs to do, then simulate natural gravity
            this.update(deltaTime, input, gravity);
            if (input && input.id > this.doneInputId) {
                this.doneInputId = input.id; //Math.max(this.doneInputId, input.id); //Update the highest input id that has been completed
                this.updateGameState();
            }
        }
    }

    updateGameState() {
        this.latestState = new GameState(this);
    }

    update(deltaTime, input, gravity) { //Move the game forward with a timestep of deltaTime, and perform the input if it's not null
        if (!this.alive) return;

        this._update(deltaTime);

        //Piece Movement
        if (this.currentPiece !== null) {
            if (input) { //It is time for the input to be performed
                const moveData = this.movePiece(input.horzDir, input.rot, input.vertDir, input.hardDrop);
                if (moveData.moved) this.pieceHasMoved = true;
                if (moveData.playSound) this.addSound('move');
                if (input.vertDir || (this.gameType == gameTypes.VERSUS && input.hardDrop)) {
                    if (input.softDrop) this.pushDownPoints++; //Pushing down
                    else this.pushDownPoints = 0;
                    this.lastMoveDown = this.time;
                }
                if (moveData.placePiece) {
                    this.placePiece();
                }
            }
        }
        //Move down based on timer
        const shouldMoveDown = gravity && this.time >= this.lastMoveDown + this.pieceSpeed;
        if (this.currentPiece !== null && shouldMoveDown) {
            const moveData = this.movePiece(0, 0, true, false);
            this.pushDownPoints = 0;
            this.lastMoveDown = this.time;
            if (moveData.moved) this.pieceHasMoved = true;
            if (moveData.placePiece) {
                this.placePiece();
            }
        }
    }

    _update(deltaTime) {
        this.time += deltaTime;

        if (this.time <= this.animatingUntil) {
            this.playLineClearingAnimation();
        } else if (this.animatingLines.length > 0) {
            let playSound = this.updateScoreAndLevel(); //After a line clear, update score and level and removed the lines from the grid
            if (playSound) this.addSound('levelup');

            //Once lines are removed, check if all garbage is cleared
            this.leastAmountOfGarbage = Math.min(this.grid.countGarbageRows(), this.leastAmountOfGarbage); //Used for B type win detection
        }

        this.updateGarbageMeter();

        //Spawn the next piece after entry delay
        if (this.shouldSpawnPiece()) {
            this.spawnPiece();
            this.lastMoveDown = this.time;
            this.pieceHasMoved = false;
            this.addSound('fall');
        }
    }

    getGameState() {
        return new GameState(this);
    }

    shouldIncreaseLevel() {
        if (this.level == this.startLevel) {
            //This formula is from https://tetris.wiki/Tetris_(NES,_Nintendo)
            if (this.lines >= (this.startLevel + 1) * 10 || this.lines >= Math.max(100, this.startLevel * 10 - 50)) {
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

    nextLevelIncreaseVersus() {
        const numIntervals = Math.max(this.level - this.startLevel, 0);
        const intervalTime = numIntervals * this.versusTimePerLevel;

        const nextLevelUpTime = intervalTime + this.versusTimePerStartLevel;
        return nextLevelUpTime;
    }

    shouldSpawnPiece() {
        return this.currentPiece == null &&
                this.time > this.spawnNextPiece &&
                this.time > this.animatingUntil;
    }

    placePiece() {
        //Before its placed and lines are cleared
        const pieceIsBlocked = !this.isValid(this.currentPiece);

        this.grid.addPiece(this.currentPiece);
        const row = this.currentPiece.getBottomRow();

        //Only clear lines if the next piece is not a triangle, or the next piece is a triangle, but it is a new triplet
        let numLinesCleared = 0;
        const finishedPieceSequence = !this.piecesJSON[this.nextPieceIndex].hasOwnProperty('count') || //The next piece comes out once (a new sequence is starting)
                                 this.nextPieceCount === this.piecesJSON[this.nextPieceIndex].count; //A new sequence is starting

        if (finishedPieceSequence) {
            numLinesCleared = this.grid.clearLines().length; //Gets how many lines to clear

            this.clearLines(); //Actually clears lines

            if (this.gameType == gameTypes.VERSUS) {
                const numLinesClearedToSend = this.getGarbageWeights(this.blockGarbage(numLinesCleared));

                let bonusLinesCleared = 0;
                if (this.grid.isEmpty(this.animatingLines)) bonusLinesCleared += this.bonusGarbageWeights['perfectClear']; //10 Lines for a perfect clear
                const bonusLinesToSend = this.blockGarbage(bonusLinesCleared)

                const numLinesToSend = numLinesClearedToSend + bonusLinesToSend;

                if (numLinesCleared === 0) { //During a combo, garbage isn't inserted
                    this.insertGarbage(); //TODO If I clear garbage that was sent to me, it gets sent back to the other player. Should this happen?
                }
                this.sendGarbage(numLinesToSend); //Send garbage

                //In versus, the level increases from the start to the next after versusTimePerStartLevel then every versusTimePerLevel
                const nextLevelIncrease = this.nextLevelIncreaseVersus();
                if (this.time > nextLevelIncrease) {
                    this.level++;
                    this.setSpeed();
                    this.addSound('levelup');
                }
            }
        }

        const entryDelay = this.calcEntryDelay(row);
        this.spawnNextPiece = this.time + entryDelay;

        this.currentPiece = null; //There is an entry delay for the next piece

        this.score += this.pushDownPoints;
        this.pushDownPoints = 0;

        //Topout if the current piece isn't moved and its blocked
        //However, if lines are cleared the the current piece isn't blocked keep going
        if ((numLinesCleared === 0 || pieceIsBlocked) && (!this.pieceHasMoved && pieceIsBlocked)) {
            this.alive = false; //A piece spawned and was not / could not be moved. Game over
            this.animatingLines = [];
            this.animatingUntil = -Infinity;
            this.addSound('topout');
        } else {
            if (numLinesCleared == 3)
                this.addSound('tritris');
            else if (numLinesCleared > 0) {
                this.addSound('clear');
            }
        }

        return numLinesCleared;
    }

    spawnPiece() {
        if (this.bag.length === 0) {
            for (let i = 0; i < this.piecesJSON.length; i++) {
                this.bag.push(i); //Refill the bag with each piece
            }
        }
        this.currentPiece = this.nextPiece; //Assign the new current piece
        this.nextPieceCount--; //Used up one of the next pieces

        if (this.nextPieceCount <= 0) {
            //Pick a new next piece
            const bagIndex = this.gen.range(this.bag.length);
            this.numGens++;
            this.nextPieceIndex = this.bag.splice(bagIndex, 1)[0]; //Pick 1 item and remove it from bag
            const nextPieceJSON = this.piecesJSON[this.nextPieceIndex];
            if (nextPieceJSON.hasOwnProperty('count')) {
                this.nextPieceCount = nextPieceJSON.count;
            } else {
                this.nextPieceCount = 1;
            }

        } else {
            //Keep using the same next piece
        }

        this.nextPiece = new Piece(this.piecesJSON[this.nextPieceIndex], this.w);
    }

    updateScoreAndLevel() {
        //After a line clear animation has just been completed
        //Readjust the entry delay to accommodate for the animation time
        this.spawnNextPiece += this.maxAnimationTime;
        this.lines += this.animatingLines.length;

        //Increase the level after a certain amt of lines, then every 10 lines
        let playSound = false;
        if (this.gameType == gameTypes.CLASSIC && this.shouldIncreaseLevel()) {
            this.level++;
            playSound = true;
            this.setSpeed();
        }
        this.score += this.scoreWeights[this.animatingLines.length] * (this.level + 1);

        //A tritris will count as 1, a quadtris will count as 1.3
        if (this.animatingLines.length == 3) this.tritrisAmt += 1; //Will increase by 100%
        else if (this.animatingLines.length == 4) this.tritrisAmt += 16/9; //Will increase by 133%


        for (const row of this.animatingLines) {
            this.grid.removeLine(row);
        }
        this.animatingLines = [];
        return playSound;
    }

    clearLines() {
        let linesCleared = this.grid.clearLines();
        if (linesCleared.length > 0) {
            //Set the time for when to stop animating
            this.animatingUntil = this.time + this.maxAnimationTime;
            this.animatingLines = linesCleared; //Which lines are being animated (and cleared)
        }
        return linesCleared.length;
    }

    sendGarbage(numLines) { //I have cleared lines
        if (this.gameType == gameTypes.CLASSIC) return;
        const garbage = new Garbage(this.garbageToSendId++, this.time, numLines);
        if (garbage.numLines > 0) {
            this.garbageToSend.push(garbage);
        }
    }

    receiveGarbage(garbage) { //The match is telling me I have received garbage
        if (this.gameType == gameTypes.CLASSIC) return;
        for (const g of garbage) {
            const garb = Garbage.deserialize(g);
            this.garbageReceived.push(garb);
            this.totalGarbageEverReceived += garb.numLines;
        }
    }

    setGarbageReceived(garbage) {
        if (this.gameType == gameTypes.CLASSIC) return;
        this.garbageReceived = garbage.map(g => Garbage.deserialize(g));
        this.totalGarbageEverReceived = this.garbageReceived.reduce((tot, garb) => tot + garb.numLines, 0);
    }

    insertGarbage() { //Add garbage lines onto the board
        if (this.gameType == gameTypes.CLASSIC) return;
        if (this.garbageMeterReady) { //Make sure that there is garbage (also fixes when spawning first pieces, before garbageMeterReady has been initialized)
            for (const garbage of this.garbageMeterReady) {
                this.grid.insertGarbage(garbage);
            }
            this.garbageMeterReady = [];
        }
    }

    blockGarbage(numLines) {
        const totalMeterLength = this.garbageMeterReady.length + this.garbageMeterWaiting.length;
        for (let i = 0; i < totalMeterLength; i++) {
            let garbage;
            if (i < this.garbageMeterReady.length) {
                garbage = this.garbageMeterReady[i];
            } else {
                garbage = this.garbageMeterWaiting[i - this.garbageMeterReady.length];
            }

            const numRemoved = Math.min(numLines, garbage.numLines);
            garbage.numLines -= numRemoved;
            numLines -= numRemoved;
            if (numLines <= 0) break;
        }

        this.garbageMeterReady.filter(g => g.numLines > 0); //Remove empty garbage
        this.garbageMeterWaiting.filter(g => g.numLines > 0);

        return numLines; //How many lines are left to be sent
    }

    getGarbageWeights(numLines) {
        if (this.garbageWeights.hasOwnProperty(numLines)) {
            return this.garbageWeights[numLines];
        }
        return 0;
    }

    updateGarbageMeter() {
        let newGarbageWaiting = this.garbageReceived.filter(g => g.id > this.doneGarbageId && g.time <= this.time).map(g => Garbage.deserialize(g.serialize()));
        if (newGarbageWaiting.length > 0) {
            this.garbageMeterWaiting.push(...newGarbageWaiting); //Adds garbage the has been received to the meter
            this.doneGarbageId = newGarbageWaiting[newGarbageWaiting.length - 1].id;
        }
        for (let i = 0; i < this.garbageMeterWaiting.length; i++) {
            if (this.garbageMeterWaiting[i].time + this.garbageDelayTime < this.time) {
                const newReady = this.garbageMeterWaiting[i];
                this.garbageMeterReady.push(newReady);

                this.garbageMeterWaiting.splice(i, 1);
                i--; //Keep index correct
            }
        }
    }

    playLineClearingAnimation() {
        const percentDone = (this.animatingUntil - this.time) / this.maxAnimationTime;
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
        this.redraw = true;
    }

    addSound(_) {
        //Do nohing. Sounds aren't played on the server
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

    movePiece(horzDirection, rotation, moveDown, hardDrop) {
        if (this.gameType != gameTypes.CLASSIC && hardDrop) {
            let moved = false; //Incase it doesn't move down at all
            while (this.isValid(this.currentPiece)) {
                this.currentPiece.move(0, 1);
                moved = true;
                //TODO Calculate push down points for hard drop??
            }
            if (moved) {
                this.currentPiece.move(0, -1); //Move it back to so it is no longer in the ground
            }
            return {
                placePiece: true,
                playSound: false,
                rotated: false,
                chargeDas: true, //Hard drop charges DAS
                moved
            }
        }
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
            return {
                placePiece: false, //Don't place the piece
                playSound: (horzDirection != 0 || rotation != 0),
                rotated: (rotation != 0),
                chargeDas: false,
                moved: (horzDirection != 0 || rotation != 0 || moveDown)
            }
        }
        //If blocked, undo horz move and maybe wall-charge
        this.currentPiece.move(-horzDirection, 0);
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //If the piece was block when moving horz, then wall charge
            return {
                placePiece: false,
                playSound: (rotation != 0),
                rotated: (rotation != 0),
                chargeDas: true,
                moved: (rotation != 0 || moveDown)
            }
        }

        //If not valid, undo rotation
        if (rotation == 1) this.currentPiece.rotateLeft();
        if (rotation == -1) this.currentPiece.rotateRight();
        if (rotation == 2) this.currentPiece.rotate180();
        valid = this.isValid(this.currentPiece);
        if (valid) {
            //The piece was blocked by rotating
            return {
                placePiece: false, //Don't place the piece
                playSound: false,
                rotated: false,
                chargeDas: (horzDirection != 0),
                moved: (moveDown)
            }
        }

        //If it reaches here, the piece was blocked by moving down and should be placed
        if (moveDown) this.currentPiece.move(0, -1); //Move the piece back up
        //The extra if statement is incase the pieces are at the top and spawn in other pieces
        return {
            placePiece: true, //Place the piece
            playSound: false,
            rotated: false,
            chargeDas: false,
            moved: false
        }
    }

    getGhostPiece() {
        //Make a copy of the current piece
        const ghost = new Piece(this.currentPiece.serialized());
        do {
            ghost.move(0, 1);
        } while (this.isValid(ghost));

        ghost.move(0, -1); //Move it back to right before it will be placed

        return ghost;
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
        this.time = game.time;

        this.seed = game.seed;
        this.numGens = game.numGens;

        this.alive = game.alive;

        this.level = game.level;
        this.lines = game.lines;
        this.score = game.score;
        this.currentPieceSerialized = null;
        if (game.currentPiece) this.currentPieceSerialized = game.currentPiece.serialized();
        this.nextPiece = game.nextPiece;
        this.nextPieceIndex = game.nextPieceIndex;
        this.nextPieceCount = game.nextPieceCount;
        this.bag = [...game.bag]; //Save a copy of the current bag

        this.pieceSpeed = game.pieceSpeed;
        this.pushDownPoints = game.pushDownPoints;
        this.lastMoveDown = game.lastMoveDown;

        this.pieceHasMoved = game.pieceHasMoved;

        this.spawnNextPiece = game.spawnNextPiece;
        this.animatingUntil = game.animatingUntil;
        this.animatingLines = [...game.animatingLines];

        this.garbageToSendId = game.garbageToSendId;
        this.garbageToSend = game.garbageToSend.map(g => g.serialize());
        this.doneGarbageId = game.doneGarbageId;
        this.garbageMeterWaiting = game.garbageMeterWaiting.map(g => g.serialize());
        this.garbageMeterReady = game.garbageMeterReady.map(g => g.serialize());

        this.doneInputId = game.doneInputId;
    }
}

export class Input {
    constructor(id, time, horzDir, vertDir, rot, softDrop, hardDrop) {
        this.id = id;
        this.time = time;
        this.horzDir = horzDir;
        this.vertDir = vertDir;
        this.rot = rot;
        this.softDrop = softDrop;
        this.hardDrop = hardDrop;
    }

    encode() {
        return {
            id: this.id,
            time: this.time, //TODO encode the direction using bits to be much more compact
            horzDir: this.horzDir,
            vertDir: this.vertDir,
            rot: this.rot,
            softDrop: this.softDrop,
            hardDrop: this.hardDrop
            //dir: this.horzDir + ',' + this.vertDir + ',' + this.rot
        }
    }

    static decode(data) {
        return new Input(data.id, data.time, data.horzDir, data.vertDir, data.rot, data.softDrop, data.hardDrop);
    }

    static isValid(inp) {
        if (!inp.hasOwnProperty('id') ||
            !inp.hasOwnProperty('time') ||
            !inp.hasOwnProperty('horzDir') ||
            !inp.hasOwnProperty('vertDir') ||
            !inp.hasOwnProperty('rot') ||
            !inp.hasOwnProperty('softDrop') ||
            !inp.hasOwnProperty('hardDrop')) return false;
        if (!inp.hasOwnProperty('time') || inp.time < 0) return false;
        if (inp.horzDir !== 0 && inp.horzDir !== -1 && inp.horzDir !== 1) return false;
        if (inp.vertDir !== false && inp.vertDir !== true) return false;
        if (inp.rot !== 0 && inp.rot !== -1 && inp.rot !== 1 && inp.rot !== 2) return false;
        if (inp.softDrop !== false && inp.softDrop !== true) return false;
        if (inp.hardDrop !== false && inp.hardDrop !== true) return false;

        return true;
    }
}

export class Garbage {
    constructor(a, time, numLinesCleared, bonusLines) {
        if (a instanceof Object) { //Deserializing
            this.id = a.id;
            this.time = a.time;
            this.numLines = a.numLines;
            this.openCol = a.openCol;
            this.openOrientation = a.openOrientation;
        } else { //Creating new
            const id = a;
            this.id = id;
            this.time = time;

            this.numLines = numLinesCleared;

            this.openCol = Math.random(); //Which col should be open. This will become an integer based on the grid size once garbage is inserted
            this.openOrientation = Math.random(); //Which orientation the open triangles should be in
        }
    }

    serialize() {
        return {
            id: this.id,
            time: this.time,
            numLines: this.numLines,
            openCol: this.openCol,
            openOrientation: this.openOrientation
        }
    }

    static deserialize(g) {
        return new Garbage(g);
    }
}
