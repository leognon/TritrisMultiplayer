const Room = require('../common/room.js');

class ClientRoom extends Room {
    constructor(roomCode) {
        super(roomCode);

    }
}

module.exports = ClientRoom;
