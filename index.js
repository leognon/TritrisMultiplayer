const app = require('express')();
const path = require('path');
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);
const io = require('socket.io')(server);
const config = require('./common/config.js');

let sockets = {};

const Match = require('./server/match.js');
let match;

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '/client/index.html'));
});
app.get('/client/*', (req, res) => {
    res.sendFile(path.join(__dirname, `/client/${req.params[0]}`));
});

io.on('connection', socket => {
    console.log(socket.id + ' connected');
    sockets[socket.id] = socket;
    socket.emit('id', socket.id);
    if (Object.keys(sockets).length == 2) {
        match = new Match(...Object.values(sockets));
    }
    socket.on('disconnect', () => {
        if (match.hasPlayer(socket)) {
            match.disconnected(socket);
        }
        console.log(socket.id + ' disconnected');
        match = undefined;
        delete sockets[socket.id];
    });
});

setInterval(() => {
    if (match) match.physicsUpdate();
}, config.SERVER_PHYSICS_UPDATE); //Physics update at 60fps
setInterval(() => {
    if (match) match.clientsUpdate();
}, config.SERVER_SEND_DATA); //Send new game states to clients at 20fps

//An interactive console to make debugging eaiser
const stdin = process.openStdin();
stdin.addListener("data", (d) => {
    d = d.toString().trim();
    try {
        let g = null;
        if (match) g = match.players[0].serverGame;
        console.log(eval(d));
    } catch (e) {
        console.error('Something went wrong.', e);
    }
});

console.log('Server started');
