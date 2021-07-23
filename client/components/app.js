import ReactDOM from 'react-dom';
import React from 'react';
//import Sketch from 'react-p5';

class App extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>
                <h1>Hello world!</h1>
            </div>
        );
    }
}

ReactDOM.render(<App />, document.querySelector('#root'));
