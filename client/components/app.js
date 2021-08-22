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

        this.totalAssets = 3; //pieceImages, font and auth

        this.state = {
            state: states.LOADING,
            assetsLoaded: 0,
            name: localStorage.hasOwnProperty('name') ? localStorage.getItem('name') : ('player' + Math.floor(Math.random()*99+1)),
            controls: this.loadControls(),
            volume: localStorage.hasOwnProperty('volume') ? parseInt(localStorage.getItem('volume')) : 75,
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

        let auth = {};
        //if (localStorage.hasOwnProperty('sessionId')) {
            //auth.sessionId = localStorage.getItem('sessionId');
        //}
        this.socket = io({
            auth,
            reconnection: true,
            closeOnBeforeunload: false
        });
        this.socket.userId = '';

        this.socket.on('auth', ({ sessionId, userId }) => {
            this.socket.userId = userId;
            auth.sessionId = sessionId;

            if (this.state.state === states.LOADING) //Make sure to not go back to menu
                this.assetLoaded();
            //localStorage.setItem('sessionId', sessionId);
        });
        this.socket.on('reAuth', ({ sessionId, userId }) => {
            this.socket.userId = userId;
            auth.sessionId = sessionId;

            if (this.state.state === states.LOADING) //Make sure to not go back to menu
                this.assetLoaded();
            //localStorage.setItem('sessionId', sessionId);
        });

        window.onbeforeunload = () => {
            this.socket.emit('leftPage');
        }

        this.socket.on('msg', this.gotMessage);
        this.socket.on('joinedRoom', this.joinedRoom);
        this.socket.on('leftRoom', this.leaveRoom);
        this.socket.on('disconnect', () => {
            //TODO Add disconnect indicator
            console.log('Disconnected!!!');
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
        p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
        p5.background(100);
        p5.loadImage('../client/assets/piecesImage.png', img => {
            this.pieceImages = loadPieces(img);
            this.assetLoaded();
        });
        p5.loadFont('../client/assets/fff-forward.ttf', fnt => {
            this.font = fnt;
            this.assetLoaded();
        });
        p5.noLoop();
    }

    nameChanged = evnt => {
        let name = evnt.target.value;
        if (name.length > COMMON_CONFIG.MAX_NAME_LENGTH)
            name = name.slice(0, COMMON_CONFIG.MAX_NAME_LENGTH);
        this.setState({ name }, () => {
            localStorage.setItem('name', this.state.name);
        });
    }

    controlChanged = (control, newKey) => {
        let newControls = Object.assign({}, this.state.controls);
        newControls[control] = {
            controlName: this.state.controls[control].controlName,
            key: newKey
        }
        this.setState({
            controls: newControls
        }, this.saveControls);
    }

    loadControls = () => {
        let controls = this.getDefaultControls();
        if (localStorage.hasOwnProperty('controls')) {
            const loaded = JSON.parse(localStorage.getItem('controls'));
            for (const control in loaded) {
                controls[control].key = loaded[control].key;
            }
        }
        return controls;
    }

    getDefaultControls = () => {
        return {
            counterClock: {
                key: 90, //Z
                controlName: "Counter Clockwise"
            },
            clock: {
                key: 88, //X
                controlName: "Clock"
            },
            left: {
                key: 37, //Left arrow
                controlName: "Left"
            },
            right: {
                key: 39, //Right arrow
                controlName: "Right"
            },
            down: {
                key: 40, //Down arrow
                controlName: "Down"
            },
            start: {
                key: 13, //Enter
                controlName: "Start / End Game"
            }
        }
    }

    resetControls = () => {
        this.setState({
            controls: this.getDefaultControls()
        }, this.saveControls);
    }

    saveControls = () => {
        window.localStorage.setItem('controls', JSON.stringify(this.state.controls));
    }

    setVolume = evnt => {
        let vol = parseInt(evnt.target.value);
        if (vol <= 3) vol = 0; //It doesn't have to be exactly 0 to be muted
        for (const sound in this.sounds) {
            this.sounds[sound].setVolume(vol / 100);
        }
        this.setState({
            volume: evnt.target.value
        }, () => {
            localStorage.setItem('volume', this.state.volume);
        });
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
        if (code.length === 0) {
            alert('Please enter a room code');
        } else {
            this.socket.emit('room', {
                type: 'join',
                name: this.state.name,
                code
            });
        }
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
                            nameChanged={this.nameChanged}
                            controls={this.state.controls}
                            controlChanged={this.controlChanged}
                            resetControls={this.resetControls}
                            volume={this.state.volume}
                            setVolume={this.setVolume}
                        />
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
                            controls={this.state.controls}
                        />
                    </div>);
            default:
                return '';
        }
    }

    assetLoaded = () => {
        const newNum = this.state.assetsLoaded + 1;
        const newState = newNum >= this.totalAssets ? states.MENU : states.LOADING;
        this.setState({
            assetsLoaded: newNum,
            state: newState
        });
    }

    windowResized = (p5) => {
        p5.resizeCanvas(window.innerWidth, window.innerHeight);
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
    pieceImages.push(load4Triangles(1, 3, spriteSheet)); //The grey triangle

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
