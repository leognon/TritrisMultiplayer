import React from 'react';
import Sketch from 'react-p5';
import Lobby from './components/lobby.js';
import LobbySettings from './components/lobbySettings.js';
import Background from './components/background.js';
import COMMON_CONFIG from '../common/config.js';
import states from '../common/states.js';
import MyGame from './myGame.js';
import OtherGame from './otherGame.js';
import keyboardMap from './components/keyboardMap.js';

export default class ClientRoom extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            state: states.LOBBY,
            users: this.props.originalUsers.map(u => new User(u.name, u.id, u.isSpectator, u.isReady)),
            ownerId: this.props.ownerId,
            roomCode: this.props.roomCode,
            settings: {
                startLevel: 0,
                use4x8: false,
                quadtris: false,
                versus: true //TODO Make this false by default
            },
            roomIsLocked: false,
        }

        this.socket = this.props.socket;

        this.match = null;

        this.socket.on('room', this.gotData);
    }

    setup = (p5, canvasParentRef) => {
        p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
        p5.textFont(this.props.font);
    }
    windowResized = p5 => {
        p5.resizeCanvas(window.innerWidth, window.innerHeight);
        p5.redraw();
    }

    draw = p5 => {
        //Do everything necessary (update, show)
        this.update(p5);
        this.showGame(p5, this.props.pieceImages, this.props.sounds);
    }

    render = () => {
        switch (this.state.state) {
            case states.LOBBY:
                return <>
                    <Lobby
                        roomCode={this.state.roomCode}
                        users={this.state.users}
                        myId={this.socket.userId}
                        ownerId={this.state.ownerId}
                        toggleSpectator={this.changeSpectator}
                        changeReady={this.changeReady}
                        leaveRoom={this.leaveRoom}
                    />

                    { this.state.ownerId == this.socket.userId ?
                        <LobbySettings
                            startGame={this.startGame}
                            startKey={this.props.controls['start'].key}

                            startLevel={this.state.settings.startLevel}
                            startLevelChanged={this.startLevelChanged}

                            use4x8={this.state.settings.use4x8}
                            use4x8Changed={this.use4x8Changed}

                            quadtris={this.state.settings.quadtris}
                            quadtrisChanged={this.quadtrisChanged}

                            versus={this.state.settings.versus}
                            versusChanged={this.versusChanged}

                            toggleLockRoom={this.toggleLockRoom}
                            roomIsLocked={this.state.roomIsLocked}
                        />
                    : ''
                    }

                    <Background pieceImages={this.props.pieceImages}/>
                </>
            case states.INGAME:
            case states.GAME_OVER:
                return <Sketch
                    setup={this.setup}
                    draw={this.draw}
                    windowResized={this.windowResized}
                    keyPressed={this.keyPressed}
                />
            default:
                console.log('No state for clientRoom', this.state.state);
                return null;
        }
    }

    componentWillUnmount = () => {
        this.socket.removeListener('room');
    }

    toggleLockRoom = () => {
        this.socket.emit('room', {
            type: 'toggleLockRoom',
            lockRoom: !this.state.roomIsLocked
        });
    }

    roomLocked = roomIsLocked => {
        this.setState({ roomIsLocked });
    }

    addUser = (id, name) => {
        const newUser = new User(name, id, false, false);
        this.setState({
            users: [...this.state.users, newUser]
        });
    }

    removeUser = (id) => {
        //Make a new list without the user that left
        let newUsers = this.state.users.filter(u => u.getId() != id);
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
            settings: this.state.settings
        });
    }

    changeSpectator = id => {
        if (this.socket.userId == this.state.ownerId) {
            this.socket.emit('room', {
                type: 'changeSpectator',
                isSpectator: !this.state.users.filter(u => u.getId() == id)[0].isSpectator,
                id
            });
        }
    }

    changeReady = () => {
        this.socket.emit('room', {
            type: 'changeReady',
            isReady: !this.getUserById(this.socket.userId).isReady
        });
    }

    startLevelChanged = evnt => {
        try {
            let lvl = parseInt(evnt.target.value);
            if (isNaN(lvl)) lvl = '';
            lvl = Math.min(29, Math.max(0, lvl));
            lvl = lvl.toString();

            const newSettings = { ...this.state.settings };
            newSettings.startLevel = lvl;
            this.setState({ settings: newSettings });
        } catch (e) {
            //They entered something wrong (like the letter e. Exponentials aren't necessary)
        }
    }

    use4x8Changed = evnt => {
        const newSettings = { ...this.state.settings };
        newSettings.use4x8 = evnt.target.checked;
        this.setState({ settings: newSettings });
    }

    quadtrisChanged = evnt => {
        const newSettings = { ...this.state.settings };
        newSettings.quadtris = evnt.target.checked;
        this.setState({ settings: newSettings });
    }

    versusChanged = evnt => {
        const newSettings = { ...this.state.settings };
        newSettings.versus = evnt.target.checked;
        this.setState({ settings: newSettings });
    }

    spectatorChanged = (id, isSpectator) => {
        const newUsers = [...this.state.users];
        for (let i = 0; i < newUsers.length; i++) {
            if (newUsers[i].getId() == id) {
                newUsers[i] = new User(newUsers[i].name, newUsers[i].getId(), isSpectator, newUsers[i].isReady);
            }
        }
        this.setState({ users: newUsers });
    }

    readyChanged = (id, isReady) => {
        const newUsers = [...this.state.users];
        for (let i = 0; i < newUsers.length; i++) {
            if (newUsers[i].getId() == id) {
                newUsers[i] = new User(newUsers[i].name, newUsers[i].getId(), newUsers[i].isSpectator, isReady);
            }
        }
        this.setState({ users: newUsers });
    }


    matchStarted = (playerIds, settings) => {
        let me = null;
        let others = [];
        for (let id of playerIds) {
            if (id == this.socket.userId) me = this.getUserById(id);
            else others.push(this.getUserById(id));
        }

        this.match = new ClientMatch(me, others, settings, this.props.controls);

        this.setState({ state: states.INGAME });
    }

    matchIsOver = () => {
        //Unready everyone after a match
        const newUsers = [...this.state.users];
        for (let i = 0; i < newUsers.length; i++) {
            newUsers[i] = new User(newUsers[i].name, newUsers[i].getId(), newUsers[i].isSpectator, false);
        }

        this.setState({
            state: states.GAME_OVER,
            users: newUsers
        });
    }

    //Update the current game
    update = p5 => {
        if (this.isIngame() && this.match) {
            this.match.update(p5, this.socket);
        }
    }

    showGame = (p5, pieceImages, sounds) => {
        if (this.isIngame() && this.match) {
            this.match.show(p5, pieceImages, sounds);
        }
        if (this.state.state == states.GAME_OVER) {
            const scale = p5.width * p5.height / (1920 * 1000);
            p5.fill(0);
            p5.textSize(35 * scale);
            const key = this.props.controls['start'].key;
            const name = keyboardMap[key];
            p5.textAlign(p5.RIGHT, p5.BOTTOM);
            p5.text(`Press [${name}] to continue.`, p5.width - 10*scale, p5.height - 10*scale);
        }
    }

    keyPressed = p5 => {
        const startKey = this.props.controls['start'].key;
        if (this.state.state == states.GAME_OVER && p5.keyCode == startKey) { //If enter is pressed
            this.match = null;
            this.setState({
                state: states.LOBBY
            });
        }
    }

    gotData = data => {
        switch (data.type) {
            case 'matchStarted':
                this.matchStarted(data.playerIds, data.settings);
                break;
            case 'matchIsOver':
                this.matchIsOver();
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
            case 'readyChanged':
                this.readyChanged(data.id, data.isReady);
                break;
            case 'roomLocked':
                this.roomLocked(data.roomIsLocked);
                break;
        }
    }

    isIngame = () => {
        return this.state.state == states.INGAME || this.state.state == states.GAME_OVER;
    }

    gotGameState = d => {
        if (this.isIngame() && this.match) {
            this.match.gotGameState(d);
        }
    }

    getUserById = id => {
        for (let u of this.state.users) {
            if (u.getId() == id) return u;
        }
        return null;
    }
}

class User {
    constructor(name, id, isSpectator, isReady) {
        this.name = name;
        this.userId = id;
        this.isReady = isReady;
        this.isSpectator = isSpectator;
    }

    getId() {
        return this.userId;
    }
}

class ClientMatch {
    constructor(me, others, settings, myControls) {
        if (me === null) this.myId = null;
        else this.myId = me.getId();

        if (me !== null) this.myGame = new MyGame(me.name, myControls, settings);
        else this.myGame = null;

        this.otherPlayers = [];
        for (let other of others) {
            this.otherPlayers.push(new OtherPlayer(other.getId(), other.name, settings));
        }

        this.nextSendData = Date.now();

        this.currentOrder = [];
        this.lastShowOrderChange = -1;
        this.minChangeOrderTime = 10 * 1000; //It can only change every 10 seconds to stop flickering
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
            const otherData = games[other.getId()];
            other.gotGameState(otherData);
        }
    }

    show(p5, pieceImages, sounds) {
        const allOtherGames = this.otherPlayers.map(p => p.game);
        const desIndexes = allOtherGames.map((g, i) => {
            return { //This convuluted mess is done in order to preserve the original index when sorting
                score: g.score,
                index: i
            }
        }).sort((a, b) => b.score - a.score).map(obj => obj.index);
        //Creates an array with the indices from allOtherGames that is sorted from highest score to lowest

        let ordersAreDiff = false;
        if (this.lastShowOrderChange === -1) {
            ordersAreDiff = true; //First order
        } else {
            //Compare if the indices are different
            for (let i = 0; i < desIndexes.length; i++) {
                if (desIndexes[i] !== this.currentOrder[i]) {
                    ordersAreDiff = true;
                    break;
                }
            }
        }

        //The orders are different and it has been long enough to change, then change
        if (ordersAreDiff && Date.now() > this.lastShowOrderChange + this.minChangeOrderTime) {
            this.currentOrder = desIndexes;
            this.lastShowOrderChange = Date.now();
        }
        //Otherwise, do nothing. Once enough time has passed the order will change (if it is still different)

        let gamesToDisplay = [];
        if (this.myGame !== null) gamesToDisplay.push(this.myGame);
        gamesToDisplay.push(...this.currentOrder.map(i => allOtherGames[i])); //Convert back to game objects

        if (gamesToDisplay[0].isFlashing()) p5.background(150);
        else p5.background(100);

        const padding = 20 * (p5.width * p5.height) / (1920 * 1000);

        const mainGame = gamesToDisplay[0];
        if (gamesToDisplay.length === 1) {
            //Just show in center
            mainGame.showBig(p5, p5.width/2, true, p5.width/2, pieceImages, true, mainGame);
        } else if (gamesToDisplay.length === 2 || gamesToDisplay.length === 3) {
            const elems = mainGame.getBigElements(p5, 0, false, Infinity);
            const boardWidthToTotalWidthRatio = elems.board.w / elems.bounding.right; //The ratio from board to total width (including next box)

            const maxTotalW = (p5.width - padding) / gamesToDisplay.length - padding; //The max width including next box
            const maxBoardWidth = maxTotalW * boardWidthToTotalWidthRatio; //The max width of each board (not included next box)

            //An array of all to display (in order) from left to array
            let games = [gamesToDisplay[1], gamesToDisplay[0]];
            if (gamesToDisplay.length === 3) games.push(gamesToDisplay[2]);

            let left = padding;
            for (let g of games) { //Show them each in a row
                const gElems = g.showBig(p5, left, false, maxBoardWidth, pieceImages, true, mainGame);
                left = gElems.bounding.right + padding;
            }
        } else {
            const elems = mainGame.getBigElements(p5, 0, false, Infinity);
            const boardWidthToTotalWidthRatio = elems.board.w / elems.bounding.right; //The ratio from board to total width (including next box)
            const maxTotalW = (p5.width - padding) / 3 - padding; //The max width including next box. Ensures a large enough partition for the left, middle and right
            const maxBoardWidth = maxTotalW * boardWidthToTotalWidthRatio; //The max width of each board (not included next box)

            const secondaryGame = gamesToDisplay[1];

            const secondaryElems = secondaryGame.showBig(p5, padding, false, maxBoardWidth, pieceImages, true, mainGame);
            const mainElems = mainGame.showBig(p5, secondaryElems.bounding.right + padding, false, maxBoardWidth, pieceImages, true, mainGame);

            const smallGames = gamesToDisplay.slice(2, gamesToDisplay.length);
            this.showSmallGames(p5, mainElems.bounding.right, smallGames, mainGame, pieceImages);
        }

        for (let g of gamesToDisplay) {
            if (g === mainGame) g.playSounds(sounds, true); //Play all sounds for main game
            else g.playSounds(sounds, false); //Only play tritris
        }
    }

    showSmallGames(p5, x, games, baseGame, pieceImages) {
        const gameDim = games[0].getSmallElements(0, 0, 100, 200);
        const gameRatio = gameDim.bounding.bottom / gameDim.bounding.right; //The ratio of height to width
        const boardToTotalHeightRatio = gameDim.bounding.bottom / gameDim.board.h;

        const padding = 8 * (p5.width * p5.height) / (1920 * 1000); //Padding for in between games and around the border

        const leftBorder = x + padding; //The left side
        const totalWidth = p5.width - padding - leftBorder; //The total width to fit all of the small games
        const totalHeight = p5.height - padding*2; //Padding for top and bottom
        //const gridRatio = totalHeight / totalWidth;

        let bestDiff = Infinity; //Keep track of the closest ration
        let gridW = -1; //The number of grid cells in a row
        let gridH = -1; //The number of grid cells in a column
        for (let tryGridW = 1; tryGridW <= games.length; tryGridW++) { //Loop to find the optimal grid width
            const tryGridH = Math.ceil(games.length / tryGridW);

            const gameWidth = totalWidth / tryGridW; //how wide each game will be
            const gameHeight = totalHeight / tryGridH; //How tall each game will be

            const ratioDiff = Math.abs((gameHeight / gameWidth) - gameRatio); //How close the ratios are
            if (ratioDiff < bestDiff) {
                gridW = tryGridW; //New best ratio
                gridH = tryGridH;
                bestDiff = ratioDiff;
            }
        }

        let boardWidth = (totalWidth / gridW) - padding; //The width of each game board
        let boardHeight = boardWidth * 2; //The height of each game board
        let cellHeight = boardHeight * boardToTotalHeightRatio; //Including the text at the bottom, the total height of the grid cell
        if ((cellHeight + padding) * gridH > p5.height) { //If the bottom will cut it off
            cellHeight = (totalHeight / gridH) - padding; //Recalculate so that each cell is as tall as possible

            boardHeight = cellHeight / boardToTotalHeightRatio; //Calculate the board height
            boardWidth = boardHeight / 2; //Calculate the board width
        }

        const displayedGridHeight = cellHeight * gridH; //The total height of the grid. Allows for centering
        const verticalPadding = (p5.height - displayedGridHeight) / 2; //How much padding is needed to center

        for (let index = 0; index < games.length; index++) {
            const i = Math.floor(index / gridW); //The grid cell row
            const j = index % gridW; //The grid cell column

            let numInRow = gridW; //How many cells are in this row
            if (i == Math.floor((games.length-1) / gridW)) {
                numInRow = games.length % gridW;
                if (numInRow == 0) numInRow = gridW; //In case it is all 1 column or all 1 row
            }
            const displayedRowWidth = numInRow * (boardWidth + padding); //The total width of this row.
            const horzPadding = (p5.width - x - displayedRowWidth) / 2; //How much padding to center it

            const posX = leftBorder + horzPadding + j * (boardWidth + padding); //The top left position of the cell
            const posY = verticalPadding + i * (cellHeight + padding); //The top left position of the cell
            games[index].showSmall(p5, posX, posY, boardWidth, boardHeight, baseGame, pieceImages, true);
        }
    }
}

class OtherPlayer {
    constructor(id, name, settings) {
        this.userId = id;
        this.name = name;

        this.game = new OtherGame(this.name, settings);
    }

    getId() {
        return this.userId;
    }

    interpolateUpdate() {
        this.game.interpolateUpdate();
    }

    gotGameState(d) {
        this.game.gotGameState(d);
    }
}
