const states = require('../common/states.js');
const Match = require('./match.js');
const Room = require('../common/room.js');

class ServerRoom extends Room {
    constructor(roomCode, owner) {
        super(roomCode, owner.id);
        this.owner = owner;
        this.players = [];
        //this.spectators = [];

        //this.names = {};

        this.match = null;

        this.owner.emit('room', {
            type: 'created',
            code: this.roomCode,
            owner: this.owner.id
        });
        this.players.push(this.owner);

        console.log('Created room with code ' + this.roomCode);
    }

    addPlayer(socket) {
        for (let p of this.players) {
            p.emit('room', {
                type: 'playerJoin',
                id: socket.id,
            });
        }
        this.players.push(socket);
        socket.emit('room', {
            type: 'joined',
            code: this.roomCode,
            ownerId: this.owner.id,
            players: this.players.map(p => p.id)
        });
    }

    gotData(socket, data) {
        if (data.type == 'start') {
            if (socket.id == this.owner.id && this.match === null) {
                this.newMatch();
            }
        }
    }

    newMatch() {
        this.match = new Match(5, this.players[0], this.players[1]);
        for (let p of this.players) {
            p.emit('room', {
                type: 'startMatch',
                seed: this.match.seed,
                level: this.match.level
            });
        }
    }

    update() {

    }

    hasPlayer(socket) {
        for (let p of this.players) {
            if (p.id == socket.id) return true;
        }
        return false;
    }
}

module.exports = ServerRoom;
