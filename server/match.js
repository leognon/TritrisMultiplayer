const states = require('../common/states.js');
const ServerGame = require('../server/serverGame.js');

class Match {
    constructor(socket1, socket2) {
        console.log('Created match between ' + socket1.id + ' and ' + (socket2 ? socket2.id : 'nobody'));
        this.players = [];
        this.addPlayer(socket1);
        this.addPlayer(socket2);

        for (const p of this.players) {
            p.sendState(states.INGAME);
        }
    }

    addPlayer(socket) {
        this.players.push(new Player(socket));
    }

    physicsUpdate() {
        for (const p of this.players) {
            p.physicsUpdate();
        }
    }

    //Sends data to the clients
    clientsUpdate() {
        let data = {
            serverTime: Date.now(), //TODO serverTime might be unnecessary
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
    constructor(socket) {
        this.socket = socket;
        this.serverGame = new ServerGame();

        this.socket.on('inputs', this.gotData.bind(this));
    }

    physicsUpdate() {
        this.serverGame.physicsUpdate();
    }

    getId() {
        return this.socket.id;
    }

    gotData(data) {
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

    sendState(s) {
        this.socket.emit('state', s);
    }
}

module.exports = Match;
