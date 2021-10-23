import ServerGame from './serverGame.js';
import gameTypes from '../common/gameTypes.js';

export default class ServerMatch {
    constructor(clients, settings) {
        this.settings = {
            seed: Math.random(),
            ...settings,
        }
        if (this.settings.gameType == gameTypes.B_TYPE) {
            this.settings.bTypeSeed = Math.random();
        }

        this.players = [];
        for (let client of clients) {
            this.addPlayer(client);
        }

        this.someoneHasWon = false;
    }

    addPlayer(client) {
        this.players.push(new ServerPlayer(client, this.settings));
    }

    //If all players have lost
    isOver() {
        switch (this.settings.gameType) {
            case gameTypes.VERSUS:
                return this.isOverVersus();
            case gameTypes.CLASSIC:
                return this.isOverClassic();
            case gameTypes.B_TYPE:
                return this.isOverBType();
        }
    }

    isOverVersus() {
        let numAlive = this.players.filter(p => p.serverGame.isAlive()).length;

        //Last one alive
        if (numAlive === 0 || (numAlive === 1 && this.players.length > 1)) {
            let winnerTime = -Infinity;
            let winnerId = null;
            for (const p of this.players) {
                if (p.serverGame.latestState.time > winnerTime) {
                    winnerTime = p.serverGame.latestState.time;
                    winnerId = p.client.userId;
                }
            }

            return {
                over: true,
                winner: this.players.length > 1 ? winnerId : null, //If only 1 player, dont mark as winner
                delay: true
            }
        }

        return { over: false };
    }

    isOverClassic() {
        for (let p of this.players) {
            if (p.serverGame.isAlive()) return { over: false };
        }

        let winnerScore = -Infinity;
        let winnerId = null;
        for (const p of this.players) {
            if (p.serverGame.latestState.score > winnerScore) {
                winnerScore = p.serverGame.latestState.score;
                winnerId = p.client.userId;
            }
        }

        return {
            over: true,
            winner: this.players.length > 1 ? winnerId : null, //If only 1 player, dont mark as winner
            delay: true
        };
    }

    isOverBType() {
        let allDead = true;
        let leastGarbagePlayer = null;
        for (let p of this.players) {
            //Whoever clears all garbage first wins
            const myAmount = p.serverGame.getLeastAmountOfGarbage();
            if (myAmount === 0) {
                return {
                    over: true,
                    winner: p.client.userId,
                    delay: true
                }
            } else {
                if (leastGarbagePlayer === null) {
                    leastGarbagePlayer = p;
                } else if (myAmount < leastGarbagePlayer.serverGame.getLeastAmountOfGarbage()) {
                    //Whoever cleared the most garbage wins
                    leastGarbagePlayer = p;
                } else if (myAmount == leastGarbagePlayer.serverGame.getLeastAmountOfGarbage() &&
                            p.serverGame.latestState.time < leastGarbagePlayer.serverGame.time) {
                    //If the same amount was cleared, whoever cleared it first wins
                    //TODO Currently it is actually who died first, which isn't really right. Perhaps a better delimeter like score?
                    leastGarbagePlayer = p;
                }
            }
            if (p.serverGame.isAlive()) allDead = false;
        }
        if (allDead && leastGarbagePlayer !== null) {
            //If everyone dies before anyone has cleared all garbage, winner is who cleared the most
            return {
                over: true,
                winner: this.players.length > 1 ? leastGarbagePlayer.client.userId : null, //If there is only 1 player, only show they won if they cleared all garbage (which happens above)
                delay: true
            }
        }

        return { over: false }
        
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
