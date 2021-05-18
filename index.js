const app = require('express')();
const PORT = process.env.PORT || 3000;
const path = require('path');
const server = app.listen(PORT);
const io = require('socket.io')(server);

app.get('/', (req, res) => {
    console.log('here');
    res.sendFile(path.join(__dirname, '/client.html'));
});

io.on('connection', (socket) => {
    console.log('got connection');
});
