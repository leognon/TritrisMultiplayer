import React from 'react';
import UserLabel from './playerLabel.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div id="lobbyDiv" className="center box">
                {
                    this.props.isOwner
                        ? <h2>Created Lobby</h2>
                        : <h2>Joined Lobby</h2>
                }
                <p>Code: {this.props.roomCode}</p>
                {
                    this.props.users.map((p, index) => {
                        return <UserLabel
                            key={index}
                            name={p.name}
                            />;
                    })
                }
                {
                    this.props.isOwner ?
                    <button onClick={this.props.startGame}>Start Game</button>
                    : ''
                }
            </div>
        );
    }
}
