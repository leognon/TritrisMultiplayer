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

    show(p5, x, y, w, h, pieceImages, showGridLines) {
        const cellW = w / this.w;
        const cellH = h / this.h;

        if (showGridLines) {
            //Draws the grid outline
            p5.stroke(100);
            p5.strokeWeight(2);
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
                    pieceImages
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

    show(p5, x, y, w, h, pieceImages) {
        for (let row = 0; row < this.tris.length; row++) {
            for (let col = 0; col < this.tris[0].length; col++) {
                if (this.tris[row][col])
                    this.tris[row][col].show(p5, x, y, w, h, row, col, pieceImages);
            }
        }
    }
}

export class Triangle {
    constructor(clr) {
        this.clr = clr;
    }

    show(p5, x, y, w, h, row, col, pieceImages) {
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
        p5.image(thisColor[rot], x, y, w, h);
    }
}

export class Piece {
    constructor(data) {
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
            this.rotation = data.rotation;
            this.rotations = data.rotations;
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
                x: Math.ceil((8 - this.grid[0].length) / 2),
                y: 0
            };
            this.rotation = 0;
            this.rotations = data.rotationOffset || [[0, 0]]; //How the position should change when rotated. If not specified, the pos can stay the same (for pieces with square dimensions)
        }
    }

    rotate180() {
        this.rotateLeft(); //The lazy way to rotate 180
        this.rotateLeft();
    }

    rotateLeft() {
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

        //Calculates a new position so the piece stays centered around the same piece
        this.pos.x += this.rotations[this.rotation][0]
        this.pos.y += this.rotations[this.rotation][1];
        this.rotation = (this.rotation + 1) % this.rotations.length;
    }

    rotateRight() {
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

        //Calculates a new position so the piece stays centered around the same piece
        this.rotation = (this.rotation - 1 + this.rotations.length) % this.rotations.length;
        this.pos.x -= this.rotations[this.rotation][0]
        this.pos.y -= this.rotations[this.rotation][1];
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
            rotation: this.rotation,
            rotations: this.rotations
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

    show(p5, originX, originY, cellW, cellH, pieceImages) {
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
                    pieceImages
                );
            }
        }
    }
}
