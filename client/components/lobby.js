import React from 'react';
import UserLabel from './userLabel.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div id="lobbyDiv" className="center box">
                {
                    this.props.myId == this.props.ownerId
                        ? <h2>Created Lobby</h2>
                        : <h2>Joined Lobby</h2>
                }
                <p>Code: {this.props.roomCode}</p>
                {
                    this.props.users.map((p, index) => {
                        return <UserLabel
                            key={index}
                            name={p.name}
                            isOwner={this.props.ownerId == p.id}
                            />;
                    })
                }
                {
                    this.props.myId == this.props.ownerId ?
                    <button onClick={this.props.startGame}>Start Game</button>
                    : ''
                }
                <button onClick={this.props.leaveRoom}>Leave Room</button>
            </div>
        );
    }
}
