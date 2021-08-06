import React from 'react';

export default class Settings extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div className="popupContainer">
                <div className="popup box">
                    <h1>Settings</h1>
                    <hr />
                    <h3>Controls</h3>


                    <hr />
                    <button onClick={() => this.props.toggleSettings(false)}>Close</button>
                </div>
            </div>
        );
    }
}
