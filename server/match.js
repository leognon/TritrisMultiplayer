const states = require('../common/states.js');
const ServerGame = require('./serverGame.js');

class Match {
    constructor(level, socket1, socket2) {
        console.log('Created match between ' + socket1.id + ' and ' + (socket2 ? socket2.id : 'nobody'));
        this.seed = Math.random();
        this.level = level;

        this.players = [];
        this.addPlayer(socket1);
        this.addPlayer(socket2);

        /*this.names = {};
        for (const p of this.players) {
            this.names[p.getId()] = p.getName();
        }*/

        /*for (const p of this.players) {
            p.sendState({
                state: states.INGAME,
                seed: this.seed,
                level: this.level,
                names: this.names
            });
        }*/
    }

    addPlayer(socket) {
        this.players.push(new Player(socket, this.seed, this.level));
    }

    hasPlayer(socket) {
        for (let p of this.players) {
            if (p.getId() == socket.id) return true;
        }
        return false;
    }

    gotInputs(socket, data) {
        for (let p of this.players) {
            if (p.getId() == socket.id) {
                p.gotInputs(data);
                break;
            }
        }
    }

    disconnected(socket) {
        for (let p of this.players) {
            if (p.getId() != socket.id) {
                p.disconnected();
            }
        }
    }

    physicsUpdate() {
        for (const p of this.players) {
            p.physicsUpdate();
        }
    }

    //Sends data to the clients
    clientsUpdate() {
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

class Player {
    constructor(socket, seed, level) {
        this.socket = socket;
        this.serverGame = new ServerGame(seed, level);
    }

    disconnected() {
        this.socket.emit('matchOver');
    }

    physicsUpdate() {
        this.serverGame.physicsUpdate();
    }

    getId() {
        return this.socket.id;
    }

    getName() {
        return this.socket.name;
    }
    //TODO Should lastFrame be set to Date.now() after receiving data on the client?

    gotInputs(data) {
        this.serverGame.gotInputs(data);
    }

    getGameStateAndInputs() {
        return this.serverGame.getGameStateAndInputs();
    }

    getGameState() {
        return this.serverGame.getGameState();
    }

    sendData(data) {
        this.socket.emit('data', data);
    }

    sendState(data) {
        this.socket.emit('state', data);
    }
}

module.exports = Match;
