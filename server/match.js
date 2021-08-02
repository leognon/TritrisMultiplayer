import ServerGame from './serverGame.js';

export default class ServerMatch {
    constructor(level, socket1, socket2) {
        let names = '';
        for (let s of [socket1, socket2]) {
            names += `${s.name} (${s.id.slice(0,4)}), `;
        }
        console.log('Created match btwn ' + names);


        this.seed = Math.random();
        this.level = level;

        this.players = [];
        this.addPlayer(socket1);
        this.addPlayer(socket2);
    }

    addPlayer(socket) {
        this.players.push(new ServerPlayer(socket, this.seed, this.level));
    }

    //If all players have lost
    isOver() {
        for (let p of this.players) {
            if (p.serverGame.alive) return false;
        }
        return true;
    }

    //When inputs have been received from a player
    gotInputs(socket, data) {
        for (let p of this.players) {
            if (p.getId() == socket.id) {
                p.gotInputs(data);
                break;
            }
        }
    }

    //Update the boards
    physicsUpdate() {
        for (const p of this.players) {
            p.physicsUpdate();
        }
    }

    //Sends data to the clients
    clientsUpdate(spectatorSockets) {
        let data = {
            players: {},
            yourData: null
        };
        for (const p of this.players) {
            //The current game state of the player and the inputs which have not been
            //sent. The player will go to a previous state that had been sent, then
            //begin performing inputs to take them to this state.
            data.players[p.getId()] = p.getGameStateAndInputs();
        }
        for (const s of spectatorSockets) {
            s.emit('room', {
                type: 'gotGameState',
                data
            });
        }
        for (const p of this.players) {
            //The authoratative state at time t, and the input id that has been received
            //The player will then update their client to the current time (performing
            //any update the server has yet to do)
            data.yourData = p.serverGame.getGameState();

            const tempYourData = data.players[p.getId()];
            delete data.players[p.getId()]; //Remove it from the other player's data

            p.sendData(data);

            data.players[p.getId()] = tempYourData; //Add it back
        }
    }
}

class ServerPlayer {
    constructor(socket, seed, level) {
        this.socket = socket;
        this.serverGame = new ServerGame(seed, level);
    }

    physicsUpdate() {
        this.serverGame.physicsUpdate(this.socket.disconnected);
    }

    getId() {
        return this.socket.id;
    }

    //TODO Should lastFrame be set to Date.now() after receiving data on the client?

    gotInputs(data) {
        this.serverGame.gotInputs(data);
    }

    getGameStateAndInputs() {
        return this.serverGame.getGameStateAndInputs();
    }

    getGameState() {
        return this.serverGame.getGameState();
    }

    sendData(data) {
        this.socket.emit('room', {
            type: 'gotGameState',
            data //TODO Rework this data.data stuff
        });
    }
}
