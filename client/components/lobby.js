import React from 'react';
import UserLabel from './userLabel.js';
import Settings from './settings.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showRoomCode: true,
            showSettings: false
        }
    }

    toggleShowRoomCode = () => {
        this.setState({
            showRoomCode: !this.state.showRoomCode
        });
    }

    toggleSettings = show => {
        this.setState({
            showSettings: show
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
            key={u.getId()}
            name={u.name}
            isOwner={this.props.ownerId == u.getId()}
            isReady={u.isReady && !u.isSpectator}
            isMe={u.getId() == this.props.myId}
            toggleSpectator={() => this.props.toggleSpectator(u.getId())}
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
                    !this.props.users.filter(u => u.getId() === this.props.myId)[0].isSpectator
                        ?  <button onClick={this.props.changeReady}>Toggle Ready</button>
                        : ''
                }

                <button id="settings" onClick={() => this.toggleSettings(true)}>Settings</button>
                { this.state.showSettings &&
                    <Settings
                        toggleSettings={this.toggleSettings}
                        controls={this.props.controls}
                        controlChanged={this.props.controlChanged}
                        resetControls={this.props.resetControls}
                        soundVolume={this.props.soundVolume}
                        setSoundVolume={this.props.setSoundVolume}

                        visualSettings={this.props.visualSettings}
                        visualSettingsChanged={this.props.visualSettingsChanged}
                    />
                }

                <button onClick={this.props.leaveRoom}>Leave Room</button>
            </div>
            </>
        );
    }
}
