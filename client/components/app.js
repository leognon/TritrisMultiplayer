import ReactDOM from 'react-dom';
import React from 'react';
import { p5, p5States } from '../sketch.js';

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
            name: localStorage.hasOwnProperty('name') ? localStorage.getItem('name') : ('player' + Math.floor(Math.random()*99+1)),
            controls: this.loadControls(),
            soundVolume: localStorage.hasOwnProperty('soundVolume') ? parseInt(localStorage.getItem('soundVolume')) : 75,
            musicVolume: localStorage.hasOwnProperty('musicVolume') ? parseInt(localStorage.getItem('musicVolume')) : 0,
            roomData: {
                roomCode: '',
                ownerId: '',
                originalUsers: []
            },
            visualSettings: this.loadVisualSettings(),
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
        p5.socket = this.socket;
        this.socket.userId = '';

        this.socket.on('auth', ({ sessionId, userId }) => {
            console.log('Auth as ' + userId);
            this.socket.userId = userId;
            auth.sessionId = sessionId;

            if (this.state.state === states.LOADING) { //Make sure to not go back to menu
                //this.assetLoaded();
            } else {
                alert('It seems you have been disconnected for too long. Please refresh the page.');
                this.socket.outOfSync = true;
                //The server thinks it has a different session than what the client thinks
            }
            //localStorage.setItem('sessionId', sessionId);
        });
        this.socket.on('reAuth', ({ sessionId, userId }) => {
            console.log('Reauth as ' + userId);
            if (this.socket.userId !== userId) {
                console.log('New auth!');
            }
            this.socket.userId = userId;
            auth.sessionId = sessionId;

            if (this.state.state === states.LOADING) { //Make sure to not go back to menu
                //this.assetLoaded();
            }
            //localStorage.setItem('sessionId', sessionId);
        });

        this.socket.latency = '0';
        setInterval(() => {
            const start = Date.now();
            this.socket.volatile.emit('ping', () => { // volatile, so the packet will be discarded if the socket is not connected
                this.socket.latency = Math.round((Date.now() - start) / 2);
            });
        }, 5000);

        window.onbeforeunload = () => {
            this.socket.emit('leftPage');
        }

        this.socket.on('msg', this.gotMessage);
        this.socket.on('joinedRoom', this.joinedRoom);
        this.socket.on('leftRoom', this.leaveRoom);

        p5.setSoundVolume(this.state.soundVolume); //Make sure to set it initially
        p5.setMusicVolume(this.state.musicVolume);

        this.checkLoadedInterval = setInterval(this.checkLoaded, 300);
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
            hardDrop: {
                key: 32, //Space
                controlName: "Hard Drop (versus mode)"
            },
            start: {
                key: 13, //Enter
                controlName: "Start / Exit Game"
            },
            restart: {
                key: 27,
                controlName: "Quick Restart (Single-player only)"
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

    setSoundVolume = evnt => {
        let vol = parseInt(evnt.target.value);

        if (vol <= 3) vol = 0; //It doesn't have to be exactly 0 to be muted
        p5.setSoundVolume(vol);

        this.setState({
            soundVolume: evnt.target.value
        }, () => {
            localStorage.setItem('soundVolume', this.state.soundVolume);
        });
    }

    setMusicVolume = evnt => {
        let vol = parseInt(evnt.target.value);

        if (vol <= 3) vol = 0; //It doesn't have to be exactly 0 to be muted
        p5.setMusicVolume(vol);

        this.setState({
            musicVolume: evnt.target.value
        }, () => {
            localStorage.setItem('musicVolume', this.state.musicVolume);
        });
    }

    visualSettingsChanged = (evnt, setting) => {
        const newSettings = { ...this.state.visualSettings };
        newSettings[setting] = evnt.target.checked;
        this.setState({ visualSettings: newSettings }, this.saveVisualSettings);
    }

    loadVisualSettings = () => {
        let mySettings = {
            showGhost: true,
            showGridLines: true
        }
        if (localStorage.hasOwnProperty('visualSettings')) {
            const loaded = JSON.parse(localStorage.getItem('visualSettings'));
            for (const setting in loaded) {
                mySettings[setting] = loaded[setting];
            }
        }
        return mySettings;
    }

    saveVisualSettings = () => {
        window.localStorage.setItem('visualSettings', JSON.stringify(this.state.visualSettings));
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
        if (code && code.length === 0) {
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
                p5.setStateIfDifferent(p5States.LOADING, () => {
                    p5.background(100);
                });
                return (
                    <div className="main">
                        <Loading />
                    </div>);
            case states.MENU:
                p5.setStateIfDifferent(p5States.BACKGROUND, new Background().draw);
                return (
                    <div className="main">
                        <Menu quickPlay={this.quickPlay}
                            createRoom={this.createRoom}
                            joinRoom={this.joinRoom}
                            quickPlay={this.quickPlay}
                            name={this.state.name}
                            nameChanged={this.nameChanged}
                            controls={this.state.controls}
                            controlChanged={this.controlChanged}
                            resetControls={this.resetControls}
                            soundVolume={this.state.soundVolume}
                            setSoundVolume={this.setSoundVolume}
                            musicVolume={this.state.musicVolume}
                            setMusicVolume={this.setMusicVolume}

                            visualSettings={this.state.visualSettings}
                            visualSettingsChanged={this.visualSettingsChanged}
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
                            font={this.font}
                            controls={this.state.controls}

                            controlChanged={this.controlChanged}
                            resetControls={this.resetControls}
                            soundVolume={this.state.soundVolume}
                            setSoundVolume={this.setSoundVolume}
                            musicVolume={this.state.musicVolume}
                            setMusicVolume={this.setMusicVolume}

                            visualSettings={this.state.visualSettings}
                            visualSettingsChanged={this.visualSettingsChanged}
                        />
                    </div>);
            default:
                return '';
        }
    }

    checkLoaded = () => {
        if (p5.numAssetsLoaded >= p5.totalAssets && this.state.state == states.LOADING) {
            clearInterval(this.checkLoadedInterval);
            this.setState({
                state: states.MENU
            });
        }
    }
}

ReactDOM.render(<App />, document.querySelector('#root'));
