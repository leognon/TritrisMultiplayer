import ServerGame from './serverGame.js';

export default class ServerMatch {
    constructor(clients, settings) {
        this.settings = {
            seed: Math.random(),
            ...settings,
        }

        this.players = [];
        for (let client of clients) {
            this.addPlayer(client);
        }
    }

    addPlayer(client) {
        this.players.push(new ServerPlayer(client, this.settings));
    }

    //If all players have lost
    isOver() {
        for (let p of this.players) {
            if (p.serverGame.isAlive()) return false;
        }
        return true;
    }

    //When inputs have been received from a player
    gotInputs(client, data) {
        for (let p of this.players) {
            if (p.getId() == client.getId()) {
                p.gotInputs(data);
                break;
            }
        }
    }

    //Update the boards
    physicsUpdate() {
        for (const p of this.players) {
            p.physicsUpdate();
        }
        for (const p of this.players) {
            let garbageToSend = p.getNewGarbageToSend();
            if (garbageToSend.length > 0) {
                this.sendGarbage(p, garbageToSend);
            }
        }
    }

    sendGarbage(fromPlayer, garbageToSend) {
        let otherPlayers = this.players.filter(p => p !== fromPlayer);
        let sendTo = otherPlayers[0];
        sendTo.receiveGarbage(garbageToSend);
    }

    //Sends data to the clients
    clientsUpdate(spectatorClients) {
        let data = {
            players: {},
            yourData: null
        };
        for (const p of this.players) {
            //The current game state of the player and the inputs which have not been
            //sent. The player will go to a previous state that had been sent, then
            //begin performing inputs to take them to this state.
            data.players[p.getId()] = p.getGameStateAndInputs();
        }
        for (const s of spectatorClients) {
            s.emit('room', {
                type: 'gotGameState',
                data
            });
        }
        for (const p of this.players) {
            //The authoratative state at time t, and the input id that has been received
            //The player will then update their client to the current time (performing
            //any update the server has yet to do)
            data.yourData = p.serverGame.getGameState();

            const tempYourData = data.players[p.getId()];
            delete data.players[p.getId()]; //Remove it from the other player's data

            p.sendData(data);

            data.players[p.getId()] = tempYourData; //Add it back
        }
    }
}

class ServerPlayer {
    constructor(client, settings) {
        this.client = client;
        this.serverGame = new ServerGame(settings);
    }

    physicsUpdate() {
        this.serverGame.physicsUpdate(this.client.isDisconnected());
    }

    getId() {
        return this.client.userId;
    }

    //TODO Should lastFrame be set to Date.now() after receiving data on the client?

    gotInputs(data) {
        this.serverGame.gotInputs(data);
    }

    receiveGarbage(garbage) {
        this.serverGame.receiveGarbage(garbage);
    }

    getNewGarbageToSend() {
        return this.serverGame.getNewGarbageToSend();
    }

    getGameStateAndInputs() {
        return this.serverGame.getGameStateAndInputs();
    }

    getGameState() {
        return this.serverGame.getGameState();
    }

    sendData(data) {
        this.client.emit('room', {
            type: 'gotGameState',
            data //TODO Rework this data.data stuff
        });
    }
}
