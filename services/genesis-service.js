
import express from 'express';
import { NodeVM, VMScript } from 'vm2';
// import session from 'express-session';
import db from '../db/world-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

db.open();

function createWorld() {
  function worldCreated(world) {
    console.log(world);

    // Generate our worldBlocks
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const corners = [
          { 
            x: (x * world.worldBlockFormula.width), y: (y * world.worldBlockFormula.width)
          },
          { 
            x: ((x + 1) * world.worldBlockFormula.width), y: (y * world.worldBlockFormula.width)
          },
          { 
            x: ((x + 1) * world.worldBlockFormula.width), y: ((y + 1) * world.worldBlockFormula.width)
          },
          { 
            x: (x * world.worldBlockFormula.width), y: ((y + 1) * world.worldBlockFormula.width)
          }
        ];
        db.createWorldBlock(worldBlockCreated, world, corners);
      }
    }
  }
  const options = {
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
      rarity: 20, // In each worldBlock, how many groups should there be?
      density: {
        size: 4, // How many nodes to put in a group.  Needs to have a max of 45 (including var).
        var: 2, // Node groups will be size +/- var big
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
      deathScript: "console.log(\"This was a triumph!  I'm making a note here: 'Huge Success!'\");" // Executes when a scriptling dies.
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
  db.createWorld(worldCreated, options);
}

function worldBlockCreated(world, block) {
  // Put up a wall of resources connecting the corners.
  const resourceArr = [];
  for (let i = 0; i < world.worldBlockFormula.width; i++) {
    let size = calcSize(world.worldBlockFormula.wallsize);
    for (let j = 0; j < size; j++) {
      const resourceType = calcResourceType(world.worldBlockFormula.wallResources);
      resourceArr.push({
        worldID: ObjectID(world.worldID), 
        location: { x: block.corners[0].x + i, y: block.corners[0].y + j }, 
        type: resourceType, 
        quantity: 100, 
        respawnTime: null
      });
    }
  }

  db.addWorldResources(scatterResources, resourceArr);

  // Then scatter nodes of resources within the block based on resourceFormulae.
}

function scatterResources() {
  const resourceArr = [];
  for (let i = 0; i < world.resourceFormulae.length; i++) {
    const resource = world.resourceFormulae[i];
    for (let j = 0; j < resource.rarity; j++) {
      const locations = calcFreeLocations(calcSize(resource.density));

      for (let k = 0; k < locations.length; k++) {
        resourceArr.push({
          worldID: ObjectID(world.worldID), 
          location: locations[k], 
          type: resource.name, 
          quantity: 100, 
          respawnTime: null
        });
      }
    }
  }
}

// Pick a random location in the block.
// Make sure it's clear and that there is nothing around it for ceil(size/2).
// If can't find a spot like that in 5 tries then give up and return an empty list.
// If a spot is found then return a list of locations centered around the one that was found.
function calcFreeLocations(block, size) {
  let location = calcRandomBlockLocation(block);
  let attempts = 0;
  let blocked = isLocationBlocked(location, Math.ceil(size / 2));
  while (blocked && attempts < 5) {
    location = calcRandomBlockLocation(block);
    blocked = isLocationBlocked(location, Math.ceil(size / 2));
    attempts++;
  }
  if (!blocked) {
    const locations = [];
    for (let i = 0; i < size; i++) {
      let loc = spiralOffsets[i];
      loc.x += location.x;
      loc.y += location.y;
      locations.push(loc);
    }
  }
  return locations;
}

// This is a spiral.  It's a list of locations spiraling out from 0,0.
// I could do it mathematically, but it's probably best to just make a master array and just return the first 
// x elements.  It will be faster.
const spiralOffsets = 
[
  { x:0, y:0 },
  { x:1, y:0 },
  { x:1, y:1 },
  { x:0, y:1 },
  { x:-1, y:1 },
  { x:-1, y:0 },
  { x:-1, y:-1 },
  { x:0, y:-1 },
  { x:1, y:-1 },
  { x:2, y:-1 },
  { x:2, y:0 },
  { x:2, y:1 },
  { x:1, y:2 },
  { x:0, y:2 },
  { x:-1, y:2 },
  { x:-2, y:1 },
  { x:-2, y:0 },
  { x:-2, y:-1 },
  { x:-1, y:-2 },
  { x:0, y:-2 },
  { x:1, y:-2 },
  { x:3, y:-2 },
  { x:3, y:-1 },
  { x:3, y:0 },
  { x:3, y:1 },
  { x:3, y:2 },
  { x:2, y:2 },
  { x:2, y:3 },
  { x:1, y:3 },
  { x:0, y:3 },
  { x:-1, y:3 },
  { x:-2, y:3 },
  { x:-2, y:2 },
  { x:-3, y:2 },
  { x:-3, y:1 },
  { x:-3, y:0 },
  { x:-3, y:-1 },
  { x:-3, y:-2 },
  { x:-2, y:-2 },
  { x:-2, y:-3 },
  { x:-1, y:-3 },
  { x:0, y:-3 },
  { x:1, y:-3 },
  { x:2, y:-3 },
  { x:2, y:-2 }
];

function isLocationBlocked(location, radius) {
  return resourceArr.some( resource => getDistance(location, resource.location) <= radius );
}

function getDistance(loc1, loc2) {
  const a = loc1.x - loc2.x;
  const b = loc1.y - loc2.y;
  return Math.sqrt(a * a + b * b);
}

function calcRandomBlockLocation(block) {
  let x = block.corners[0].x + Math.round(Math.random() * block.width);
  let y = block.corners[0].y + Math.round(Math.random() * block.width);
  return { x, y };
}

function calcSize(o) {
  return o.size + Math.round(Math.random() * o.var * 2) - o.var;
}

function calcResourceType(wallResources) {
  const rand = Math.round(Math.random() * 100);
  let percentages = 0;
  let type = '';
  for (let i = 0; i < wallResources.length; i++) {
    percentages += wallResources[i].percentage;
    if (percentages > rand) {
      type = wallResources[i].type;
      break;
    }
  }
  return type;
}

function close() {
  db.close();
}

// Test route
router.get('/createWorld', function (req, res) {
  createWorld();
  res.send({ message: 'Becky is hot!'});
});

module.exports = router;
module.exports.close = close; 
