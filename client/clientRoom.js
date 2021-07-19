const config = require('../common/config.js');
const Room = require('../common/room.js');
const MyGame = require('./myGame.js');
const OtherGame = require('./otherGame.js');

class ClientRoom extends Room {
    constructor(roomCode, ownerId) {
        super(roomCode);
        this.owner = new Player(ownerId);
        this.players = [];

        //this.match = null;
        this.myGame = null;
        this.otherGame = null;

        this.nextSendData = Date.now();
    }

    addPlayer(id) {
        console.log('Player ' + id +  ' joined');
        this.players.push(new Player(id));
    }

    startMatch(seed, level) {
        console.log('Starting match');
        this.myGame = new MyGame(seed, level, 'myName');
        this.otherGame = new OtherGame(seed, level, 'otherName');
    }

    run(socket) {
        if (Date.now() > this.nextSendData) {
            this.sendData(socket);
            this.nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        }
        this.update();
    }

    update() {
        this.myGame.clientUpdate();
        this.otherGame.interpolateUpdate();
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

    sendData(socket) {
        const inps = this.myGame.getInputs();
        if (inps.length > 0) socket.emit('inputs', inps);
    }
}

//TODO Match ServerMatch and ClientMatch (and maybe Server/ClientPlayer)
/*class Match {
    constructor() {
        this.players = [];
    }
}*/

//TODO Figure out what a "player" should be
class Player {
    constructor(id) {
        this.id = id;
    }
}

module.exports = ClientRoom;
