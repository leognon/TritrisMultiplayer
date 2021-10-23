import { Game, Input } from '../common/game.js';
import SERVER_CONFIG from '../server/config.js';
import gameTypes from '../common/gameTypes.js';

export default class ServerGame extends Game {
    constructor(settings) {
        super(settings);
        this.lastInputSent = -1; //The last input id that was sent to other clients
        this.lastSentTime = -1; //The time of the last game state that was sent to other clients

        this.lastReceivedTime = 0; //The time of the last input received from the player
        this.lastClientMoveDown = 0; //The time of the last move down received from the client

        this.lastGarbageSentId = -1; //To avoid sending duplicate garbage
    }

    getNewGarbageToSend() {
        let notSent = this.latestState.garbageToSend.filter(g => g.id > this.lastGarbageSentId);
        if (notSent.length > 0)
            this.lastGarbageSentId = notSent[notSent.length-1].id;
        return notSent;
    }

    physicsUpdate(forceMove) {
        if (!this.alive) return;

        //This will almost always get overridden by user inputs. It is really only for calculating a win in B type without requiring the player to have an extra input to advance the state
        this.updateToTime(Date.now() - this.startTime, true);

        const maxTime = SERVER_CONFIG.FORCE_MOVE_AFTER; //If nothing is received for too long, it will update automatically
        const maxMoveDownTime = this.pieceSpeed*2 + SERVER_CONFIG.FORCE_MOVE_AFTER;
        if (forceMove || this.time - maxTime >= this.lastReceivedTime || this.time - maxMoveDownTime >= this.lastClientMoveDown) {
            //If no inputs received for too long, force the state to update
            this.goToGameState(this.latestState);
            this.updateToTime(Date.now() - this.startTime, true);
            this.updateGameState();
            console.log('Force updating to ' + this.time);
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
            if ((inp.vertDir || (this.gameType == gameTypes.VERSUS && inp.hardDrop)) && inp.time > this.lastClientMoveDown) {
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
        //Pretty sure this is useless. It doesnt update latests state, so whats the point?
    }

    isAlive() {
        return this.latestState.alive;
    }

    hasWonBType() {
        //If the player has ever cleared all the garbage
        return this.hasClearedGarbage;
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

    getGameStateAndInputs() { //Sent to otherGame
        let data = {
            changed: false,
            gameData: { //TODO Even if not changed, send new garbage stuff
                time: (Date.now() - this.startTime),
            },
            garbageReceived: this.garbageReceived.map(g => g.serialize()),
            //TODO Don't emit already sent garbage. Only when there is new. Also fix for getGameState()
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
            gameData: this.latestState,
            garbageReceived: this.garbageReceived.map(g => g.serialize()),
        }
    }
}
