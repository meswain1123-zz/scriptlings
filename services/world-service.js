// world service module

import express from 'express';
// import session from 'express-session';
import db from '../db/world-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

db.open();

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
let userArr = null;
let userHash = {};
let counter = 0;
let tickStep = 0; // 0: ready, 1: sense, 2: decide, 3: perform
let scriptlingCount = 0;
let processedScriptlings = 0;
function tick() {
  if (userArr == null) {
    db.getUsersForWorld(gotUsersForWorld);// This is loading everything from the db after a reboot.
  }
  else if (tickStep == 0) {
    tickStep = 1;
    counter++;
    console.log(`tick ${counter}`);
    scriptlingCount = 0;
    processedScriptlings = 0;
    for (let i = 0; i < userArr.length; i++) {
      const user = userHash[userArr[i]._id];
      console.log(`${userArr[i]._id}`);
      for (let j = 0; j < user.scriptlings.length; j++) {
        const scriptling = user.scriptlings[j];
        if (scriptling.health.HP > 0) {
          scriptlingCount++;
          db.getSense(gotSense, scriptling._id);
        }
      }
    }
    if (scriptlingCount == 0) {
      tickStep = 0;
    }
  }
  else {
    console.log(`tickStep ${tickStep}: ${processedScriptlings}/${scriptlingCount}`);
  }
}

///////////// I need to put sense onto scriptling, and I need to make getSense also getHealth.  
///////////// I also need to make some changes to move and attack to have it get target from hash 
///////////// so we can use the real one instead of the one in sense.  Sense should include less data about targets.
function gotSense(slObj) {
  const user = userHash[slObj.userID];
  const scriptling = user.scriptlingHash[slObj._id];
  scriptling.health = slObj.health;
  scriptling.sense = slObj.sense;
  processedScriptlings++;
  decideMaybe();
}

function decideMaybe() {
  if (processedScriptlings == scriptlingCount) {
    tickStep = 2;
    processedScriptlings = 0;
    for (let i = 0; i < userArr.length; i++) {
      const user = userHash[userArr[i]._id];
      for (let j = 0; j < user.scriptlings.length; j++) {
        const scriptling = user.scriptlings[j];
        if (scriptling.health.HP > 0) {
          const response = decide(scriptling, user.commandFromUI);
          scriptling.action = response.action;
          scriptling.memory = response.memory;
          db.setScriptlingActionAndMemory(itsSet, scriptlingID, action, memory);
        }
      }
    }
  }
}

function itsSet() {
  processedScriptlings++;
  performActionsMaybe();
}

function performActionsMaybe() {
  if (processedScriptlings == scriptlingCount) {
    tickStep = 3;
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
  function go(loc) {
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = { x: scriptling.x - loc.x, y: scriptling.y - loc.y };
    const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
    let status = 'In Progress';
    if (distance <= scriptling.sense.speed) {
      scriptling.location.x = loc.x;
      scriptling.location.y = loc.y;

      status = 'Arrived';
    }
    else {
      const velocity = { x: locDiff.x / distance * scriptling.sense.speed, y: locDiff.y / distance * scriptling.sense.speed };
      scriptling.location.x -= velocity.x;
      scriptling.location.y -= velocity.y;
    }

    db.updateScriptlingLocation(scriptling);

    performedAction(scriptling.userID, scriptling._id, status);
  }

  if (target != null) {
    console.log(`${scriptling._id} moving to ${target}`);
    // Have to check that scriptling can see the target.  
    // If not then cancel the action
    // else move toward the target's current location.
    let cancelled = true;
    for (let i = 0; i < scriptling.sense.scriptlings.length; i++) {
      const s2 = scriptling.sense.scriptlings[i];
      if (s2._id == target) {
        cancelled = false;
        go(s2.location);
        break;
      }
    }
    if (cancelled) {
      performedAction(scriptling.userID, scriptling._id, 'Cancelled.  Target lost.');
    }
  }
  else if (location != null) {
    console.log(`${scriptling._id} moving to (${location.x}, ${location.y})`);
    go(location);
  }
  else {
    performedAction(scriptling.userID, scriptling._id, 'Move To requires a target or location.');
  }
}

function Attack(scriptling, target, location, type) {
  function aanval(targetScriptling) {
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = { x: scriptling.x - targetScriptling.x, y: scriptling.y - targetScriptling.y };
    let distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
    if (distance <= scriptling.sense.attackRange) {
      status = 'Attacking';
    }
    else {
      status = 'Out of Range';
    }
    if (status == 'Attacking') {
      const damageObj = calcDamage(scriptling, targetScriptling);
      scriptling.health.HP = 
        Math.max(scriptling.health.HP - damageObj.attackerDamage, 0);
      targetScriptling.health.HP = 
        Math.max(targetScriptling.health.HP - damageObj.targetDamage, 0);
      targetScriptling.inventory.armor.durability = 
        Math.max(targetScriptling.inventory.armor.durability - damageObj.armorDamage, 0);
      scriptling.inventory.weapon.durability = 
        Math.max(scriptling.inventory.weapon.durability - damageObj.weaponDamage, 0);
      // // REMINDER: Health status
      // scriptling.health.status = damageObj.healthStatus;
      // targetScriptling.health.status = damageObj.targetHealthStatus;

      db.updateScriptlingStats(scriptling);
      db.updateScriptlingStats(targetScriptling);

      if (targetScriptling.health.HP == 0) {
        status = 'Target is dead.';
      }
    }

    performedAction(scriptling.userID, scriptling._id, status);
  }

  if (target != null) {
    console.log(`${scriptling._id} attacking ${target}`);
    // Have to check that scriptling can see the target.  
    // If not then cancel the action
    // else if it's within attack range then attack,
    // else move toward the target's current location.
    let cancelled = true;
    for (let i = 0; i < scriptling.sense.scriptlings.length; i++) {
      const s2 = scriptling.sense.scriptlings[i];
      if (s2._id == target) {
        cancelled = false;
        if (s2.health.HP > 0) {
          // Target and sense.scriptlings have partial copies, not references to the original.
          // The attack has to be on the original.
          aanval(userHash[s2.userID].scriptlingHash[s2._id]);
        }
        else {
          performedAction(scriptling.userID, scriptling._id, 'Target is dead.');
        }
        break;
      }
    }
    if (cancelled) {
      performedAction(scriptling.userID, scriptling._id, 'Cancelled.  Target lost.');
    }
  }
}
function calcDamage(scriptling, targetScriptling) {
  const damageObj = {
    attackerDamage: 0,
    targetDamage: 0,
    armorDamage: 0,
    weaponDamage: 0,
    // healthStatus: {}, // REMINDER: Add Health Statuses like bleed, poison, slow, etc.
    // targetHealthStatus: {}
  };
  if (scriptling.inventory.weapon == null) {
    damageObj.targetDamage = 1 * (Math.random() + 1);
  }
  else {
    damageObj.targetDamage = (1 + scriptling.inventory.weapon.damage) * (Math.random() + 1);
    damageObj.weaponDamage = 1;
    // // REMINDER: Add combat effects to some weapons like healing self, adding removing health statuses, etc.
    // if (scriptling.inventory.weapon.combatEffect != null) {
    // }
  }
  if (targetScriptling.inventory.armor != null) {
    damageObj.armorDamage = damageObj.targetDamage * targetScriptling.inventory.armor.absorbPercent * Math.random();
    damageObj.targetDamage = damageObj.targetDamage * (1 - targetScriptling.inventory.armor.absorbPercent);
    damageObj.attackerDamage = targetScriptling.inventory.armor.returnDamage * Math.random();
  }
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

function RepairItem(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function RepairWall(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function RepairScriptling(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

function Research(scriptling, target, location, type) {

  performedAction(scriptling.userID, scriptling._id, 'In Progress');
}

const actionFunctions = { 
  MoveTo, Attack, Gather, Drop, 
  MakeItem, MakeWall, MakeScriptling, 
  RepairItem, RepairWall, RepairScriptling, 
  Research };
function performAction(scriptling) {
  if (scriptling != null && scriptling.action != null && scriptling.action.action != null && scriptling.action.action != "") {
    const actionFunction = actionFunctions[scriptling.action.action];
    if (actionFunction != undefined && actionFunction != null) {
      actionFunction(scriptling, scriptling.action.target, scriptling.action.location, scriptling.action.type);
    }
    else {
      console.log(`Invalid Action: ${scriptling.action.action}`);
      performedAction(scriptling.userID, scriptling._id, `Invalid Action: ${scriptling.action.action}`);
    }
  }
}

function performedAction(userID, scriptlingID, actionStatus) {
  userHash[userID].scriptlingHash[scriptlingID].actionStatus = actionStatus;
  processedScriptlings++;
  if (processedScriptlings == scriptlingCount) {
    tickStep = 0;
  }
}

function gotUsersForWorld(u) {
  console.log(u);
  userArr = u;
  for (let i = 0; i < userArr.length; i++) {
    addUserToHash(userArr[i]);
  }
}

function addUserToHash(user) {
  let userID = user._id;
  // This if is probably redundant, but I want to leave it for now.
  if (userHash[userID] == undefined || userHash[userID] == null) {
    userHash[userID] = {
      userID: userID,
      mindScript: compileMindScript(user.mindCode),
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

    db.getScriptlingsForUser(gotScriptlings, userID);
  }
}

// This is where we use the mindScript to decide on an action.
function decide(sense, actionStatus, commandFromUI, memory) {
  return { action: { action: "" }, memory: {} };
}

function compileMindScript(mindCode) {
  return mindCode;
}

let intervalObj = setInterval(tick, 1500);

// Test route
router.get('/test', function (req, res) {
  res.send({ message: 'Becky is hot!'});
}).get('/getCounter', function (req, res) {
  res.send({ message: counter });
}).post('/join', function (req, res) {
  function respond(user) {
    // user should be a single doc of the same structure as getUsersForWorld
    userArr.push(user);
    addUserToHash(user);
    res.send({ message: 'Welcome!' });
  };

  //REMINDER: I need to move the logic from addUserToWorld to this.  db should only hold the actual db queries.

  db.addUserToWorld(respond, req.session.userID, req.body.startLocation);
}).post('/command', function (req, res) {
  console.log(`Command recieved: ${req.session.userID} ${req.body.commandFromUI}`);
  userHash[req.session.userID].commandFromUI = req.body.commandFromUI;
  // db.updateCommand(req.session.userID, req.body.commandFromUI);
  res.send({ message: 'Command recieved' });
}).get('/getAvailableStartLocations', function (req, res) {
  function respond(startLocations) {
    res.send({ message: 'Here they are!', startLocations });
  };

  db.getAvailableStartLocations(respond);
});

function close() {
  clearInterval(intervalObj);
  db.close();
}

module.exports = router;
module.exports.close = close; 
