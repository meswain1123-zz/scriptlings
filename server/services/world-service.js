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

// let resourceArr = [];
let deadResources = [];
let objectHash = {};
let locationHash = {}; // This holds all the objects (resources, scriptlings, etc), based on their locations.
let userArr = null;
let userHash = {};
let counter = 0;
let tickStep = 0; // 0: ready, 1: sense, 2: decide, 3: perform
let scriptlingCount = 0;
let processedScriptlings = 0;
let world = {};
let loading = false;

function tick() {
  if (myEnv.worldID) {
    if (loading) {
      // console.log('Loading...'); // I NEED TO MAKE IT SO THE END OF THE LOADING PROCESS MARKS loading = false
    }
    else if (userArr == null) {
      loading = true;
      // This is loading everything from the db after a reboot.
      getWorldResources(gotResourcesForWorld);
    }
    else if (tickStep == 0) {
      // console.log(resources);
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
      location: getUserLocation(user.userID, scriptling.location),
      // { 
      //   x: scriptling.location.x - user.home.x, 
      //   y: scriptling.location.y - user.home.y
      // },
      health: scriptling.health,
      inventory: scriptling.inventory,
      senseRange: world.scriptlingFormula.senseRange,
      gatherRange: world.scriptlingFormula.gatherRange,
      dropRange: world.scriptlingFormula.dropRange,
      attackRange: world.scriptlingFormula.attackRange
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
      // element.location.x -= user.home.x;
      // element.location.y -= user.home.y;
      element.objectType = 'resource';
      element.location = getUserLocation(user.userID, element.location);
      return element;
    });

    db.senseDroppedResources(sensedDroppedResources, scriptling, myEnv.worldID, world.scriptlingFormula.senseRange + 1);
  }

  function sensedDroppedResources(droppedResources) {
    senseObj.droppedResources = droppedResources.map(element => {
      // element.location.x -= user.home.x;
      // element.location.y -= user.home.y;
      element.objectType = 'droppedResource';
      element.location = getUserLocation(user.userID, element.location);
      return element;
    });

    db.senseScriptlings(sensedScriptlings, scriptling, myEnv.worldID, world.scriptlingFormula.senseRange + 1);
  }

  function sensedScriptlings(scriptlings) {
    senseObj.scriptlings = scriptlings.map(element => {
      element.objectType = 'scriptling';
      element.location = getUserLocation(user.userID, element.location);
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
    let status = 'Moving';
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
      status += `; collision with ${collision.obj.objectType} at (${collision.obj.location.x}, ${collision.obj.location.y})`;
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
    // console.log('scriptlingLoc', scriptling.location);
    // console.log('newLoc', newLoc);
    if (scriptling.location !== newLoc) {
      if (!isNaN(newLoc.x)) {
        removeFromHashes(scriptling);
        scriptling.location.x = newLoc.x;
        scriptling.location.y = newLoc.y;
        scriptling.objectType = "scriptling";
        addToHashes(scriptling);

        // console.log(scriptling);
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
function FollowRoute(scriptling, target, location, type) {
  console.log('FR: ', scriptling.location);
  function go(loc) {
    console.log('Start of FR Go: ', scriptling.location);
    console.log('Start of FR Go: ', loc);
    // Calculate the difference in location, divide by distance, multiply by speed, apply.
    const locDiff = { 
      x: loc.x - scriptling.location.x, 
      y: loc.y - scriptling.location.y
    };
    const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
    const newLoc = {};
    let status = 'Following Route';
    if (distance <= scriptling.sense.speed) {
      newLoc.x = loc.x;
      newLoc.y = loc.y;

      // Remove this step from the route.
      scriptling.memory.route.splice(0, 1);
      if (scriptling.memory.route.length === 0) {
        status = 'Arrived'
      }
    }
    else {
      const velocity = { 
        x: locDiff.x / distance * scriptling.sense.speed, 
        y: locDiff.y / distance * scriptling.sense.speed 
      };
      newLoc.x = scriptling.location.x + velocity.x;
      newLoc.y = scriptling.location.y + velocity.y;
    }
    console.log('Got newLoc: ', newLoc);

    const collision = detectCollision(scriptling.location, newLoc);

    if (collision.detected) {
      // console.log(collision);
      status += `; collision with ${collision.obj.objectType} at (${collision.obj.location.x}, ${collision.obj.location.y})`;
      if (collision.effects.HP !== 0) {
        scriptling.health.HP = Math.min(100, scriptling.health.HP + collision.effects.HP);
      }
      if (collision.effects.speed !== 1) {
        if (distance <= scriptling.sense.speed * collision.effects.speed) {
          newLoc.x = loc.x;
          newLoc.y = loc.y;
    
          // Remove this step from the route.
          scriptling.memory.route.splice(0, 1);
          if (scriptling.memory.route.length === 0) {
            status = 'Arrived'
          }
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
    console.log('scriptlingLoc', scriptling.location);
    console.log('newLoc', newLoc);
    if (scriptling.location.x !== newLoc.x || scriptling.location.y !== newLoc.y) {
      if (!isNaN(newLoc.x)) {
        console.log('prehashes: ', scriptling.location);
        console.log('prehashes: ', newLoc);
        removeFromHashes(scriptling);
        scriptling.location.x = newLoc.x;
        scriptling.location.y = newLoc.y;
        scriptling.objectType = "scriptling";
        addToHashes(scriptling);

        // console.log(scriptling);
        db.updateScriptlingLocation(scriptling);
      }
    }

    scriptling.actionStatus = status;
    performedAction(scriptling);
  }

  if (scriptling.memory.route != null && scriptling.memory.route.length > 0) {
    // console.log(`${scriptling._id} moving to (${location.x}, ${location.y})`);
    go(scriptling.memory.route[0]);
  }
  else {
    scriptling.actionStatus = 'Move To requires a target or location.';
    performedAction(scriptling);
  }
}
function RouteTo(scriptling, target, location, type) {
  function go(loc) {
    // We need to look through the locations within scriptling.sense, and identify a route that will avoid collisions.
    // The route identified may have multiple steps.  It will MoveTo the first one.  The route will be put into memory.
    // Once a route is identified MoveTo should be used to follow it.
    // First check direct path.  
    console.log('RT loc: ', location);
    console.log('RT sLoc1: ', scriptling.location);

    const route = GetRoutes(scriptling, scriptling.location, location);
    if (route !== null) {
      console.log('RT sLoc2: ', scriptling.location);
      scriptling.memory.route = getRouteArray(route);
      console.log('RT route: ', scriptling.memory.route);
      console.log('RT sLoc3: ', scriptling.location);
      scriptling.actionStatus = 'Got Route';
    }
    else {
      scriptling.actionStatus = 'Unable to Get Route';
    }
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
    scriptling.actionStatus = 'FindRoute requires a target or location.';
    performedAction(scriptling);
  }
}
function getRouteArray(route) {
  const arr = [];
  arr.push(route.from);
  if (route.subRoute1 !== null) {
    const subArr = getRouteArray(route.subRoute1);
    for (let i = 1; i < subArr.length; i++) {
      arr.push(subArr[i]);
    }
    const subArr2 = getRouteArray(route.subRoute2);
    for (let i = 1; i < subArr2.length - 1; i++) {
      arr.push(subArr2[i]);
    }
  }
  arr.push(route.to);
  return arr;
}
// Recursively creates routes going from loc1 to loc2.
// Step forward from loc1 to loc2 1 tick's distance at a time.
// If the path runs into a collision then recursively split, trying to go to either side of the obstacle.
// If the path to a midway point is longer than the path to loc2 then give up that path.
// If that happens to one then it probably happens to the other as well.  
// On the plus side it should only happen when the two are close together.
function GetRoutes(scriptling, loc1, loc2) {
  let l1 = { x: loc1.x, y: loc1.y };
  let l2 = { x: loc1.x, y: loc1.y };
  const locDiff = { 
    x: loc2.x - loc1.x, 
    y: loc2.y - loc1.y
  };
  const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
  let collision = {
    detected: false
  };
  const velocity = { 
    x: locDiff.x / distance * scriptling.sense.speed, 
    y: locDiff.y / distance * scriptling.sense.speed 
  };
  while ((l2.x !== loc2.x || l2.y !== loc2.y) && !collision.detected) {
    const locDiff2 = { 
      x: loc2.x - l1.x, 
      y: loc2.y - l1.y
    };
    const distance2 = Math.sqrt(locDiff2.x * locDiff2.x + locDiff2.y * locDiff2.y);
    if (distance2 <= scriptling.sense.speed) {
      l2.x = loc2.x;
      l2.y = loc2.y;
    }
    else {
      l2.x = l1.x + velocity.x;
      l2.y = l1.y + velocity.y;

      collision = detectCollision(l1, l2);
      l1 = l2;
    }
  }
  if (collision.detected) {
    // We have a collision, so we need to do some math.  
    const aw = collision.obj.width + scriptling.width * 2; // avoidance width
    const m = (collision.obj.location.y - scriptling.location.y) / (collision.obj.location.x - scriptling.location.x); // slope of line from scriptling to object
    const m2 = -1 / m; // slope of line between 2 possible stepping points
    const xDiff = Math.sqrt((aw * aw) / (m2 * m2 + 1)); // difference of x values (+/-) from collision location
    const step1 = {
      x: collision.obj.location.x + xDiff,
      y: collision.obj.location.y + (xDiff * m2)
    };
    const step2 = {
      x: collision.obj.location.x - xDiff,
      y: collision.obj.location.y - (xDiff * m2)
    };
    // That should give us our two stepping points to try with.
    // Put a catch in to make sure it's not going too far off
    const locDiff11 = { 
      x: step1.x - loc1.x, 
      y: step1.y - loc1.y
    };
    const locDiff12 = { 
      x: step1.x - loc2.x, 
      y: step1.y - loc2.y
    };
    const distance11 = Math.sqrt(locDiff11.x * locDiff11.x + locDiff11.y * locDiff11.y);
    const distance12 = Math.sqrt(locDiff12.x * locDiff12.x + locDiff12.y * locDiff12.y);
    const locDiff21 = { 
      x: step2.x - loc1.x, 
      y: step2.y - loc1.y
    };
    const locDiff22 = { 
      x: step2.x - loc2.x, 
      y: step2.y - loc2.y
    };
    const distance21 = Math.sqrt(locDiff21.x * locDiff21.x + locDiff21.y * locDiff21.y);
    const distance22 = Math.sqrt(locDiff22.x * locDiff22.x + locDiff22.y * locDiff22.y);
    let route11 = null;
    let route12 = null;
    let route21 = null;
    let route22 = null;
    // REMINDER: I should maybe find a way to make it so if route11 or route21 has a collision then it can try from closer to this collision to get to the same point.
    // Probably redundant though.
    if (distance11 < distance && distance12 < distance) {
      route11 = GetRoutes(scriptling, loc1, step1);
      if (route11 !== null && route11.distance < distance * 3) {
        route12 = GetRoutes(scriptling, step1, loc2);
        if (route12 === null || route12.distance >= distance * 3) {
          route11 = null;
          route12 = null;
        }
      }
      else {
        route11 = null;
      }
    }
    if (distance21 < distance && distance22 < distance) {
      route21 = GetRoutes(scriptling, loc1, step2);
      if (route21 !== null && route21.distance < distance * 3) {
        route22 = GetRoutes(scriptling, step2, loc2);
        if (route22 === null || route22.distance >= distance * 3) {
          route21 = null;
          route22 = null;
        }
      }
      else {
        route21 = null;
      }
    }
    if (route11 !== null && route21 !== null) {
      // Which route is shorter.
      if (route11.distance + route12.distance <= route21.distance + route22.distance) {
        return {
          from: loc1,
          to: loc2,
          subRoute1: route11,
          subRoute2: route12,
          distance: route11.distance + route12.distance
        }
      }
      else {
        return {
          from: loc1,
          to: loc2,
          subRoute1: route21,
          subRoute2: route22,
          distance: route21.distance + route22.distance
        }
      }
    }
    else if (route11 !== null) {
      return {
        from: loc1,
        to: loc2,
        subRoute1: route11,
        subRoute2: route12,
        distance: route11.distance + route12.distance
      }
    }
    else if (route21 !== null) {
      return {
        from: loc1,
        to: loc2,
        subRoute1: route21,
        subRoute2: route22,
        distance: route21.distance + route22.distance
      }
    }
    else {
      return null;
    }
  }
  else {
    // Put together the route object and return it.
    return {
      from: loc1,
      to: loc2,
      subRoute1: null,
      subRoute2: null,
      distance
    };
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
    if (distance <= scriptling.sense.self.attackRange) {
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
  // console.log(scriptling);
  // console.log(target);
  if (target != null) {
    // REMINDER: this only works for now because the type field is on resource and not scriptling.
    // I should really add objectType to everything.
    if (target.objectType === 'resource') { 
      const locDiff = { 
        x: target.location.x - scriptling.location.x, 
        y: target.location.y - scriptling.location.y
      };
      const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
      // console.log('distance', distance);
      // console.log(scriptling.inventory);
      if (distance <= scriptling.sense.self.gatherRange) {
        if (!scriptling.inventory.full) {
          go();
        }
        else {
          scriptling.actionStatus = 'Inventory is full.';
          performedAction(scriptling);
        }
      }
      else {
        scriptling.actionStatus = `Target out of range: ${scriptling.sense.self.gatherRange}.`;
        performedAction(scriptling);
      }
    }
    else {
      // console.log('gather target: ', target);
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
    // console.log(target);
    // Update resource in db.
    db.updateResource(resourceUpdated, target._id, target.quantity, target.respawnTime);

    function resourceUpdated() {
      // Add 1 resource unit to inventory.
      // console.log(scriptling);
      if (scriptling.inventory.resources[target.resourceType] == null) {
        scriptling.inventory.resources[target.resourceType] = { type: target.resourceType, quantity: 0 };
      }
      scriptling.inventory.resources[target.resourceType].quantity++;
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
  removeFromHashes(resource);
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
      const timeDiff = resource.respawnTime - Date.now();
      if (timeDiff < 0) {
        respawnResource(checkResource, resource);
      }
      else {
        i++;
        checkResource();
      }
    }
  }
}
function respawnResource(done, resource) {
  // console.log('respawning resource');
  resource.respawnTime = null;
  resource.quantity = 100;
  db.updateResource(respond, resource._id, resource.quantity, null);
  function respond(msg) {
    resource.objectType = "resource";
    addToHashes(resource);
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
  // console.log(scriptling);
  // console.log(target);
  // console.log(location);
  // It drops all the resource units of the given type at the location.
  // droppedResources are much faster to pick up, and can't be collided with.
  // The idea is to allow scriptlings to store resources at a location for when they're needed.
  // Also it will be simpler to develop and test this than having the scriptlings use resources to make things.

  // Dropping a resource requires a location and a type.
  if (location != null) {
    // For this function target is a string representing a resource type in the scriptling's inventory.
    // console.log(target);
    // console.log(scriptling.inventory);
    if (target != null && scriptling.inventory.resources[target] != null) { 
      if (scriptling.inventory.resources[target].quantity > 0) {
        const locDiff = { 
          x: location.x - scriptling.location.x, 
          y: location.y - scriptling.location.y
        };
        const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
        if (distance <= scriptling.sense.self.dropRange) { 
          go();
        }
        else {
          scriptling.actionStatus = `Drop location is out of range: ${scriptling.sense.self.dropRange}.`;
          performedAction(scriptling);
        }
      }
      else {
        scriptling.actionStatus = `No ${target} in inventory.`;
      }
    }
    else {
      // console.log('drop target:', target);
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
      type: target,
      quantity: scriptling.inventory.resources[target].quantity,
      location,
      worldID: myEnv.worldID
    };
    // console.log(scriptling);
    scriptling.inventory.full = false;
    scriptling.inventory.current -= scriptling.inventory.resources[target].quantity;
    scriptling.inventory.resources[target] = null;
    // console.log(scriptling);
    // Update in the db.
    db.updateScriptlingInventory(inventoryUpdated, scriptling);

    function inventoryUpdated(msg) {
      // Create a 'droppedResource' node, 
      // or add to an existing node of the same type in the same location.  
      const locationDroppedResources = getItemsForLocation(location, 'droppedResource');
      let index = -1;
      if (locationDroppedResources.length > 0) {
        index = locationDroppedResources.findIndex(findItem, droppedResource);

        function findItem(element) {
          return this.resourceType === element.resourceType;
        }
      }
      // console.log(locationDroppedResources);
      // console.log(index);
      // Add or update in the db.
      if (index === -1) {
        droppedResource.objectType = "droppedResource";
        db.addDroppedResource(done, droppedResource);
      }
      else {
        locationDroppedResources[index].quantity += droppedResource.quantity;
        db.updateDroppedResource(done, locationDroppedResources[index]);
      }
      function done(msg) {
        // console.log(msg);
        if (msg._id !== undefined) {
          msg.objectType = "droppedResource";
          addToHashes(msg);
        }
        scriptling.actionStatus = 'Dropped';
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
  Gather, Drop, RouteTo, FollowRoute,
  // MakeItem, MakeWall, MakeScriptling, 
  // RepairItem, RepairWall, RepairScriptling, 
  // Research, Say
};
function performAction(scriptling) {
  const actionFunction = actionFunctions[scriptling.action.action];
  if (actionFunction !== undefined && actionFunction !== null) {

    const target = getTrueObject(scriptling.action.target);
    const location = getTrueLocation(scriptling.userID, scriptling.action.location);
    // console.log('PA: ', target);
    if (scriptling.memory.route !== undefined && scriptling.memory.route.length > 0) {
      console.log('PA: ', scriptling.memory.route);
      console.log('PA: ', scriptling.location);
    }
    actionFunction(scriptling, target, location, scriptling.action); // REMINDER: this was scriptling.action.type.  I'm not sure what I meant by that.
  }
  else {
    // console.log(`Invalid Action: ${scriptling.action.action}`);
    scriptling.actionStatus = `Invalid Action: ${scriptling.action.action}`;
    performedAction(scriptling);
  }
}

// This gets the true object from hash of a sensed version.  
function getTrueObject(obj) {
  if (obj === null || obj.objectType === undefined || obj.objectType === null) {
    return obj;
  }
  else if (objectHash[obj.objectType][obj._id] !== null) {
    return objectHash[obj.objectType][obj._id];
  }
  else {
    // console.log('Missing Object: ', obj);
    return null;
  }
}

// This gets a true location, translating it from a user's home location.  
function getTrueLocation(userID, location) {
  if (location === undefined || location === null) {
    return null;
  }
  else {
    const user = userHash[userID];
    // console.log('loc: ', location);
    // console.log('home: ', user.home);
    const trueLocation = {
      x: location.x + user.home.x,
      y: location.y + user.home.y
    };
    return trueLocation;
  }
}

// This gets a location relative to a user's home location.  
function getUserLocation(userID, location) {
  if (location === null) {
    return null;
  }
  else {
    const user = userHash[userID];
    const trueLocation = {
      x: location.x - user.home.x,
      y: location.y - user.home.y
    };
    return trueLocation;
  }
}

function performedAction(scriptling) {
  // console.log('aStatus5', scriptling.actionStatus);
  userHash[scriptling.userID].scriptlingHash[scriptling._id] = scriptling;
  processedScriptlings++;
  if (processedScriptlings == scriptlingCount) {
    tickStep = 4;
    respawnResources(respawnedResources);

    function respawnedResources() {
      tickStep = 0;
    }
  }
}

let scriptlingsLoadedForUsers = 0;

function gotUsersForWorld(u) {
  // console.log('gotUsers');
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
        scriptlings[i].objectType = 'scriptling';
        scriptlings[i].inventory.current = 0;
        const vals = Object.values(scriptlings[i].inventory.resources);
        vals.forEach( rType => {
          if (rType !== undefined && rType !== null) {
            scriptlings[i].inventory.current += rType.quantity;
          }
        });
        // console.log(scriptlings[i]);
        addToHashes(scriptlings[i]);
      }
      scriptlingsLoadedForUsers++;
      if (scriptlingsLoadedForUsers == userArr.length) {
        loading = false;
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
    // console.log('resources', resourceArr.length);

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
  // console.log('got resources');
  for (let i = 0; i < resources.length; i++) {
    resources[i].objectType = 'resource';
    if (resources[i].quantity > 0) {
      addToHashes(resources[i]);
    }
    else {
      deadResources.push(resources[i]);
    }
  }
  getDroppedResources(gotDroppedResources);
}

function gotDroppedResources(droppedResources) {
  // droppedResourceArr = droppedResources;
  // console.log(droppedResources);
  for (let i = 0; i < droppedResources.length; i++) {
    droppedResources[i].objectType = 'droppedResource';
    addToHashes(droppedResources[i]);
  }
  // console.log(myEnv);
  db.getWorld(gotWorld, myEnv.worldID);
}

function getItemsForLocation(location, objectType) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  if (locationHash[y] === undefined || locationHash[y] === null ||
    locationHash[y][x] === undefined || locationHash[y][x] === null) {
    // It's never held anything.
    return [];
  }
  else {
    return locationHash[y][x][objectType];
  }
}

function addToHashes(item) {
  const location = item.location;
  const objectType = item.objectType;
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  // Add to locationHash
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
  // console.log(objectType);
  locationHash[y][x][objectType].push(item);

  if (objectType === 'scriptling') { // Add to user's scriptlingHash
    console.log('addToHashes: ', item.location);
    console.log('addToHashes: ', locationHash[y][x][objectType]);
    userHash[item.userID].scriptlingHash[item._id] = item;
  }
  // Add to object hash
  if (objectHash[objectType] === undefined || objectHash[objectType] === null) {
    objectHash[objectType] = {};
  }
  objectHash[objectType][item._id] = item;
}

function removeFromHashes(item) {
  const location = item.location;
  const objectType = item.objectType;
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  try {
    // Remove From locationHash.
    if (locationHash[y] === undefined || locationHash[y] === null ||
      locationHash[y][x] === undefined || locationHash[y][x] === null) {
      // console.log('Error 525'); // This is a catch for if something is being removed from a location which has never held anything
    }
    else {
      const arr = locationHash[y][x][objectType];
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
      if (objectType == 'scriptling') {
        console.log('removeFromHashes: ', item.location);
        console.log('removeFromHashes: ', locationHash[y][x][objectType]);
      }
    }
    // Remove from object hash.
    if (objectType === 'scriptling') {
      userHash[item.userID].scriptlingHash[item._id] = null;
    }
    if (objectHash[objectType] === undefined || objectHash[objectType] === null) {
      objectHash[objectType] = {};
    }
    objectHash[objectType][item._id] = null;
  }
  catch (e) {
    // console.log('Error 547: ', e);
  }
}

function gotWorld(w) {
  // console.log(w);
  world = w;
  db.getUsersForWorld(gotUsersForWorld, myEnv.worldID);
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
  try {
    const script = new VMScript(`exports.decide = (sense, actionStatus, commandFromUI, memory) => { 
      let action = {
        action: 'DoNothing',
        location: null,
        target: null
      };
      // console.log(sense);
      if (actionStatus === undefined || actionStatus === null) {
        actionStatus = 'Did Nothing';
      }
      // console.log(actionStatus);
      // Gather resources and drop at home.
      if (actionStatus === 'Did Nothing' || actionStatus === 'Dropped') {
        if (sense.self.inventory.full) {
          action.action = 'RouteTo';
          action.location = { x: 0, y: 0 };
          memory = {
            currentAction: {
              action: 'Drop',
              location: { x: 0, y: 0 },
              target: 'Iron'
            }
          };
        }
        else if (sense.resources.length > 0) {
          // Identify the closest resource node.
          let closest = null;
          let closestDistance = null;
          let locDiff = null;
          sense.resources.forEach( element => {
            locDiff = { 
              x: element.location.x - sense.self.location.x, 
              y: element.location.y - sense.self.location.y
            };
            const distance = Math.sqrt(locDiff.x * locDiff.x + locDiff.y * locDiff.y);
            if (closestDistance === null || distance < closestDistance) {
              closestDistance = distance;
              closest = element;
            }
          });
          if (closestDistance > sense.self.gatherRange) {
            action.action = 'RouteTo';
            // Calculate the location closest to current location that is within gatherRange to the resource node.
            const a1 = locDiff.x;
            const b1 = locDiff.y;
            const a2 = a1 * ((closestDistance - sense.self.gatherRange) / closestDistance);
            const b2 = b1 * ((closestDistance - sense.self.gatherRange) / closestDistance);
            let xg1 = sense.self.location.x + a2;
            let yg1 = sense.self.location.y + b2;
            let xg2 = sense.self.location.x - a2;
            let yg2 = sense.self.location.y - b2;
            action.location = {};
            if (Math.abs(closest.location.x - xg1) < Math.abs(closest.location.x - xg2))
            {
              action.location.x = xg1;
            }
            else {
              action.location.x = xg2;
            }
            if (Math.abs(closest.location.y - yg1) < Math.abs(closest.location.y - yg2))
            {
              action.location.y = yg1;
            }
            else {
              action.location.y = yg2;
            }
            // // REMINDER: I think this isn't being calculated correctly.  
            // // It should be calculating it relative to current location, and I think this is relative to home.
            // action.location = {
            //   x: closest.location.x * sense.self.gatherRange / closestDistance,
            //   y: closest.location.y * sense.self.gatherRange / closestDistance
            // };
            memory = {
              currentAction: {
                action: 'Gather',
                target: closest
              }
            };
          }
          else {
            // console.log('closestDistance', closestDistance);
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
      else if (actionStatus.includes('Inventory is full.')) {
        action.action = 'RouteTo';
        action.location = { x: 0, y: 0 };
        memory = {
          currentAction: {
            action: 'Drop',
            location: { x: 0, y: 0 },
            target: 'Iron'
          }
        };
      }
      // else if (actionStatus === 'Finished Gathering') {
      //   // Do Nothing.  It will automatically end up searching for more resources on the next tick.
      // }
      else if (actionStatus === 'Got Route') {
        action.action = 'FollowRoute';
      }
      else if (actionStatus === 'Unable to Get Route') {
        action.action = 'Pout'; // REMINDER: I need to have it move randomly and hopefully it will end up coming with something to do.
      }
      else if (actionStatus === 'Following Route') {
        action.action = 'FollowRoute';
      }
      else if (actionStatus === 'Arrived') {
        if (memory.currentAction !== undefined && memory.currentAction !== null) {
          action = memory.currentAction;
        }
        // else {
        //   // Do Nothing.  It will automatically end up searching for more resources on the next tick.
        // }
      }
      else {
        // It's probably an error message we haven't planned for.  
        // console.log('actionStatus: ', actionStatus);
        // In that case the best plan is to clear out memory and do nothing.
        memory = {};
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
      // console.log('sense.self', sense.self);
      // console.log('actionStatus', actionStatus);
      // console.log('commandFromUI', commandFromUI);
      // console.log('memory', memory);
      // console.log('action', action.action);

      ${mindScript}
      return { sense, memory, action };
    };`);
    const mind = vm.run(script); // mind can be put into a field on the scriptling in the hash, and this part and the above are run when loading user.
    return mind;
  }
  catch (e) {
    // console.log('Invalid Mind');
    const script = new VMScript(`exports.decide = (sense, actionStatus, commandFromUI, memory) => { 
      let action = {
        action: 'DoNothing',
        location: null,
        target: null
      };
      return { sense, memory, action };
    };`);
    const mind = vm.run(script);
    return mind;
  };
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
  // console.log('World started!');
  res.send({ message: 'World started!' });
}).post('/stopWorld', function(req, res) {
  clearInterval(intervalObj);
  intervalObj = null;
  // console.log('World stopped!');
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
    // console.log('1155');
    // const takeUs = resourceArr.filter(resource => resource.quantity > 0);
    // console.log(takeUs);
    res.send({ message: 'Here they are!', resourceArr });
  };
  // console.log(req.body);
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
}).post('/getLocationHash', function (req, res) {
  res.send({ message: 'Here they are!', locationHash });
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
