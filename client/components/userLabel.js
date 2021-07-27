import React from 'react';

export default class UserLabel extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        const title = this.props.isOwner ? 'Owner' : 'User';
        return (
            <p>{title}: {this.props.name}</p>
        );
    }
}
