import React from 'react';
import SetControlButton from './setControlButton.js';

export default class Settings extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selected: ''
        }
    }

    toggleSelect = c => {
        if (this.state.selected === c)
            this.setState({ selected: '' });
        else
            this.setState({ selected: c });
    }

    renderControls = controls => {
        let items = [];
        for (const c in controls) {
            items.push(
                <SetControlButton
                    key={c}
                    control={controls[c]}
                    isSelected={this.state.selected === c}
                    toggleSelect={() => this.toggleSelect(c)}
                />
            );
        }
        return items;
    }

    keyHandling = e => {
        if (this.state.selected == '') return;

        this.props.controlChanged(this.state.selected, e.keyCode);
        this.setState({ selected: '' });

        //With space, It would instantly reclick the button which would prompt the user to enter another key even though they just did
        if (e.keyCode == 32) e.preventDefault();
    }

    componentDidMount = () => {
        window.addEventListener('keyup', this.keyHandling);
    }

    componentWillUnmount = () => {
        window.removeEventListener('keyup', this.keyHandling);
    }

    render = () => {
        return (
            <div className="popupContainer">
                <div className="popup box">
                    <h1>Settings</h1>
                    <hr />
                    <h3>Controls</h3>
                    { this.renderControls(this.props.controls) }
                    <button onClick={this.props.resetControls}>Revert to Defaults</button>
                    <hr />

                    <h3>Visual Settings</h3>
                    <label htmlFor="showGhost">Show Ghost Piece: </label>
                    <input id="showGhost" type="checkbox"
                        checked={this.props.visualSettings.showGhost}
                        onChange={evnt => this.props.visualSettingsChanged(evnt, 'showGhost')}
                    />
                    <br />
                    <label htmlFor="showGridLines">Show Grid Lines: </label>
                    <input id="showGridLines" type="checkbox"
                        checked={this.props.visualSettings.showGridLines}
                        onChange={evnt => this.props.visualSettingsChanged(evnt, 'showGridLines')}
                    />
                    <br />


                    <hr />
                    <h3>Music and Sounds</h3>
                    <label htmlFor="soundVolumeSlider">Sound Volume</label>
                    <input id="soundVolumeSlider" type="range" min="0" max="100"
                        value={this.props.soundVolume}
                        onChange={this.props.setSoundVolume}
                    />
                    <hr />

                    <label htmlFor="musicVolumeSlider">Music Volume</label>
                    <input id="musicVolumeSlider" type="range" min="0" max="100"
                        value={this.props.musicVolume}
                        onChange={this.props.setMusicVolume}
                    />
                    <hr />

                    <button onClick={() => this.props.toggleSettings(false)}>Close</button>
                </div>
            </div>
        );
    }
}
