import React from 'react';
import NameInput from './nameInput';

export default class Menu extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div id="joinDiv" className="box">
                <h2>Tritris Beta</h2>
                <label htmlFor="name">Name</label>
                <NameInput name={this.props.name} nameChanged={this.props.nameChanged} />
                <br />
                { /*<button id="quickPlay" onClick={this.props.quickPlay}>Quick play</button> */ }

                <br />
                <button id="createRoom" onClick={this.props.createRoom}>Create Room</button>
                <button id="joinRoom" onClick={this.props.joinRoom}>Join Room</button>
            </div>
        );
    }
}
