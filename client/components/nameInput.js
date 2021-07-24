import React from 'react';

export default class NameInput extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <input id="name"
                value={this.props.name}
                onChange={this.props.nameChanged}
                style={ { width: "100px" } }></input>
        );
    }
}
