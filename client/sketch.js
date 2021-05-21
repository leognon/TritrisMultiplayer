const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const ClientGame = require('../client/clientGame.js');

new p5(() => {
window.debug = this; //Enables variables created with "this." to be accessed in the chrome developer console
const socket = io({
    reconnection: false //Do not try to reconnect automatically
});


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

socket.on('state', s => {
    state = s;
    if (state == states.INGAME) {
        game = new ClientGame();
    }
});
socket.on('data', d => {

});
socket.on('disconnect', () => {
    console.log('Disconnected!!!');
    noLoop();
    //window.location.href = window.location.href;
});

setup = () => {
    createCanvas(windowWidth, windowHeight);

    setInterval(() => {
        if (game) sendData();
    }, 1000/1); //15);
}

draw = () => {
    if (state == states.FINDING_MATCH) {
        background(0);
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text('Finding match...', width/2, height/2);
    } else if (state == states.INGAME) {
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
    game.show(10, 10, 425, 850, false, true, true, true, true);
}

function sendData() {
    socket.emit('inputs', game.getInputs());
}
});
