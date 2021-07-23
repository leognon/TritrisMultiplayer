const app = require('express')();
const path = require('path');
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);
const io = require('socket.io')(server);
const states = require('./common/states.js');
const config = require('./common/config.js');

let sockets = {};

const ServerRoom = require('./server/serverRoom.js');
//let queue = []; //A list of socket ids in the queue
let rooms = {}; //The key is the room code

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '/client/index.html'));
});
app.get('/client/*', (req, res) => { //TODO This might not be the best way to do it
    res.sendFile(path.join(__dirname, `/client/${req.params[0]}`));
});
app.get('/build/*', (req, res) => { //TODO This might not be the best way to do it
    res.sendFile(path.join(__dirname, `/build/${req.params[0]}`));
});

io.on('connection', socket => {
    console.log(socket.id + ' connected');
    sockets[socket.id] = socket;

    //TODO Validate and sanitize inputs
    /*socket.on('joinMatch', data => {
        socket.name = data.name;
        enqueue(socket);
    });*/

    socket.on('room', data => {
        switch (data.type) {
            case 'create':
                socket.name = data.name;
                createRoom(socket);
                break;
            case 'join':
                socket.name = data.name;
                joinRoom(socket, data.code);
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
        const room = getRoom(socket);
        if (room.found) {
            const shouldDisband = room.room.disconnected(socket);
            if (shouldDisband) {
                delete rooms[room.id];
            }
        }
        /*const match = getMatch(socket);
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
        delete sockets[socket.id];*/
    });
});

/*
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
}*/

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
        rooms[code].addUser(socket);
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

//Physics update
setInterval(() => {
    for (const id in rooms) {
        rooms[id].physicsUpdate();
    }
    /*for (const match of matches) {
        match.physicsUpdate();
    }*/
}, config.SERVER_PHYSICS_UPDATE);

//Send new game states to clients
setInterval(() => {
    for (const id in rooms) {
        rooms[id].clientsUpdate();
    }
    /*for (const match of matches) {
        match.clientsUpdate();
    }*/
}, config.SERVER_SEND_DATA);

//An interactive console to make debugging eaiser
const stdin = process.openStdin();
stdin.addListener("data", (d) => {
    d = d.toString().trim();
    try {
        //let g = null;
        //if (matches.length > 0) g = matches[0].players[0].serverGame;
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
