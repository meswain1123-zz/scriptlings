// world service module

import express from 'express';
import { NodeVM, VMScript } from 'vm2';
// import session from 'express-session';
import db from '../db/world-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

const vm = new NodeVM();
db.open();

let userHashObj = {
  userID: 'unique id',
  mindScript: 'string - will change this to VMScript once I understand it.',
  commandFromUI: 'object - null or defined by UI script.  Commands will only go into the next tick.',
  scriptlings: [{
    _id: 'unique id',
    body: {
      location: { type: "Point", x: 'float', y: 'float', z: 'float' },
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

let resourceArr = [];
let resourceHash = {};
let userArr = null;
let userHash = {};
let counter = 0;
let tickStep = 0; // 0: ready, 1: sense, 2: decide, 3: perform
let scriptlingCount = 0;
let processedScriptlings = 0;
let world = {};

function tick() {
  if (myEnv.worldID) {
    if (userArr == null) {
      // This is loading everything from the db after a reboot.
      db.getWorldResources(gotResourcesForWorld, myEnv.worldID);
      db.getWorld(gotWorld, myEnv.worldID);
      db.getUsersForWorld(gotUsersForWorld, myEnv.worldID);
    }
    else if (tickStep == 0) {
      tickStep = 1;
      counter++;
      // console.log(`tick ${counter}`);
      scriptlingCount = 0;
      processedScriptlings = 0;
      for (let i = 0; i < userArr.length; i++) {
        const user = userHash[userArr[i]._id];
        // console.log(`${userArr[i]._id}`);
        for (let j = 0; j < user.scriptlings.length; j++) {
          const scriptling = user.scriptlings[j];
          if (scriptling.health.HP > 0) {
            scriptlingCount++;
            getSense(gotSense, scriptling, user);
          }
        }
      }
      if (scriptlingCount == 0) {
        tickStep = 0;
      }
    }
    else {
      // console.log(`tickStep ${tickStep}: ${processedScriptlings}/${scriptlingCount}`);
    }
  }
}

function getSense(respond, scriptling, user) {
  const senseObj = {
    self: {
      location: 
      { 
        type: "Point", 
        x: scriptling.location.x + user.startLocation.x, 
        y: scriptling.location.y + user.startLocation.y
      },
      health: scriptling.health,
      inventory: scriptling.inventory
    },
    resources: [],
    scriptlings: [],
    // mobs: [],
    // env: [] // REMINDER: This holds things that aren't necessarily in any of the other categories.  Like fog, etc.
  };
  db.senseResources(sensedResources, scriptling, myEnv.worldID, world.senseRange);

  function sensedResources(resources) {
    senseObj.resources = resources.map(element => {
      element.location[0] += user.startLocation[0];
      element.location[1] += user.startLocation[1];
      return element;
    });

    db.senseScriptlings(sensedScriptlings, scriptling, myEnv.worldID, world.senseRange);
  }

  function sensedScriptlings(scriptlings) {
    senseObj.scriptlings = scriptlings.map(element => {
      element.location[0] += user.startLocation[0];
      element.location[1] += user.startLocation[1];
      return element;
    });
    scriptling.sense = senseObj;
    return scriptling;
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
          const response = decide(user, scriptling);
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
    const locDiff = [ scriptling.location[0] - loc[0], scriptling.location[1] - loc[1] ];
    const distance = Math.sqrt(locDiff[0] * locDiff[0] + locDiff[1] * locDiff[1]);
    const newLoc = {};
    let status = 'In Progress';
    if (distance <= scriptling.sense.speed) {
      newLoc[0] = loc[0];
      newLoc[1] = loc[1];

      status = 'Arrived';
    }
    else {
      const velocity = [ locDiff[0] / distance * scriptling.sense.speed, locDiff[1] / distance * scriptling.sense.speed ];
      newLoc[0] -= velocity[0];
      newLoc[1] -= velocity[1];
    }

    const collision = detectCollision(scriptling.location, newLoc);

    if (collision.detected) {
      status += collision.status;
      if (collision.effects.HP) {
        scriptling.health.HP = Math.min(100, scriptling.health.HP + collision.effects.HP);
      }
      if (collision.effects.speed) {
        if (distance <= scriptling.sense.speed * collision.effects.speed) {
          newLoc[0] = loc[0];
          newLoc[1] = loc[1];
    
          status = 'Arrived';
        }
        else {
          const velocity = [ locDiff[0] / distance * scriptling.sense.speed * collision.effects.speed, locDiff[1] / distance * scriptling.sense.speed * collision.effects.speed ];
          newLoc[0] -= velocity[0];
          newLoc[1] -= velocity[1];
        }
      }
    }
    
    scriptling.location[0] = newLoc[0];
    scriptling.location[1] = newLoc[1];

    db.updateScriptlingLocation(scriptling);

    performedAction(scriptling.userID, scriptling._id, status);
  }

  if (target != null) {
    // console.log(`${scriptling._id} moving to ${target}`);
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
    // console.log(`${scriptling._id} moving to (${location[0]}, ${location[1]})`);
    go(location);
  }
  else {
    performedAction(scriptling.userID, scriptling._id, 'Move To requires a target or location.');
  }
}
function detectCollision(loc1, loc2) {
  // For true collision detection you need to check for any part of the line between loc1 and loc2 being within .5 of a wall or resource piece.
  // The calculations for that are a lot more intense than I want to do.  
  // I don't intend to have anything moving so fast that from one tick to another would take it from one side of an object to the other.  
  // So I feel safe cheating and just checking for loc1 and loc2 being within 1 of a wall or resource piece.

}

function Attack(scriptling, target, location, type) {
  function aanval(targetScriptling) {
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = [ scriptling[0] - targetScriptling[0], scriptling[1] - targetScriptling[1] ];
    let distance = Math.sqrt(locDiff[0] * locDiff[0] + locDiff[1] * locDiff[1]);
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
    // console.log(`${scriptling._id} attacking ${target}`);
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

// function Gather(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function Drop(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function MakeItem(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function MakeWall(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function MakeScriptling(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function RepairItem(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function RepairWall(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function RepairScriptling(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// function Research(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

// // Says a message which will be in the sense of all scriptlings within range on the next tick
// function Say(scriptling, target, location, type) {

//   performedAction(scriptling.userID, scriptling._id, 'In Progress');
// }

const actionFunctions = { 
  MoveTo, Attack, 
  // Gather, Drop, 
  // MakeItem, MakeWall, MakeScriptling, 
  // RepairItem, RepairWall, RepairScriptling, 
  // Research, Say
};
function performAction(scriptling) {
  if (scriptling != null && scriptling.action != null && scriptling.action.action != null && scriptling.action.action != "") {
    const actionFunction = actionFunctions[scriptling.action.action];
    if (actionFunction != undefined && actionFunction != null) {
      actionFunction(scriptling, scriptling.action.target, scriptling.action.location, scriptling.action.type);
    }
    else {
      // console.log(`Invalid Action: ${scriptling.action.action}`);
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
  // console.log(u);
  userArr = u;
  for (let i = 0; i < userArr.length; i++) {
    addUserToHash(userArr[i]);
  }
}

function addUserToHash(user) {
  // console.log(user);
  let userID = user._id;
  // This if is probably redundant, but I want to leave it for now.
  if (userHash[userID] == undefined || userHash[userID] == null) {
    userHash[userID] = {
      userID: userID,
      mindScript: user.mindScript,
      mind: compileMindScript(user.mindScript),
      commandFromUI: null,
      scriptlings: [],
      scriptlingHash: {}
    };

    function gotScriptlings(userID, scriptlings) {
      // console.log(userHash);
      userHash[userID].scriptlings = scriptlings;
      for (let i = 0; i < scriptlings.length; i++) {
        userHash[userID].scriptlingHash[scriptlings[i]._id] = scriptlings[i];
      }
    }

    db.getScriptlingsForUser(gotScriptlings, userID, myEnv.worldID);
  }
}

function gotResourcesForWorld(resources) {
  resourceArr = resources;
  for (let i = 0; i < resourceArr.length; i++) {
    resourceHash[resourceArr[i]._id] = resourceArr[i];
  }
}

function gotWorld(w) {
  world = w;
}

// // REMINDER: This is part of the Mob Spawning process.  Mobs will be added later.
// function getRandomInventory(inventoryBag) {
//   return inventoryBag[Math.floor(Math.random() * inventoryBag.length)];
// }

// This is where we use the mindScript to decide on an action.
function decide(user, scriptling) {
  const response = user.mind.decide(scriptling.sense, scriptling.actionStatus, user.commandFromUI, scriptling.memory);
  return response;
}

function compileMindScript(mindScript) {
  const script = new VMScript(`exports.decide = (sense, actionStatus, commandFromUI, memory) => { 
    ${mindScript}
    return { sense, memory };
  };`);
  const mind = vm.run(script); // mind can be put into a field on the scriptling in the hash, and this part and the above are run when loading user.
  // // console.log(mind);
  return mind;
}

let intervalObj = null;

// Test route
router.get('/test', function (req, res) {
  res.send({ message: 'Becky is hot!'});
}).post('/startWorld', function(req, res) {
  console.log(req.body.worldID);
  if (req.body.worldID !== undefined && req.body.worldID !== null) {
    myEnv.worldID = req.body.worldID;
  }
  if (myEnv.worldID !== undefined && myEnv.worldID !== null) {
    intervalObj = setInterval(tick, 1500);
  }
}).post('/stopWorld', function(req, res) {
  // console.log(req.body.worldID);
  // REMINDER: I need to refresh my memory about how to manipulate these.
  intervalObj.stop();
  intervalObj = null;
}).get('/getCounter', function (req, res) {
  res.send({ message: counter });
}).post('/join', function (req, res) {
  console.log(req.body);
  console.log(userHash);
  console.log(req.session.userID);
  const sCount = userHash[req.session.userID] ? userHash[req.session.userID].scriptlings.count() : 0;
  if (sCount > 0) {
    res.send({ message: `The user already has ${sCount} scriptlings in the world.` });
  }
  else {
    db.addUserToWorld(respond, req.session.userID, req.body.worldID, req.body.startLocation);
    function respond() {
      let count = 0;
      function respond2() {
        count++;
        if (count < 5) {
          const newStartLocation = { x: req.body.startLocation.x + count, y: req.body.startLocation.y };
          db.createScriptlingForUser(respond2, req.session.userID, req.body.worldID, newStartLocation);
        }
        else {
          // console.log(userID);
          db.getUserForWorld(respond3, req.session.userID, req.body.worldID);
          function respond3(user) {
            // user should be a single doc of the same structure as getUsersForWorld
            // console.log(user);
            if (userArr === null) {
              userArr = [];
            }
            userArr.push(user);
            addUserToHash(user);
            res.send({ message: 'Welcome!' });
          }
        }
      }
    
      db.createScriptlingForUser(respond2, req.session.userID, req.body.worldID, req.body.startLocation);
    };
  }
}).post('/command', function (req, res) {
  // console.log(`Command recieved: ${req.session.userID} ${req.body.commandFromUI}`);
  userHash[req.session.userID].commandFromUI = req.body.commandFromUI;
  // db.updateCommand(req.session.userID, req.body.commandFromUI);
  res.send({ message: 'Command recieved' });
}).get('/getAvailableStartLocations', function (req, res) {
  function respond(startLocations) {
    res.send({ message: 'Here they are!', startLocations });
  };

  db.getAvailableStartLocations(respond);
}).post('/getWorldResources', function (req, res) {
  console.log(req.body);
  function respond(resourceArr) {
    console.log(resourceArr.length);
    res.send({ message: 'Here they are!', resourceArr });
  };
 
  db.getWorldResources(respond, req.body.worldID, req.body.skip, req.body.take);
}).post('/getWorldScriptlings', function (req, res) {
  console.log(req.body);
  function respond(scriptlingArr) {
    console.log(scriptlingArr.length);
    res.send({ message: 'Here they are!', scriptlingArr });
  };
 
  db.getScriptlings(respond, req.body.worldID, req.body.skip, req.body.take);
}).post('/getSenseForUser', function (req, res) {
  console.log(req.body);
  
  // Get their senseObjects from hash
  const senseObjects = [];
  const user = userHash[req.body.userID];
  for (let i = 0; i < user.scriptlings.length; i++) {
    senseObjects.push(user.scriptlings[i].sense);
  }
  console.log(senseObjects);
  res.send({ message: 'Here they are!', scriptlingArr });
});

function close() {
  clearInterval(intervalObj);
  db.close();
}

module.exports = router;
module.exports.close = close; 
