const { Input } = require('../common/game.js');
const config = require('../common/config.js');
const ClientGame = require('../client/clientGame');

class OtherGame extends ClientGame {
    constructor(seed, level) {
        super(seed, level);

        this.lastReceivedInputTime = -1; //The time when the most recent input was received

        this.previousStates = [];
        this.lastReceived = 0; //When the last data was receieved
        this.receivedTimes = []; //An array of the amount of time since the previous time was receieved
        this.totalReceivedTimes = 0; //Used for calculating average
    }

    interpolateUpdate() {
        const deltaTime = Date.now() - this.lastFrame;

        //Simulate gravity if there are no more inputs to simulate
        let gravity = false;
        if (this.time > this.lastReceivedInputTime) gravity = true;
        this.updateToTime(this.time + deltaTime, gravity);

        this.lastFrame = Date.now();
    }

    gotData(data) {
        const { inputs, gameData } = data;
        const timeSinceLast = gameData.time - this.lastReceived;
        this.lastReceived = gameData.time;
        this.receivedTimes.push(timeSinceLast);
        this.totalReceivedTimes += timeSinceLast;
        while (this.totalReceivedTimes > 10 * 1000) { //Only look at the past 10 seconds to calculate the average
            this.totalReceivedTimes -= this.receivedTimes[0];
            this.receivedTimes.splice(0, 1);
        }
        let avgUpdateEvery = this.totalReceivedTimes / this.receivedTimes.length;
        //TODO Is avgUpdateEvery necessary? Just use config.SERVER_SEND_DATA

        //TODO Delete inputs that are before the previous state
        for (let encodedInp of inputs) {
            const decoded = Input.decode(encodedInp);
            this.inputs[decoded.id] = decoded;
            if (decoded.time > this.lastReceivedInputTime)
                this.lastReceivedInputTime = decoded.time;
        }

        const behindBy = Math.max(config.CLIENT_NUM_UPDATES_BEHIND_BY*avgUpdateEvery, config.CLIENT_MIN_BEHIND_BY); //How far behind the interpolation should be. This ensures a buffer so interpolation stays smooth
        const tooClose = 0; //This is the minimum it should be behind. If it gets closer than this, it lags back by behindBy time
        let desTime = gameData.time - behindBy; //What time to go to

        if (desTime < this.time) { //Don't go backwards in time. This will stop any lag backs from appearing, however the interpolation may get closer to the actual time
            desTime = this.time;
        }
        if (gameData.time - desTime < tooClose) { //If the interpolation is too close,
            desTime = gameData.time - behindBy; //Go back to the desired amount. This will cause a lagback
        }

        //The below code finds a game state that is just before desired time. It then sets it's state to that, then updates to be exactly at desTime
        if (data.changed) this.previousStates.push(gameData);
        let mostRecentStateBeforeDesTimeIndex = -1; //That's quite a long name...
        for (let i = 0; i < this.previousStates.length; i++) {
            if (this.previousStates[i].time <= desTime) { //It is just before the desired time
                mostRecentStateBeforeDesTimeIndex = i;
            }
        }
        if (mostRecentStateBeforeDesTimeIndex != -1) {
            const state = this.previousStates[mostRecentStateBeforeDesTimeIndex];
            this.goToGameState(state); //Go to that state (authoritative from the server)
            this.previousStates.splice(0, mostRecentStateBeforeDesTimeIndex-1); //The states before it are too long ago and are no longer needed
        } else {
            this.goToStart();
        }
        this.updateToTime(desTime, false); //Jump from the state just before desTime to exactly at desTime, replaying any inputs that happened during that time

        this.lastFrame = Date.now();
        this.redraw = true;
    }
}

module.exports = OtherGame;
