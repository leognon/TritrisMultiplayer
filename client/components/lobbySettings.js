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
                    onClick={e => e.target.select()}
                    value={this.props.startLevel}
                    onChange={this.props.startLevelChanged} />

                <br />
                <button onClick={this.props.startGame}>Start Game</button>
            </div>
        );
    }
}
