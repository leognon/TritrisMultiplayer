import ReactDOM from 'react-dom';
import React from 'react';
import Sketch from 'react-p5';

import io from 'socket.io-client';
import states from '../../common/states.js';
import Loading from './loading.js';
import Background from './background.js';
import Menu from './menu.js';
import ClientRoom from '../clientRoom.js';
import COMMON_CONFIG from '../../common/config.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            state: states.LOADING,
            name: 'player' + Math.floor(Math.random()*99+1),
            roomData: {
                roomCode: '',
                ownerId: '',
                originalUsers: []
            },
            background: {
                triangles: [],
                nextSpawn: Date.now()
            }
        }

        this.socket = io({
            reconnection: false //Do not try to reconnect automatically
        });

        this.socket.on('msg', this.gotMessage);
        //this.socket.on('gameState', gotGameState);
        //this.socket.on('matchOver', () => { });
        this.socket.on('joinedRoom', this.joinedRoom);
        this.socket.on('leftRoom', this.leaveRoom);
        this.socket.on('disconnect', () => {
            console.log('Disconnected!!!');
            /*this.setState({
                state: -1
            });*/
        });

        this.pieceImages = null;

        this.sounds = {
            move: new Sound('../client/assets/move.wav'),
            fall: new Sound('../client/assets/fall.wav'),
            clear: new Sound('../client/assets/clear.wav'),
            tritris: new Sound('../client/assets/tritris.wav'),
            levelup: new Sound('../client/assets/levelup.wav'),
            topout: new Sound('../client/assets/topout.wav')
        };
    }

    setup = (p5, canvasParentRef) => {
        p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
        p5.background(100);
        p5.loadImage('../client/assets/piecesImage.png', img => {
            this.pieceImages = loadPieces(img);
            this.setState({ state: states.MENU });
        });
        p5.loadFont('../client/assets/fff-forward.ttf', fnt => {
            this.font = fnt;
        });
        p5.noLoop();
    }

    nameChanged = evnt => {
        let name = evnt.target.value;
        if (name.length > COMMON_CONFIG.MAX_NAME_LENGTH)
            name = name.slice(0, COMMON_CONFIG.MAX_NAME_LENGTH);
        this.setState({ name });
    }


    quickPlay = () => {
        /*this.socket.emit('joinMatch', {
            name: dom.name.value()
        });
        state = states.FINDING_MATCH;*/
    }

    gotMessage = data => {
        alert(data.msg);
    }

    createRoom = () => {
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

    joinedRoom = data => {
        this.setState({
            state: states.ROOM,
            roomData: {
                roomCode: data.code,
                ownerId: data.ownerId,
                originalUsers: data.users
            }
        });
    }

    leaveRoom = () => {
        this.setState({
            state: states.MENU
        });
    }

    render = () => {
        switch (this.state.state) {
            case states.LOADING:
                return (
                    <div className="main">
                        <Sketch setup={this.setup} windowResized={this.windowResized} />
                        <Loading />
                    </div>);
            case states.MENU:
                return (
                    <div className="main">
                        <Background pieceImages={this.pieceImages} />
                        <Menu quickPlay={this.quickPlay}
                            createRoom={this.createRoom}
                            joinRoom={this.joinRoom}
                            quickPlay={this.quickPlay}
                            name={this.state.name}
                            nameChanged={this.nameChanged} />
                    </div>);
            case states.ROOM:
                return (
                    <div className="main">
                        <ClientRoom
                            roomCode={this.state.roomData.roomCode}
                            ownerId={this.state.roomData.ownerId}
                            originalUsers={this.state.roomData.originalUsers}
                            socket={this.socket}
                            pieceImages={this.pieceImages}
                            sounds={this.sounds}
                            font={this.font}
                        />
                    </div>);
            default:
                return '';
        }
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

        document.querySelector('#sound').appendChild(this.sound);
    }

    setVolume(vol) {
        this.sound.volume = vol;
    }

    play() {
        this.sound.play();
    }
}

ReactDOM.render(<App />, document.querySelector('#root'));
