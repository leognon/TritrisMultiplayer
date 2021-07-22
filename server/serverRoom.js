const states = require('../common/states.js');
const ServerMatch = require('./match.js');

//TODO Make the Room class more useful with inheritance
class ServerRoom {
    constructor(roomCode, owner) {
        this.roomCode = roomCode;

        this.owner = owner; //The socket who created the room
        this.users = []; //An array of sockets

        this.match = null;

        this.state = states.LOBBY;

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

    disconnected(socket) {
        for (let i = this.users.length-1; i >= 0; i--) {
            if (this.users[i].id == socket.id) {
                this.users.splice(i, 1);
            } else {
                this.users[i].emit('room', {
                    type: 'playerDisconnected',
                    id: socket.id
                });
            }
        }

        if (this.users.length == 0) {
            return true; //Disband room
        } else if (socket.id == this.owner.id) {
            //Pick new owner
            const newOwner = this.users[0];
            this.owner = newOwner;
            for (let u of this.users) {
                u.emit('room', {
                    type: 'newOwner',
                    id: this.owner.id
                });
            }
        }

        return false;
    }

    gotData(socket, data) {
        switch (data.type) {
            case 'start':
                if (socket.id == this.owner.id && this.state == states.LOBBY) {
                    this.newMatch();
                }
                break;
            case 'inputs':
                if (this.state == states.INGAME && this.match) {
                    this.match.gotInputs(socket, data.inps);
                }
                break;
        }
    }

    newMatch() {
        this.match = new ServerMatch(15, this.users[0], this.users[1]);
        for (let p of this.users) {
            p.emit('room', {
                type: 'startMatch',
                seed: this.match.seed,
                level: this.match.level
            });
        }
        this.state = states.INGAME;
    }

    endMatch() {
        for (let p of this.users) {
            p.emit('room', {
                type: 'endMatch'
            });
        }
        this.match = null;
        this.state = states.LOBBY;
    }

    physicsUpdate() {
        if (this.state == states.INGAME && this.match) {
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
        if (this.state == states.INGAME && this.match) this.match.clientsUpdate();
    }

    hasPlayer(socket) {
        for (let p of this.users) {
            if (p.id == socket.id) return true;
        }
        return false;
    }
}

module.exports = ServerRoom;
