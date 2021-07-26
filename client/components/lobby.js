import React from 'react';
import UserLabel from './playerLabel.js';

export default class Lobby extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div id="lobbyDiv" className="center box">
                <h2>Lobby</h2>
                <p>Code: {this.props.roomCode}</p>
                {
                    this.props.users.map((p, index) => {
                        return <UserLabel
                            key={index}
                            name={p.name}
                            />;
                    })
                }
            </div>
        );
    }
}
