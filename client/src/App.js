import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {
    fetchData, 
    postData,
    // putData
  } from './api';

class App extends Component {
  state = {
    response: ''
  };

  componentDidMount() {
    this.getVersion()
      .then(res => { 
        this.setState({ version: res.version })
      })
      .catch(err => console.log(err));
    this.getCounter()
      .then(res => { 
        console.log(res);
      })
      .catch(err => console.log(err));
    this.userTest()
      .then(res => { 
        this.setState({ greeting: res.message });
        console.log(res);
      })
      .catch(err => console.log(err));
  }

  userTest = async () => {
    // const response = await fetchData('/user/test/meswain@gmail.com');
    const response = await postData('/user/login', { email: 'meswain@gmail.com', password: 'that1guy' });
    // const response = await postData('/user/register', { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });    
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

  getCounter = async () => {
    const response = await fetchData('/user/getCounter');
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
        <p className="App-intro">{this.state.greeting}</p>
      </div>
    );
  }
}

export default App;
