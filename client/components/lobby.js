import React from 'react';
import UserLabel from './userLabel.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
    }

    getUserLabel = u => {
        return <UserLabel
            key={u.id}
            name={u.name}
            isOwner={this.props.ownerId == u.id}
            isSpectator={u.isSpectator}
            isMe={u.id == this.props.myId}
            toggleSpectator={() => this.props.toggleSpectator(u.id)}
        />;
    }

    render = () => {
        const isOwner = this.props.myId == this.props.ownerId;
        const title = isOwner ? 'Created Lobby' : 'Joined Lobby';
        const playerList = this.props.users.filter(u => !u.isSpectator).map(this.getUserLabel);
        const spectatorList = this.props.users.filter(u => u.isSpectator).map(this.getUserLabel);
        return (
            <>
            <div id="lobbyDiv" className="box">
                <h1>{ title }</h1>
                <p>Code: {this.props.roomCode}</p>
                <hr />
                <h3>Players</h3> { playerList }
                { spectatorList.length > 0 ? <><hr /><h3>Spectators</h3></> : ''}
                {spectatorList }

                <hr />
                <button onClick={this.props.leaveRoom}>Leave Room</button>
            </div>
            </>
        );
    }
}
