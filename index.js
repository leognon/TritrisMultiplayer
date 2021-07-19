const app = require('express')();
const path = require('path');
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);
const io = require('socket.io')(server);
const states = require('./common/states.js');
const config = require('./common/config.js');

let sockets = {};

const Match = require('./server/match.js');
const ServerRoom = require('./server/serverRoom.js');
let matches = [];
let queue = []; //A list of socket ids in the queue
let rooms = {}; //The key is the room code

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '/client/index.html'));
});
app.get('/client/*', (req, res) => {
    res.sendFile(path.join(__dirname, `/client/${req.params[0]}`));
});

io.on('connection', socket => {
    console.log(socket.id + ' connected');
    sockets[socket.id] = socket;

    //TODO Validate and sanitize inputs
    socket.on('joinMatch', data => {
        socket.name = data.name;
        enqueue(socket);
    });

    socket.on('room', data => {
        if (data.type == 'create') {
            socket.name = data.name;
            createRoom(socket);
        } else if (data.type == 'join') {
            socket.name = data.name;
            joinRoom(socket, data.code);
        } else {
            console.log('Got ', data);
            const room = getRoom(socket);
            if (room.found) {
                room.room.gotData(socket, data);
            }
        }
    });

    socket.on('inputs', data => {
        const match = getMatch(socket);
        if (match.found) {
            match.match.gotInputs(socket, data);
        }
    });

    socket.on('disconnect', () => {
        const match = getMatch(socket);
        if (match.found) {
            matches[match.index].disconnected(socket);
            matches.splice(match.index, 1);
        }
        for (let i = queue.length-1; i >= 0; i--) {
            if (queue[i].id == socket.id) {
                queue.splice(i, 1);
            }
        }
        console.log(socket.id + ' disconnected');
        delete sockets[socket.id];
    });
});

function getMatch(socket) {
    for (let i = 0; i < matches.length; i++) {
        if (matches[i].hasPlayer(socket)) {
            return {
                found: true,
                index: i,
                match: matches[i]
            };
        }
    }
    return {
        found: false,
    }
}

function enqueue(socket) {
    queue.push(socket);
    if (queue.length == 2) {
        matches.push(new Match(level, queue[0], queue[1]));
        queue.splice(0, 2);
    }
}

function createRoom(owner) {
    let roomCode = generateUniqRoomCode();
    rooms[roomCode] = new ServerRoom(roomCode, owner);
}

function generateUniqRoomCode() {
    let code;
    do {
        const min = 'A'.charCodeAt(0);
        const max = 'Z'.charCodeAt(0);
        code = '';
        for (let i = 0; i < 1; i++) {
            const d = Math.floor(Math.random()*(max-min)) + min;
            code += String.fromCharCode(d);
        }
    } while (rooms.hasOwnProperty(code));
    return code;
}

function joinRoom(socket, code) {
    if (rooms.hasOwnProperty(code)) {
        rooms[code].addPlayer(socket);
    } else {
        socket.emit('state', {
            state: states.MENU,
            message: 'Invalid room code'
        });
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

setInterval(() => {
    for (const match of matches) {
        match.physicsUpdate();
    }
}, config.SERVER_PHYSICS_UPDATE); //Physics update at 60fps
setInterval(() => {
    for (const match of matches) {
        match.clientsUpdate();
    }
}, config.SERVER_SEND_DATA); //Send new game states to clients at 20fps

//An interactive console to make debugging eaiser
const stdin = process.openStdin();
stdin.addListener("data", (d) => {
    d = d.toString().trim();
    try {
        let g = null;
        if (matches.length > 0) g = matches[0].players[0].serverGame;
        console.log(eval(d));
    } catch (e) {
        console.error('Something went wrong.', e);
    }
});

let level = 9;
app.get('/level/*', (req, res) => {
    try {
        level = parseInt(req.params[0]);
    } catch (e) { }
    res.redirect('/');
});

console.log('Server started');
