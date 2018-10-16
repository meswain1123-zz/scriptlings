// world service module

import express from 'express';
// import session from 'express-session';
import db from '../db/world-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

let userHashObj = {
  userID: 'unique id',
  mindScript: 'string - will change this to VMScript once I understand it.',
  commandFromUI: 'object - null or defined by UI code.  Commands will only go into the next tick.',
  scriptlings: [{
    _id: 'unique id',
    body: {
      location: { x: 'float', y: 'float', z: 'float' },
      health: {
        HP: 'int',
        energy: 'int',
        status: 'string'
      },
      inventory: {
        armor: {
          type: 'string',
          durability: {
            current: 'int',
            max: 'int'
          }
        },
        weapon: {
          type: 'string',
          durability: {
            current: 'int',
            max: 'int'
          }
        },
        tool: 'string'
      }
    },
    memory: 'object - defined by previous tick',
    action: {
      action: 'string',
      target: '_id of a scriptling.  Used for some actions',
      location: 'location object like above.  Used for some actions',
      type: 'string.  Used for some actions'      
    }
  }]
};
let userArr = [];
let userHash = {};
let counter = 0;
let tickStep = 0;
let scriptlingCount = 0;
let processedScriptlings = 0;
let userCount = 0;
let processedUsers = 0;
function tick() {
  if (tickStep == 0) {
    tickStep = 1;
    counter++;
    console.log(`tick ${counter}`);
    scriptlingCount = 0;
    processedScriptlings = 0;
    userCount = userArr.length;
    processedUsers = 0;
    for (let i = 0; i < userArr.length; i++) {
      const user = userHash[userArr[i]._id];
      console.log(`${userArr[i]._id}`);
      db.getCommand(gotCommand, user._id);
    }
    if (userCount == 0) {
      tickStep = 0;
    }
  }
  else {
    console.log(`tickStep ${tickStep}: ${processedScriptlings}/${scriptlingCount}`);
  }
}

function gotCommand(userObj) {
  const user = userHash[userObj._id];
  user.commandFromUI = userObj.commandFromUI;
  for (let j = 0; j < user.scriptlings.length; j++) {
    const scriptling = user.scriptlings[j];
    scriptlingCount++;
    db.getSense(gotSense, scriptling._id);
  }
  processedUsers++;
  if (user.scriptlings.length == 0)
    performActionsMaybe();
}

function gotSense(slObj) {
  const user = userHash[slObj.userID];
  const scriptling = user.scriptlingHash[slObj._id];
  const response = decide(slObj.sense, scriptling.actionStatus, user.commandFromUI, scriptling.memory);
  setScriptlingActionAndMemory(slObj.userID, slObj._id, response.action, response.memory);
}

function setScriptlingActionAndMemory(userID, scriptlingID, action, memory) {
  const scriptling = userHash[userID].scriptlingHash[scriptlingID];
  scriptling.action = action;
  scriptling.memory = memory;
  db.setScriptlingActionAndMemory(itsSet, scriptlingID, action, memory);
}

function itsSet() {
  processedScriptlings--;
  performActionsMaybe();
}

function performActionsMaybe() {
  if (processedScriptlings == scriptlingCount && processedUsers == userCount) {
    tickStep = 2;
    processedScriptlings = 0;
    for (let i = 0; i < userArr.length; i++) {
      const user = userHash[userArr[i]._id];
      for (let j = 0; j < user.scriptlings.length; j++) {
        performAction(user.scriptlings[j]);
      }
    }
  }
}

function MoveTo(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function Attack(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function Gather(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function Drop(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function MakeItem(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function MakeWall(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function MakeScriptling(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function Research(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

const actionFunctions = { MoveTo, Attack, Gather, Drop, MakeItem, MakeWall, MakeScriptling, Research };
function performAction(scriptling) {
  const actionFunction = actionFunctions[scriptling.action.action];
  if (actionFunction != undefined && actionFunction != null) {
    actionFunction(scriptling, scriptling.action.target, scriptling.action.location, scriptling.action.type);
  }
  else {
    console.log(`Invalid Action: ${scriptling.action.action}`);
    performedAction(scriptling.userID, scriptling._id, `Invalid Action: ${scriptling.action.action}`);
  }
  // db.performAction(performedAction, scriptling);
}

function performedAction(userID, scriptlingID, actionStatus) {
  userHash[userID].scriptlingHash[scriptlingID].actionStatus = actionStatus;
  processedScriptlings++;
  if (processedScriptlings == scriptlingCount) {
    tickStep = 0;
  }
}

function gotUsersForWorld(u) {
  userArr = u;
  for (let i = 0; i < userArr.length; i++) {
    let userID = userArr[i]._id;
    if (userHash[userID] == undefined || userHash[userID] == null) {
      userHash[userID] = {
        userID: userID,
        mindScript: compileMindScript(userArr[i].mindCode),
        commandFromUI: null,
        scriptlings: [],
        scriptlingHash: {}
      };

      function gotScriptlings(userID, scriptlings) {
        userHash[userID].scriptlings = scriptlings;
        for (let i = 0; i < scriptlings.length; i++) {
          userHash[userID].scriptlingHash[scriptlings[i]._id] = scriptlings[i];
        }
      }

      db.getScriptlings(gotScriptlings, userID);
    }
  }
}

// This is where we use the mindScript to decide on an action.
function decide(sense, actionStatus, commandFromUI, memory) {
  return { action: { action: "" }, memory: {} };
}

function compileMindScript(mindCode) {
  return mindCode;
}

db.getUsersForWorld(gotUsersForWorld);

let intervalObj = setInterval(tick, 1500);

// Test route
router.get('/test', function (req, res) {
  res.send({ message: 'Becky is hot!'});
}).get('/getCounter', function (req, res) {
  res.send({ message: counter });
});

function close() {
  clearInterval(intervalObj);
  db.close();
}

module.exports = router;
module.exports.close = close; 
