import ReactDOM from 'react-dom';
import React from 'react';
import Sketch from 'react-p5';

import io from 'socket.io-client';
import states from '../../common/states.js';
import Loading from './loading.js';
import Menu from './menu.js';
import ClientRoom from '../clientRoom.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            state: states.LOADING,
            name: 'yourname'
        }

        this.socket = io({
            reconnection: false //Do not try to reconnect automatically
        });

        this.socket.on('state', this.gotState);
        //this.socket.on('gameState', gotGameState);
        this.socket.on('matchOver', () => {
            /*game = null;
            otherGame = null;
            state = states.MENU;
            dom.joinDiv.style('visibility: visible;');*/
        });
        this.socket.on('room', this.gotRoomData);
        this.socket.on('disconnect', () => {
            console.log('Disconnected!!!');
            //noLoop();
            //window.location.href = window.location.href;
        });

        this.pieceImages = null;
        this.sounds = {};

        this.room = null;

        this.sounds.move = new Sound('../client/assets/move.wav');
        this.sounds.fall = new Sound('../client/assets/fall.wav');
        this.sounds.clear = new Sound('../client/assets/clear.wav');
        this.sounds.tritris = new Sound('../client/assets/tritris.wav');
        this.sounds.levelup = new Sound('../client/assets/levelup.wav');
        this.sounds.topout = new Sound('../client/assets/topout.wav');
    }

    loadedSpriteSheet = (img) => {
        this.pieceImages = loadPieces(img);
        this.setState({ state: states.MENU });
        console.log('done');
    }

    setup = (p5, canvasParentRef) => {
        p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
        console.log('Setup');
        p5.loadImage('../client/assets/piecesImage.png', this.loadedSpriteSheet);
        p5.loadFont('../client/assets/fff-forward.ttf', fnt => {
            p5.textFont(fnt);
        });
    }

    nameChanged = evnt => {
        this.setState({
            name: evnt.target.value
        });
    }

    draw = (p5) => {
        if (this.state.state != states.ROOM) {
            p5.background(
                100 + 155*p5.noise(p5.frameCount/50, 0),
                100 + 155*p5.noise(p5.frameCount/30, 20),
                100 + 155*p5.noise(p5.frameCount/100, 30));
        } else {
            this.room.run(p5, this.socket, this.pieceImages, this.sounds);
        }
    }

    joinGame = () => {
        /*this.socket.emit('joinMatch', {
            name: dom.name.value()
        });
        state = states.FINDING_MATCH;*/
    }

    gotState = (data) => {
        this.setState({ state: data.state });
        if (data.hasOwnProperty('message')) {
            alert(data.message);
        }

        if (this.state.state == states.MENU) {
            //dom.joinDiv.style('visibility: visible;');
            //room = null;
        }
    }

    createRoom = () => {
        console.log('Create');
        this.socket.emit('room', {
            type: 'create',
            name: this.state.name
        });
        //TODO Add loading state for after creating room
    }

    joinRoom = () => {
        const code = prompt('Please enter the room code to join.');
        this.socket.emit('room', {
            type: 'join',
            name: this.state.name,
            code
        });
        //TODO Add loading state
    }

    keyPressed = evnt => {
        if (this.state.state == states.ROOM && this.room && this.socket.id == this.room.ownerId && evnt.keyCode == 32) {
            this.socket.emit('room', {
                type: 'start',
            });
        }
    }

    gotRoomData = (data) => {
        switch (data.type) {
            case 'created': //You just created a lobby
                console.log('Created lobby', data);
                this.room = new ClientRoom(data.code, data.owner.id, this.socket.id);
                this.room.addUser(data.owner.id, data.owner.name); //Add the owner
                this.setState({ state: states.ROOM });
                break;
            case 'joined': //You just joined a lobby
                console.log('Joined lobby');
                this.room = new ClientRoom(data.code, data.ownerId, this.socket.id);
                for (let p of data.players) { //Add all of the already joined players
                    this.room.addUser(p.id, p.name);
                }
                this.setState({ state: states.ROOM });
                break;
            default:
                if (this.room) this.room.gotData(data);
                break;
        }
    }

    getUI = () => {
        switch (this.state.state) {
            case states.LOADING:
                return <Loading />;
            case states.MENU:
                return <Menu quickPlay={this.quickPlay}
                    createRoom={this.createRoom}
                    joinRoom={this.joinRoom}
                    name={this.state.name}
                    nameChanged={this.nameChanged}
                    />;
            case states.ROOM:
                //p5 will take care of everything
                break;
            default:
                console.log('State was ' + this.state.state);
                return <h2 className="center box">State: {this.state.state}</h2>;
        }
    }

    render = () => {
        return (
            <>
                <Sketch setup={this.setup} draw={this.draw} keyPressed={this.keyPressed} windowResized={this.windowResized} />
                { this.getUI() }
            </>
        );
    }

    windowResized = (p5) => {
        p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
        p5.redraw();
    }
}

function loadPieces(spriteSheet) {
    let pieceImages = []; //A 2d array of each piece color and their rotations
    for (let i = 0; i < 2; i++) { //All of the colors (except white)
        for (let j = 0; j < 3; j++) {
            pieceImages.push(load4Triangles(i, j, spriteSheet));
        }
    }
    pieceImages.push(load4Triangles(0, 3, spriteSheet)); //The white ninja

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

ReactDOM.render(<App />, document.querySelector('#root'));
/*
App
    Loading
        Text in center saying loading
    Home
        Box in center
            Title
            Name input
            Play buttons
    Room
        Lobby
            Box in center
                Room code
                List of players
        Ingame
            Empty
*/
