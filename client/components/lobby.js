import React from 'react';
import UserLabel from './userLabel.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showRoomCode: true
        }
    }

    toggleShowRoomCode = () => {
        this.setState({
            showRoomCode: !this.state.showRoomCode
        });
    }

    getShownRoomCode = () => {
        let code = this.props.roomCode;
        if (!this.state.showRoomCode) {
            //Replace all the characters with *
            code = code.split('').fill('*').join('');
        }
        return code;
    }

    getUserLabel = u => {
        return <UserLabel
            key={u.id}
            name={u.name}
            isOwner={this.props.ownerId == u.id}
            isReady={u.isReady && !u.isSpectator}
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
                <p onClick={this.toggleShowRoomCode}>Code: {this.getShownRoomCode()}</p>
                <hr />
                <h3>Players</h3> { playerList }
                { spectatorList.length > 0 ? <><hr /><h3>Spectators</h3></> : ''}
                {spectatorList }

                <hr />
                {
                    !this.props.users.filter(u => u.id === this.props.myId)[0].isSpectator
                        ?  <button onClick={this.props.changeReady}>Toggle Ready</button>
                        : ''
                }
                <button onClick={this.props.leaveRoom}>Leave Room</button>
            </div>
            </>
        );
    }
}
