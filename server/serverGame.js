const { Game, Input } = require('../common/game.js');

class ServerGame extends Game {
    constructor() {
        super();
        this.lastInputSent = -1; //The last input id that was sent to other clients
        this.lastSentTime = -1; //The time of the last game state that was sent to other clients

        this.lastReceivedTime = 0; //The time of the last input received from the player
        this.lastClientMoveDown = 0; //The time of the last move down received from the client
    }

    physicsUpdate() {
        //TODO The line below is slightly pointless. It will get overriden 99.99% of the time. It might only help to check if someone loses??
        this.updateToTime(Date.now() - this.startTime, true);
        //TODO Make this condition better. 10 seconds will result in an instant top out no matter what...
        const maxTime = 10 * 1000; //If nothing is received for 3 seconds, it will update automatically
        const maxMoveDownTime = this.pieceSpeed*2 + maxTime; //TODO Idk what the formula for this should be. Also, is this even necessary? People can still cheat by lengthening the time between move downs
        if (this.time - maxTime >= this.lastReceivedTime || this.time - maxMoveDownTime >= this.lastClientMoveDown) {
            //If no inputs recieved for 7 seconds, force the state to update
            //TODO Figure out why latest state jumps up a ton, then goes back down
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
            this.addInput(inp);
            if (inp.time > latestTime) latestTime = inp.time;
            if (inp.vertDir && inp.time > this.lastClientMoveDown) {
                this.lastClientMoveDown = inp.time;
            }
        }
        this.lastReceivedTime = latestTime;
        this.goToGameState(this.latestState); //Go to the last known state before these new inputs were just received
        if (latestTime >= this.time) //Don't go back in time. Prevents user from sending old inputs
            this.updateToTime(latestTime, false); //Update all of the newly received inputs
        else
            console.log(`No back ${this.latestState} to ${latestTime}`);
        this.physicsUpdate(); //Updates to the current time (simulating gravity)
    }

    addInput(inp) {
        this.inputs[inp.id] = inp; //TODO Add validation here to prevent bugs and cheating
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

module.exports = ServerGame;
