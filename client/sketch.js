const p5 = require('p5');
const io = require('socket.io-client');
const states = require('../common/states.js');
const config = require('../common/config.js');
const MyGame = require('../client/myGame.js');
const OtherGame = require('../client/otherGame.js');

new p5(() => {
let socket;

let state = states.FINDING_MATCH;
let game;
let otherGame;

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
        }
    });
    socket.on('data', d => {
        //game.gotData(d);
        setTimeout(() => {
            const games = d.players;
            const myData = games[socket.id];
            let otherData;
            for (let id in games) {
                if (id != socket.id) {
                    otherData = games[id];
                    break;
                }
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
    createSocket();
}

draw = () => {
    background(100);
    if (state == states.FINDING_MATCH) {
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
    showGame(game, 10, 10);
    showGame(otherGame, 550, 10);
}

function showGame(g, x, y) {
    g.redraw = true;
    g.show(x, y, 300, 300*2, false, true, true, true, true);
}

function sendData() {
    socket.emit('inputs', game.getInputs());
}


});
