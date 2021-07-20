const states = require('../common/states.js');
const Match = require('./match.js');
const Room = require('../common/room.js');

class ServerRoom extends Room {
    constructor(roomCode, owner) {
        super(roomCode, owner.id);
        this.owner = owner;
        this.players = [];
        //this.spectators = [];

        this.match = null;

        this.endMatchAt = 0;
        this.endMatchDelay = 5000; //Wait 5 seconds before ending the match

        this.owner.emit('room', {
            type: 'created',
            code: this.roomCode,
            owner: {
                id: this.owner.id,
                name: this.owner.name
            }
        });
        this.players.push(this.owner);

        console.log('Created room with code ' + this.roomCode);
    }

    addPlayer(socket) {
        for (let p of this.players) {
            p.emit('room', {
                type: 'playerJoin',
                id: socket.id,
                name: socket.name
            });
        }
        this.players.push(socket);

        socket.emit('room', {
            type: 'joined',
            code: this.roomCode,
            ownerId: this.owner.id,
            players: this.players.map(p => {
                return { //Just get the id and name
                    id: p.id, name: p.name
                }
            })
        });
    }

    gotData(socket, data) {
        if (data.type == 'start') {
            if (socket.id == this.owner.id && this.match === null) {
                this.newMatch();
            }
        } else if (data.type == 'inputs') {
            if (this.match) {
                this.match.gotInputs(socket, data.inps);
            }
        }
    }

    newMatch() {
        this.match = new Match(19, this.players[0], this.players[1]);
        for (let p of this.players) {
            p.emit('room', {
                type: 'startMatch',
                seed: this.match.seed,
                level: this.match.level
            });
        }
    }

    endMatch() {
        for (let p of this.players) {
            p.emit('room', {
                type: 'endMatch'
            });
        }
        this.match = null;
    }

    physicsUpdate() {
        if (this.match) {
            this.match.physicsUpdate();

            if (this.match.isOver()) {
                if (this.endMatchAt == -1) {
                    //The match just ended
                    this.endMatchAt = Date.now() + this.endMatchDelay;
                } else if (Date.now() >= this.endMatchAt) {
                    //The match is still over, wait is over
                    this.endMatch();
                }
            } else {
                //Match isn't over yet
                this.endMatchAt = -1;
            }
        }
    }

    clientsUpdate() {
        if (this.match) this.match.clientsUpdate();
    }

    hasPlayer(socket) {
        for (let p of this.players) {
            if (p.id == socket.id) return true;
        }
        return false;
    }
}

module.exports = ServerRoom;
