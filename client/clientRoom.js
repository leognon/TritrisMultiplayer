import React from 'react';
import Sketch from 'react-p5';
import Lobby from './components/lobby.js';
import config from '../common/config.js';
import states from '../common/states.js';
import MyGame from './myGame.js';
import OtherGame from './otherGame.js';

export default class ClientRoom extends React.Component {
    constructor(props) {
        super(props);
        console.log('Instantiaing room!!!');
        this.state = {
            state: states.LOBBY,
            users: this.props.originalUsers,
            ownerId: this.props.ownerId,
            roomCode: this.props.roomCode,
        }

        this.socket = this.props.socket;

        this.match = null;

        this.socket.on('room', this.gotData);
    }

    setup = (p5, canvasParentRef) => {
        console.log('setup...');
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
                return <Lobby
                    roomCode={this.state.roomCode}
                    users={this.state.users}
                    isOwner={this.state.ownerId == this.socket.id}
                    startGame={this.startGame}
                    leaveRoom={this.leaveRoom} />
            case states.INGAME:
                return <Sketch setup={this.setup} draw={this.draw} windowResized={this.windowResized}/>
            default:
                console.log('No state for clientRoom', this.state.state);
                return null;
        }
    }

    componentWillUnmount = () => {
        console.log('Removed room listener for room ' + this.state.roomCode);
        this.socket.removeListener('room');
    }

    addUser = (id, name) => {
        console.log('Player ' + id +  ' joined');
        const newUser = { id, name };
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
        });
    }

    matchStarted = (seed, level) => {
        let me;
        let others = [];
        for (let user of this.state.users) {
            if (user.id == this.socket.id) me = user;
            else others.push(user);
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

    showLobbyOwner = (p5) => {
        /*p5.background(0);
        p5.fill(255);
        p5.textSize(20);
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.text(`You made the lobby\n\nCode: ${this.roomCode}`, p5.width/2, p5.height/2);
        for (let i = 0; i < this.state.state.users.length; i++) {
            p5.text('Player ' + this.state.state.users[i].name, p5.width/2, p5.height/2 + 100 + i*30);
        }*/
    }

    showLobby = (p5) => {
        /*p5.background(0);
        p5.fill(255);
        p5.textSize(20);
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.text(`You joined the lobby\n\nCode: ${this.roomCode}`, p5.width/2, p5.height/2);
        for (let i = 0; i < this.state.users.length; i++) {
            p5.text('Player ' + this.state.users[i].name, p5.width/2, p5.height/2 + 100 + i*30);
        }*/
    }

    showGame = (p5, pieceImages, sounds) => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.show(p5, pieceImages, sounds);
        }
    }

    gotData = (data) => {
        switch (data.type) {
            case 'matchStarted':
                this.matchStarted(data.seed, data.level);
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
        }
    }

    gotGameState = (d) => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.gotGameState(d);
        }
    }
}

class ClientMatch {
    constructor(level, seed, me, others) {
        this.seed = seed;
        this.level = level;

        this.myId = me.id;
        this.myGame = new MyGame(this.seed, this.level, me.name);
        this.otherPlayers = [];
        for (let other of others) {
            this.otherPlayers.push(new OtherPlayer(other.id, other.name, this.seed, this.level));
        }

        this.nextSendData = Date.now();
    }

    addPlayer(p) {
        this.players.push(new OtherPlayer(p.id, p.name, this.seed, this.level));
    }

    update(p5, socket) {
        if (Date.now() > this.nextSendData) {
            this.sendData(socket);
            this.nextSendData = Date.now() + config.CLIENT_SEND_DATA;
        }

        this.myGame.clientUpdate(p5);
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

        this.myGame.gotGameState(myData);
        for (let other of this.otherPlayers) {
            const otherData = games[other.id];
            other.gotGameState(otherData);
        }
    }

    show(p5, pieceImages, sounds) {
        if (this.myGame.duringCountDown() || Date.now()-300 < this.myGame.startTime) { //TODO Make this all better by making the redraw system use p5 graphics
            p5.background(100);
        }
        if (this.myGame.isFlashing()) {
            p5.background(150);
        } else {
            p5.background(100);
        }
        let boardWidth = p5.width/4;
        let boardHeight = boardWidth*2;
        if (boardHeight > p5.height * 0.9) {
            boardHeight = p5.height * 0.9;
            boardWidth = boardHeight / 2;
        }
        const gameWidth = boardWidth + 5*(boardWidth / this.myGame.w) + 20;
        const center = p5.width/2;
        const spacing = 30;

        this.myGame.show(p5, center-gameWidth-spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        this.otherPlayers[0].game.show(p5, center+spacing/2, 10, boardWidth, boardHeight, pieceImages, true, true, true);
        //TODO Display multiple other players!

        this.myGame.playSounds(sounds);

        if (this.myGame.duringCountDown()) {
            p5.textSize(50);
            p5.fill(255);
            p5.noStroke();
            p5.textAlign(p5.CENTER, p5.CENTER);
            const secondsRemaining = 1 + Math.floor(-this.myGame.time / 1000);
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

    //gotGameState
    //sendData
}
