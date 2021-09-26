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

import { addClient, removeClient } from './server/sockets.js';
import ServerRoom from './server/serverRoom.js';
//let queue = []; //A list of socket ids in the queue
let rooms = {}; //The key is the room code

app.get('/', (_, res) => {
    res.sendFile('/client/index.html', { root: __dirname });
});
app.get('/client/assets/*', (req, res) => {
    res.sendFile(`/client/assets/${req.params[0]}`, { root: __dirname });
});
app.get('/client/style.css', (_, res) => {
    res.sendFile('/client/style.css', { root: __dirname });
});
app.get('/main.js', (_, res) => {
    if (process.env.PORT) //Production
        res.sendFile('/build/prod.js', { root: __dirname });
    else //Local testing
        res.sendFile('/build/dev.js', { root: __dirname });
});

io.on('connection', socket => {
    const client = addClient(socket);
    console.log(client.getId() + ' connected');

    //TODO Validate and sanitize inputs
    /*socket.on('joinMatch', data => {
        socket.name = data.name;
        enqueue(socket);
    });*/

    client.on('room', data => {
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
                client.setName(data.name);

                if (data.type == 'create')
                    createRoom(client);
                else if (data.type == 'join')
                    joinRoom(client, data.code);
                break;
            case 'leave':
                leaveRoom(client);
                break;
            default:
                const room = getRoom(client);
                if (room.found) {
                    room.room.gotData(client, data);
                }
                break;
        }
    });

    //The client left the page. Remove them from any rooms
    client.on('leftPage', () => {
        console.log(`Client ${client.getId()} left the page`);
        leaveRoom(client);
        client.leftPage = true;
    });

    client.on('disconnect', () => {
        client.lastDisconnectedAt = Date.now();
        //If I'm disconnected everyone keeps mvoing
        if (!client.leftPage) {
            //TODO Add offline status and ability for owner to kick people out of room
            //Currently, if someone disconnects while ingame for over 10 seconds, then reconnect they think they are in game, but they've left the room
            //Only remove from room if in lobby?
            console.log(`Client ${client.getId()} disconnected`);
            setTimeout(() => {
                //After a timeout, make sure they are still disconnected (and have been for long enough)
                if (Date.now() - client.lastDisconnectedAt > SERVER_CONFIG.DISCONNECT_TIMEOUT - 1000 && client.socket.disconnected) {
                    console.log(`Client ${client.getId()} is still disconnected`);
                    leaveRoom(client);
                    removeClient(client);
                }
            }, SERVER_CONFIG.DISCONNECT_TIMEOUT);
        } else {
            removeClient(client);
        }
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

function joinRoom(client, code) {
    if (!code) code = '';
    code = code.toUpperCase();
    if (rooms.hasOwnProperty(code) && !rooms[code].roomIsLocked) {
        rooms[code].addUser(client);
    } else {
        client.emit('msg', {
            msg: 'Invalid room code'
        });
    }
}

function leaveRoom(client) {
    const room = getRoom(client);
    if (room.found) {
        const shouldDisband = room.room.removeUser(client);
        if (shouldDisband) {
            delete rooms[room.id];
        }
    }
}

function getRoom(client) {
    for (let id in rooms) {
        if (rooms[id].hasPlayer(client)) {
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
