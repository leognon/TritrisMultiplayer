import React from 'react';

export default class LobbySettings extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div id="lobbySettings" className="box">
                <h1>Settings</h1>

                <label htmlFor="levelStart">Start Level: </label>
                <input id="levelStart" type="number"
                    min="0" max="29" style={ {width: "50px" } }
                    onClick={e => e.target.select()} //Select all the text when clicked
                    value={this.props.startLevel}
                    onChange={this.props.startLevelChanged} />
                <br />

                <label htmlFor="4x8">4x8: </label>
                <input id="4x8" type="checkbox"
                    checked={this.props.use4x8}
                    onChange={this.props.use4x8Changed}
                />
                <br />


                <button onClick={this.props.toggleLockRoom}>
                    { this.props.roomIsLocked ? 'Unlock room' : 'Lock room' }
                </button>
                <br />

                <button onClick={this.props.startGame}>Start Game</button>
            </div>
        );
    }
}
