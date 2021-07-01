const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const config = require('../common/config.js');
const MyGame = require('../client/myGame.js');
const OtherGame = require('../client/otherGame.js');

new p5(() => {
let socket;

let state = states.LOADING;
let game;
let otherGame;

let backgroundColor = 0;

let piecesImage; //The spritesheet
let pieceImages = []; //The individual images
let sounds = {};

let dom = {};

let nextSendData = 0;

function createSocket() {
    socket = io({
        reconnection: false //Do not try to reconnect automatically
    });

    socket.on('state', gotState);
    socket.on('data', gotData);
    socket.on('matchOver', () => {
        game = null;
        otherGame = null;
        state = states.MENU;
        dom.joinDiv.style('visibility: visible;');
    });
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
    dom.joinButton = select('#joinButton');
    dom.joinButton.mousePressed(() => {
        if (state == states.MENU) {
            joinGame();
            dom.joinDiv.style('visibility: hidden;');
        }
    });
}

draw = () => {
    if (state == states.LOADING) {
        setBackground(51);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Loading...', width/2, height/2);
    } else if (state == states.MENU) {
        setBackground(120);
        //dom.joinDiv.style('visibility: visible;');
     } else if (state == states.FINDING_MATCH) {
        setBackground(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Finding match...', width/2, height/2);
    } else if (state == states.INGAME) {
        if (Date.now() > nextSendData) {
            sendData();
            nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        }
        runGame();
    }
}

function joinGame() {
    socket.emit('joinMatch', {
        name: dom.name.value()
    });

    state = states.FINDING_MATCH;
}

function runGame() {
    game.clientUpdate();
    otherGame.interpolateUpdate();
    if (game.isFlashing()) {
        setBackground(150);
    } else {
        if (backgroundColor != 100) {
            setBackground(100);
        }
    }
    let boardWidth = width/4;
    let boardHeight = boardWidth*2;
    if (boardHeight > height * 0.9) {
        boardHeight = height * 0.9;
        boardWidth = boardHeight / 2;
    }
    const gameWidth = boardWidth + 5*(boardWidth / game.w) + 20;
    const center = width/2;
    const spacing = 30;
    showGame(game, center-gameWidth-spacing/2, 10, boardWidth, boardHeight);
    game.playSounds(sounds);
    showGame(otherGame, center+spacing/2, 10, boardWidth, boardHeight);
}

function showGame(g, x, y, w, h) {
    g.show(x, y, w, h, pieceImages, true, true, true);
}

function gotState(data) {
    state = data.state;
    if (state == states.INGAME) {
        let otherId;
        for (let id in data.names) {
            if (id != socket.id) {
                otherId = id;
                break;
            }
        }
        game = new MyGame(data.seed, data.level, data.names[socket.id]);
        otherGame = new OtherGame(data.seed, data.level, data.names[otherId]);
        nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        setBackground(100);
    }
}

function gotData(d) {
    setTimeout(() => {
        const games = d.players;
        const myData = d.yourData;
        let otherData;
        for (let id in games) {
            //if (id != socket.id) {
                otherData = games[id];
                break;
            //}
        }
        if (game) game.gotData(myData);
        if (otherGame) otherGame.gotData(otherData);
    }, config.FAKE_LATENCY); //Some fake latency
};

function sendData() {
    const inps = game.getInputs();
    if (inps.length > 0)
        socket.emit('inputs', inps);
}

function setBackground(c) {
    backgroundColor = c;
    background(c);
    if (game) game.redraw = true;
    if (otherGame) otherGame.redraw = true;
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
    if (game) game.redraw = true;
    if (otherGame) otherGame.redraw = true;
}

});
