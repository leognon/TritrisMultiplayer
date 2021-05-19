const app = require('express')();
const PORT = process.env.PORT || 3000;
const path = require('path');
const server = app.listen(PORT);
const io = require('socket.io')(server);

let sockets = {};

const Match = require('./server/match.js');
let match;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/client/index.html'));
});
app.get('/client/*', (req, res) => {
    res.sendFile(path.join(__dirname, `/client/${req.params[0]}`));
});
app.get('/common/*', (req, res) => {
    const name = req.params[0];
    //const data = require(`./common/${name}`);
    res.sendFile(path.join(__dirname, `/common/${req.params[0]}`));
});

io.on('connection', socket => {
    console.log(socket.id + ' connected');
    sockets[socket.id] = socket;
    socket.emit('id', socket.id);
    if (Object.keys(sockets).length == 2) {
        match = new Match(...Object.values(sockets));
    }
    socket.on('disconnect', () => {
        console.log(socket.id + ' disconnected');
        match = undefined;
        delete sockets[socket.id];
    });
});

setInterval(() => {
    if (match) match.physicsUpdate();
}, Math.floor(1000/60)); //Physics update at 60fps
setInterval(() => {
    if (match) match.clientsUpdate();
}, Math.floor(1000/20)); //Send new game states to clients at 20fps
