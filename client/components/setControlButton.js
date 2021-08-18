import React from 'react';
import keyboardMap from './keyboardMap.js';

export default class SetControlButton extends React.Component {
    constructor(props) {
        super(props);
    }


    render = () => {
        return (
            <div>
                <label htmlFor={this.props.control.controlName}>{this.props.control.controlName}: </label>
                <button
                    name={this.props.control.controlName}
                    onClick={this.props.toggleSelect}
                >
                    {this.props.isSelected ? 'Press a key' : keyboardMap[this.props.control.key]}
                </button>

                <br />
            </div>
        );
    };
}
