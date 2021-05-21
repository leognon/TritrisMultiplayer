const states = require('../common/states.js');

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
            //p.pos.y += 10;
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
        this.pos = { x: 0, y: 0 };

        this.socket.on('inputs', this.gotData.bind(this));
    }

    getId() {
        return this.socket.id;
    }

    gotData(data) {
        this.inputs = data;
        console.log('Got data', this.inputs);
    }

    getData() {
        return this.pos; 
    }

    sendState(s) {
        this.socket.emit('state', s);
    }

    sendData(data) {
        this.socket.emit('data', data);
    }
}

module.exports = Match;
