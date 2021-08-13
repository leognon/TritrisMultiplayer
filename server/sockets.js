let sessionIdtoUserId = new Map(); //sessionIdtoUserId[sessionId] = userId
let clients = new Map(); //users[userId] = Client

function generateRandomId() {
    return Math.floor(Math.random() * 100000000);
}

export function addClient(socket) {
    let newUser = true;
    if (socket.handshake.auth.hasOwnProperty('sessionId') && sessionIdtoUserId.has(socket.handshake.auth.sessionId)) {
        newUser = false;
    }

    let client;
    let sessionId, userId;
    if (newUser) {
        sessionId = 'session' + Math.floor(Math.random() * 10000000);
        userId = 'user' + Math.floor(Math.random() * 10000000);
        sessionIdtoUserId.set(sessionId, userId);

        client = new Client(socket, userId);
        clients.set(userId, client);

        console.log('New Client ' + sessionId + ' userId: ' + userId);

        socket.emit('auth', {
            sessionId, userId
        });
    } else {
        sessionId = socket.handshake.auth.sessionId;
        userId = sessionIdtoUserId.get(sessionId);

        client = clients.get(userId);
        client.socket = socket;
        
        console.log('Old Client ' + sessionId + ' userId: ' + userId);

        socket.emit('reAuth', {
            sessionId, userId,

        });
    }

    return client;
}

class Client {
    constructor(socket, userId) {
        this.socket = socket;
        this.userId = userId;
        this.name = 'UnknownPlayer';
    }

    getId = () => {
        return this.userId;
    }

    on = (evnt, cb) => {
        this.socket.on(evnt, cb);
    }

    emit = (name, data) => {
        this.socket.emit(name, data);
    }

    setName(n) {
        this.name = n;
    }

    isDisconnected = () => {
        return this.socket.disconnected;
    }
}
