export class Grid {
    constructor(a, height) {
        if (a instanceof Array) {
            const gridData = a;
            this.h = gridData.length;
            this.w = gridData[0].length;
            this.grid = [];
            for (let i = 0; i < this.h; i++) {
                this.grid.push([]);
                for (let j = 0; j < this.w; j++) {
                    const gridCell = new GridCell(gridData[i][j]);
                    this.grid[i].push(gridCell);
                }
            }
        } else {
            this.w = a;
            this.h = height;
            this.grid = [];
            for (let i = 0; i < this.h; i++) {
                this.grid.push([]);
                for (let j = 0; j < this.w; j++) {
                    this.grid[i].push(new GridCell());
                }
            }
        }
    }

    serialized() {
        let output = [];
        for (let i = 0; i < this.h; i++) {
            output.push([]);
            for (let j = 0; j < this.w; j++) {
                const thisCell = this.grid[i][j];
                output[i].push(thisCell.serialized());
            }
        }
        return output;
    }

    insertBType(rand, garbageHeight, percentGarbage) {
        for (let i = Math.max(0, this.h - garbageHeight); i < this.h; i++) {
            this.insertBTypeRow(rand, percentGarbage, i);
        }
    }

    insertBTypeRow(rand, percentGarbage, i) {
        let hasFilledAtLeastOne = false; //Make sure each row has at least 1 filled garbage
        let hasAHole = false; //Make sure an entire row is not solid

        for (let j = 0; j < this.w; j++) {
            let isFilled = rand.random() < percentGarbage;

            if (isFilled) {
                hasFilledAtLeastOne = true;

                const triFilled = this.insertBTypeCell(i, j, rand);

                if (triFilled < 4) hasAHole = true;
            } else {
                hasAHole = true;
            }
        }

        if (!hasAHole) {
            //The entire row is solid. Pick a random col and add a hole
            const col = rand.range(this.w);
            let triFilled = this.insertBTypeCell(i, col, rand);
            if (triFilled >= 4) { //If it filled it with a solid tri just make it empty
                this.grid[i][col] = new GridCell();
            }
        }

        if (!hasFilledAtLeastOne) {
            //No garbage in the whole row. Place a random garbage somewhere
            const col = rand.range(this.w);
            this.insertBTypeCell(i, col, rand);
        }
    }

    insertBTypeCell(i, j, rand) {
        const triFilled = rand.range(5);
        if (triFilled < 4) { //If triFilled is 0-3 then it fills 1 triangles
            const row = Math.floor(triFilled / 2);
            const col = triFilled % 2;
            this.grid[i][j].tris[row][col] = new Triangle(7);
        } else { //If its 4, it fills both
            this.grid[i][j].tris[0][0] = new Triangle(7);
            this.grid[i][j].tris[1][1] = new Triangle(7);
        }
        return triFilled;
    }

    clearLines() {
        let linesCleared = [];
        for (let row = 0; row < this.h; row++) {
            let full = true;
            for (let col = 0; col < this.w; col++) {
                if (!this.grid[row][col].isFull()) {
                    full = false;
                    break;
                }
            }
            if (full) {
                linesCleared.push(row);
            }
        }
        return linesCleared;
    }

    countGarbageRows() {
        let numRows = 0;
        for (let i = 0; i < this.h; i++) {
            for (let j = 0; j < this.w; j++) {
                if (this.grid[i][j].hasGarbage()) {
                    numRows++;
                    break; //This row has garbage
                }
            }
        }
        return numRows;
    }

    //If all the rows except for the ones in exlcuding are empty
    isEmpty(exlcuding) {
        for (let i = 0; i < this.h; i++) {
            if (exlcuding.includes(i)) continue;
            if (!this.isRowEmpty(i)) return false;
        }
        return true;
    }

    isRowEmpty(i) {
        for (let j = 0; j < this.w; j++) {
            if (!this.grid[i][j].isEmpty()) return false;
        }
        return true;
    }

    insertGarbage(garbage) {
        const openCol = Math.floor(garbage.openCol * this.w);
        let newGrid = this.grid.slice(garbage.numLines, this.grid.length);
        for (let i = 0; i < garbage.numLines; i++) {
            let newRow = [];
            for (let j = 0; j < this.w; j++) {
                if (j === openCol) {
                    if (garbage.openOrientation < 0.5) {
                        newRow.push(new GridCell([[0,0],[1,0]], 7));
                    } else {
                        newRow.push(new GridCell([[0,0],[0,1]], 7));
                    }
                } else {
                    newRow.push(new GridCell([[1,0],[0,1]], 7));
                }
            }
            newGrid.push(newRow);
        }
        this.grid = newGrid;
    }

    removeRightTri(row, col) {
        if (col < 0 || col >= this.w) return;
        this.grid[row][col].removeRightTri();
    }

    removeLeftTri(row, col) {
        if (col < 0 || col >= this.w) return;
        this.grid[row][col].removeLeftTri();
    }

    removeLine(row) {
        this.grid.splice(row, 1); //Remove the row
        this.grid.unshift([]); //Add a new row at the top
        for (let col = 0; col < this.w; col++) this.grid[0].push(new GridCell());
    }

    addPiece(piece) {
        for (let row = 0; row < piece.grid.length; row++) {
            for (let col = 0; col < piece.grid[0].length; col++) {
                let gridRow = row + piece.pos.y;
                let gridCol = col + piece.pos.x;
                this.grid[gridRow][gridCol].addCell(piece.grid[row][col]);
            }
        }
    }

    isValid(piece) {
        for (let row = 0; row < piece.grid.length; row++) {
            for (let col = 0; col < piece.grid[0].length; col++) {
                let gridRow = row + piece.pos.y;
                let gridCol = col + piece.pos.x;
                if (this.grid[gridRow][gridCol].collides(piece.grid[row][col])) {
                    return false;
                }
            }
        }
        return true;
    }

    show(p5, x, y, w, h, pieceImages, showGridLines, alive) {
        const cellW = w / this.w;
        const cellH = h / this.h;

        if (showGridLines) {
            //Draws the grid outline
            const scaleFactor = (w * h) / (400 * 800);
            p5.stroke(100);
            p5.strokeWeight(Math.max(0.25, 2.5 * scaleFactor));
            //Vertical lines
            for (let i = 0; i <= this.w; i++)
                p5.line(x + i * cellW, y, x + i * cellW, y + h);
            //Horizontal lines
            for (let j = 0; j <= this.h; j++)
                p5.line(x, y + j * cellH, x + w, y + j * cellH);
        }
        //Draws the triangles in the grid
        for (let i = 0; i < this.h; i++) {
            for (let j = 0; j < this.w; j++) {
                this.grid[i][j].show(
                    p5,
                    x + j * cellW,
                    y + i * cellH,
                    cellW,
                    cellH,
                    pieceImages,
                    !alive
                );
            }
        }

        //Draws only the outside borders on top of the pieces, so they don't stick out of the board
        p5.stroke(100);
        p5.strokeWeight(2);
        p5.line(x, y, x, y + h);
        p5.line(x + this.w * cellW, y, x + this.w * cellW, y + h);
        p5.line(x, y, x + w, y);
        p5.line(x, y + this.h * cellH, x + w, y + this.h * cellH);
    }
}

export class GridCell {
    constructor(triangles, clr) {
        if (triangles == undefined) {
            this.tris = [
                [null, null],
                [null, null],
            ];
        } else {
            this.tris = [];
            for (let row = 0; row < 2; row++) {
                this.tris.push([]);
                for (let col = 0; col < 2; col++) {
                    let tri = null;
                    if (clr == undefined) { //Each triangle might have a different color
                        if (triangles[row][col] != -1) { //-1 means no triangles
                            tri = new Triangle(triangles[row][col]);
                        }
                    } else { //All the triangles are the same color
                        if (triangles[row][col] == 1) {
                            tri = new Triangle(clr);
                        }
                    }
                    this.tris[row][col] = tri;
                }
            }
        }
    }

    serialized() {
        let output = [];
        for (let y = 0; y < this.tris.length; y++) {
            output.push([]);
            for (let x = 0; x < this.tris[y].length; x++) {
                if (this.tris[y][x]) {
                    output[y].push(this.tris[y][x].clr);
                } else {
                    output[y].push(-1);
                }
            }
        }
        return output;
    }

    removeRightTri() {
        this.tris[0][1] = null;
        this.tris[1][1] = null;
    }

    removeLeftTri() {
        this.tris[0][0] = null;
        this.tris[1][0] = null;
    }

    hasGarbage() {
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                if (this.tris[i][j] !== null && this.tris[i][j].clr == 7) return true;
            }
        }
        return false;
    }

    isEmpty() {
        return this.tris[0][0] === null && this.tris[1][1] === null &&
            this.tris[1][0] === null && this.tris[0][1] === null;
    }

    isFull() {
        return (this.tris[0][0] !== null && this.tris[1][1] !== null) ||
            (this.tris[1][0] !== null && this.tris[0][1] !== null);
    }

    rotatedLeft() {
        let rotated = new GridCell();
        rotated.tris = [
            [this.tris[0][1], this.tris[1][1]],
            [this.tris[0][0], this.tris[1][0]],
        ];
        return rotated;
    }

    rotatedRight() {
        let rotated = new GridCell();
        rotated.tris = [
            [this.tris[1][0], this.tris[0][0]],
            [this.tris[1][1], this.tris[0][1]],
        ];
        return rotated;
    }

    addCell(cell) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (cell.tris[row][col])
                    this.tris[row][col] = cell.tris[row][col];
            }
        }
    }

    collides(other) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (!this.tris[row][col]) continue;
                if (
                    other.tris[row][col] ||
                    other.tris[(row + 1) % 2][col] ||
                    other.tris[row][(col + 1) % 2]
                )
                    return true; //There is a collision
            }
        }
        return false;
    }

    show(p5, x, y, w, h, pieceImages, ghost = false) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (this.tris[row][col])
                    this.tris[row][col].show(p5, x, y, w, h, row, col, pieceImages, ghost);
            }
        }
    }
}

export class Triangle {
    constructor(clr) {
        this.clr = clr;
    }

    show(p5, x, y, w, h, row, col, pieceImages, ghost = false) {
        const thisColor = pieceImages[this.clr];
        let rot;
        if (row == 0 && col == 0) { //Top left
            rot = 3;
        } else if (row == 0 && col == 1) { //Top right
            rot = 2;
        } else if (row == 1 && col == 0) { //Bottom left
            rot = 1;
        } else if (row == 1 && col == 1) { //Bottom right
            rot = 0;
        }

        const imageIndex = rot * 2 + (ghost ? 1 : 0);
        p5.image(thisColor[imageIndex], x, y, w, h);
    }
}

export class Piece {
    constructor(data, totalGridWidth) {
        if (data.hasOwnProperty('grid')) {
            //It is a serialized version
            const gridData = data.grid;
            this.grid = [];
            for (let i = 0; i < gridData.length; i++) {
                this.grid.push([]);
                for (let j = 0; j < gridData[0].length; j++) {
                    const gridCell = new GridCell(gridData[i][j]);
                    this.grid[i].push(gridCell);
                }
            }
            this.pos = {
                x: data.x,
                y: data.y
            }
            this.centerOffset = {
                x: data.centerOffsetX,
                y: data.centerOffsetY
            }
        } else {
            this.grid = [];
            const pieces = data.pieces;
            const clr = data.color;
            for (let row = 0; row < pieces.length; row++) {
                this.grid.push([]);
                for (let col = 0; col < pieces[0].length; col++) {
                    this.grid[row].push(new GridCell(pieces[row][col], clr));
                }
            }
            this.pos = {
                x: Math.ceil((totalGridWidth - this.grid[0].length) / 2),
                y: 0
            };
            let centerOffsetX = this.grid[0].length / 2;
            let centerOffsetY = this.grid.length / 2;
            if (data.hasOwnProperty('center')) {
                centerOffsetX = data.center[0];
                centerOffsetY = data.center[1];
            }
            this.centerOffset = {
                x: centerOffsetX,
                y: centerOffsetY
            }
        }
    }

    rotate180() {
        this.rotateLeft(); //The lazy way to rotate 180
        this.rotateLeft();
    }

    rotateLeft() { //Counter clockwise
        let newGrid = [];
        for (let newRow = 0; newRow < this.grid[0].length; newRow++) {
            newGrid.push([]);
            for (let newCol = 0; newCol < this.grid.length; newCol++) {
                const oldRow = newCol;
                const oldCol = this.grid[0].length - 1 - newRow;
                newGrid[newRow].push(this.grid[oldRow][oldCol].rotatedLeft());
            }
        }
        this.grid = newGrid;

        //Make sure it rotates around the center
        const newCenterOffset = {
            x: this.centerOffset.y,
            y: this.grid.length - this.centerOffset.x
        }
        this.pos = {
            x: this.pos.x + this.centerOffset.x - newCenterOffset.x,
            y: this.pos.y + this.centerOffset.y - newCenterOffset.y
        }
        this.centerOffset = newCenterOffset;
    }

    rotateRight() { //Clockwise
        let newGrid = [];
        for (let newRow = 0; newRow < this.grid[0].length; newRow++) {
            newGrid.push([]);
            for (let newCol = 0; newCol < this.grid.length; newCol++) {
                const oldRow = this.grid.length - 1 - newCol;
                const oldCol = newRow;
                newGrid[newRow].push(this.grid[oldRow][oldCol].rotatedRight());
            }
        }
        this.grid = newGrid;

        //Make sure it rotates around the center
        const newCenterOffset = {
            x: this.grid[0].length - this.centerOffset.y,
            y: this.centerOffset.x
        }
        this.pos = {
            x: this.pos.x + this.centerOffset.x - newCenterOffset.x,
            y: this.pos.y + this.centerOffset.y - newCenterOffset.y
        }
        this.centerOffset = newCenterOffset;
    }

    move(x, y) {
        this.pos.x += x;
        this.pos.y += y;
    }

    outOfBounds(w, h) {
        return (
            this.pos.x < 0 ||
            this.pos.x + this.grid[0].length > w ||
            this.pos.y < 0 ||
            this.pos.y + this.grid.length > h
        );
    }

    getBottomRow() {
        return this.pos.y + this.grid.length;
    }

    serialized() {
        let serializedGrid = [];
        for (let i = 0; i < this.grid.length; i++) {
            serializedGrid.push([]);
            for (let j = 0; j < this.grid[0].length; j++) {
                const thisCell = this.grid[i][j];
                serializedGrid[i].push(thisCell.serialized());
            }
        }
        return {
            grid: serializedGrid,
            x: this.pos.x,
            y: this.pos.y,
            centerOffsetX: this.centerOffset.x,
            centerOffsetY: this.centerOffset.y,
            rotation: this.rotation
        }
    }

    showAt(p5, x, y, w, h, pieceImages) {
        const dim = 3;//max(this.grid.length, this.grid[0].length);
        const cellW = w / dim;
        const cellH = h / dim;
        const topLeft = x - this.pos.x*cellW;//The subtraction is to offset from when the show function adds
        const topRight = y - this.pos.y*cellH;
        const centerX = topLeft + cellW*(3-this.grid[0].length)/2;
        const centerY = topRight + cellH*(3-this.grid.length)/2;
        //Centers the piece in the middle of the next box
        this.show(
            p5,
            centerX,
            centerY,
            w / dim,
            h / dim,
            pieceImages,
        );
    }

    show(p5, originX, originY, cellW, cellH, pieceImages, ghost = false) {
        originX += this.pos.x * cellW;
        originY += this.pos.y * cellH;
        for (let row = 0; row < this.grid.length; row++) {
            for (let col = 0; col < this.grid[0].length; col++) {
                this.grid[row][col].show(
                    p5,
                    originX + col * cellW,
                    originY + row * cellH,
                    cellW,
                    cellH,
                    pieceImages,
                    ghost
                );
            }
        }
    }
}
