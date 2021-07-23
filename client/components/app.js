import ReactDOM from 'react-dom';
import React from 'react';
import Sketch from 'react-p5';

class App extends React.Component {
    constructor(props) {
        super(props);
    }

    setup(p5, canvasParentRef) {
        p5.createCanvas(400, 400).parent(canvasParentRef);
        p5.background(255,0,0);
    }

    draw(p5) {
        p5.ellipse(p5.random(100), p5.random(200, 400), 50, 50);
    }

    keyPressed(p5) {
        p5.background(Math.random()*255, Math.random()*255, Math.random()*255);
    }

    render() {
        return (
            <div>
                <h1>Hello world!</h1>
                <Sketch setup={this.setup} draw={this.draw} keyPressed={this.keyPressed} />
            </div>
        );
    }
}

ReactDOM.render(<App />, document.querySelector('#root'));
