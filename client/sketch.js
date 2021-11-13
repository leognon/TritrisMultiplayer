const p5States = {
    LOADING: 0,
    BACKGROUND: 1,
    INGAME: 2
}


//Modified from https://www.w3schools.com/graphics/game_sound.asp
class Sound {
    constructor(src) {
        this.sound = document.createElement('audio');

        this.sound.src = src;
        this.sound.setAttribute('preload', 'auto');
        this.sound.setAttribute('controls', 'none');
        this.sound.style.display = 'none';

        document.querySelector('#sound').appendChild(this.sound);
    }

    setVolume(vol) {
        this.sound.volume = vol;
    }

    play() {
        this.sound.play();
    }
}

let myP5;
const sketch = p => {
    myP5 = p;

    p.totalAssets = 2; //peiceImages, font
    p.numAssetsLoaded = 0;

    p.pieceImages = null;
    p.font = null;

    p.socket = null;
    p.frameRateDisplay = 60; //So the name doesn't conflict with p.frameRate()
    p.lastFrameRateUpdate = -Infinity;
    p.updateFrameRateEvery = 3 * 1000;

    p.sounds = {
        move: new Sound('../client/assets/move.wav'),
        fall: new Sound('../client/assets/fall.wav'),
        clear: new Sound('../client/assets/clear.wav'),
        tritris: new Sound('../client/assets/tritris.wav'),
        levelup: new Sound('../client/assets/levelup.wav'),
        topout: new Sound('../client/assets/topout.wav')
    };

    p.setup = () => {
        p.createCanvas(window.innerWidth, window.innerHeight); //.parent(canvasParentRef);
        p.background(100);
        p.loadImage('./client/assets/piecesImage.png', img => {
            p.pieceImages = loadPieces(p, img);
            p.numAssetsLoaded++;
        });
        p.loadFont('./client/assets/fff-forward.ttf', fnt => {
            p.font = fnt;
            p.textFont(p.font);
            p.numAssetsLoaded++;
        });
    }

    p.state = -1;
    p.customDraw = () => {};
    p.customKeyPressed = () => {};

    p.setStateIfDifferent = (newState, drawFn, keyPressedFn = () => {}) => {
        if (p.state != newState || p.state == -1) {
            p.setState(newState, drawFn, keyPressedFn);
        }
    }

    p.setState = (name, drawFn, keyPressedFn = () => {}) => {
        p.state = name;
        p.customDraw = drawFn;
        if (keyPressedFn) p.customKeyPressed = keyPressedFn;
        else p.customKeyPressed = () => {};
    }

    p.draw = () => {
        p.customDraw(p);

        const scl = p.width * p.height / (1920 * 1080);

        if (Date.now() > p.lastFrameRateUpdate + p.updateFrameRateEvery) {
            p.frameRateDisplay = Math.round(p.frameRate());
            p.lastFrameRateUpdate = Date.now();
        }

        let socketText = 'Connecting...';
        let col = p.color(0);
        if (p.socket !== null) {
            if (p.socket.outOfSync) {
                socketText = 'Disconnected. Please refresh the page';
                col = p.color(200, 0, 0);
            } else if (p.socket.disconnected) {
                socketText = 'Disconnected...';
                col = p.color(200, 0, 0);
            } else {
                socketText = `Ping: ${p.socket.latency}ms`;
            }
        }

        let text = `${socketText} | ${p.frameRateDisplay}fps`;

        p.textSize(20 * scl);
        p.fill(col);
        p.textAlign(p.RIGHT, p.TOP);
        p.text(text, p.width - 10*scl, 10*scl);
    }

    p.keyPressed = () => {
        p.customKeyPressed(p);
    }

    p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        p.redraw();
    }

    p.setSoundVolume = vol => {
        for (const sound in p.sounds) {
            p.sounds[sound].setVolume(vol / 100);
        }
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
