const config = require('../common/config.js');
const states = require('../common/states.js');
const MyGame = require('./myGame.js');
const OtherGame = require('./otherGame.js');

class ClientRoom {
    constructor(roomCode, ownerId, myId) {
        this.roomCode = roomCode;

        this.ownerId = ownerId;
        this.myId = myId;

        this.users = [];

        this.match = null;

        this.state = states.LOBBY;
    }

    addUser(id, name) {
        console.log('Player ' + id +  ' joined');
        this.users.push({ id, name });
        //this.users.push(new ClientPlayer(id, name));
    }

    disconnected(id) {
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].id == id) {
                this.users.splice(i, 1);
            }
        }
    }

    startMatch(seed, level) {
        let me;
        let others = [];
        for (let p of this.users) {
            if (p.id == this.myId) me = p;
            else others.push(p);
        }

        this.match = new ClientMatch(level, seed, me, others);

        this.state = states.INGAME;
    }

    endMatch() {
        this.match = null;

        this.state = states.LOBBY;
    }

    //Do everything necessary (update, show)
    run(socket, pieceImages, sounds) {
        if (this.state == states.INGAME) {
            this.update(socket);
            this.showGame(pieceImages, sounds);
        } else if (this.ownerId == this.myId) {
            this.showLobbyOwner();
        } else {
            this.showLobby();
        }
    }

    //Update the current game
    update(socket) {
        if (this.state == states.INGAME && this.match) {
            this.match.update(socket);
        }
    }

    showLobbyOwner() {
        background(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text(`You made the lobby\n\nCode: ${this.roomCode}`, width/2, height/2);
        for (let i = 0; i < this.users.length; i++) {
            text('Player ' + this.users[i].name, width/2, height/2 + 100 + i*30);
        }
    }

    showLobby() {
        background(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text(`You joined the lobby\n\nCode: ${this.roomCode}`, width/2, height/2);
        for (let i = 0; i < this.users.length; i++) {
            text('Player ' + this.users[i].name, width/2, height/2 + 100 + i*30);
        }
    }

    showGame(pieceImages, sounds) {
        if (this.state == states.INGAME && this.match) {
            this.match.show(pieceImages, sounds);
        }
    }

    gotData(data) {
        switch (data.type) {
            case 'startMatch':
                this.startMatch(data.seed, data.level);
                break;
            case 'endMatch':
                this.endMatch();
                break;
            case 'playerJoined':
                this.addUser(data.id, data.name);
                break;
            case 'playerDisconnected':
                this.disconnected(data.id);
                break;
            case 'gotGameState':
                this.gotGameState(data.data);
                break;
            case 'newOwner':
                this.ownerId = data.id;
                break;
        }
    }

    gotGameState(d) {
        if (this.state == states.INGAME && this.match) {
            this.match.gotGameState(d);
        }
    }
}

class ClientMatch {
    constructor(level, seed, me, others) {
        this.seed = seed;
        this.level = level;

        this.myId = me.id;
        this.myGame = new MyGame(this.seed, this.level, me.name);
        this.otherPlayers = [];
        for (let other of others) {
            this.otherPlayers.push(new OtherPlayer(other.id, other.name, this.seed, this.level));
        }

        this.nextSendData = Date.now();
    }

    addPlayer(p) {
        this.players.push(new OtherPlayer(p.id, p.name, this.seed, this.level));
    }

    update(socket) {
        if (Date.now() > this.nextSendData) {
            this.sendData(socket);
            this.nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        }

        this.myGame.clientUpdate();
        for (let other of this.otherPlayers) {
            other.interpolateUpdate();
        }
    }

    sendData(socket) {
        const inps = this.myGame.getInputs();
        if (inps.length > 0) {
            socket.emit('room', {
                type: 'inputs',
                inps
            });
        }
    }

    gotGameState(d) {
        const games = d.players;
        const myData = d.yourData;

        this.myGame.gotGameState(myData);
        for (let other of this.otherPlayers) {
            const otherData = games[other.id];
            other.gotGameState(otherData);
        }
    }

    show(pieceImages, sounds) {
        if (this.myGame.duringCountDown() || Date.now()-300 < this.myGame.startTime) { //TODO Make this all better by making the redraw system use p5 graphics
            background(100);
        }
        if (this.myGame.isFlashing()) {
            background(150);
        } else {
            background(100);
        }
        let boardWidth = width/4;
        let boardHeight = boardWidth*2;
        if (boardHeight > height * 0.9) {
            boardHeight = height * 0.9;
            boardWidth = boardHeight / 2;
        }
        const gameWidth = boardWidth + 5*(boardWidth / this.myGame.w) + 20;
        const center = width/2;
        const spacing = 30;

        this.myGame.show(center-gameWidth-spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        this.otherPlayers[0].game.show(center+spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        //TODO Display multiple other players!

        this.myGame.playSounds(sounds);

        if (this.myGame.duringCountDown()) {
            textSize(50);
            fill(255);
            noStroke();
            textAlign(CENTER, CENTER);
            const secondsRemaining = 1 + floor(-this.myGame.time / 1000);
            text(secondsRemaining, center - gameWidth - spacing/2 + boardWidth/2, 10+boardHeight/2);
        }
    }
}

class OtherPlayer {
    constructor(id, name, seed, level) {
        this.id = id;
        this.name = name;

        this.game = new OtherGame(seed, level, this.name);
    }

    interpolateUpdate() {
        this.game.interpolateUpdate();
    }

    gotGameState(d) {
        this.game.gotGameState(d);
    }

    //gotGameState
    //sendData
}

module.exports = ClientRoom;
