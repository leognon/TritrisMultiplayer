import { Game } from '../common/game.js';

export default class ClientGame extends Game {
    constructor(seed, level, name) {
        super(seed, level);

        this.name = name;
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

    playSounds(sounds) {
        for (const s in sounds) {
            if (this.soundsToPlay[s]) {
                sounds[s].play();
                this.soundsToPlay[s] = false;
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

        const cellW = boardWidth / this.w;

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

    //TODO Make an options object wit hall the data instead of a billion parameters
    showBig(p5, left, centered, maxWidth, pieceImages, showGridLines, baseGame) {
        const elems = this.getBigElements(p5, left, centered, maxWidth);

        this.showScoreAndLines(p5, elems.topText.x, elems.topText.y, elems.topText.w, elems.topText.h, elems.scaleFactor, baseGame);

        this.showGameBoard(p5, elems.board.x, elems.board.y, elems.board.w, elems.board.h, pieceImages, showGridLines);

        this.showNextBox(p5, elems.next.x, elems.next.y, elems.next.w, elems.next.h, elems.scaleFactor, pieceImages);

        p5.fill(0);
        p5.noStroke();
        p5.textSize(elems.bottomText.fontSize);
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

    showSmall(p5, x, y, w, h, baseGame, pieceImages, showGridLines) {
        const elements = this.getSmallElements(x, y, w, h);

        this.showGameBoard(p5, x, y, w, h, pieceImages, showGridLines);

        const scoreDiff = this.score - baseGame.score;
        const scoreTextObj = this.getDiffTextObj(scoreDiff, this.formatScore(scoreDiff));
        const textObjs = [
            {
                text: `${this.name} | `,
                color: p5.color(0)
            },
            scoreTextObj
        ];

        p5.fill(0);
        p5.noStroke();
        p5.textSize(elements.text.size);
        p5.textAlign(p5.LEFT, p5.TOP);
        const textW = this.getColorfulLineWidth(p5, textObjs);
        const correctedXPos = elements.text.x - textW/2;
        this.showColorfulText(p5, textObjs, correctedXPos, elements.text.y);
    }


    showGameBoard(p5, x, y, w, h, pieceImages, showGridLines) {
        p5.noStroke();
        p5.fill(0);
        p5.rect(x, y, w, h);

        const cellW = w / this.w;
        const cellH = h / this.h;

        this.grid.show(p5, x, y, w, h, pieceImages, showGridLines);
        if (this.currentPiece) {
            this.currentPiece.show(p5, x, y, cellW, cellH, pieceImages);
        }
    }

    showNextBox(p5, x, y, w, h, scaleFactor, pieceImages) {
        p5.fill(100);
        p5.stroke(0);
        p5.strokeWeight(3 * scaleFactor);
        p5.rect(x, y, w, h);
        if (this.nextPiece) {
            if (this.nextSingles == 0) { //Show next piece normally
                this.nextPiece.showAt(p5, x, y, w, h, pieceImages);
            } else if (this.nextSingles == 2) { //Show 3 Ninjas coming up
                const spacingX = w / 7;
                const spacingY = h / 7;
                this.nextPiece.showAt(p5, x - spacingX, y - spacingY, w, h, pieceImages);
                this.nextPiece.showAt(p5, x, y, w, h, pieceImages);
                this.nextPiece.showAt(p5, x + spacingX, y + spacingY, w, h, pieceImages);
            } else if (this.nextSingles == 1) { //Show 2 ninjas coming up
                const spacingX = w / 7;
                const spacingY = h / 7;
                this.nextPiece.showAt(p5, x - spacingX/2, y - spacingY/2, w, h, pieceImages);
                this.nextPiece.showAt(p5, x + spacingX/2, y + spacingY/2, w, h, pieceImages);
            }
        }
    }

    showScoreAndLines(p5, x, y, w, h, scaleFactor, baseGame) {
        //p5.textLeading(fontHeight);
        let textLines;
        if (baseGame === this) {
            const score = this.formatScore(this.score);
            let tritrisPercent = Math.round(100 * 3*this.tritrisAmt / this.lines);
            if (this.lines == 0) tritrisPercent = '--';

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
}
