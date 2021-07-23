class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = { liked: false };
    }

    render() {
        if (this.state.liked) {
            return (
                <h1>You liked this.</h1>
            );
        }

        return (
          <button onClick={() => this.setState({ liked: true })}>
            Like
          </button>
        );
    }
}

const domContainer = document.querySelector('#root');
ReactDOM.render(<App />, domContainer);
