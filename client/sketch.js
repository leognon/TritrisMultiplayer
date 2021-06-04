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
        if (state == states.INGAME) { //TODO Don't wait for server to start game. Make sure to start ahead of server
            game = new ClientGame();
            nextSendData = Date.now() + sendDataEvery;
        }
    });
    socket.on('data', d => {
        //game.gotData(d);
        setTimeout(() => {
            game.gotData(d);
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
    showConsole();
}

let cLog = "";
const origConsoleLog = console.log;
console.log = (a, b, c, d) => {
    let str = a + (b ? (', ' + JSON.stringify(b)) : '') + (c ? (', ' + JSON.stringify(c)) : '') + '\n';
    if (d) str += 'TOO MANY ARGS!!' + '\n';
    origConsoleLog(str);
    cLog += str;
}

function showConsole() {
    const fontSize = 12;
    textSize(fontSize);
    const numLines = cLog.split('\n').length;
    const height = numLines * (fontSize + 3);
    text(cLog, 930, 920 - height);
}

function runGame() {
    game.clientUpdate();
    for (const inp of game.inputsQueue) {
        const tempInp = inp;
        setTimeout(() => {
            //console.log('Send input id: ' + tempInp.id);
            socket.emit('inputs', tempInp);
        }, config.FAKE_LATENCY);
    }
    game.inputsQueue = [];
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
