const { Game } = require('../common/game.js');

class ClientGame extends Game {
    constructor(seed, level, name) {
        super(seed, level);

        this.name = name;
        this.flashAmount = 4;
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

    show(p5, x, y, w, h, pieceImages, showGridLines, showStats, showFlash) {
        if (Date.now() < this.startTime) {
            this.redraw = true; //During the countdown, keep redrawing to show the display
        }

        //TODO Remove redraw? It is temporarily disabled
        //if (!this.redraw) return;

        p5.noStroke();
        p5.fill(0);
        p5.rect(x, y, w, h);

        const cellW = w / this.w;
        const cellH = h / this.h;

        this.grid.show(p5, x, y, w, h, pieceImages, showGridLines);
        if (this.currentPiece) {
            this.currentPiece.show(p5, x, y, cellW, cellH, pieceImages);
        }

        const txtSize = 20;
        p5.textSize(txtSize);
        p5.textAlign(p5.LEFT, p5.TOP);
        const padding = 10;
        const scorePos = p5.createVector(x + w + cellW, y + cellH);
        let scoreDim;

        let normal = this.score % 100000;
        let dig = Math.floor(this.score / 100000);
        let formattedScore = normal.toString();
        if (dig > 0) {
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

        const scoreTxt = `Score ${formattedScore}`;
        const linesTxt = `Lines  ${this.lines}`;
        const levelTxt = `Level  ${this.level}`;
        const textW = Math.max(
            p5.textWidth(scoreTxt),
            p5.textWidth(linesTxt),
            p5.textWidth(levelTxt),
            4 * cellW
        );
        scoreDim = p5.createVector(
            textW + padding + 10,
            txtSize * 4.5 + padding * 2
        );
        p5.fill(100);
        p5.stroke(0);
        p5.strokeWeight(3);
        //The box outline
        p5.rect(scorePos.x, scorePos.y, scoreDim.x, scoreDim.y);
        p5.noStroke();
        p5.fill(0);
        p5.text(scoreTxt, scorePos.x + padding, scorePos.y + padding);
        p5.text(
            linesTxt,
            scorePos.x + padding,
            scorePos.y + padding + 1.75 * txtSize
        );
        p5.text(
            levelTxt,
            scorePos.x + padding,
            scorePos.y + padding + 3.5 * txtSize
        );

        const nextPiecePos = p5.createVector(
            scorePos.x,
            scorePos.y + scoreDim.y + cellH
        );
        const nextPieceDim = p5.createVector(cellW * 3, cellW * 3);
        p5.fill(100);
        p5.stroke(0);
        p5.strokeWeight(3);
        p5.rect(nextPiecePos.x, nextPiecePos.y, nextPieceDim.x, nextPieceDim.y);
        if (this.nextPiece) {
            if (this.nextSingles == 0) { //Show next piece normally
                this.nextPiece.showAt(
                    p5,
                    nextPiecePos.x,
                    nextPiecePos.y,
                    nextPieceDim.x,
                    nextPieceDim.y,
                    pieceImages
                );
            } else if (this.nextSingles == 2) { //Show 3 Ninjas coming up
                const spacingX = nextPieceDim.x / 7;
                const spacingY = nextPieceDim.y / 7;
                this.nextPiece.showAt(p5, nextPiecePos.x - spacingX, nextPiecePos.y - spacingY, nextPieceDim.x, nextPieceDim.y, pieceImages);
                this.nextPiece.showAt(p5, nextPiecePos.x, nextPiecePos.y, nextPieceDim.x, nextPieceDim.y, pieceImages);
                this.nextPiece.showAt(p5, nextPiecePos.x + spacingX, nextPiecePos.y + spacingY, nextPieceDim.x, nextPieceDim.y, pieceImages);
            } else if (this.nextSingles == 1) { //Show 2 ninjas coming up
                const spacingX = nextPieceDim.x / 7;
                const spacingY = nextPieceDim.y / 7;
                this.nextPiece.showAt(p5, nextPiecePos.x - spacingX/2, nextPiecePos.y - spacingY/2, nextPieceDim.x, nextPieceDim.y, pieceImages);
                this.nextPiece.showAt(p5, nextPiecePos.x + spacingX/2, nextPiecePos.y + spacingY/2, nextPieceDim.x, nextPieceDim.y, pieceImages);
            }
        }

        if (showStats) {
            const statPos = p5.createVector(
                scorePos.x,
                nextPiecePos.y + nextPieceDim.y + cellH
            );

            let tritrisPercent = Math.round(100 * 3*this.tritrisAmt / this.lines);
            if (this.lines == 0) tritrisPercent = '--';
            const tritrisPercentText = `Tri ${tritrisPercent}%`;

            const fixedTime = Math.max(this.time, 0);
            const totalSec = Math.floor(fixedTime / 1000) % 60;
            const totalM = Math.floor(fixedTime / (1000*60));
            const startLevelText = `Time ${p5.nf(totalM,2)}:${p5.nf(totalSec,2)}`;

            const textW = Math.max(
                p5.textWidth(tritrisPercentText),
                p5.textWidth(startLevelText),
                4 * cellW
            );

            const statDim = p5.createVector(
                textW + padding + 10,
                txtSize * 2.75 + padding * 2
            );
            p5.fill(100);
            p5.stroke(0);
            p5.strokeWeight(3);
            //The box outline
            p5.rect(statPos.x, statPos.y, statDim.x, statDim.y);
            p5.noStroke();
            p5.fill(0);
            p5.text(tritrisPercentText, statPos.x + padding, statPos.y + padding);
            p5.text(
                startLevelText,
                statPos.x + padding,
                statPos.y + padding + 1.75 * txtSize
            );
        }

        p5.fill(0);
        p5.noStroke();
        p5.textSize(25);
        p5.textAlign(p5.CENTER, p5.TOP);
        p5.text(this.name, x + w/2, y + h + 10);

        this.redraw = false;
    }
}

module.exports = ClientGame;
