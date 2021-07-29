import states from '../common/states.js';
import ServerMatch from './match.js';

export default class ServerRoom {
    constructor(roomCode, owner) {
        this.roomCode = roomCode;

        this.owner = new User(owner); //The socket who created the room
        this.users = []; //An array of users

        this.match = null;

        this.state = states.LOBBY;

        this.endMatchAt = 0;
        this.endMatchDelay = 5000; //Wait 5 seconds before ending the match

        this.addUser(owner);

        console.log('Created room with code ' + this.roomCode);
    }

    addUser(socket) {
        for (let u of this.users) {
            u.socket.emit('room', {
                type: 'playerJoined',
                id: socket.id,
                name: socket.name
            });
        }
        this.users.push(new User(socket));

        socket.emit('joinedRoom', {
            code: this.roomCode,
            ownerId: this.owner.id,
            users: this.users.map(u => {
                return { //Just get the id and name and isSpectator
                    id: u.id, name: u.name, isSpectator: u.isSpectator
                }
            })
        });
    }

    removeUser(socket) {
        for (let i = this.users.length-1; i >= 0; i--) {
            if (this.users[i].id == socket.id) {
                this.users[i].socket.emit('leftRoom');
                this.users.splice(i, 1);
            } else {
                this.users[i].socket.emit('room', {
                    type: 'playerLeft',
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
                u.socket.emit('room', {
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
            case 'changeSpectator':
                if (socket.id == this.owner.id) {
                    this.changeSpectator(data.id, data.isSpectator);
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
        const players = this.users.filter(u => !u.isSpectator).map(u => u.socket);
        this.match = new ServerMatch(0, ...players);
        for (let u of this.users) {
            u.socket.emit('room', {
                type: 'matchStarted',
                playerIds: players.map(p => p.id),
                seed: this.match.seed,
                level: this.match.level
            });
        }
        this.state = states.INGAME;
    }

    endMatch() {
        for (let u of this.users) {
            u.socket.emit('room', {
                type: 'endMatch'
            });
        }
        this.match = null;
        this.state = states.LOBBY;
    }

    changeSpectator(id, isSpectator) {
        for (const u of this.users) {
            if (u.id == id) {
                u.isSpectator = isSpectator;
            }
        }
        for (const u of this.users) {
            u.socket.emit('room', {
                type: 'spectatorChanged',
                id,
                isSpectator
            });
        }
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
        if (this.state == states.INGAME && this.match) {
            const spectatorSockets = this.users.filter(u => u.isSpectator).map(s => s.socket);
            this.match.clientsUpdate(spectatorSockets);
        }
    }

    hasPlayer(socket) {
        for (let u of this.users) {
            if (u.id == socket.id) return true;
        }
        return false;
    }
}

class User {
    constructor(socket) {
        this.socket = socket;
        this.name = socket.name;
        this.id = socket.id;
        this.isSpectator = false;
    }
}
