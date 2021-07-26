import React from 'react';
import Lobby from './components/lobby.js';
import config from '../common/config.js';
import states from '../common/states.js';
import MyGame from './myGame.js';
import OtherGame from './otherGame.js';

export default class ClientRoom extends React.Component {
    constructor(props) { //roomCode, ownerId, myId) {
        super(props);
        console.log('Instantiaing room!!!');
        this.state = {
            state: states.LOBBY,
            users: this.props.originalUsers
        }

        //this.ownerId = this.props.ownerId;

        this.match = null;

        this.props.socket.on('room', this.gotData);

        //TODO I should probably move the p5 sketch into this or make another component
        setInterval(() => {
            this.run(this.props.p5, this.props.socket, this.props.pieceImages, this.props.sounds);
        }, 17);
    }

    render = () => {
        switch (this.state.state) {
            case states.LOBBY:
                return <Lobby
                    roomCode={this.props.roomCode}
                    users={this.state.users}
                    isOwner={this.props.ownerId == this.props.socket.id}
                    startGame={this.startGame} />
            case states.INGAME:
                return null;
            default:
                console.log('No state for clientRoom', this.state.state);
                return null;
        }
    }

    addUser = (id, name) => {
        console.log('Player ' + id +  ' joined');
        const newUser = { id, name };
        this.setState({
            users: [...this.state.users, newUser]
        });
    }

    disconnected = (id) => {
        //Make a new list without the user that left
        let newUsers = this.state.users.filter(u => u.id != id);
        this.setState({
            users: newUsers
        });
    }

    startGame = () => {
        this.props.socket.emit('room', {
            type: 'start',
        });
    }

    matchStarted = (seed, level) => {
        let me;
        let others = [];
        for (let user of this.state.users) {
            if (user.id == this.props.socket.id) me = user;
            else others.push(user);
        }

        this.match = new ClientMatch(level, seed, me, others);

        this.setState({ state: states.INGAME });
    }

    endMatch = () => {
        this.match = null;

        this.setState({ state: states.LOBBY });
    }

    //Do everything necessary (update, show)
    run = (p5, socket, pieceImages, sounds) => {
        if (this.state.state == states.INGAME) {
            this.update(p5, socket);
            this.showGame(p5, pieceImages, sounds);
        } else if (this.props.ownerId == this.props.socket.id) {
            this.showLobbyOwner(p5);
        } else {
            this.showLobby(p5);
        }
    }

    //Update the current game
    update = (p5, socket) => {
        if (this.state.state == states.INGAME && this.match) {
            this.match.update(p5, socket);
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
            case 'playerDisconnected':
                this.disconnected(data.id);
                break;
            case 'gotGameState':
                this.gotGameState(data.data);
                break;
            case 'newOwner':
                //TODO OWNER NEEDS TO BE IN STATE????
                this.ownerId = data.id;
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
