const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const ClientRoom = require('./clientRoom.js');

new p5(() => {
let socket;

let state = states.LOADING;
let room = null;

let piecesImage; //The spritesheet
let pieceImages = []; //The individual images
let sounds = {};

let dom = {};

function createSocket() {
    socket = io({
        reconnection: false //Do not try to reconnect automatically
    });

    socket.on('state', gotState);
    //socket.on('gameState', gotGameState);
    socket.on('matchOver', () => {
        game = null;
        otherGame = null;
        state = states.MENU;
        dom.joinDiv.style('visibility: visible;');
    });
    socket.on('room', gotRoomData);
    socket.on('disconnect', () => {
        console.log('Disconnected!!!');
        noLoop();
        //window.location.href = window.location.href;
    });
}

setup = () => {
    createCanvas(windowWidth, windowHeight);
    piecesImage = loadImage('../client/assets/piecesImage.png', () => {
        pieceImages = loadPieces(piecesImage);

        state = states.MENU;
        createSocket();
    });
    FFF_Forward = loadFont('../client/assets/fff-forward.ttf', () => {
        textFont(FFF_Forward);
    });
    sounds.move = new Sound('../client/assets/move.wav');
    sounds.fall = new Sound('../client/assets/fall.wav');
    sounds.clear = new Sound('../client/assets/clear.wav');
    sounds.tritris = new Sound('../client/assets/tritris.wav');
    sounds.levelup = new Sound('../client/assets/levelup.wav');
    sounds.topout = new Sound('../client/assets/topout.wav');

    dom.name = select('#name');
    dom.joinDiv = select('#joinDiv');
    dom.quickPlay = select('#quickPlay');
    dom.quickPlay.mousePressed(() => {
        if (state == states.MENU) {
            joinGame();
            dom.joinDiv.style('visibility: hidden;');
        }
    });

    dom.createRoom = select('#createRoom');
    dom.createRoom.mousePressed(() => {
        if (state == states.MENU) {
            createRoom();
            dom.joinDiv.style('visibility: hidden;');
        }
    });

    dom.joinRoom = select('#joinRoom');
    dom.joinRoom.mousePressed(() => {
        if (state == states.MENU) {
            const code = prompt('Please enter the room code to join.');
            if (code) {
                joinRoom(code);
                dom.joinDiv.style('visibility: hidden;');
            }
        }
    });
}

draw = () => {
    if (state == states.LOADING) {
        background(51);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Loading...', width/2, height/2);
    } else if (state == states.MENU) {
        background(120);
        //dom.joinDiv.style('visibility: visible;');
     } else if (state == states.FINDING_MATCH) {
        background(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Finding match...', width/2, height/2);
    } else if (state == states.ROOM) {
        room.run(socket, pieceImages, sounds);
    } /*else if (state == states.INGAME) {
        room.run(socket);
        room.show(pieceImages, sounds);
    }*/
}

function joinGame() {
    socket.emit('joinMatch', {
        name: dom.name.value()
    });
    state = states.FINDING_MATCH;
}

function createRoom() {
    socket.emit('room', {
        type: 'create',
        name: dom.name.value()
    });
    //TODO Add loading state for after creating room
}

function joinRoom(code) {
    socket.emit('room', {
        type: 'join',
        name: dom.name.value(),
        code
    });
    //TODO Add loading state
}
keyPressed = () => {
    if (state == states.ROOM && room && socket.id == room.ownerId && keyCode == 32) {
        socket.emit('room', {
            type: 'start',
        });
    }
}

//TODO With namespacing, will this function be needed?
function gotState(data) {
    state = data.state;
    if (data.hasOwnProperty('message')) {
        alert(data.message);
    }

    if (state == states.MENU) {
        dom.joinDiv.style('visibility: visible;');
        room = null;
    }
}

function gotRoomData(data) {
    switch (data.type) {
        case 'created': //You just created a lobby
            console.log('Created lobby', data);
            room = new ClientRoom(data.code, data.owner.id, socket.id);
            room.addUser(data.owner.id, data.owner.name); //Add the owner
            state = states.ROOM;
            break;
        case 'joined': //You just joined a lobby
            console.log('Joined lobby');
            room = new ClientRoom(data.code, data.ownerId, socket.id);
            for (let p of data.players) { //Add all of the already joined players
                room.addUser(p.id, p.name);
            }
            state = states.ROOM;
            break;
        default:
            if (room) room.gotData(data);
            break;
    }
}

function loadPieces(piecesImage) {
    let pieceImages = []; //A 2d array of each piece color and their rotations
    for (let i = 0; i < 2; i++) { //All of the colors (except white)
        for (let j = 0; j < 3; j++) {
            pieceImages.push(load4Triangles(i, j, piecesImage));
        }
    }
    pieceImages.push(load4Triangles(0, 3, piecesImage)); //The white ninja

    function load4Triangles(i, j, piecesImage) { //Aaaaaah a function inside a function!!!
        const triWidth = piecesImage.width / 8;
        let triangles = [];
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const x = (j*2 + col) * triWidth; //The j*2 is because each set of 4 is a 2x2 square of triangles
                const y = (i*2 + row) * triWidth;
                const imageSlice = piecesImage.get(x, y, triWidth, triWidth);
                triangles.push(imageSlice); //A single rotation
            }
        }
        return triangles;
    }

    return pieceImages;
}

//Modified from https://www.w3schools.com/graphics/game_sound.asp
class Sound {
    constructor(src) {
        this.sound = document.createElement('audio');
        this.sound.src = src;
        this.sound.setAttribute('preload', 'auto');
        this.sound.setAttribute('controls', 'none');
        this.sound.style.display = 'none';
        document.body.appendChild(this.sound);
    }

    setVolume(vol) {
        this.sound.volume = vol;
    }

    play() {
        this.sound.play();
    }
}

windowResized = () => {
    resizeCanvas(windowWidth, windowHeight);
    //if (game) game.redraw = true;
    //if (otherGame) otherGame.redraw = true;
}

});
