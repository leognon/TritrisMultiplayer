const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const { Triangle, Piece } = require('../common/classes.js');
const ClientGame = require('../client/clientGame.js');

new p5(() => {
window.debug = this; //Enables variables created with "this." to be accessed in the chrome developer console
let socket;


/* Client sends input packets
 * Client receives data:
 *      Set state to authoritative server
 *      Delete inputs that server has processed
 *      Then replay inputs that server has not processed
 *
 * Server receives data:
 *      Replay game from client perspective
 *
 *
 */

let state = states.FINDING_MATCH;
let game;

let nextSendData = 0;
let sendDataEvery = 1000/1; //Send at 15 fps

function createSocket() {
    socket = io({
        reconnection: false //Do not try to reconnect automatically
    });

    socket.on('state', s => {
        state = s;
        if (state == states.INGAME) {
            game = new ClientGame();
            nextSendData = Date.now();
        }
    });
    socket.on('data', d => {
        const myData = Object.values(d.players)[0];

        //TODO Make this not horrible code... this was all very rushed just to debug
        const piecesJSON = require('../common/pieces.js');
        if (myData.currentPiece) {
            game.currentPiece = new Piece(piecesJSON[myData.currentPieceIndex]);
            game.currentPiece.pos.x = myData.currentPiece.pos.x;
            game.currentPiece.pos.y = myData.currentPiece.pos.y;
            game.currentPiece.pos.rotation = myData.currentPiece.pos.rotation;
        } else {
            game.currentPiece = null;
        }
        //console.log(game.grid);
        for (let i = 0; i < game.grid.h; i++) {
            for (let j = 0; j < game.grid.w; j++) {
                for (let y = 0; y < 2; y++) {
                    for (let x = 0; x < 2; x++) {
                        if (myData.grid.grid[i][j].tris[y][x]) {
                            game.grid.grid[i][j].tris[y][x] = new Triangle(myData.grid.grid[i][j].tris[y][x].clr);
                        } else {
                            game.grid.grid[i][j].tris[y][x] = null;
                        }
                    }
                }
            }
        }
    });
    socket.on('disconnect', () => {
        console.log('Disconnected!!!');
        noLoop();
        //window.location.href = window.location.href;
    });
}

setup = () => {
    createCanvas(windowWidth, windowHeight);
    createSocket();
}

draw = () => {
    if (state == states.FINDING_MATCH) {
        background(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Finding match...', width/2, height/2);
    } else if (state == states.INGAME) {
        if (Date.now() > nextSendData) {
            sendData();
            nextSendData = Date.now() + sendDataEvery;
        }
        runGame();
    }
}

function runGame() {
    game.update();
    showGame();
}

function showGame() {
    background(100);
    game.redraw = true;
    game.show(10, 10, 375, 375*2, false, true, true, true, true);
}

function sendData() {
    socket.emit('inputs', game.getInputs());
}
});
