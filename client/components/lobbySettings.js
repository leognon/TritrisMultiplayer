import React from 'react';
import { gameTypes, boardTypes } from '../../common/gameTypes.js';

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

                <label htmlFor="boardType">Board Type: </label>
                <select name="boardType" id="boardType"
                    value={this.props.boardType}
                    onChange={this.props.boardTypeChanged}
                >
                    <option value={boardTypes.NORMAL}>Normal (8x16)</option>
                    <option value={boardTypes.SMALL}>Small (4x8)</option>
                    <option value={boardTypes.TALL}>Tall (8x24)</option>
                </select>
                <br />

                <label htmlFor="quadtris">Quadtris: </label>
                <input id="quadtris" type="checkbox"
                    checked={this.props.quadtris}
                    onChange={this.props.quadtrisChanged}
                />
                <br />

                <label htmlFor="gameType">Game Type: </label>
                <select name="gameType" id="gameType"
                    value={this.props.gameType}
                    onChange={this.props.gameTypeChanged}
                >
                    <option value={gameTypes.CLASSIC}>Classic</option>
                    <option value={gameTypes.VERSUS}>Versus (Modern)</option>
                    <option value={gameTypes.B_TYPE}>B-Type</option>
                </select>
                <br />

                {
                    this.props.gameType == gameTypes.B_TYPE ?
                        <>
                            <label htmlFor="garbageHeight">Garbage Height: </label>
                            <input id="garbageHeight" type="number"
                                style={ {width: "50px" } }
                                onClick={e => e.target.select()} //Select all the text when clicked
                                value={this.props.garbageSettings.height}
                                onChange={this.props.garbageHeightChanged} />
                            <br />
                            <label htmlFor="garbageDensity">Garbage Density: </label>
                            <input id="garbageDensity" type="number"
                                style={ {width: "50px" } }
                                onClick={e => e.target.select()} //Select all the text when clicked
                                value={this.props.garbageSettings.density}
                                onChange={this.props.garbageDensityChanged} />
                            <br />

                        </>
                        : ''
                }

                <button onClick={this.props.toggleLockRoom}>
                    { this.props.roomIsLocked ? 'Unlock room' : 'Lock room' }
                </button>
                <br />

                <button onClick={this.props.startGame}>Start Game</button>
            </div>
        );
    }

    keyHandling = e => {
        if (e.keyCode == this.props.startKey) {
            this.props.startGame();
        }
    }

    componentDidMount = () => {
        window.addEventListener('keydown', this.keyHandling);
    }

    componentWillUnmount = () => {
        window.removeEventListener('keydown', this.keyHandling);
    }
}
