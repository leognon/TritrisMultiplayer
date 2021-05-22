const states = require('../common/states.js');
const ServerGame = require('../server/serverGame.js');

class Match {
    constructor(socket1, socket2) {
        console.log('Created match between ' + socket1.id + ' and ' + socket2.id);
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

    clientsUpdate() {
        let data = {
            time: Date.now(),
            players: {}
        };
        for (const p of this.players) {
            data.players[p.getId()] = p.getData();
        }
        for (const p of this.players) {
            p.sendData(data);
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
        this.serverGame.updateToTime(Date.now() - this.serverGame.startTime);
    }

    getId() {
        return this.socket.id;
    }

    gotData(data) {
        this.serverGame.gotInputs(data);
        //this.inputs = data;
    }

    getData() {
        return this.serverGame.getData();
        //TODO Send back game data
    }

    sendState(s) {
        this.socket.emit('state', s);
    }

    sendData(data) {
        this.socket.emit('data', data);
    }
}

module.exports = Match;
