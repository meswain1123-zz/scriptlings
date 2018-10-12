import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {
    fetchData,
    // postData,
    // putData
  } from './api';

class App extends Component {
  state = {
    response: ''
  };

  componentDidMount() {
    this.callApi()
      .then(res => this.setState({ response: res.express }))
      .catch(err => console.log(err));
    this.getVersion()
      .then(res => { 
        this.setState({ version: res.version })
      })
      .catch(err => console.log(err));
    this.userTest()
      .then(res => { 
        console.log(res);
      })
      .catch(err => console.log(err));
  }

  userTest = async () => {
    const response = await fetchData('/user/test');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  getVersion = async () => {
    const response = await fetchData('/version');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  callApi = async () => {
    const response = await fetchData('/hello');
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
