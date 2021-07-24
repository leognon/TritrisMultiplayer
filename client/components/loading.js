import React from 'react';

export default class Loading extends React.Component {
    constructor(props) {
        super(props);
    }

    render = () => {
        return (
            <div className="center box">
                <h1>Loading...</h1>
            </div>
        );
    }
}
