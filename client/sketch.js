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

let piecesImage; //The spritesheet
let pieceImages = []; //The individual images

let nextSendData = 0;

function createSocket() {
    socket = io({
        reconnection: false //Do not try to reconnect automatically
    });

    socket.on('state', s => {
        state = s;
        if (state == states.INGAME) { //TODO Don't wait for server to start game. Make sure to start ahead of server
            game = new MyGame();
            otherGame = new OtherGame();
            nextSendData = Date.now() + config.CLIENT_SEND_DATA;
            background(100);
        }
    });
    socket.on('data', d => {
        //game.gotData(d);
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
            game.gotData(myData);
            otherGame.gotData(otherData);
        }, config.FAKE_LATENCY); //Some fake latency
    });
    socket.on('disconnect', () => {
        console.log('Disconnected!!!');
        noLoop();
        //window.location.href = window.location.href;
    });
}

setup = () => {
    createCanvas(windowWidth, windowHeight);
    piecesImage = loadImage('../client/piecesImage.png', () => {
        pieceImages = loadPieces(piecesImage);

        state = states.FINDING_MATCH;
        createSocket();
    });
    FFF_Forward = loadFont('../client/fff-forward.ttf', () => {
        textFont(FFF_Forward);
    });
}

draw = () => {
    if (state == states.LOADING) {
        background(51);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Loading...', width/2, height/2);
    } else if (state == states.FINDING_MATCH) {
        background(0);
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
    //showConsole();
}

playing = 0;
keyPressed = () => {
    if (key == 'p') {
        //A fun compact way to alternate btwn these functions
        [loop, noLoop][playing^=1]();
    }
}

let cLog = [];
const origConsoleLog = console.log;
console.log = (a, b, c, d) => {
    let str = a + (b ? (', ' + JSON.stringify(b)) : '') + (c ? (', ' + JSON.stringify(c)) : '') + '\n';
    if (d) str += 'TOO MANY ARGS!!' + '\n';
    origConsoleLog(str);
    cLog.push(str);
    const maxLen = 50;
    while (cLog.length > maxLen) {
        cLog.splice(0, 1);
    }
}
function showConsole() {
    fill(100);
    rect(855, 0, 300, height);
    const fontSize = 12;
    textSize(fontSize);
    const txt = cLog.join(' ');
    const txtHeight = cLog.length * (fontSize + 3);
    fill(0);
    text(txt, 860, 813 - txtHeight);
}

function runGame() {
    game.clientUpdate();
    otherGame.interpolateUpdate();
    if (game.isFlashing()) {
        background(150);
    }
    showGame(game, 10, 10);
    showGame(otherGame, 550, 10);
}

function showGame(g, x, y) {
    g.show(x, y, 300, 300*2, pieceImages, true, true, true);
}

function sendData() {
    socket.emit('inputs', game.getInputs());
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

});
