const config = require('../common/config.js');
const states = require('../common/states.js');
const Room = require('../common/room.js');
const MyGame = require('./myGame.js');
const OtherGame = require('./otherGame.js');

class ClientRoom extends Room {
    constructor(roomCode, ownerId, myId) {
        super(roomCode);
        this.owner = new ClientPlayer(ownerId);
        this.myId = myId;
        this.users = [];

        //this.match = null;
        this.myGame = null;
        this.otherGame = null;

        this.nextSendData = Date.now();
    }

    addUser(id, name) {
        console.log('Player ' + id +  ' joined');
        this.users.push(new ClientPlayer(id, name));
    }

    startMatch(seed, level) {
        let myName;
        let otherName;
        for (let p of this.users) {
            if (p.id == this.myId) myName = p.name;
            else otherName = p.name;
        }

        this.myGame = new MyGame(seed, level, myName);
        this.otherGame = new OtherGame(seed, level,otherName);

        this.nextSendData = Date.now();
    }

    endMatch() {
        this.myGame = null;
        this.otherGame = null;
    }

    //Do everything necessary (update, show)
    run(socket, pieceImages, sounds) {
        if (this.myGame !== null && this.otherGame !== null) {
            this.update(socket);
            this.showGame(pieceImages, sounds);
        } else if (this.owner.id == this.myId) {
            this.showLobbyOwner();
        } else {
            this.showLobby();
        }
    }

    //Update the current game
    update(socket) {
        if (Date.now() > this.nextSendData) {
            this.sendData(socket);
            this.nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        }
        this.myGame.clientUpdate();
        this.otherGame.interpolateUpdate();
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
        this.otherGame.show(center+spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);

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
            case 'gotGameState':
                this.gotGameState(data.data);
                break;
        }
    }

    gotGameState(d) {
        const games = d.players;
        const myData = d.yourData;
        let otherData;
        for (let id in games) {
            //if (id != socket.id) {
                otherData = games[id];
                break;
            //}
        }
        if (this.myGame) this.myGame.gotGameState(myData);
        if (this.otherGame) this.otherGame.gotGameState(otherData);
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
}

//TODO Match ServerMatch and ClientMatch (and maybe Server/ClientPlayer)
/*class Match {
    constructor() {
        this.players = [];
    }
}*/

//TODO Figure out what a "player" should be
class ClientPlayer {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
}

module.exports = ClientRoom;
