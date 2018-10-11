import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  state = {
    response: ''
  };

  componentDidMount() {
    this.callApi()
      .then(res => this.setState({ response: res.express }))
      .catch(err => console.log(err));
    this.getVersion()
      .then(res => this.setState({ version: res.version }))
      .catch(err => console.log(err));
  }

  getVersion = async () => {
    const response = await fetch('/api/version');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  callApi = async () => {
    const response = await fetch('/api/hello');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          Welcome to Scriptlings v{this.state.version}!
        </header>
        <p className="App-intro">{this.state.response}</p>
      </div>
    );
  }
}

export default App;
