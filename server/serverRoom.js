const states = require('../common/states.js');
const Match = require('./match.js');
const Room = require('../common/room.js');

class ServerRoom extends Room {
    constructor(roomCode, owner) {
        super(roomCode, owner.id);
        this.owner = owner;
        this.players = [];
        this.spectators = [];
        
        this.match = null;

        this.owner.emit('state', {
            state: states.LOBBY_OWNER,
            code: this.roomCode
        });

        console.log('Created room with code ' + this.roomCode);
    }

    addPlayer(socket) {
        this.players.push(socket);
    }

    update() {
        
    }
}

module.exports = ServerRoom;
