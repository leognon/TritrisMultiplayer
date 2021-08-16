import { Game, Input } from '../common/game.js';

export default class ServerGame extends Game {
    constructor(settings) {
        super(settings);
        this.lastInputSent = -1; //The last input id that was sent to other clients
        this.lastSentTime = -1; //The time of the last game state that was sent to other clients

        this.lastReceivedTime = 0; //The time of the last input received from the player
        this.lastClientMoveDown = 0; //The time of the last move down received from the client
    }

    physicsUpdate(forceMove) {
        //TODO The line below is slightly pointless. It will get overriden 99.99% of the time. It might only help to check if someone loses??
        if (!this.alive) return;
        this.updateToTime(Date.now() - this.startTime, true);
        //TODO Make this condition better. 10 seconds will result in an instant top out no matter what...
        const maxTime = 10 * 1000; //If nothing is received for 3 seconds, it will update automatically
        const maxMoveDownTime = this.pieceSpeed*2 + maxTime; //TODO Idk what the formula for this should be. Also, is this even necessary? People can still cheat by lengthening the time between move downs
        if (forceMove || this.time - maxTime >= this.lastReceivedTime || this.time - maxMoveDownTime >= this.lastClientMoveDown) {
            //If no inputs recieved for 7 seconds, force the state to update
            this.goToGameState(this.latestState);
            this.updateToTime(Date.now() - this.startTime, true);
            this.updateGameState();
        }
    }

    gotInputs(inps) {
        if (inps.length == 0) return;
        let latestTime = 0;
        for (let encodedInp of inps) {
            const inp = Input.decode(encodedInp);
            const added = this.addInput(inp);
            if (!added) continue; //Invalid input

            if (inp.time > latestTime) latestTime = inp.time;
            if (inp.vertDir && inp.time > this.lastClientMoveDown) {
                this.lastClientMoveDown = inp.time;
            }
        }
        this.lastReceivedTime = latestTime;
        this.goToGameState(this.latestState); //Go to the last known state before these new inputs were just received
        if (latestTime >= this.time) //Don't go back in time. Prevents user from sending old inputs
            this.updateToTime(latestTime, false); //Update all of the newly received inputs
        //else
            //console.log(`Not going back from ${this.time} to ${latestTime}`);
        this.physicsUpdate(false); //Updates to the current time (simulating gravity)
    }

    isAlive() {
        return this.latestState.alive;
    }

    addInput(inp) {
        if (!Input.isValid(inp)) return false;
        if (this.inputs[inp.id]) return false;
        if (this.lastReceivedTime > inp.time) return false;
        const nextInpId = this.inputs.length == 0 ? 0 : this.inputs[this.inputs.length-1].id+1;
        if (inp.id < nextInpId) return false;
        if (inp.id > nextInpId) {
            //console.log(`Adding id ${inp.id} when des is ${nextInpId}`);
            for (let id = nextInpId; id < inp.id; id++) {
                this.inputs[id] = new Input(id, this.time, 0, false, 0, false);
            }
        }
        /*if (this.inputs.length == 0) {
            if (inp.id !== 0) return false;
        } else {
            if (this.inputs[this.inputs.length-1].id !== inp.id-1) return false;
        }*/
         this.inputs[inp.id] = inp; //TODO Add validation here to prevent bugs and cheating
         return true;
    }

    getGameStateAndInputs() {
        let data = {
            changed: false,
            gameData: {
                time: (Date.now() - this.startTime),
            },
            inputs: this.getCurrentInputs()
        };
        if (this.latestState.time > this.lastSentTime) {
            data.changed = true;
            data.gameData = this.latestState;
            this.lastSentTime = this.latestState.time;
        }
        return data;
    }

    getCurrentInputs() {
        let notSent = this.inputs.filter(inp => inp.id > this.lastInputSent);

        if (notSent.length > 0)
            this.lastInputSent = notSent[notSent.length-1].id;

        return notSent.map(inp => inp.encode());
    }


    //Gets the current game state to be applied to myGame
    getGameState() { //TODO Redo this system
        return {
            gameData: this.latestState
        }
    }
}
