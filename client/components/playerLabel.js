import React from 'react';

export default class UserLabel extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <p>User: {this.props.name}</p>
        );
    }
}
