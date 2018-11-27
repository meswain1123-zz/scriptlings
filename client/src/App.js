import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {
    fetchData, 
    postData,
    // putData
  } from './api';
  import { 
    Button, 
    FormGroup, 
    // FormControl, 
    // ControlLabel 
  } from 'react-bootstrap';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      worldID: "5bfda8790114f913dabb1791",
      user: { email: 'meswain@gmail.com', password: 'that1guy' }
    };
    this.loginClick = this.loginClick.bind(this);
    this.joinClick = this.joinClick.bind(this);
    this.startClick = this.startClick.bind(this);
    this.stopClick = this.stopClick.bind(this);
    this.userScriptlingsClick = this.userScriptlingsClick.bind(this);
    this.worldClick = this.worldClick.bind(this);
    this.createWorldClick = this.createWorldClick.bind(this);
  }

  loginClick() {
    this.userTest()
      .then(res => { 
        console.log(res);
        this.setState({ greeting: res.message, user: res.user });
      })
      .catch(err => console.log(err));
  }

  joinClick() {
    this.join()
      .then(res => { 
        console.log(res);
      })
      .catch(err => console.log(err));
  }

  startClick() {
    this.startWorld()
      .then(res => { 
        console.log('Started');
      })
      .catch(err => console.log(err));
  }

  stopClick() {
    this.stopWorld()
      .then(res => { 
        console.log('Stopped');
      })
      .catch(err => console.log(err));
  }

  userScriptlingsClick() {
    this.getUserScriptings()
      .then(res => { 
        console.log(res);

        const locationArr = [];
        const strArr = [];
        const locationHash = {};

        let maxX = 0;
        let maxY = 0;
        let minX = 0;
        let minY = 0;
        res.forEach( scriptling => {
          console.log(scriptling);
          if (!isNaN(scriptling.self.location.y)) {
            // REMINDER: I should probably change locationHash to hold arrays of objects.  
            // Then when preparing to render it can go through each element and decide what to display.
            if (locationHash[scriptling.self.location.y] === undefined || 
              locationHash[scriptling.self.location.y] === null) {
              locationHash[scriptling.self.location.y] = {};
            }
            locationHash[scriptling.self.location.y][scriptling.self.location.x] = scriptling;
            // console.log(scriptling.location.x, scriptling.type);
            maxX = Math.max(maxX, scriptling.self.location.x);
            maxY = Math.max(maxY, scriptling.self.location.y);
            minX = Math.min(minX, scriptling.self.location.x);
            minY = Math.min(minY, scriptling.self.location.y);

            scriptling.resources.forEach( resource => {
              locationHash[resource.location.y][resource.location.x] = resource;
              maxX = Math.max(maxX, resource.location.x);
              maxY = Math.max(maxY, resource.location.y);
              minX = Math.min(minX, resource.location.x);
              minY = Math.min(minY, resource.location.y);
            });
            scriptling.scriptlings.forEach( s => {
              locationHash[s.location.y][s.location.x] = s;
              maxX = Math.max(maxX, s.location.x);
              maxY = Math.max(maxY, s.location.y);
              minX = Math.min(minX, s.location.x);
              minY = Math.min(minY, s.location.y);
            });
          }
        });
        console.log(minX + ' ' +maxX + ' ' + minY + ' ' + maxY);
        const tempRow = [{ location: { x: null, y: null }, type: `-` }];
        let tempStrRow = '-';
        for (let i = minX; i <= maxX; i++) {
          tempRow.push({ location: { x: i, y: null }, type: `${i%10}` });
          tempStrRow += `${i%10}`;
        }
        locationArr.push(tempRow);
        strArr.push(tempStrRow);
        for (let i = minY; i <= maxY; i++) {
          const hashRow = locationHash[i];
          const arrRow = [];
          const iStr = (`${i}`);
          let strRow = iStr.substring(iStr.length - 1);
          for (let j = minX; j <= maxX; j++) {
            if (hashRow === undefined || hashRow === null || 
              hashRow[j] === undefined || hashRow[j] === null) {
              arrRow.push({ location: { x: j, y: i }, type: 'Empty' });
              strRow += '_';
            }
            else {
              // console.log(hashRow[j].type);
              arrRow.push(hashRow[j]);
              if (hashRow[j].type === undefined) {
                strRow += 'S';
              }
              else {
                strRow += hashRow[j].type.substring(0, 1);
              }
            }
          }
          locationArr.push(arrRow);
          strArr.push(strRow);
        }
        console.log(locationArr);
        console.log(strArr);
        this.setState({ locationArr, strArr });
      })
      .catch(err => console.log(err));
  }

  worldClick() {
    this.getWorldResources()
      .then(res => { 
        console.log(res);

        this.setState({ resourceArr: res });

        this.getWorldScriptings()
          .then(res => {
            console.log(res);

            const locationArr = [];
            const strArr = [];
            const locationHash = {};

            let maxX = 0;
            let maxY = 0;
            this.state.resourceArr.forEach( resource => {
              if (!isNaN(resource.location.coordinates.y)) {
                if (locationHash[resource.location.coordinates.y] === undefined || 
                  locationHash[resource.location.coordinates.y] === null) {
                  locationHash[resource.location.coordinates.y] = {};
                }
                locationHash[resource.location.coordinates.y][resource.location.coordinates.x] = resource;
                // console.log(resource.location.coordinates.x, resource.type);
                maxX = Math.max(maxX, resource.location.coordinates.x);
                maxY = Math.max(maxY, resource.location.coordinates.y);
              }
            });
            // Do the scriptlings after the resources so they trump resources on display.
            // This is just temporary.  
            res.forEach( scriptling => {
              console.log(scriptling);
              if (!isNaN(scriptling.location.y)) {
                if (locationHash[scriptling.location.y] === undefined || 
                  locationHash[scriptling.location.y] === null) {
                  locationHash[scriptling.location.y] = {};
                }
                locationHash[scriptling.location.y][scriptling.location.x] = scriptling;
                // console.log(scriptling.location.x, scriptling.type);
                maxX = Math.max(maxX, scriptling.location.x);
                maxY = Math.max(maxY, scriptling.location.y);
              }
            });
            // console.log(maxX);
            // console.log(maxY);
            const tempRow = [];
            for (let i = 0; i <= maxX; i++) {
              tempRow.push({ location: { x: i, y: -1 }, type: `${i%10}` });
            }
            locationArr.push(tempRow);
            for (let i = 0; i <= maxY; i++) {
              const hashRow = locationHash[i];
              const arrRow = [];
              let strRow = '';
              for (let j = 0; j <= maxX; j++) {
                if (hashRow === undefined || hashRow === null || 
                  hashRow[j] === undefined || hashRow[j] === null) {
                  arrRow.push({ location: { x: j, y: i }, type: 'Empty' });
                  strRow += '_';
                }
                else {
                  // console.log(hashRow[j].type);
                  arrRow.push(hashRow[j]);
                  if (hashRow[j].type === undefined) {
                    strRow += 'S';
                  }
                  else {
                    strRow += hashRow[j].type.substring(0, 1);
                  }
                }
              }
              locationArr.push(arrRow);
              strArr.push(strRow);
              // console.log(strRow);
            }
            // console.log(locationArr);
            // console.log(strArr);
            this.setState({ locationArr, strArr });
          });
      })
      .catch(err => console.log(err));
  }

  createWorldClick() {
    this.createWorld()
      .then(res => {
        console.log(res);
      })
      .catch(err => console.log(err));
  }

  componentDidMount() {
    this.getVersion()
      .then(res => { 
        this.setState({ version: res.version });
      })
      .catch(err => console.log(err));
  }

  userTest = async () => {
    // const response = await fetchData('/user/test/meswain@gmail.com');
    const response = await postData('/user/login', this.state.user);
    // const response = await postData('/user/register', { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });    
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  getWorldResources = async () => {
    const options = { worldID: this.state.worldID, skip: 0, take: 100 };
    let response = await postData('/world/getWorldResources', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let resources = body.resourceArr;

    while(body.resourceArr.length === 100) {
      options.skip = resources.length;
      response = await postData('/world/getWorldResources', options);
      body = await response.json();
  
      if (response.status !== 200) throw Error(body.message);

      resources = [...resources, ...body.resourceArr];
    }

    return resources;
  };

  getWorldScriptings = async () => {
    const options = { worldID: this.state.worldID, skip: 0, take: 100 };
    let response = await postData('/world/getWorldScriptlings', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let scriptlings = body.scriptlingArr;

    while(body.scriptlingArr.length === 100) {
      options.skip = scriptlings.length;
      response = await postData('/world/getWorldScriptlings', options);
      body = await response.json();
  
      if (response.status !== 200) throw Error(body.message);

      scriptlings = [...scriptlings, ...body.resourceArr];
    }

    return scriptlings;
  };

  startWorld = async () => {
    const response = await postData('/world/startWorld', { worldID: this.state.worldID });
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  stopWorld = async () => {
    const response = await postData('/world/stopWorld', { worldID: this.state.worldID });
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  getUserScriptings = async () => {
    const options = { worldID: this.state.worldID, skip: 0, take: 100 };
    let response = await postData('/world/getScriptlingsForUser', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let scriptlings = body.scriptlingArr;


    // while(body.scriptlingArr.length === 100) {
    //   options.skip = scriptlings.length;
    //   response = await postData('/world/getScriptlingsForUser', options);
    //   body = await response.json();
  
    //   if (response.status !== 200) throw Error(body.message);

    //   scriptlings = [...scriptlings, ...body.resourceArr];
    // }

    return scriptlings;
  };

  join = async () => {
    const response = await postData('/world/join', { worldID: this.state.worldID, home: { x: 50, y: 50} });
    // const response = await postData('/user/register', { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });    
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  createWorld = async () => {
    const options = {
      name: 'Scripterra',
      worldBlockFormula: {
        width: 100,
        wallThickness: 
        {
          size: 4,
          var: 1
        },
        wallResources: [
          {
            type: 'Iron',
            percentage: 100
          }
        ]
      },
      resourceFormulae: [{
        name: 'Iron', 
        rarity: 40, // In each worldBlock, how many groups should there be?
        density: {
          size: 10, // How many nodes to put in a group.  Needs to have a max of 45 (including var).
          var: 5, // Node groups will be size +/- var big
        },
        spawnTimer: {
          time: 100, // How many minutes after 'death' before respawn
          var: 10, // On 'death' a respawn time is set to currentTime + (time +/- var) minutes
        },
        passability: {
          speedFactor: 0, // When passing through a resource, speed is multiplied by speedFactor.  Should be 0<=speedFactor<=1.
          HP: 0, // When passing through a resource scriptling's HP lowers by this number each tick.
          // REMINDER: I don't want these for v1, but I like the idea of them.
          // senses: {
          //   factor: 1, // When passing through a resource sense radius is multiplied by factor.  Should be 0<=factor<=1.
          //   distortion: 0, // When passing through a resource sense will place sensed items up to this number off from actual location.
          //   hallucination: 0, // When passing through a resource sense will have chance to 
          // },
          // misdirection: 0, // When passing through a resource your direction can be sent off course by an angle up to this.
        }
      }],
      defaultUIScript: "", // I'll figure this out later
      scriptlingFormula: {
        cost: 
        [ // Cost to make a new scriptling
          {
            resource: 'Iron',
            amount: 50
          }
        ], 
        defaultMindScript: "", // Default mindScript to give the user something to start with.  mindScript executes every tick.
        birthScript: "console.log('Good Morning, Dave!);", // Executes on scriptling creation.
        upkeepScript: "console.log(\"I'm hungry\");", // Executes every hour.  Basically it's to make scriptlings require maintenance, food, etc.
        deathScript: "console.log(\"This was a triumph!  I'm making a note here: 'Huge Success!'\");", // Executes when a scriptling dies.
        senseRange: 10
      },
      startLocationFormula: {
        resources: 
        [
          {
            resource: 'Iron',
            minNodes: 3,
            dist: 
            {
              min: 3,
              max: 10
            }
          }
        ],
        mobs: {
          dist: {
            min: 4,
            max: -1
          }
        },
        scriptlings: {
          dist: {
            min: 10,
            max: -1
          }
        }
      },
      // mobFormulae: options.mobFormulae,
      // wallFormulae: options.wallFormulae, // REMINDER: I do want to add these features eventually, but I also want to get something working soonish.  Leaving them out for now.
      // itemFormulae: options.itemFormulae,
      // researchFormulae: options.researchFormulae
    };
    console.log('creating world');
    // const response = await fetchData('/user/test/meswain@gmail.com');
    const response = await postData('/genesis/createWorld', options);
    // const response = await postData('/user/register', { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });    
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  generateResources = async () => {
    const options = { worldID: "5bf46e1bfc5b2819ba140dd9", blockID: "5bf46e1cfc5b2819ba140dda" };
    // const response = await fetchData('/user/test/meswain@gmail.com');
    const response = await postData('/genesis/generateResources', options);
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
    const response = await fetchData('/world/getCounter');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  renderWorld() {
    // if (this.state.locationArr) {
    //   return this.state.locationArr.map(row => (
    //     <div key={ row.coordinates.x.location.coordinates.y } className="row">{ this.renderLocationRow(row) }</div>
    //   ));
    // }
    if (this.state.strArr) {
      return this.state.strArr.map((row, index) => (
        <div key={ index } className="row"><div className="col-xl-12">{ row }</div></div>
      ));
    }
  }

  // renderLocationRow(row) {
  //   return row.map(element => (
  //     <span key={ element.location.coordinates.x } className={ element.location.coordinates.x }>{ this.renderElement(element) }</span>
  //   ));
  // }

  // renderElement(element) {
  //   return (
  //     <span>{ element.type.substring(0,1) }</span>
  //   );
  // }

  getYs(data) {
    return data.map(d => d.location.coordinates.y);
  }
  getMinY(data) {
    return Math.min(...this.getYs(data));
  }
  getMaxY(data) {
    return Math.max(...this.getYs(data));
  }

  getXs(data) {
    return data.map(d => d.location.coordinates.x);
  }
  getMinX(data) {
    return Math.min(...this.getXs(data));
  }
  getMaxX(data) {
    return Math.max(...this.getXs(data));
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          Welcome to Scriptlings v{this.state.version}!
        </header>
        <p className="App-intro">{this.state.greeting}</p>
        <FormGroup className="FormGroup" controlId="formControls">
          <div className="row">
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.loginClick }>Login</Button>
              <Button bsStyle="primary" className="FormGroup" onClick={ this.joinClick }>Join World</Button>
            </div>
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.createWorldClick }>Create World</Button>
            </div>
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.startClick }>Start World</Button>
            </div>
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.stopClick }>Stop World</Button>
            </div>
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.worldClick }>Get World</Button>
            </div>
            <div className="col-xl-2">
              <Button bsStyle="primary" className="FormGroup" onClick={ this.userScriptlingsClick }>Sense World</Button>
            </div>
          </div>
        </FormGroup>
        <div className="courier">
          { this.renderWorld() }
        </div>
      </div>
    );
  }
}

export default App;
