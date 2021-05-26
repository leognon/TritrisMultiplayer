const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const config = require('../common/config.js');
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
let sendDataEvery = config.CLIENT_SEND_DATA;

function createSocket() {
    socket = io({
        reconnection: false //Do not try to reconnect automatically
    });

    socket.on('state', s => {
        state = s;
        if (state == states.INGAME) {
            game = new ClientGame();
            nextSendData = Date.now() + sendDataEvery;
        }
    });
    socket.on('data', d => {
        game.gotData(d);
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
    game.clientUpdate();
    if (game.input) {
        socket.emit('inputs', game.input);
        game.input = null;
    }
    showGame();
}

function showGame() {
    background(100);
    game.redraw = true;
    game.show(10, 10, 375, 375*2, false, true, true, true, true);
}

function sendData() {
    //socket.emit('inputs', game.getInputs());
}
});
