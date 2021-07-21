const states = require('../common/states.js');
const Match = require('./match.js');
const Room = require('../common/room.js');

class ServerRoom extends Room {
    constructor(roomCode, owner) {
        super(roomCode, owner.id);
        this.owner = owner; //The socket who created the room
        this.users = []; //An array of sockets

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
        this.users.push(this.owner);

        console.log('Created room with code ' + this.roomCode);
    }

    addUser(socket) {
        for (let p of this.users) {
            p.emit('room', {
                type: 'playerJoined',
                id: socket.id,
                name: socket.name
            });
        }
        this.users.push(socket);

        socket.emit('room', {
            type: 'joined',
            code: this.roomCode,
            ownerId: this.owner.id,
            players: this.users.map(p => {
                return { //Just get the id and name
                    id: p.id, name: p.name
                }
            })
        });
    }

    gotData(socket, data) {
        switch (data.type) {
            case 'start':
                if (socket.id == this.owner.id && this.match === null) {
                    this.newMatch();
                }
                break;
            case 'inputs':
                if (this.match) {
                    this.match.gotInputs(socket, data.inps);
                }
                break;
        }
    }

    newMatch() {
        this.match = new Match(19, this.users[0], this.users[1]);
        for (let p of this.users) {
            p.emit('room', {
                type: 'startMatch',
                seed: this.match.seed,
                level: this.match.level
            });
        }
    }

    endMatch() {
        for (let p of this.users) {
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
        for (let p of this.users) {
            if (p.id == socket.id) return true;
        }
        return false;
    }
}

module.exports = ServerRoom;
