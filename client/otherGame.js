import { Input } from '../common/game.js';
import COMMON_CONFIG from '../common/config.js';
import ClientGame from '../client/clientGame';

export default class OtherGame extends ClientGame {
    constructor(name, settings) {
        super(name, settings);

        this.lastReceivedInputTime = -1; //The time when the most recent input was received

        this.previousStates = []; //A list of previous game states sent by the server
        this.lastReceived = this.time; //When the last data was receieved
        this.receivedTimes = []; //An array of the amount of time since the previous time was receieved
        this.totalReceivedTimes = 0; //Used for calculating average
    }

    addSound(s) {
        this.soundsToPlay[s] = true;
    }

    interpolateUpdate() {
        if (!this.frozen) {
            //Simulate gravity if there are no more inputs to simulate
            let gravity = false;
            if (this.time > this.lastReceivedInputTime) gravity = true;

            for (const s in this.soundsToPlay) this.soundsToPlay[s] = false; //Only play new sounds
            const avgUpdateEvery = this.totalReceivedTimes / this.receivedTimes.length;
            const behindBy = Math.max(COMMON_CONFIG.CLIENT_NUM_UPDATES_BEHIND_BY*avgUpdateEvery, COMMON_CONFIG.CLIENT_MIN_BEHIND_BY); //How far behind the interpolation should be. This ensures a buffer so interpolation stays smooth
            const curTime = Date.now() - this.startTime - behindBy; //Update with a 350ms buffer
            //TODO Is it good to go to curTime??? What if gameData.time gets behind?
            if (curTime > this.time) {
                this.updateToTime(curTime, gravity);
            }
        }
    }

    gotGameState(data) {
        const { inputs, gameData } = data;
        const timeSinceLast = gameData.time - this.lastReceived;

        this.lastReceived = gameData.time;
        this.receivedTimes.push(timeSinceLast);
        this.totalReceivedTimes += timeSinceLast;
        while (this.totalReceivedTimes > 10 * 1000) { //Only look at the past 10 seconds to calculate the average
            this.totalReceivedTimes -= this.receivedTimes[0];
            this.receivedTimes.splice(0, 1);
        }
        const avgUpdateEvery = this.totalReceivedTimes / this.receivedTimes.length;
        const behindBy = Math.max(COMMON_CONFIG.CLIENT_NUM_UPDATES_BEHIND_BY*avgUpdateEvery, COMMON_CONFIG.CLIENT_MIN_BEHIND_BY); //How far behind the interpolation should be. This ensures a buffer so interpolation stays smooth

        //TODO Delete inputs that are before the previous state
        for (let encodedInp of inputs) {
            const decoded = Input.decode(encodedInp);
            this.inputs[decoded.id] = decoded;
            if (decoded.time > this.lastReceivedInputTime)
                this.lastReceivedInputTime = decoded.time;
        }

        //let desTime = gameData.time - behindBy; //What time to go to
        let desTime = this.time; //Try to stay at a constant time. This time will be about 350ms behind gameData.time

        if (gameData.time < desTime) { //If the interpolation is too close, freeze
            this.frozen = true;
        }
        if (gameData.time >= behindBy + desTime) { //Once the interpolation is far enough away, unfreeze
            this.frozen = false;
        }

        //The below code finds a game state that is just before desired time. It then sets it's state to that, then updates to be exactly at desTime
        if (data.changed) this.previousStates.push(gameData);
        if (!this.frozen) {
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
        }

        this.redraw = true;
    }
}
