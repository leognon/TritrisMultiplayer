const p5 = require('p5');
const io = require('socket.io-client');
new p5(() => {

const socket = io({
    reconnection: false //Do not try to reconnect automatically
});

let prevData = {};
let data = {};
let myId;

socket.on('id', id => {
    myId = id;
});
socket.on('data', d => {
    prevData = data;
    data = d;
});
socket.on('disconnect', () => {
    window.location.href = window.location.href;
});

setup = () => {
    createCanvas(windowWidth, windowHeight);
    textSize(20);

    setInterval(() => {
        sendData();
    }, 1000/15);
}

draw = () => {
    background(0, 255,0);
    fill(0);
    ellipse(mouseX, mouseY, 50, 50);

    if (!prevData || !prevData.players) prevData = data;
    for (const id in data.players) {
        if (id == myId) continue;
        const prevPos = prevData.players[id];
        const currPos = data.players[id];
        let lerpPercent = (Date.now() - data.time) / (data.time - prevData.time);
        const interpolatedPos = {
            x: lerpPercent*currPos.x + (1-lerpPercent)*prevPos.x,
            y: lerpPercent*currPos.y + (1-lerpPercent)*prevPos.y,
        }
        fill(255,0,0);
        //ellipse(currPos.x, currPos.y, 25, 25);
        ellipse(interpolatedPos.x, interpolatedPos.y, 15, 15);
        fill(255);
        text(id.slice(0, 5), interpolatedPos.x, interpolatedPos.y-20);
    }

}

function sendData() {
    const myData = {
        x: mouseX,
        y: mouseY
    }
    socket.emit('myPos', myData);
}
});
