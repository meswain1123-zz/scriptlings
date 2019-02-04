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

let intervalObj = null;
let processing = false;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      worldID: "5c4b7967a82f0ae4489ab8c4",
      user: { email: 'meswain@gmail.com', password: 'that1guy' }
    };
    this.loginClick = this.loginClick.bind(this);
    this.joinClick = this.joinClick.bind(this);
    this.startClick = this.startClick.bind(this);
    this.stopClick = this.stopClick.bind(this);
    this.userScriptlingsClick = this.userScriptlingsClick.bind(this);
    this.worldClick = this.worldClick.bind(this);
    this.createWorldClick = this.createWorldClick.bind(this);
    this.worldTick = this.worldTick.bind(this);
    this.senseTick = this.senseTick.bind(this);
    this.hashClick = this.hashClick.bind(this);
    this.hashTick = this.hashTick.bind(this);
  }

  loginClick() {
    this.userTest()
      .then(res => { 
        // console.log(res);
        this.setState({ greeting: res.message, user: res.user });
      })
      .catch(err => console.log(err));
  }

  joinClick() {
    this.join()
      .then(res => { 
        // console.log(res);
      })
      .catch(err => console.log(err));
  }

  startClick() {
    this.startWorld()
      .then(res => { 
        // console.log('Started');
      })
      .catch(err => console.log(err));
  }

  stopClick() {
    this.stopWorld()
      .then(res => { 
        // console.log('Stopped');
      })
      .catch(err => console.log(err));
  }

  userScriptlingsClick() {
    if (intervalObj !== null) {
      clearInterval(intervalObj);
      intervalObj = null;
      processing = false;
    }
    intervalObj = setInterval(this.senseTick, 3000);
  }

  senseTick() {
    if (!processing) {
      processing = true;
      this.getUserScriptings()
        .then(res => { 
          // console.log(res);
          if (res === undefined || res === null || res.length === 0) {
            processing = false;
          }
          else {
            const locationArr = [];
            const strArr = [];
            const locationHash = {};

            let maxX = res[0].self.location.x;
            let maxY = res[0].self.location.y;
            let minX = res[0].self.location.x;
            let minY = res[0].self.location.y;
            res.forEach( scriptling => {
              // console.log(scriptling);
              if (!isNaN(scriptling.self.location.y)) {
                let x = Math.floor(scriptling.self.location.x);
                let y = Math.floor(scriptling.self.location.y);
                const myMaxX = x + scriptling.self.senseRange;
                const myMaxY = y + scriptling.self.senseRange;
                const myMinX = x - scriptling.self.senseRange;
                const myMinY = y - scriptling.self.senseRange;

                maxX = Math.max(maxX, myMaxX);
                maxY = Math.max(maxY, myMaxY);
                minX = Math.min(minX, myMinX);
                minY = Math.min(minY, myMinY);

                scriptling.resources.forEach( resource => {
                  if (locationHash[resource.location.y] === undefined || 
                    locationHash[resource.location.y] === null) {
                    locationHash[resource.location.y] = {};
                  }
                  if (locationHash[resource.location.y][resource.location.x] === undefined || 
                    locationHash[resource.location.y][resource.location.x] === null) {
                    locationHash[resource.location.y][resource.location.x] = [];
                  }
                  locationHash[resource.location.y][resource.location.x].push(resource);
                });

                scriptling.scriptlings.forEach( s => {
                  x = Math.floor(s.location.x);
                  y = Math.floor(s.location.y);
                  if (locationHash[y] === undefined || 
                    locationHash[y] === null) {
                    locationHash[y] = {};
                  }
                  if (locationHash[y][x] === undefined || 
                    locationHash[y][x] === null) {
                    locationHash[y][x] = [];
                  }
                  locationHash[y][x].push(s);
                });

                // REMINDER: I should probably change locationHash to hold arrays of objects.  
                // Then when preparing to render it can go through each element and decide what to display.
                if (locationHash[y] === undefined || 
                  locationHash[y] === null) {
                  locationHash[y] = {};
                }
                if (locationHash[y][x] === undefined || 
                  locationHash[y][x] === null) {
                  locationHash[y][x] = [];
                }
                locationHash[y][x].push(scriptling);
                // console.log(scriptling.location.x, scriptling.type);
                // REMINDER: This needs to be changed to circles instead of squares.
                for(let i = myMinY; i <= myMaxY; i++) {
                  if (locationHash[i] === undefined || 
                    locationHash[i] === null) {
                    locationHash[i] = {};
                  }
                  for (let j = myMinX; j <= myMaxX; j++) {
                    if (locationHash[i][j] === undefined || 
                      locationHash[i][j] === null) {
                      locationHash[i][j] = [];
                      locationHash[i][j].push({ location: { x: j, y: i }, type: 'Empty' });
                    }
                  }
                }
              }
            });
            // console.log(minX + ' ' +maxX + ' ' + minY + ' ' + maxY);
            const tempRow = [{ location: { x: null, y: null }, type: `-` }];
            let tempStrRow = '-';
            for (let i = minX; i <= maxX; i++) {
              tempRow.push({ location: { x: i, y: null }, type: `${i%10}` });
              const iStr = `${i%10}`;
              tempStrRow += iStr.substring(iStr.length - 1);
            }
            locationArr.push(tempRow);
            // console.log(tempStrRow);
            // console.log(tempRow);
            strArr.push(tempStrRow);
            for (let i = minY; i <= maxY; i++) {
              const hashRow = locationHash[i];
              const arrRow = [];
              const iStr = `${i}`;
              let strRow = iStr.substring(iStr.length - 1);
              for (let j = minX; j <= maxX; j++) {
                if (hashRow === undefined || hashRow === null || 
                  hashRow[j] === undefined || hashRow[j] === null || hashRow[j].length === 0) {
                  arrRow.push({ location: { x: j, y: i }, type: 'Fog' });
                  strRow += 'X';
                }
                else {
                  // console.log(hashRow[j].type);
                  arrRow.push(hashRow[j]);
                  let str = null;
                  for (let k = 0; k < hashRow[j].length; k++) {
                    if (str === null || str !== 'S') {
                      const item = hashRow[j][k];
                      if (item.type === undefined) {
                        str = 'S';
                      }
                      else if (item.type === 'Empty') {
                        str = '_';
                      }
                      else {
                        str = item.type.substring(0, 1);
                      }
                    }
                  }
                  strRow += str;
                }
              }
              locationArr.push(arrRow);
              strArr.push(strRow);
            }
            // console.log(locationArr);
            // console.log(strArr);
            processing = false;
            this.setState({ locationArr, strArr });
          }
        })
        .catch(err => console.log(err));
    }
  }

  hashClick() {
    if (intervalObj !== null) {
      clearInterval(intervalObj);
      intervalObj = null;
      processing = false;
    }
    intervalObj = setInterval(this.hashTick, 3000);
  }

  hashTick() {
    if (!processing) {
      processing = true;
      this.getLocationHash()
        .then(res => { 
          const locationArr = [];
          const strArr = [];
          const locationHash = res;
          const maxX = 100;
          const maxY = 100;
          
          const tempRow = [{ location: { x: null, y: null }, type: `-` }];
          let tempStrRow = '-';
          for (let i = 0; i <= maxX; i++) {
            tempRow.push({ location: { x: i, y: null }, type: `${i%10}` });
            const iStr = `${i%10}`;
            tempStrRow += iStr.substring(iStr.length - 1);
          }
          locationArr.push(tempRow);
          // console.log(tempStrRow);
          // console.log(tempRow);
          strArr.push(tempStrRow);
          for (let i = 0; i <= maxY; i++) {
            const hashRow = locationHash[i];
            const arrRow = [];
            const iStr = `${i}`;
            let strRow = iStr.substring(iStr.length - 1);
            for (let j = 0; j <= maxX; j++) {
              if (hashRow === undefined || hashRow === null || 
                hashRow[j] === undefined || hashRow[j] === null) {
                arrRow.push({ location: { x: j, y: i }, type: 'Empty' });
                strRow += '_';
              }
              else {
                // console.log(hashRow[j]);
                arrRow.push(hashRow[j]);
                if (hashRow[j].scriptling.length > 0) {
                  strRow += 'S';
                }
                else if (hashRow[j].droppedResource.length > 0) {
                  strRow += 'D';
                }
                else if (hashRow[j].resource.length > 0) {
                  // console.log(hashRow[j]);
                  strRow += hashRow[j].resource[0].resourceType.substring(0, 1);
                  // strRow += 'R';
                }
                else {
                  strRow += '?';
                }
              }
            }
            locationArr.push(arrRow);
            strArr.push(strRow);
            // console.log(strRow);
          }
          // console.log(locationArr);
          // console.log(strArr);
          processing = false;
          this.setState({ locationArr, strArr });
        })
        .catch(err => console.log(err));
    }
  }

  worldClick() {
    if (intervalObj !== null) {
      clearInterval(intervalObj);
      intervalObj = null;
      processing = false;
    }
    intervalObj = setInterval(this.worldTick, 3000);
  }

  worldTick() {
    if (!processing) {
      processing = true;
      this.getWorldResources()
        .then(res => { 
          if (res === undefined || res === null) {
            processing = false;
          }
          else {
            // console.log(res);

            this.setState({ resourceArr: res });

            this.getDroppedResources()
            .then(res => { 
              if (res === undefined || res === null) {
                processing = false;
              }
              else {
                // console.log(res);

                this.setState({ droppedResourceArr: res });

                this.getWorldScriptlings()
                  .then(res => {
                    if (res === undefined || res === null) {
                      processing = false;
                    }
                    else {
                      // console.log(res);
    
                      const locationArr = [];
                      const strArr = [];
                      const locationHash = {};
    
                      let maxX = 0;
                      let maxY = 0;
                      this.state.resourceArr.forEach( resource => {
                        if (!isNaN(resource.location.y)) {
                          if (locationHash[resource.location.y] === undefined || 
                            locationHash[resource.location.y] === null) {
                            locationHash[resource.location.y] = {};
                          }
                          resource.type = resource.resourceType;
                          locationHash[resource.location.y][resource.location.x] = resource;
                          // console.log(resource.location.x, resource.type);
                          maxX = Math.max(maxX, resource.location.x);
                          maxY = Math.max(maxY, resource.location.y);
                        }
                      });
                      this.state.droppedResourceArr.forEach( resource => {
                        if (!isNaN(resource.location.y)) {
                          if (locationHash[resource.location.y] === undefined || 
                            locationHash[resource.location.y] === null) {
                            locationHash[resource.location.y] = {};
                          }
                          resource.type = 'Dropped';
                          locationHash[resource.location.y][resource.location.x] = resource;
                          // console.log(resource.location.x, resource.type);
                          maxX = Math.max(maxX, resource.location.x);
                          maxY = Math.max(maxY, resource.location.y);
                        }
                      });
                      // Do the scriptlings after the resources so they trump resources on display.
                      // This is just temporary.  
                      res.forEach( scriptling => {
                        // console.log(scriptling);
                        if (!isNaN(scriptling.location.y)) {
                          const x = Math.floor(scriptling.location.x);
                          const y = Math.floor(scriptling.location.y);
                          if (locationHash[y] === undefined || 
                            locationHash[y] === null) {
                            locationHash[y] = {};
                          }
                          locationHash[y][x] = scriptling;
                          // console.log(x, scriptling.type);
                          maxX = Math.max(maxX, x);
                          maxY = Math.max(maxY, y);
                          // console.log(scriptling.location);
                          if (scriptling.action.action === "Gather") {
                            const targetLoc = scriptling.action.target.location;
                            targetLoc.x += 50;
                            targetLoc.y += 50;
                            // const target = locationHash[targetLoc.y][targetLoc.x];
                            // console.log(target);
                            // console.log(scriptling.action.target);
                            // console.log(this.state.resourceArr.length);
                            for (let i = 0; i < this.state.resourceArr.length; i++) {
                              const resource = this.state.resourceArr[i];
                              if (resource._id === scriptling.action.target._id) {
                                // console.log(resource);
                                resource.type = "Target";
                                locationHash[resource.location.y][resource.location.x] = resource;
                                break;
                              }
                            }
                          }
                        }
                      });
                      // console.log(maxX);
                      // console.log(maxY);
                      const tempRow = [{ location: { x: null, y: null }, type: `-` }];
                      let tempStrRow = '-';
                      for (let i = 0; i <= maxX; i++) {
                        tempRow.push({ location: { x: i, y: null }, type: `${i%10}` });
                        const iStr = `${i%10}`;
                        tempStrRow += iStr.substring(iStr.length - 1);
                      }
                      locationArr.push(tempRow);
                      // console.log(tempStrRow);
                      // console.log(tempRow);
                      strArr.push(tempStrRow);
                      for (let i = 0; i <= maxY; i++) {
                        const hashRow = locationHash[i];
                        const arrRow = [];
                        const iStr = `${i}`;
                        let strRow = iStr.substring(iStr.length - 1);
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
                              // console.log(hashRow[j]);
                              strRow += 'S';
                            }
                            else {
                              // console.log(hashRow[j].type);
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
                      processing = false;
                      this.setState({ locationArr, strArr });
                    }
                  });
              }
            })
            .catch(err => console.log(err));
          }
        })
        .catch(err => console.log(err));
    }
  }

  createWorldClick() {
    this.createWorld()
      .then(res => {
        // console.log(res);
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
    const options = { worldID: this.state.worldID, skip: 0, take: 2000 };
    // console.log(options);
    let response = await postData('/world/getWorldResources', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let resources = body.resourceArr.filter(resource => resource.quantity > 0);
    // This is here because I figured out that 5 of the resources were showing up multiple times, ie getting duplicated for display.  
    // Not going to worry about it for now.
    // let resourceHash = {};
    // resources.forEach( r => {
    //   if (resourceHash[r._id] !== undefined && resourceHash[r._id] !== null) {
    //     console.log('dupe: ', r);
    //   }
    //   resourceHash[r._id] = r;
    // });
    

    while(body.resourceArr.length === options.take) {
      options.skip = resources.length;
      response = await postData('/world/getWorldResources', options);
      body = await response.json();
  
      if (response.status !== 200) {
        console.log(body.message);
        throw Error(body.message);
      }

      const takeUs = body.resourceArr.filter(resource => resource.quantity > 0);
      // takeUs.forEach( r => {
      //   if (resourceHash[r._id] !== undefined && resourceHash[r._id] !== null) {
      //     console.log('dupe: ', r);
      //   }
      //   resourceHash[r._id] = r;
      // });
      // console.log(takeUs.length);
      // console.log(body.resourceArr.length);
      resources = [...resources, ...takeUs];
    }

    return resources;
  };

  getDroppedResources = async () => {
    const options = { worldID: this.state.worldID, skip: 0, take: 100 };
    // console.log(options);
    let response = await postData('/world/getDroppedResources', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let resources = body.resourceArr.filter(resource => resource.quantity > 0);

    while(body.resourceArr.length === options.take) {
      options.skip = resources.length;
      response = await postData('/world/getDroppedResources', options);
      body = await response.json();
  
      if (response.status !== 200) throw Error(body.message);

      const takeUs = body.resourceArr.filter(resource => resource.quantity > 0);

      // console.log(body.resourceArr.length);
      resources = [...resources, ...takeUs];
    }

    return resources;
  };

  getWorldScriptlings = async () => {
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

  getLocationHash = async () => {
    const options = { worldID: this.state.worldID, skip: 0, take: 100 };
    let response = await postData('/world/getLocationHash', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let locationHash = body.locationHash;
    // console.log(locationHash);
    return locationHash;
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
    const options = { worldID: this.state.worldID, userID: this.state.user._id, skip: 0, take: 100 };
    let response = await postData('/world/getScriptlingsForUser', options);
    let body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    let scriptlings = body.scriptlingArr;
    // console.log(scriptlings);

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
        birthScript: "// console.log('Good Morning, Dave!);", // Executes on scriptling creation.
        upkeepScript: "// console.log(\"I'm hungry\");", // Executes every hour.  Basically it's to make scriptlings require maintenance, food, etc.
        deathScript: "// console.log(\"This was a triumph!  I'm making a note here: 'Huge Success!'\");", // Executes when a scriptling dies.
        senseRange: 10,
        gatherRange: 2,
        dropRange: 2,
        attackRange: 2,
        speed: 0.5
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
    // console.log('creating world');
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
    //     <div key={ row.x.location.y } className="row">{ this.renderLocationRow(row) }</div>
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
  //     <span key={ element.location.x } className={ element.location.x }>{ this.renderElement(element) }</span>
  //   ));
  // }

  // renderElement(element) {
  //   return (
  //     <span>{ element.type.substring(0,1) }</span>
  //   );
  // }

  getYs(data) {
    return data.map(d => d.location.y);
  }
  getMinY(data) {
    return Math.min(...this.getYs(data));
  }
  getMaxY(data) {
    return Math.max(...this.getYs(data));
  }

  getXs(data) {
    return data.map(d => d.location.x);
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
              <Button bsStyle="primary" className="FormGroup" onClick={ this.hashClick }>Get Hash</Button>
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
