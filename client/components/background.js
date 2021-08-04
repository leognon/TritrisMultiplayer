import React from 'react';
import Sketch from 'react-p5';

export default class Background extends React.Component {
    constructor(props) {
        super(props);
        this.triangles = [];
        this.nextSpawn = Date.now();

        this.lastFrame = Date.now();
    }

    setup = (p5, canvasParentRef) => {
        p5.createCanvas(window.innerWidth, window.innerHeight).parent(canvasParentRef);
        this.draw(p5);
    }

    windowResized = p5 => {
        p5.resizeCanvas(window.innerWidth, window.innerHeight);
        p5.redraw();
    }

    draw = p5 => {
        const deltaTime = Date.now() - this.lastFrame;

        p5.background(100);

        for (let i = this.triangles.length-1; i >= 0; i--) {
            const t = this.triangles[i];
            t.show(p5);
            t.move(deltaTime);
            if (t.offScreen(p5)) {
                this.triangles.splice(i, 1);
            }
        }

        if (Date.now() > this.nextSpawn) {
            this.spawnTriangle(p5);
            this.nextSpawn = Date.now() + p5.random(100, 500);
        }

        this.lastFrame = Date.now();
    }

    spawnTriangle = p5 => {
        const w = 50;
        const speed = 0.3;
        const border = Math.PI / 3;
        let x, y, theta;
        if (Math.random() < 0.5) {
            //Spawn on left or right side
            theta = p5.random(-Math.PI/2 + border, Math.PI/2 - border);
            if (Math.random() < 0.5) x = -w; //Left wall
            else {
                x = p5.width + w; //Right wall
                theta += Math.PI;
            }

            y = Math.random() * p5.height;
        } else {
            //Spawn on top or bottom
            theta = p5.random(-border, -Math.PI + border);
            if (Math.random() < 0.5) {
                y = -w; //Top
                theta += Math.PI;
            } else {
                y = p5.height + w; //Bottom
            }

            x = Math.random() * p5.width;
        }

        const vx = Math.cos(theta) * speed;
        const vy = Math.sin(theta) * speed;
        const img = this.props.pieceImages[Math.floor(Math.random() * this.props.pieceImages.length)][0];
        this.triangles.push(new Triangle(x, y, w, vx, vy, img));
    }

    render = () => {
        return <Sketch setup={this.setup} draw={this.draw} windowResized={this.windowResized} />;
    }
}

class Triangle {
    constructor(x, y, w, vx, vy, img) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.w = w;
        this.img = img;
    }

    move(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }

    offScreen(p5) {
        return (this.x < -this.w*2 || this.x > p5.width + this.w*2 ||
            this.y < -this.w*2 || this.y > p5.height + this.w*2);
    }

    show(p5) {
        p5.push()
        p5.translate(this.x - this.w/2, this.y - this.w/2);
        p5.rotate(Math.atan2(this.vy, this.vx));
        p5.image(this.img, -this.w/2, -this.w/2, this.w, this.w);
        p5.pop();
    }
}
