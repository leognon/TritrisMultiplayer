import { Game } from '../common/game.js';

export default class ClientGame extends Game {
    constructor(name, settings) {
        super(settings);

        this.name = name;
        this.isWinner = false;
        this.flashAmount = 4;

        this.soundsToPlay = {
            move: false,
            fall: false,
            clear: false,
            tritris: false,
            levelup: false,
            topout: false,
        }
    }

    isFlashing() { //Returns whether or not to flash white
        if (this.time <= this.animatingUntil && this.animatingLines.length == 3) {
            //Currently play tritris line clear animation
            const timePassed = this.animatingUntil - this.time;
            const interval = Math.floor(this.flashAmount * timePassed / this.maxAnimationTime);
            this.redraw = true; //If flashing, redraw each frame
            if (interval % 2 == 0) {
                return true;
            } else {
                return false;
            }
        }
        return false;
    }

    duringCountDown() {
        return Date.now() < this.startTime;
    }

    sendGarbage() {
        //Do nothing. Garbage sending is handled server side
    }

    addSound(s) {
        this.soundsToPlay[s] = true;
    }

    youWon() {
        this.winner = true;
    }

    playSounds(sounds, allSounds) {
        if (allSounds) { //Play all sounds
            for (const s in sounds) {
                if (this.soundsToPlay[s]) {
                    sounds[s].play();
                    this.soundsToPlay[s] = false;
                }
            }
        } else { //Play all tritris and topout sound
            const desiredSounds = ['tritris', 'topout'];
            for (const s of desiredSounds) { //Only play the desired sounds
                if (this.soundsToPlay[s]) {
                    sounds[s].play();
                    this.soundsToPlay[s] = false;
                }
            }
        }
    }

    getBigElements(p5, pos, centered, maxWidth) {
        //Score/Lines display - Top 10%
        //Board Middle 80%
        //Name - Bottom 10%
        let boardHeight = p5.height * 0.8;
        let boardWidth = boardHeight / 2;
        if (boardWidth > maxWidth) { //If the window is too thin
            boardWidth = maxWidth;
            boardHeight = boardWidth * 2;
        }

        let left;
        if (centered) {
            left = pos - boardWidth/2;
        } else {
            left = pos;
        }

        const scaleFactor = boardWidth / 250; //Ensure everything scales together

        const cellW = boardWidth / 8; //8 is hardcoded so everything doesnt get extremely big in 4x8

        const padding = 8 * scaleFactor;

        const scorePosX = left;
        const scorePosY = padding;
        const scoreWidth = boardWidth;
        const scoreHeight = boardHeight * 1/8;

        const boardPosX = left;
        const boardPosY = scorePosY + scoreHeight + padding;

        const nextPosX = boardPosX + boardWidth + padding;
        const nextPosY = boardPosY + cellW * 2;
        const nextDim = cellW * 3;

        const textSize = cellW * 0.5;
        const nameX = left + boardWidth / 2;
        const nameY = boardPosY + boardHeight + padding;

        return {
            scaleFactor: scaleFactor,
            topText: {
                x: scorePosX,
                y: scorePosY,
                w: scoreWidth,
                h: scoreHeight,
            },
            board: {
                x: boardPosX,
                y: boardPosY,
                w: boardWidth,
                h: boardHeight
            },
            next: {
                x: nextPosX,
                y: nextPosY,
                w: nextDim,
                h: nextDim
            },
            bottomText: {
                x: nameX,
                y: nameY,
                textSize
            },
            bounding: {
                left,
                right: nextPosX + nextDim,
                top: scorePosY,
                bottom: nameY + textSize
            }
        }
    }

    showBig({ p5, left, centered, maxWidth, pieceImages, baseGame, visualSettings }) {
        const elems = this.getBigElements(p5, left, centered, maxWidth);

        this.showScoreAndLines(p5, elems.topText.x, elems.topText.y, elems.topText.w, elems.topText.h, elems.scaleFactor, baseGame);

        this.showGameBoard(p5, elems.board.x, elems.board.y, elems.board.w, elems.board.h, pieceImages, visualSettings);

        this.showNextBox(p5, elems.next.x, elems.next.y, elems.next.w, elems.next.h, elems.scaleFactor, pieceImages);

        p5.fill(this.winner ? p5.color(255, 215, 0) : p5.color(0)); //Winner has a gold name
        p5.noStroke();
        p5.textSize(elems.bottomText.textSize);
        p5.textAlign(p5.CENTER, p5.TOP);
        p5.text(this.name, elems.bottomText.x, elems.bottomText.y);

        if (this === baseGame && this.duringCountDown()) {
            p5.textSize(50 * elems.scaleFactor);
            p5.fill(255);
            p5.noStroke();
            p5.textAlign(p5.CENTER, p5.CENTER);
            const secondsRemaining = 1 + Math.floor(-this.time / 1000);
            p5.text(secondsRemaining, elems.board.x + elems.board.w/2, elems.board.y + elems.board.h/2);
        }

        return elems;
    }

    getSmallElements(x, y, w, h) {
        const padding = h * 0.01;
        const cellH = h / this.h;
        const textHeight = 0.5 * cellH;
        return {
            bounding: {
                left: x,
                right: x + w,
                top: y,
                bottom: y + h + padding + textHeight
            },
            board: {
                x, y, w, h
            },
            text: {
                x: x + w/2,
                y: y + h + padding,
                size: textHeight
            }
        }
    }

    showSmall({ p5, x, y, w, h, baseGame, pieceImages, visualSettings }) {
        const elements = this.getSmallElements(x, y, w, h);

        this.showGameBoard(p5, x, y, w, h, pieceImages, visualSettings);

        const scoreDiff = this.score - baseGame.score;
        let infoTextObj;
        if (this.versus) {
            infoTextObj = {
                text: `Rec: ${this.totalGarbageEverReceived} Sent: ${this.getTotalNumLinesSent()}`,
                color: 0
            }
        } else {
            infoTextObj = this.getDiffTextObj(scoreDiff, this.formatScore(scoreDiff));
            //Display their score
        }
        const textObjs = [
            {
                text: this.name,
                color: (this.winner ? p5.color(255, 215, 0) : p5.color(0)) //Winner has a gold name
            },
            {
                text: ' | ',
                color: 0
            },
            infoTextObj
        ];

        let textSize = elements.text.size;
        p5.fill(0);
        p5.noStroke();
        p5.textSize(textSize);
        p5.textAlign(p5.LEFT, p5.TOP);
        let textW = this.getColorfulLineWidth(p5, textObjs);
        if (textW > w) {
            const scale = w / textW;
            textSize *= scale;

            p5.textSize(textSize);
            textW = this.getColorfulLineWidth(p5, textObjs);
        }
        const correctedXPos = elements.text.x - textW/2;
        this.showColorfulText(p5, textObjs, correctedXPos, elements.text.y);
    }


    showGameBoard(p5, x, y, w, h, pieceImages, visualSettings) {
        p5.noStroke();
        p5.fill(0);
        p5.rect(x, y, w, h);

        const cellW = w / this.w;
        const cellH = h / this.h;

        this.grid.show(p5, x, y, w, h, pieceImages, visualSettings.showGridLines, this.alive);
        if (this.currentPiece) {
            this.currentPiece.show(p5, x, y, cellW, cellH, pieceImages);

            if (visualSettings.showGhost) {
                this.showGhostPiece(p5, x, y, cellW, cellH, pieceImages);
            }
        }

        const waitingNumLines = this.garbageMeterWaiting.reduce((sum, garbage) => sum + garbage.numLines, 0);
        const readyNumLines = this.garbageMeterReady.reduce((sum, garbage) => sum + garbage.numLines, 0);

        const waitingHeight = waitingNumLines * cellH;
        const readyHeight = readyNumLines * cellH;
        p5.fill(150, 150, 50);
        p5.rect(x + w, y + h - readyHeight - waitingHeight, cellW * 0.2, waitingHeight);
        p5.fill(150, 50, 50);
        p5.noStroke();
        p5.rect(x + w, y + h - readyHeight, cellW * 0.2, readyHeight);
    }

    showNextBox(p5, x, y, w, h, scaleFactor, pieceImages) {
        p5.fill(100);
        p5.stroke(0);
        p5.strokeWeight(3 * scaleFactor);
        p5.rect(x, y, w, h);
        if (this.nextPiece) {
            const spacing = w / 7;
            for (let i = 0; i < this.nextPieceCount; i++) {
                let positionRelativeToCenter = i - (this.nextPieceCount - 1) / 2;
                this.nextPiece.showAt(p5, x + spacing * positionRelativeToCenter, y + spacing * positionRelativeToCenter, w, h, pieceImages);
            }
        }
    }

    showGhostPiece(p5, x, y, cellW, cellH, pieceImages) {
        this.getGhostPiece().show(p5, x, y, cellW, cellH, pieceImages, true);
    }

    showScoreAndLines(p5, x, y, w, h, scaleFactor, baseGame) {
        let textLines;
        if (baseGame === this) {
            const score = this.formatScore(this.score);
            let tritrisPercent = Math.round(100 * 3*this.tritrisAmt / this.lines);
            if (this.lines == 0) tritrisPercent = '--';

            const totalSec = Math.floor(Math.max(this.time, 0) / 1000) % 60;
            const totalM = Math.floor(Math.max(this.time, 0) / (1000*60));
            const timeText = `${p5.nf(totalM,2)}:${p5.nf(totalSec,2)}`;
            let timeColor = 0;
            const timeToTextLevelUp = this.nextLevelIncreaseVersus() - this.time;
            if (timeToTextLevelUp <= 0) timeColor = p5.color(220, 0, 0); //Red because it will levelup on the next piece
            else if (timeToTextLevelUp < 3 * 1000) timeColor = p5.color(220,220,30); //Yellow because it is soon



            if (this.versus) {
                textLines = [
                    [ //First line
                        {
                            text: `Received: ${this.totalGarbageEverReceived}`,
                            color: 0
                        },
                        {
                            text: ` | Sent: ${this.getTotalNumLinesSent()}`,
                            color: 0
                        }
                    ],
                    [ //Second line
                        {
                            text: `Level: ${this.level} | Time: `,
                            color: 0
                        },
                        {
                            text: timeText,
                            color: timeColor
                        }
                    ]
                ];
            } else {
                textLines = [
                    [ //First line of text
                        {
                            text: `Score ${score} | ${tritrisPercent}%`,
                            color: 0
                        }
                    ],
                    [ //Second line of text
                        {
                            text: `Lines ${this.lines} | (${this.level})`,
                            color: 0
                        }
                    ]
                ];
            }
        } else {
            const scoreDiff = this.score - baseGame.score; //Show comparison
            const scoreTextObj = this.getDiffTextObj(scoreDiff, this.formatScore(scoreDiff));

            const myTritrisPercent = (this.lines !== 0) ? Math.round(100 * 3*this.tritrisAmt / this.lines) : 0;
            const otherTritrisPercent = (baseGame.lines !== 0) ? Math.round(100 * 3*baseGame.tritrisAmt / baseGame.lines) : 0;
            const tritrisPercentDiff = myTritrisPercent - otherTritrisPercent;
            const tritrisPercentTextObj = this.getDiffTextObj(tritrisPercentDiff);

            const lineDiff = this.lines - baseGame.lines; //Show comparison
            const lineTextObj = this.getDiffTextObj(lineDiff);

            //TODO What if they have the same score? It looks like they have 0 points
            const levelDiff = this.level - baseGame.level;
            const levelTextObj = this.getDiffTextObj(levelDiff);

            if (this.versus) {
                textLines = [
                    [ //First line
                        {
                            text: `Received: ${this.totalGarbageEverReceived}`,
                            color: 0
                        }
                    ],
                    [ //Second line
                        {
                            text: `Sent: ${this.garbageToSend.reduce((tot, g) => tot + g.numLines, 0)}`,
                            color: 0
                        }
                    ]
                ];
            } else {
                textLines = [
                    [ //First line
                        {
                            text: 'Score ',
                            color: 0
                        },
                        scoreTextObj,
                        {
                            text: ' (',
                            color: 0
                        },
                        tritrisPercentTextObj,
                        {
                            text: '%)',
                            color: 0
                        }
                    ],
                    [ //Second line
                        {
                            text: 'Lines: ',
                            color: 0
                        },
                        lineTextObj,
                        {
                            text: ' (',
                            color: 0
                        },
                        levelTextObj,
                        {
                            text: ')',
                            color: 0
                        }
                    ]
                ];
            }
        }
        const innerTextHeight = h - 5*scaleFactor;
        const lineHeight = innerTextHeight / textLines.length;
        let fontSize = lineHeight - 10*scaleFactor;

        const textPadding = 8 * scaleFactor;
        p5.textSize(fontSize); //Needed to calcualte the text width accurately
        const lineWidths = textLines.map(parts => this.getColorfulLineWidth(p5, parts));
        const longestLineWidth = Math.max(...lineWidths) + textPadding*2;
        if (longestLineWidth > w) {
            const scale = w / longestLineWidth;
            fontSize *= scale;
        }

        p5.stroke(0);
        p5.strokeWeight(3 * scaleFactor);
        p5.fill(100); //Box border
        p5.rect(x, y, w, h);

        p5.textSize(fontSize);
        p5.textAlign(p5.LEFT, p5.TOP);
        //p5.fill(0);
        p5.noStroke();
        for (let i = 0; i < textLines.length; i++) {
            this.showColorfulText(p5, textLines[i], x + textPadding, y + lineHeight*i + textPadding);
        }
    }

    showColorfulText(p5, textParts, x, y) {
        let curX = x;
        for (let part of textParts) {
            p5.fill(part.color);
            p5.text(part.text, curX, y);
            curX += p5.textWidth(part.text);
        }
    }

    getColorfulLineWidth(p5, parts) {
        return p5.textWidth(parts.reduce((acc, part) => acc + part.text, ''));
    }

    getDiffTextObj(diff, diffStr) {
        if (diffStr === undefined) diffStr = diff.toString();
        const text = (diff >= 0 ? '+' : '') + diffStr;
        let color;
        if (diff === 0) color = 0; //Black
        else if (diff > 0) color = [0, 200, 0];
        else color = [200, 0, 0];
        return {
            text, color
        }
    }

    formatScore(s) {
        const isNeg = s < 0;
        s = Math.abs(s);
        let normal = s % 100000; //The last 5 digits are displayed normally
        let dig = Math.floor(s / 100000); //The leading digit
        let formattedScore = normal.toString();
        if (dig > 0) { //Pad zeros
            while (formattedScore.length < 5) formattedScore = '0' + formattedScore; //Make sure the length is correct
        }
        for (let i = formattedScore.length-3; i > 0; i -= 3) {
            formattedScore = formattedScore.slice(0, i) + " " + formattedScore.slice(i);
        } //Put a space every 3 characters (from the end)

        if (dig > 0) {
            let str = dig.toString();
            if (dig >= 10 && dig <= 35) str = String.fromCharCode('A'.charCodeAt(0) + dig - 10);
            formattedScore = str + formattedScore;
        }
        if (isNeg) formattedScore = '-' + formattedScore;
        return formattedScore;
    }
    
    getTotalNumLinesSent() {
        return this.garbageToSend.reduce((tot, g) => tot + g.numLines, 0);
    }
}
