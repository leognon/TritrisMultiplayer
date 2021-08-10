import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import validator from 'validator';

import COMMON_CONFIG from './common/config.js';
import SERVER_CONFIG from './server/config.js';

const PORT = process.env.PORT || 3000;
const app = express();
const server = app.listen(PORT);
const io = new SocketIOServer(server);

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

let sockets = {}; //TODO This is pretty much useless

import ServerRoom from './server/serverRoom.js';
//let queue = []; //A list of socket ids in the queue
let rooms = {}; //The key is the room code

app.get('/', (_, res) => {
    res.sendFile('/client/index.html', { root: __dirname });
});
app.get('/client/assets/*', (req, res) => {
    res.sendFile(`/client/assets/${req.params[0]}`, { root: __dirname });
});
app.get('/client/style.css', (req, res) => {
    res.sendFile('/client/style.css', { root: __dirname });
});
app.get('/main.js', (req, res) => {
    if (process.env.PORT) //Production
        res.sendFile('/build/prod.js', { root: __dirname });
    else //Local testing
        res.sendFile('/build/dev.js', { root: __dirname });
});

io.on('connection', socket => {
    console.log(nameId(socket) + ' connected');
    sockets[socket.id] = socket;

    //TODO Validate and sanitize inputs
    /*socket.on('joinMatch', data => {
        socket.name = data.name;
        enqueue(socket);
    });*/

    socket.on('room', data => {
        const validateName = name => {
            const min = 3;
            const max = COMMON_CONFIG.MAX_NAME_LENGTH;
            const validators = [
                {
                    valid: validator.isLength(name, {min, max}),
                    msg: `Name must be between ${min} and ${max} characters long`
                },
                {
                    valid: validator.isAscii(name),
                    msg: `Name must only contain ASCII characters (a-Z, 0-9)`
                }
            ]
            for (const valid of validators) {
                if (!valid.valid) {
                    return valid;
                }
            }
            return { valid: true };
        }

        switch (data.type) {
            case 'create':
            case 'join':
                const valid = validateName(data.name);
                if (!valid.valid) {
                    socket.emit('msg', { msg: valid.msg });
                    return;
                }
                socket.name = data.name;

                if (data.type == 'create')
                    createRoom(socket);
                else if (data.type == 'join')
                    joinRoom(socket, data.code);
                break;
            case 'leave':
                leaveRoom(socket);
                break;
            default:
                const room = getRoom(socket);
                if (room.found) {
                    room.room.gotData(socket, data);
                }
                break;
        }
    });

    socket.on('disconnect', () => {
        leaveRoom(socket);
    });
});

function enqueue(socket) {
    /*
    queue.push(socket);
    if (queue.length == 2) {
        matches.push(new Match(level, queue[0], queue[1]));
        queue.splice(0, 2);
    }
    */
}

function createRoom(owner) {
    let roomCode = generateUniqRoomCode();
    rooms[roomCode] = new ServerRoom(roomCode, owner);
}

function generateUniqRoomCode() {
    let length = SERVER_CONFIG.ROOM_CODE_LENGTH;
    let code;
    let attempts = 0;
    do {
        const min = 'A'.charCodeAt(0);
        const max = 'Z'.charCodeAt(0);
        code = '';
        for (let i = 0; i < length; i++) {
            const d = Math.floor(Math.random()*(max-min)) + min;
            code += String.fromCharCode(d);
        }

        //If taking too long, make it longer
        if (attempts++ > Math.pow(max-min, length) / 10) length++;
    } while (rooms.hasOwnProperty(code));
    return code;
}

function joinRoom(socket, code) {
    if (!code) code = '';
    code = code.toUpperCase();
    if (rooms.hasOwnProperty(code) && !rooms[code].roomIsLocked) {
        rooms[code].addUser(socket);
    } else {
        socket.emit('msg', {
            msg: 'Invalid room code'
        });
    }
}

function leaveRoom(socket) {
    const room = getRoom(socket);
    if (room.found) {
        const shouldDisband = room.room.removeUser(socket);
        if (shouldDisband) {
            console.log('Disbanding room ' + room.id);
            delete rooms[room.id];
        }
    }
}

function getRoom(socket) {
    for (let id in rooms) {
        if (rooms[id].hasPlayer(socket)) {
            return {
                found: true,
                id,
                room: rooms[id]
            }
        }
    }
    return {
        found: false
    }
}

function nameId(socket) {
    if (socket.hasOwnProperty(nameId))
        return `${nameId} (${socket.id.slice(0, 4)})`;
    return `${socket.id.slice(0,4)}`;
}

//Physics update
setInterval(() => {
    for (const id in rooms) {
        rooms[id].physicsUpdate();
    }
}, SERVER_CONFIG.PHYSICS_UPDATE);

//Send new game states to clients
setInterval(() => {
    for (const id in rooms) {
        rooms[id].clientsUpdate();
    }
}, SERVER_CONFIG.SEND_DATA);

console.log('Server started');
