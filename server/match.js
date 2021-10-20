import ServerGame from './serverGame.js';
import gameTypes from '../common/gameTypes.js';

export default class ServerMatch {
    constructor(clients, settings) {
        this.settings = {
            seed: Math.random(),
            ...settings,
        }

        this.players = [];
        for (let client of clients) {
            this.addPlayer(client);
        }

        this.winner = null;
    }

    addPlayer(client) {
        this.players.push(new ServerPlayer(client, this.settings));
    }

    //If all players have lost
    isOver() {
        if (this.settings.gameType == gameTypes.VERSUS) {
            let numAlive = this.players.filter(p => p.serverGame.isAlive()).length;
            if (numAlive === 0 || (numAlive === 1 && this.players.length > 1)) {
                return {
                    over: true,
                    winner: this.getWinner()
                }
            } else {
                return { over: false };
            }
        } else {
            for (let p of this.players) {
                if (p.serverGame.isAlive()) return { over: false };
            }
            this.winner = this.getWinner();
            return {
                over: true,
                winner: this.winner
            };
        }
    }

    getWinner() {
        if (this.players.length === 1) return null; //Only 1 player. No winner
        let winnerId = null;
        if (this.settings.gameType == gameTypes.VERSUS) {
            let winnerTime = -Infinity;
            for (const p of this.players) {
                if (p.serverGame.latestState.time > winnerTime) {
                    winnerTime = p.serverGame.latestState.time;
                    winnerId = p.client.userId;
                }
            }
        } else {
            let winnerScore = -Infinity;
            for (const p of this.players) {
                if (p.serverGame.latestState.score > winnerScore) {
                    winnerScore = p.serverGame.latestState.score;
                    winnerId = p.client.userId;
                }
            }
        }
        return winnerId;
    }

    //When inputs have been received from a player
    gotInputs(client, data) {
        for (let p of this.players) {
            if (p.getId() == client.getId()) {
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
        if (this.settings.gameType == gameTypes.VERSUS) {
            for (const p of this.players) {
                let garbageToSend = p.getNewGarbageToSend();
                if (garbageToSend.length > 0) {
                    this.sendGarbage(p, garbageToSend);
                }
            }
        }
    }

    sendGarbage(fromPlayer, garbageToSend) {
        const alivePlayers = this.players.filter(p => p.serverGame.isAlive());
        let otherPlayers = alivePlayers.filter(p => p !== fromPlayer);
        let leastGarbReceived = Math.min(...otherPlayers.map(p => p.serverGame.totalGarbageEverReceived));
        let playersWhoReceivedLeast = otherPlayers.filter(p => p.serverGame.totalGarbageEverReceived === leastGarbReceived);

        if (playersWhoReceivedLeast.length === 0) playersWhoReceivedLeast = alivePlayers; //Send garbage to yourself

        let sendTo = playersWhoReceivedLeast[Math.floor(Math.random() * playersWhoReceivedLeast.length)]; //Pick a random player who received the least
        sendTo.receiveGarbage(garbageToSend);
    }

    //Sends data to the clients
    clientsUpdate(spectatorClients) {
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
        for (const s of spectatorClients) {
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
    constructor(client, settings) {
        this.client = client;
        this.serverGame = new ServerGame(settings);
    }

    physicsUpdate() {
        this.serverGame.physicsUpdate(this.client.hasLeftPage());
    }

    getId() {
        return this.client.userId;
    }

    //TODO Should lastFrame be set to Date.now() after receiving data on the client?

    gotInputs(data) {
        this.serverGame.gotInputs(data);
    }

    receiveGarbage(garbage) {
        this.serverGame.receiveGarbage(garbage);
    }

    getNewGarbageToSend() {
        return this.serverGame.getNewGarbageToSend();
    }

    getGameStateAndInputs() {
        return this.serverGame.getGameStateAndInputs();
    }

    getGameState() {
        return this.serverGame.getGameState();
    }

    sendData(data) {
        this.client.emit('room', {
            type: 'gotGameState',
            data //TODO Rework this data.data stuff
        });
    }
}
