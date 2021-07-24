import ReactDOM from 'react-dom';
import React from 'react';
import Sketch from 'react-p5';
import states from '../../common/states.js';
import Loading from './loading.js';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            state: states.LOADING
        }
    }

    setup(p5, canvasParentRef) {
        p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
        p5.background(255,0,0);
    }

    draw(p5) {
        p5.background(255,0,0);
    }

    windowResized(p5) {
        p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
        p5.redraw();
    }

    getUI() {
        switch (this.state.state) {
            case states.LOADING:
                return <Loading />;
            default:
                console.log('State was ' + this.state.state);
                return <h2>State: {this.state.state}</h2>;
        }
    }

    render() {
        return (
            <>
                <Sketch setup={this.setup} draw={this.draw} windowResized={this.windowResized} />
                { this.getUI() }
            </>
        );
    }
}

ReactDOM.render(<App />, document.querySelector('#root'));
/*
App
    Loading
        Text in center saying loading
    Home
        Box in center
            Title
            Name input
            Play buttons
    Room
        Lobby
            Box in center
                Room code
                List of players
        Ingame
            Empty
*/
