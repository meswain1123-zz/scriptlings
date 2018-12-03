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

// let resourceArr = [];
let deadResources = [];
// let resourceHash = {};
let locationHash = {}; // This holds all the objects (resources, scriptlings, etc), based on their locations.
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
      getWorldResources(gotResourcesForWorld);
      getDroppedResources(gotDroppedResources);
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
        const user = userHash[userArr[i].userID];
        for (let j = 0; j < user.scriptlings.length; j++) {
          const scriptling = user.scriptlings[j];
          if (scriptling.health.HP > 0) {
            scriptlingCount++;
            // console.log('aStatus4', scriptling.actionStatus);
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
      scriptlingID: scriptling._id,
      userID: user.userID,
      location: 
      { 
        type: "Point", 
        x: scriptling.location.x - user.home.x, 
        y: scriptling.location.y - user.home.y
      },
      health: scriptling.health,
      inventory: scriptling.inventory,
      senseRange: world.scriptlingFormula.senseRange
    },
    resources: [],
    scriptlings: [],
    speed: world.scriptlingFormula.speed,
    // mobs: [],
    // env: [] // REMINDER: This holds things that aren't necessarily in any of the other categories.  Like fog, etc.
  };
  db.senseResources(sensedResources, scriptling, myEnv.worldID, world.scriptlingFormula.senseRange + 1);

  function sensedResources(resources) {
    senseObj.resources = resources.map(element => {
      element.location.x -= user.home.x;
      element.location.y -= user.home.y;
      return element;
    });

    db.senseScriptlings(sensedScriptlings, scriptling, myEnv.worldID, world.scriptlingFormula.senseRange + 1);
  }

  function sensedScriptlings(scriptlings) {
    senseObj.scriptlings = scriptlings.map(element => {
      element.location.x -= user.home.x;
      element.location.y -= user.home.y;
      return element;
    });
    respond(senseObj);
  }
}

///////////// I need to put sense onto scriptling, and I need to make getSense also getHealth.  
///////////// I also need to make some changes to move and attack to have it get target from hash 
///////////// so we can use the real one instead of the one in sense.  Sense should include less data about targets.
function gotSense(senseObj) {
  const user = userHash[senseObj.self.userID];
  const scriptling = user.scriptlingHash[senseObj.self.scriptlingID];
  // console.log('aStatus3', scriptling.actionStatus);
  scriptling.health = senseObj.self.health;
  scriptling.sense = senseObj;
  processedScriptlings++;
  decideMaybe();
}

function decideMaybe() {
  if (processedScriptlings == scriptlingCount) {
    tickStep = 2;
    processedScriptlings = 0;
    for (let i = 0; i < userArr.length; i++) {
      const user = userHash[userArr[i].userID];
      for (let j = 0; j < user.scriptlings.length; j++) {
        const scriptling = user.scriptlings[j];
        if (scriptling.health.HP > 0) {
          // console.log('aStatus2', scriptling.actionStatus);
          const response = decide(user, scriptling);
          scriptling.action = response.action;
          scriptling.memory = response.memory;
          db.setScriptlingActionAndMemory(itsSet, scriptling._id, scriptling.action, scriptling.memory);
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
      const user = userHash[userArr[i].userID];
      for (let j = 0; j < user.scriptlings.length; j++) {
        performAction(user.scriptlings[j]);
      }
    }
  }
}

function DoNothing(scriptling, target, location, type) {
  scriptling.actionStatus = 'Did Nothing';
  performedAction(scriptling);
}
function MoveTo(scriptling, target, location, type) {
  function go(loc) {
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = { 
      x: loc.x - scriptling.location.x, 
      y: loc.y - scriptling.location.y
    };
    const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
    const newLoc = {};
    let status = 'In Progress';
    if (distance <= scriptling.sense.speed) {
      newLoc.x = loc.x;
      newLoc.y = loc.y;

      status = 'Arrived';
    }
    else {
      const velocity = { 
        x: locDiff.x / distance * scriptling.sense.speed, 
        y: locDiff.y / distance * scriptling.sense.speed 
      };
      newLoc.x = scriptling.location.x + velocity.x;
      newLoc.y = scriptling.location.y + velocity.y;
    }

    const collision = detectCollision(scriptling.location, newLoc);

    if (collision.detected) {
      // console.log(collision);
      status += `; collision with ${collision.obj.type} at (${collision.obj.location.x}, ${collision.obj.location.y})`;
      if (collision.effects.HP !== 0) {
        scriptling.health.HP = Math.min(100, scriptling.health.HP + collision.effects.HP);
      }
      if (collision.effects.speed !== 1) {
        if (distance <= scriptling.sense.speed * collision.effects.speed) {
          newLoc.x = loc.x;
          newLoc.y = loc.y;
    
          status = 'Arrived';
        }
        else {
          const velocity = { 
            x: locDiff.x / distance * scriptling.sense.speed * collision.effects.speed, 
            y: locDiff.y / distance * scriptling.sense.speed * collision.effects.speed 
          };
          newLoc.x = scriptling.location.x + velocity.x;
          newLoc.y = scriptling.location.y + velocity.y;
          // console.log('collision scriptling', scriptling.location);
          // console.log('collision newLoc', newLoc);
        }
      }
    }
    if (scriptling.location !== newLoc) {
      if (!isNaN(newLoc.x)) {
        removeFromLocationHash(scriptling.location, scriptling, 'scriptling');
        scriptling.location.x = newLoc.x;
        scriptling.location.y = newLoc.y;
        addToLocationHash(scriptling.location, scriptling, 'scriptling');

        db.updateScriptlingLocation(scriptling);
      }
    }

    scriptling.actionStatus = status;
    performedAction(scriptling);
  }

  if (target != null) {
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
      scriptling.actionStatus = 'Cancelled.  Target lost.';
      performedAction(scriptling);
    }
  }
  else if (location != null) {
    // console.log(`${scriptling._id} moving to (${location.x}, ${location.y})`);
    go(location);
  }
  else {
    scriptling.actionStatus = 'Move To requires a target or location.';
    performedAction(scriptling);
  }
}
function detectCollision(loc1, loc2, size = 1) {
  // For true collision detection you need to check for any part of the line between loc1 and loc2 being within .5 of a wall or resource piece.
  // The calculations for that are a lot more intense than I want to do.  
  // I don't intend to have anything moving so fast that from one tick to another would take it from one side of an object to the other.  
  // So I feel safe cheating and just checking for loc2 being within 1 of a wall or resource piece.

  // Returns a collision object
  const collisionObj = {
    detected: false,
    effects: {
      HP: 0, // Gets added to health each tick.
      speed: 1 // Gets multiplied by speed when moving.
    },
    obj: null // Holds the object that it collided with.
  };

  // We check for collision by looking at the locationHash.  locationHash keeps track of everything based on its location.
  let locationResources = null;
  let collisionResource = null;
  for (let i = 0; i <= Math.ceil(size); i++) {
    for (let j = 0; j <= Math.ceil(size); j++) {
      const loc = {
        x: loc2.x + j,
        y: loc2.y + i
      };
      locationResources = getItemsForLocation(loc, 'resource');
      if (locationResources.length > 0) {
        // console.log(locationResources);
        // Check the actual distance for each one.
        let closest = 100;
        for (let k = 0; k < locationResources.length; k++) {
          const locDiff = {
            x: loc2.x - locationResources[k].location.x,
            y: loc2.y - locationResources[k].location.y
          };
          let distance = locDiff.x * locDiff.x + locDiff.y * locDiff.y;
          distance = Math.sqrt(distance);
          closest = Math.min(closest, distance);
          if (distance <= size) {
            collisionResource = locationResources[k];
            // console.log('Collision!');
            break;
          }
        }
        // console.log('closest', closest);
        if (collisionResource !== null) {
          break;
        }
      }
    }
    if (collisionResource !== null) {
      break;
    }
  }
  if (collisionResource !== null) {
    collisionObj.detected = true;
    collisionObj.obj = collisionResource;
    // REMINDER: These will need to be changed to come from the resource, 
    // and the resourceFormulae will need to contain parameters for these.
    collisionObj.effects.speed = -0.5;
  }
  return collisionObj;
}

function Attack(scriptling, target, location, type) {
  function aanval(targetScriptling) {
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = { 
      x: scriptling.x - targetScriptling.x, 
      y: scriptling.y - targetScriptling.y 
    };
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

    scriptling.status = status;
    performedAction(scriptling);
  }

  if (target != null) {
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
          scriptling.actionStatus = 'Target is dead.';
          performedAction(scriptling);
        }
        break;
      }
    }
    if (cancelled) {
      scriptling.actionStatus = 'Cancelled.  Target lost.';
      performedAction(scriptling);
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
  if (target != null) {
    // REMINDER: this only works for now because the type field is on resource and not scriptling.
    // I should really add objectType to everything.
    if (target.type != null) { 
      const locDiff = { 
        x: target.location.x - scriptling.location.x, 
        y: target.location.y - scriptling.location.y
      };
      const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
      if (distance <= scriptling.sense.gatherRange) {
        if (!scriptling.inventory.full) {
          go();
        }
        else {
          scriptling.actionStatus = 'Inventory is full.';
          performedAction(scriptling);
        }
      }
      else {
        scriptling.actionStatus = `Target out of range: ${scriptling.sense.gatherRange}.`;
        performedAction(scriptling);
      }
    }
    else {
      scriptling.actionStatus = 'Gather requires target to be a resource.';
      performedAction(scriptling);
    }
  }
  else {
    scriptling.actionStatus = 'Gather requires a target.';
    performedAction(scriptling);
  }
  function go() {
    let status = 'Gathering';

    // Pull 1 resource unit out of the resource.
    target.quantity--;
    if (target.quantity === 0) {
      // If resource node is empty then we need to kill it and set a respawn time.
      killResource(target);
      // Also if resource node is now empty then update actionStatus.
      status = 'Finished Gathering';
      // Should check on respawn methodology.  This will be the first time it's used.
    }
    // Update resource in db.
    db.updateResource(resourceUpdated, target._id, target.quantity, target.respawnTime);

    function resourceUpdated() {
      // Add 1 resource unit to inventory.
      if (scriptling.inventory.resources[target.type] == null) {
        scriptling.inventory.resources[target.type] = { type: target.type, quantity: 0 };
      }
      scriptling.inventory.resources[target.type].quantity++;
      // Recalc inventory status.
      scriptling.inventory.current++;
      if (scriptling.inventory.max === scriptling.inventory.current) {
        scriptling.inventory.full = true;
        // If full now update actionStatus.
        status += '; Inventory Full';
      }
      // Update scriptling inventory in db.
      db.updateScriptlingInventory(inventoryUpdated, scriptling);

      function inventoryUpdated(msg) {
        // REMINDER: Go update the mindScript so when it's doing nothing it calculates the closest resource node, 
        // goes to it, and gathers it until either the node dies or inventory is full.  
        // If inventory is full then go home and drop the resources.
        // else if the node dies find the next closest one.
        // Once that is tested and working then I can add in makeScriptling.
  
        scriptling.actionStatus = status;
        performedAction(scriptling);
      }
    }
  }
}
function killResource(resource) {
  // REMINDER: For now I'm just hard coding this, but in the future it should be a compiled resourceKillScript, similar to the mindScripts.
  resource.respawnTime = Date.now() + (1000 * 60 * 60); // now + milliseconds * seconds * minutes.  
  removeFromLocationHash(resource.location, resource, 'resource');
  deadResources.push(resource);
}
function respawnResources(done) {
  // REMINDER: Add this to the tickSteps.  Have it as a last step. 
  let i = 0;
  checkResource();

  function checkResource() {
    if (i >= deadResources.length) {
      done();
    }
    else {
      const resource = deadResources[i];
      if (resource.respawnTime <= Date.now()) {
        respawnResource(checkResource, resource);
      }
      else {
        i++;
      }
    }
  }
}
function respawnResource(done, resource) {
  resource.respawnTime = null;
  resource.quantity = 100;
  db.updateResource(respond, resource._id, resource.quantity, null);
  function respond(msg) {
    addToLocationHash(resource.location, resource, 'resource');
    const index = deadResources.findIndex(findItem, resource);
  
    function findItem(element) {
      return this._id === element._id;
    }
    if (index < 0) {
      // console.log(item);
      // console.log('Error 538'); // This is a catch for if something is being removed from a location when it's not there.
    }
    else {
      deadResources.splice(index, 1);
    }
    done();
    // REMINDER: Should have this check the location for scriptlings, 
    // and if there are any then it should move them to a random nearby empty location.
  }
}

function Drop(scriptling, target, location, type) {
  // It drops all the resource units of the given type at the location.
  // droppedResources are much faster to pick up, and can't be collided with.
  // The idea is to allow scriptlings to store resources at a location for when they're needed.
  // Also it will be simpler to develop and test this than having the scriptlings use resources to make things.

  // Dropping a resource requires a location and a type.
  if (location != null) {
    // For this function target is a field of scriptling.inventory.resources.
    if (target.type != null && scriptling.inventory.resources[target.type] != null) { 
      if (scriptling.inventory.resources[target.type].quantity > 0) {
        const locDiff = { 
          x: location.x - scriptling.location.x, 
          y: location.y - scriptling.location.y
        };
        const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
        if (distance <= scriptling.sense.dropRange) { 
          go();
        }
        else {
          scriptling.actionStatus = `Drop location is out of range: ${scriptling.sense.dropRange}.`;
          performedAction(scriptling);
        }
      }
      else {
        scriptling.actionStatus = `No ${target.type} in inventory.`;
      }
    }
    else {
      scriptling.actionStatus = 'Drop requires target to be a resource in inventory.';
      performedAction(scriptling);
    }
  }
  else {
    scriptling.actionStatus = 'Drop requires a location.';
    performedAction(scriptling);
  }
  function go() {
    // Remove the resource from inventory.
    const droppedResource = {
      type: target.type,
      quantity: scriptling.inventory.resources[target.type].quantity,
      location
    };
    scriptling.inventory.resources[target.type] = null;
    // Update in the db.
    db.updateScriptlingInventory(inventoryUpdated, scriptling);

    function inventoryUpdated(msg) {
      // Create a 'droppedResource' node, 
      // or add to an existing node of the same type in the same location.  
      const locationDroppedResources = getItemsForLocation(location, 'droppedResource');
      const index = -1;
      if (locationDroppedResources.length > 0) {
        index = locationDroppedResources.findIndex(findItem, droppedResource);

        function findItem(element) {
          return this.type === element.type;
        }
      }
      // Add or update in the db.
      if (index === -1) {
        addToLocationHash(location, droppedResource, 'droppedResource');
        db.addDroppedResource(done, droppedResource);
      }
      else {
        locationDroppedResources[index].quantity += droppedResource.quantity;
        db.updateDroppedResource(done, locationDroppedResources[index]);
      }
      function done(msg) {
        let status = 'Dropped';
        performedAction(scriptling);
      }
    }
  }
}

// function MakeItem(scriptling, target, location, type) {
//   scriptling.actionStatus = 'MakeItem not defined yet.';
//   performedAction(scriptling);
// }

// function MakeWall(scriptling, target, location, type) {
//   scriptling.actionStatus = 'MakeWall not defined yet.';
//   performedAction(scriptling);
// }

// function MakeScriptling(scriptling, target, location, type) {
//   scriptling.actionStatus = 'MakeScriptling not defined yet.';
//   performedAction(scriptling);
// }

// function RepairItem(scriptling, target, location, type) {
//   scriptling.actionStatus = 'RepairItem not defined yet.';
//   performedAction(scriptling);
// }

// function RepairWall(scriptling, target, location, type) {
//   scriptling.actionStatus = 'RepairWall not defined yet.';
//   performedAction(scriptling);
// }

// function RepairScriptling(scriptling, target, location, type) {
//   scriptling.actionStatus = 'RepairScriptling not defined yet.';
//   performedAction(scriptling);
// }

// function Research(scriptling, target, location, type) {
//   scriptling.actionStatus = 'Research not defined yet.';
//   performedAction(scriptling);
// }

// // Says a message which will be in the sense of all scriptlings within range on the next tick
// function Say(scriptling, target, location, type) {

//   performedAction(scriptling);
// }

const actionFunctions = { 
  DoNothing, MoveTo, Attack, 
  Gather, Drop, 
  // MakeItem, MakeWall, MakeScriptling, 
  // RepairItem, RepairWall, RepairScriptling, 
  // Research, Say
};
function performAction(scriptling) {
  const actionFunction = actionFunctions[scriptling.action.action];
  if (actionFunction !== undefined && actionFunction !== null) {
    actionFunction(scriptling, scriptling.action.target, scriptling.action.location, scriptling.action.type);
  }
  else {
    // console.log(`Invalid Action: ${scriptling.action.action}`);
    scriptling.actionStatus = `Invalid Action: ${scriptling.action.action}`;
    performedAction(scriptling);
  }
}

function performedAction(scriptling) {
  // console.log('aStatus5', scriptling.actionStatus);
  userHash[scriptling.userID].scriptlingHash[scriptling._id] = scriptling;
  processedScriptlings++;
  if (processedScriptlings == scriptlingCount) {
    tickStep = 0;
  }
}

function gotUsersForWorld(u) {
  userArr = u;
  for (let i = 0; i < userArr.length; i++) {
    addUserToHash(userArr[i]);
  }
}

function addUserToHash(user) {
  let userID = user.userID;
  // This if is probably redundant, but I want to leave it for now.
  if (userHash[userID] == undefined || userHash[userID] == null) {
    userHash[userID] = {
      userID: userID,
      mindScript: user.mindScript,
      mind: compileMindScript(user.mindScript),
      commandFromUI: null,
      scriptlings: [],
      scriptlingHash: {},
      home: user.home
    };

    db.getScriptlingsForUser(gotScriptlings, userID, myEnv.worldID);

    function gotScriptlings(scriptlings) { 
      userHash[userID].scriptlings = scriptlings;
      for (let i = 0; i < scriptlings.length; i++) {
        userHash[userID].scriptlingHash[scriptlings[i]._id] = scriptlings[i];
        addToLocationHash(scriptlings[i].location, scriptlings[i], 'scriptling');
      }
      // console.log('hash', locationHash);
    }
  }
}

function getWorldResources(finish) {
  let resources = [];

  db.getWorldResources(respond, myEnv.worldID, 0, 100);

  function respond(resourceArr) {
    resources = [...resources, ...resourceArr];

    if (resourceArr.length === 100) {
      db.getWorldResources(respond, myEnv.worldID, resources.length, 100);
    }
    else {
      finish(resources);
    }
  }
}

function getDroppedResources(finish) {
  let resources = [];

  db.getDroppedResources(respond, myEnv.worldID, 0, 100);

  function respond(resourceArr) {
    resources = [...resources, ...resourceArr];

    if (resourceArr.length === 100) {
      db.getDroppedResources(respond, myEnv.worldID, resources.length, 100);
    }
    else {
      finish(resources);
    }
  }
}

function gotResourcesForWorld(resources) {
  // resourceArr = resources;
  for (let i = 0; i < resources.length; i++) {
    // resourceHash[resources[i]._id] = resources[i];
    addToLocationHash(resources[i].location, resources[i], 'resource');
  }
}

function gotDroppedResources(resources) {
  // resourceArr = resources;
  for (let i = 0; i < resources.length; i++) {
    // resourceHash[resources[i]._id] = resources[i];
    addToLocationHash(resources[i].location, resources[i], 'droppedResource');
  }
}

function getItemsForLocation(location, type) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  if (locationHash[y] === undefined || locationHash[y] === null ||
    locationHash[y][x] === undefined || locationHash[y][x] === null) {
    // It's never held anything.
    return [];
  }
  else {
    return locationHash[y][x][type];
  }
}

function addToLocationHash(location, item, type) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  if (locationHash[y] === undefined || locationHash[y] === null) {
    locationHash[y] = {};
  }
  if (locationHash[y][x] === undefined || locationHash[y][x] === null) {
    locationHash[y][x] = {
      resource: [],
      scriptling: [],
      droppedResource: []
    };
  }

  locationHash[y][x][type].push(item);
}

function removeFromLocationHash(location, item, type) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  try {
    if (locationHash[y] === undefined || locationHash[y] === null ||
      locationHash[y][x] === undefined || locationHash[y][x] === null) {
      // console.log('Error 525'); // This is a catch for if something is being removed from a location which has never held anything
    }
    else {
      const arr = locationHash[y][x][type];
      const index = arr.findIndex(findItem, item);

      function findItem(element) {
        return this._id === element._id;
      }
      if (index < 0) {
        // console.log(item);
        // console.log('Error 538'); // This is a catch for if something is being removed from a location when it's not there.
      }
      else {
        arr.splice(index, 1);
      }
    }

  }
  catch (e) {
    // console.log('Error 547: ', e);
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
  // console.log('aStatus', scriptling.actionStatus);
  const response = user.mind.decide(scriptling.sense, scriptling.actionStatus, user.commandFromUI, scriptling.memory);
  return response;
}

function compileMindScript(mindScript) {
  const script = new VMScript(`exports.decide = (sense, actionStatus, commandFromUI, memory) => { 
    let action = {
      action: 'DoNothing',
      location: null,
      target: null
    };
    // Gather resources and drop at home.
    if (actionStatus === 'Did Nothing' || actionStatus === 'Dropped') {
      if (sense.resources.length > 0) {
        // Identify the closest resource node.
        let closest = null;
        let closestDistance = null;
        let locDiff = null;
        sense.resources.forEach( element => {
          locDiff = { 
            x: element.location.x - scriptling.location.x, 
            y: element.location.y - scriptling.location.y
          };
          const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
          if (closestDistance === null || distance < closestDistance) {
            closestDistance = distance;
            closest = element;
          }
        });
        action.action = 'MoveTo';
        if (closestDistance > sense.self.gatherRange) {
          // Calculate the location closest to current location that is within gatherRange to the resource node.
          action.location = {
            x: closest.location.x * sense.self.gatherRange / closestDistance,
            y: closest.location.y * sense.self.gatherRange / closestDistance
          };
          memory = {
            plan: {
              action: 'Gather',
              target: closest
            }
          }
        }
        else {
          action.action = 'Gather';
          action.target = closest;
          memory = {
            currentAction: action
          };
        }
      }
      else {
        // There aren't any resources in senseRange.  Go looking.
      }
    }
    else if (actionStatus === 'Gathering') {
      action = memory.currentAction;
    }
    else if (actionStatus.includes('Inventory Full')) {
      action.action = 'MoveTo';
      action.location = { x: 0, y: 0 };
      memory = {
        currentAction: {
          action: 'Drop',
          location: { x: 0, y: 0 },
          target: memory.currentAction.target
        }
      };
    }
    // else if (actionStatus === 'Finished Gathering') {
    //   // Do Nothing.  It will automatically end up searching for more resources on the next tick.
    // }
    else if (actionStatus === 'Arrived') {
      // Code this part last, because it needs to look at memory and inventory to figure out what to do next.
      if (memory.currentAction !== null) {
        action = memory.currentAction;
      }
      // else {
      //   // Do Nothing.  It will automatically end up searching for more resources on the next tick.
      // }
    }

    // // Move around randomly
    // if (actionStatus === 'Did Nothing') {
    //   action.action = 'MoveTo';
    //   action.location = {
    //     x: Math.round(Math.random() * 100),
    //     y: Math.round(Math.random() * 100)
    //   }
    //   // console.log(sense.self);
    //   // console.log(action);
    //   memory = {
    //     currentAction: action
    //   };
    // }
    // else if (actionStatus === 'Arrived') {
    //   action.action = 'DoNothing';
    // }
    // else if (actionStatus !== undefined && actionStatus !== null && 
    //   actionStatus.includes('collision')) {
    //   // console.log(actionStatus);
    //   action.action = 'DoNothing';
    // }
    // else if (memory.currentAction !== undefined) {
    //   action = memory.currentAction;
    // }

    // console.log('sense', sense);
    // console.log('actionStatus', actionStatus);
    // console.log('commandFromUI', commandFromUI);
    // console.log('memory', memory);

    ${mindScript}
    return { sense, memory, action };
  };`);
  const mind = vm.run(script); // mind can be put into a field on the scriptling in the hash, and this part and the above are run when loading user.
  return mind;
}

let intervalObj = null;

// Test route
router.get('/test', function (req, res) {
  res.send({ message: 'Becky is hot!'});
}).post('/startWorld', function(req, res) {
  if (req.body.worldID !== undefined && req.body.worldID !== null) {
    myEnv.worldID = req.body.worldID;
  }
  if (myEnv.worldID !== undefined && myEnv.worldID !== null) {
    intervalObj = setInterval(tick, 1500);
  }
  res.send({ message: 'World started!' });
}).post('/stopWorld', function(req, res) {
  clearInterval(intervalObj);
  intervalObj = null;
  res.send({ message: 'World stopped!' });
}).get('/getCounter', function (req, res) {
  res.send({ message: counter });
}).post('/join', function (req, res) {
  const sCount = userHash[req.session.userID] ? userHash[req.session.userID].scriptlings.count() : 0;
  if (sCount > 0) {
    res.send({ message: `The user already has ${sCount} scriptlings in the world.` });
  }
  else {
    db.addUserToWorld(respond, req.session.userID, req.body.worldID, req.body.home);
    function respond() {
      let count = 0;
      function respond2() {
        count++;
        if (count < 5) {
          const newhome = { x: req.body.home.x + count, y: req.body.home.y };
          db.createScriptlingForUser(respond2, req.session.userID, req.body.worldID, newhome);
        }
        else {
          db.getUserForWorld(respond3, req.session.userID, req.body.worldID);
          function respond3(user) {
            // user should be a single doc of the same structure as getUsersForWorld
            if (userArr === null) {
              userArr = [];
            }
            userArr.push(user);
            addUserToHash(user);
            res.send({ message: 'Welcome!' });
          }
        }
      }
    
      db.createScriptlingForUser(respond2, req.session.userID, req.body.worldID, req.body.home);
    };
  }
}).post('/command', function (req, res) {
  userHash[req.session.userID].commandFromUI = req.body.commandFromUI;
  res.send({ message: 'Command recieved' });
}).get('/getAvailableStartLocations', function (req, res) {
  function respond(startLocations) {
    res.send({ message: 'Here they are!', startLocations });
  };

  db.getAvailableStartLocations(respond);
}).post('/getWorldResources', function (req, res) {
  function respond(resourceArr) {
    res.send({ message: 'Here they are!', resourceArr });
  };
 
  db.getWorldResources(respond, req.body.worldID, req.body.skip, req.body.take);
}).post('/getDroppedResources', function (req, res) {
  function respond(resourceArr) {
    res.send({ message: 'Here they are!', resourceArr });
  };
 
  db.getDroppedResources(respond, req.body.worldID, req.body.skip, req.body.take);
}).post('/getWorldScriptlings', function (req, res) {
  function respond(scriptlingArr) {
    res.send({ message: 'Here they are!', scriptlingArr });
  };
 
  db.getScriptlings(respond, req.body.worldID, req.body.skip, req.body.take);
}).post('/getWorld', function (req, res) {
  res.send({ message: 'Here they are!', locationHash });
}).post('/getScriptlingsForUser', function (req, res) {
  // console.log(`tick ${counter}`);
  // console.log(req.session.userID);
  // console.log(req.body.userID);
  if (req.session.userID === undefined) {
    // console.log('It is undefined');
    req.session.userID = req.body.userID;
    // console.log(req.session.userID);
  }
  if (userHash === undefined || userHash === null) {
    res.send({ message: 'Game isn\'t running.' });
  } 
  else if (userHash[req.session.userID] === undefined || userHash[req.session.userID] === null) {
    res.send({ message: 'User hasn\'t joined the game.' });
  }
  else {
    // console.log('else');
    const scriptlingArr = userHash[req.session.userID].scriptlings.map( scriptling => {
      return scriptling.sense;
    });
    // console.log(scriptlingArr[0].resources.length);
    res.send({ message: 'Here they are!', scriptlingArr });
  }
});

function close() {
  clearInterval(intervalObj);
  db.close();
}

module.exports = router;
module.exports.close = close; 
