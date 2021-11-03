const p5States = {
    LOADING: 0,
    BACKGROUND: 1,
}


let myP5;
const sketch = p => {
    myP5 = p;

    p.totalAssets = 2; //peiceImages, font
    p.numAssetsLoaded = 0;

    p.pieceImages = null;
    p.font = null;

    p.setup = () => {
        p.createCanvas(window.innerWidth, window.innerHeight); //.parent(canvasParentRef);
        p.background(100);
        p.loadImage('./client/assets/piecesImage.png', img => {
            p.pieceImages = loadPieces(p, img);
            p.numAssetsLoaded++;
        });
        p.loadFont('./client/assets/fff-forward.ttf', fnt => {
            p.font = fnt;
            p.numAssetsLoaded++;
        });
    }

    p.drawName = -1;
    p.customDraw = () => {};

    p.setDrawIfDifferent = (name, fn) => {
        if (p.drawName != name || p.drawName == -1) {
            p.setDraw(name, fn);
        }
    }

    p.setDraw = (name, fn) => {
        console.log('Draw state set to ' + Object.keys(p5States).filter(x => p5States[x] == name)[0]);
        p.drawName = name;
        p.customDraw = fn;
    }

    p.draw = () => {
        p.customDraw(p);
    }
}
new p5(sketch);

function loadPieces(p5, spriteSheet) {
    let pieceImages = []; //A 2d array of each piece color and their rotations and tinted versions
    for (let i = 0; i < 2; i++) { //All of the colors (except white)
        for (let j = 0; j < 3; j++) {
            pieceImages.push(load4Triangles(i, j, spriteSheet));
        }
    }
    pieceImages.push(load4Triangles(0, 3, spriteSheet)); //The white ninja
    pieceImages.push(load4Triangles(1, 3, spriteSheet)); //The grey triangle

    function load4Triangles(i, j, piecesImage) { //Aaaaaah a function inside a function!!!
        const triWidth = piecesImage.width / 8;
        let triangles = [];
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const x = (j*2 + col) * triWidth; //The j*2 is because each set of 4 is a 2x2 square of triangles
                const y = (i*2 + row) * triWidth;
                const imageSlice = piecesImage.get(x, y, triWidth, triWidth);
                triangles.push(imageSlice); //A single rotation (not tinted)

                let g = p5.createGraphics(triWidth, triWidth);
                g.tint(255, 100); //Make it slightly transparent
                g.image(imageSlice, 0, 0);
                const tintedImg = g.get(); //Get the p5.Image that is now tinted. Drawing this will be fast
                g.remove();

                triangles.push(tintedImg); //That same rotation, tinted
            }
        }
        return triangles;
    }

    return pieceImages;
}

export { myP5 as p5, p5States };
