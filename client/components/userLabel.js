import React from 'react';

export default class UserLabel extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        const title = this.props.isOwner ? 'Owner' : 'User';
        const isMyLabel = this.props.isMe ? 'myLabel' : '';
        return <p className={isMyLabel} onClick={this.props.toggleSpectator}>{title}: {this.props.name}</p>;
    }
}
