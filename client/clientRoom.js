import React from 'react';
import Sketch from 'react-p5';
import Lobby from './components/lobby.js';
import LobbySettings from './components/lobbySettings.js';
import Background from './components/background.js';
import COMMON_CONFIG from '../common/config.js';
import states from '../common/states.js';
import MyGame from './myGame.js';
import OtherGame from './otherGame.js';

export default class ClientRoom extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            state: states.LOBBY,
            users: this.props.originalUsers.map(u => new User(u.name, u.id, u.isSpectator)),
            ownerId: this.props.ownerId,
            roomCode: this.props.roomCode,
            startLevel: 0
        }

        this.socket = this.props.socket;

        this.match = null;

        this.socket.on('room', this.gotData);
    }

    setup = (p5, canvasParentRef) => {
        p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
        p5.textFont(this.props.font);
    }
    windowResized = p5 => {
        p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
        p5.redraw();
    }

    draw = p5 => {
        //Do everything necessary (update, show)
        if (this.state.state == states.INGAME) {
            this.update(p5);
            this.showGame(p5, this.props.pieceImages, this.props.sounds);
        }
    }

    render = () => {
        switch (this.state.state) {
            case states.LOBBY:
                return <>
                    <Lobby
                    roomCode={this.state.roomCode}
                    users={this.state.users}
                    myId={this.socket.id}
                    ownerId={this.state.ownerId}
                    toggleSpectator={this.changeSpectator}
                    startGame={this.startGame}
                    leaveRoom={this.leaveRoom} />

                    { this.state.ownerId == this.socket.id ?
                        <LobbySettings
                            startGame={this.startGame}
                            startLevel={this.state.startLevel}
                            startLevelChanged={this.startLevelChanged}
                        />
                    : ''
                    }

                    <Background pieceImages={this.props.pieceImages}/>
                </>
            case states.INGAME:
                return <Sketch setup={this.setup} draw={this.draw} windowResized={this.windowResized}/>
            default:
                console.log('No state for clientRoom', this.state.state);
                return null;
        }
    }

    componentWillUnmount = () => {
        this.socket.removeListener('room');
    }

    addUser = (id, name) => {
        const newUser = new User(name, id, false);
        this.setState({
            users: [...this.state.users, newUser]
        });
    }

    removeUser = (id) => {
        //Make a new list without the user that left
        let newUsers = this.state.users.filter(u => u.id != id);
        this.setState({
            users: newUsers
        });
    }

    leaveRoom = () => {
        this.socket.emit('room', {
            type: 'leave'
        });
    }

    startGame = () => {
        this.socket.emit('room', {
            type: 'start',
            settings: {
                startLevel: this.state.startLevel
            }
        });
    }

    changeSpectator = id => {
        if (this.socket.id == this.state.ownerId) {
            this.socket.emit('room', {
                type: 'changeSpectator',
                isSpectator: !this.state.users.filter(u => u.id == id)[0].isSpectator,
                id
            });
        }
    }

    startLevelChanged = evnt => {
        try {
            let lvl = parseInt(evnt.target.value);
            if (isNaN(lvl)) lvl = '';
            lvl = Math.min(29, Math.max(0, lvl));
            lvl = lvl.toString();
            this.setState({
                startLevel: lvl
            });
        } catch (e) {
            //They entered something wrong (like the letter e. Exponentials aren't necessary)
        }
    }

    spectatorChanged = (id, isSpectator) => {
        const newUsers = [...this.state.users];
        for (let i = 0; i < newUsers.length; i++) {
            if (newUsers[i].id == id) {
                newUsers[i] = new User(newUsers[i].name, newUsers[i].id, isSpectator);
            }
        }
        this.setState({ users: newUsers });
    }

    matchStarted = (playerIds, seed, level) => {
        let me = null;
        let others = [];
        for (let id of playerIds) {
            if (id == this.socket.id) me = this.getUserById(id);
            else others.push(this.getUserById(id));
        }

        this.match = new ClientMatch(level, seed, me, others);

        this.setState({ state: states.INGAME });
    }

    endMatch = () => {
        this.match = null;

        this.setState({ state: states.LOBBY });
    }

    //Update the current game
    update = p5 => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.update(p5, this.socket);
        }
    }

    showGame = (p5, pieceImages, sounds) => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.show(p5, pieceImages, sounds);
        }
    }

    gotData = data => {
        switch (data.type) {
            case 'matchStarted':
                this.matchStarted(data.playerIds, data.seed, data.level);
                break;
            case 'endMatch':
                this.endMatch();
                break;
            case 'playerJoined':
                this.addUser(data.id, data.name);
                break;
            case 'playerLeft':
                this.removeUser(data.id);
                break;
            case 'gotGameState':
                this.gotGameState(data.data);
                break;
            case 'newOwner':
                this.setState({
                    ownerId: data.id
                });
                break;
            case 'spectatorChanged':
                this.spectatorChanged(data.id, data.isSpectator);
                break;
        }
    }

    gotGameState = d => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.gotGameState(d);
        }
    }

    getUserById = id => {
        for (let u of this.state.users) {
            if (u.id == id) return u;
        }
        return null;
    }
}

class User {
    constructor(name, id, isSpectator) {
        this.name = name;
        this.id = id;
        this.isSpectator = isSpectator;
    }
}

class ClientMatch {
    constructor(level, seed, me, others) {
        this.seed = seed;
        this.level = level;

        if (me === null) this.myId = null;
        else this.myId = me.id;

        if (me !== null) this.myGame = new MyGame(this.seed, this.level, me.name);
        else this.myGame = null;

        this.otherPlayers = [];
        for (let other of others) {
            this.otherPlayers.push(new OtherPlayer(other.id, other.name, this.seed, this.level));
        }

        this.nextSendData = Date.now();
    }

    update(p5, socket) {
        if (this.myGame !== null && Date.now() > this.nextSendData) {
            this.sendData(socket);
            this.nextSendData = Date.now() + COMMON_CONFIG.CLIENT_SEND_DATA;
        }

        if (this.myGame !== null) this.myGame.clientUpdate(p5);
        for (let other of this.otherPlayers) {
            other.interpolateUpdate();
        }
    }

    sendData(socket) {
        const inps = this.myGame.getInputs();
        if (inps.length > 0) {
            socket.emit('room', {
                type: 'inputs',
                inps
            });
        }
    }

    gotGameState(d) {
        const games = d.players;
        const myData = d.yourData;

        if (myData !== null) this.myGame.gotGameState(myData);
        for (let other of this.otherPlayers) {
            const otherData = games[other.id];
            other.gotGameState(otherData);
        }
    }

    show(p5, pieceImages, sounds) {
        let gamesToDisplay = [];
        if (this.myGame !== null) gamesToDisplay.push(this.myGame);
        gamesToDisplay.push(...this.otherPlayers.map(p => p.game));

        if (gamesToDisplay[0].isFlashing()) p5.background(150);
        else p5.background(100);

        let boardWidth = p5.width/4;
        let boardHeight = boardWidth*2;
        if (boardHeight > p5.height * 0.9) {
            boardHeight = p5.height * 0.9;
            boardWidth = boardHeight / 2;
        }
        const gameWidth = boardWidth + 5*(boardWidth / gamesToDisplay[0].w) + 20;
        const center = p5.width/2;
        const spacing = 30;

        gamesToDisplay[0].show(p5, center-gameWidth-spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        gamesToDisplay[1].show(p5, center+spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        //TODO Display multiple other players!

        gamesToDisplay[0].playSounds(sounds);

        if (gamesToDisplay[0].duringCountDown()) {
            p5.textSize(50);
            p5.fill(255);
            p5.noStroke();
            p5.textAlign(p5.CENTER, p5.CENTER);
            const secondsRemaining = 1 + Math.floor(-gamesToDisplay[0].time / 1000);
            p5.text(secondsRemaining, center - gameWidth - spacing/2 + boardWidth/2, 10+boardHeight/2);
        }
    }
}

class OtherPlayer {
    constructor(id, name, seed, level) {
        this.id = id;
        this.name = name;

        this.game = new OtherGame(seed, level, this.name);
    }

    interpolateUpdate() {
        this.game.interpolateUpdate();
    }

    gotGameState(d) {
        this.game.gotGameState(d);
    }
}
