import validator from 'validator';
import states from '../common/states.js';
import ServerMatch from './match.js';

export default class ServerRoom {
    constructor(roomCode, owner) {
        this.roomCode = roomCode;
        this.roomIsLocked = false;

        this.owner = new User(owner); //The socket who created the room
        this.users = []; //An array of users

        this.match = null;

        this.state = states.LOBBY;

        this.endMatchAt = 0;
        this.endMatchDelay = 5000; //Wait 5 seconds before ending the match

        this.addUser(owner);

        console.log(this.owner.name + ' created room with code ' + this.roomCode);
    }

    addUser(socket) {
        console.log(socket.name + ' joined ' + this.roomCode);
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
                return { //Just get the id and name and isSpectator and isReady
                    id: u.id, name: u.name, isSpectator: u.isSpectator, isReady: u.isReady
                }
            })
        });
    }

    removeUser(socket) {
        console.log(socket.name + ' left ' + this.roomCode);
        for (let i = this.users.length-1; i >= 0; i--) {
            if (!this.users[i]) {
                //TODO This happens if multiple people leave simulateneously (select multiple tabs and click reload)
                console.log('There is no user index ' + i + ' in room ' + this.roomCode, this.users);
                continue;
            }
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
                    this.newMatch(data.settings);
                }
                break;
            case 'changeSpectator':
                if (socket.id == this.owner.id) {
                    this.changeSpectator(data.id, data.isSpectator);
                }
                break;
            case 'changeReady':
                this.changeReady(socket.id, data.isReady);
                break;
            case 'toggleLockRoom':
                if (socket.id == this.owner.id) {
                    this.toggleLockRoom(data.lockRoom);
                }
                break;
            case 'inputs':
                if (this.state == states.INGAME && this.match) {
                    this.match.gotInputs(socket, data.inps);
                }
                break;
        }
    }

    newMatch(settings) {
        console.log('Server starting match', settings);

        if (!validator.isNumeric(settings.startLevel + '')) {
            this.owner.socket.emit('msg', { msg: 'Start level must be a number between 0 and 29' });
            return;
        }

        if (settings.use4x8 !== false && settings.use4x8 !== true) {
            this.owner.socket.emit('msg', { msg: 'Please check the 4x8 checkbox correctly.' });
            return;
        }

        if (settings.quadtris !== false && settings.quadtris !== true) {
            this.owner.socket.emit('msg', { msg: 'Please check the quadtris checkbox correctly.' });
            return;
        }

        const players = this.users.filter(u => !u.isSpectator).map(u => u.socket);

        this.match = new ServerMatch(players, settings);
        for (let u of this.users) {
            u.socket.emit('room', {
                type: 'matchStarted',
                playerIds: players.map(p => p.id),
                settings: this.match.settings
            });
        }
        this.state = states.INGAME;
    }

    endMatch() {
        let scores = '';
        for (let p of this.match.players) {
            scores += p.socket.name + ': ' + p.serverGame.score + ' | ';
        }
        console.log('Ending match in room ' + this.roomCode + '. ' + scores);

        for (let u of this.users) {
            u.socket.emit('room', {
                type: 'endMatch'
            });
            u.isReady = false;
        }
        this.match = null;
        this.state = states.LOBBY;
    }

    changeSpectator(id, isSpectator) {
        const valid = (isSpectator === true || isSpectator === false);
        if (!valid) {
            this.owner.emit('msg', { msg: 'Something went wrong changing the spectator' });
            return;
        }

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

    changeReady(id, isReady) {
        const valid = (isReady === true || isReady === false);
        if (!valid) {
            this.getUserById(id).socket.emit('msg', { msg: 'Something went wrong changing ready.' });
            return;
        }
        this.getUserById(id).isReady = isReady;

        for (const u of this.users) {
            u.socket.emit('room', {
                type: 'readyChanged',
                id,
                isReady
            });
        }
    }

    toggleLockRoom(newState) {
        this.roomIsLocked = newState;
        this.owner.socket.emit('room', {
            type: 'roomLocked',
            roomIsLocked: this.roomIsLocked
        });
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

    getUserById = id => {
        for (let u of this.users) {
            if (u.id == id) return u;
        }
        return null;
    }
}

class User {
    constructor(socket) {
        this.socket = socket;
        this.name = socket.name;
        this.id = socket.id;
        this.isReady = false;
        this.isSpectator = false;
    }
}
