
import express from 'express';
import { NodeVM, VMScript } from 'vm2';
import { ObjectID } from 'mongodb';
// import session from 'express-session';
import db from '../db/world-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

db.open();

function createWorld(respond, options) {
  // console.log(13, options);
  db.createWorld(worldCreated, options);
  function worldCreated(world) {
    // console.log(world);

    // Generate our worldBlocks
    // REMINDER: I need to refactor this so it fully creates each block before it starts on the next.
    // then send some signal that it's done at the end.  For now though, for testing, I'll just do one worldBlock.
    // for (let x = 0; x < 10; x++) {
    //   for (let y = 0; y < 10; y++) {
    const x = 0;
    const y = 0;
    const wB = {
      worldID: ObjectID(world._id),
      corners: [
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
      ]
    };
    
    db.createWorldBlock(worldBlockCreated, wB);
    //   }
    // }

    function worldBlockCreated(block) {
      generateResourcesForBlock(respond, world, block);
    }
  }
}

function generateResourcesForBlock(respond, world, block) {
  // Put up a wall of resources connecting the corners.
  const resourceArr = [];
  for (let i = 0; i < world.worldBlockFormula.width; i++) {
    // console.log(world.worldBlockFormula);
    // Top wall
    let size = calcSize(world.worldBlockFormula.wallThickness);
    for (let j = 0; j < size; j++) {
      if (!isLocationBlocked(resourceArr, 
        [ block.corners[0].x + i, block.corners[0].y + j ], 0.5)) {
        const resourceType = calcResourceType(world.worldBlockFormula.wallResources);
        resourceArr.push({
          worldID: ObjectID(world._id), 
          location: { type: "Point", x: block.corners[0].x + i, y: block.corners[0].y + j }, 
          type: resourceType, 
          quantity: 100, 
          respawnTime: null
        });
      }
    }
    // Bottom wall
    size = calcSize(world.worldBlockFormula.wallThickness);
    for (let j = 0; j < size; j++) {
      if (!isLocationBlocked(resourceArr, 
        [ block.corners[3].x + i, block.corners[3].y - j ], 0.5)) {
        const resourceType = calcResourceType(world.worldBlockFormula.wallResources);
        resourceArr.push({
          worldID: ObjectID(world._id), 
          location: { type: "Point", x: block.corners[3].x + i, y: block.corners[3].y - j }, 
          type: resourceType, 
          quantity: 100, 
          respawnTime: null
        });
      }
    }
    // Left wall
    size = calcSize(world.worldBlockFormula.wallThickness);
    for (let j = 0; j < size; j++) {
      if (!isLocationBlocked(resourceArr, 
        [ block.corners[0].x + j, block.corners[0].y + i ], 0.5)) {
        const resourceType = calcResourceType(world.worldBlockFormula.wallResources);
        resourceArr.push({
          worldID: ObjectID(world._id), 
          location: { type: "Point", x: block.corners[0].x + j, y: block.corners[0].y + i }, 
          type: resourceType, 
          quantity: 100, 
          respawnTime: null
        });
      }
    }
    // Right wall
    size = calcSize(world.worldBlockFormula.wallThickness);
    for (let j = 0; j < size; j++) {
      if (!isLocationBlocked(resourceArr, 
        [ block.corners[1].x - j - 1, block.corners[1].y + i ], 0.5)) {
        const resourceType = calcResourceType(world.worldBlockFormula.wallResources);
        resourceArr.push({
          worldID: ObjectID(world._id), 
          location: { type: "Point", x: block.corners[1].x - j - 1, y: block.corners[1].y + i }, 
          type: resourceType, 
          quantity: 100, 
          respawnTime: null
        });
      }
    }
  }

  db.addWorldResources(scatterResources, resourceArr);

  // Then scatter nodes of resources within the block based on resourceFormulae.

  function scatterResources(...params) {
    const newResourceArr = [];
    // console.log('hi');
    // console.log(world.resourceFormulae);
    for (let i = 0; i < world.resourceFormulae.length; i++) {
      const resource = world.resourceFormulae[i];
      // console.log(resource);
      for (let j = 0; j < resource.rarity; j++) {
        const locations = calcFreeLocations(resourceArr, block, calcSize(resource.density));
        // console.log(locations);
        for (let k = 0; k < locations.length; k++) {
          const r = {
            worldID: ObjectID(world._id), 
            location: { type: "Point", x: locations[k].x, y: locations[k].y }, 
            type: resource.name, 
            quantity: 100, 
            respawnTime: null
          };
          resourceArr.push(r);
          newResourceArr.push(r);
        }
        // console.log(newResourceArr);
      }
    }
    // console.log(resourceArr);
    db.addWorldResources(respond, newResourceArr);
  }
}

// Pick a random location in the block.
// Make sure it's clear and that there is nothing around it for ceil(size/2).
// If can't find a spot like that in 5 tries then give up and return an empty list.
// If a spot is found then return a list of locations centered around the one that was found.
function calcFreeLocations(resourceArr, block, size) {
  let location = calcRandomBlockLocation(block);
  // console.log(location);
  let attempts = 0;
  let blocked = isLocationBlocked(resourceArr, location, Math.ceil(size / 2));
  while (blocked && attempts < 5) {
    location = calcRandomBlockLocation(block);
    blocked = isLocationBlocked(resourceArr, location, Math.ceil(size / 2));
    attempts++;
  }
  const locations = [];
  if (!blocked) {
    // console.log(location);
    // console.log('offsets', spiralOffsets);
    for (let i = 0; i < size; i++) {
      let loc = { x: spiralOffsets[i][0], y: spiralOffsets[i][1] };
      // console.log(loc);
      loc.x += location.x;
      loc.y += location.y;
      // console.log(loc);
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
  [0,0 ],
  [1,0 ],
  [1,1 ],
  [0,1 ],
  [-1,1 ],
  [-1,0 ],
  [-1,-1 ],
  [0,-1 ],
  [1,-1 ],
  [2,-1 ],
  [2,0 ],
  [2,1 ],
  [1,2 ],
  [0,2 ],
  [-1,2 ],
  [-2,1 ],
  [-2,0 ],
  [-2,-1 ],
  [-1,-2 ],
  [0,-2 ],
  [1,-2 ],
  [3,-2 ],
  [3,-1 ],
  [3,0 ],
  [3,1 ],
  [3,2 ],
  [2,2 ],
  [2,3 ],
  [1,3 ],
  [0,3 ],
  [-1,3 ],
  [-2,3 ],
  [-2,2 ],
  [-3,2 ],
  [-3,1 ],
  [-3,0 ],
  [-3,-1 ],
  [-3,-2 ],
  [-2,-2 ],
  [-2,-3 ],
  [-1,-3 ],
  [0,-3 ],
  [1,-3 ],
  [2,-3 ],
  [2, -2 ]
];

function isLocationBlocked(resourceArr, location, radius) {
  return resourceArr.some( resource => getDistance(location, resource.location) <= radius );
}

function getDistance(loc1, loc2) {
  const a = loc1.x - loc2.x;
  const b = loc1.y - loc2.y;
  return Math.sqrt(a * a + b * b);
}

function calcRandomBlockLocation(block) {
  const width = Math.abs(block.corners[1].x - block.corners[0].x);
  // console.log(width);
  let x = block.corners[0].x + Math.round(Math.random() * width - 2);
  let y = block.corners[0].y + Math.round(Math.random() * width - 2);
  const location = { x, y };
  // console.log(location);
  return location;
}

function calcSize(o) {
  return o.size + Math.round(Math.random() * o.var * 2) - o.var;
}

function calcResourceType(resourceType) {
  const rand = Math.round(Math.random() * 100);
  let percentages = 0;
  let type = '';
  for (let i = 0; i < resourceType.length; i++) {
    percentages += resourceType[i].percentage;
    if (percentages >= rand) {
      type = resourceType[i].type;
      break;
    }
  }
  return type;
}

function close() {
  db.close();
}

// Test route
router.post('/createWorld', function (req, res) {
  // console.log(req.body);
  // const options = {
  //   name: 'Scripterra Prime',
  //   worldBlockFormula: {
  //     width: 100,
  //     wallThickness: 
  //     {
  //       size: 4,
  //       var: 1
  //     },
  //     wallResources: [
  //       {
  //         type: 'Iron',
  //         percentage: 100
  //       }
  //     ]
  //   },
  //   resourceFormulae: [{
  //     name: 'Iron', 
  //     rarity: 20, // In each worldBlock, how many groups should there be?
  //     density: {
  //       size: 4, // How many nodes to put in a group.  Needs to have a max of 45 (including var).
  //       var: 2, // Node groups will be size +/- var big
  //     },
  //     spawnTimer: {
  //       time: 100, // How many minutes after 'death' before respawn
  //       var: 10, // On 'death' a respawn time is set to currentTime + (time +/- var) minutes
  //     },
  //     passability: {
  //       speedFactor: 0, // When passing through a resource, speed is multiplied by speedFactor.  Should be 0<=speedFactor<=1.
  //       HP: 0, // When passing through a resource scriptling's HP lowers by this number each tick.
  //       // REMINDER: I don't want these for v1, but I like the idea of them.
  //       // senses: {
  //       //   factor: 1, // When passing through a resource sense radius is multiplied by factor.  Should be 0<=factor<=1.
  //       //   distortion: 0, // When passing through a resource sense will place sensed items up to this number off from actual location.
  //       //   hallucination: 0, // When passing through a resource sense will have chance to 
  //       // },
  //       // misdirection: 0, // When passing through a resource your direction can be sent off course by an angle up to this.
  //     }
  //   }],
  //   defaultUIScript: "", // I'll figure this out later
  //   scriptlingFormula: {
  //     cost: 
  //     [ // Cost to make a new scriptling
  //       {
  //         resource: 'Iron',
  //         amount: 50
  //       }
  //     ], 
  //     defaultMindScript: "", // Default mindScript to give the user something to start with.  mindScript executes every tick.
  //     birthScript: "// console.log('Good Morning, Dave!);", // Executes on scriptling creation.
  //     upkeepScript: "// console.log(\"I'm hungry\");", // Executes every hour.  Basically it's to make scriptlings require maintenance, food, etc.
  //     deathScript: "// console.log(\"This was a triumph!  I'm making a note here: 'Huge Success!'\");" // Executes when a scriptling dies.
  //   },
  //   startLocationFormula: {
  //     resources: 
  //     [
  //       {
  //         resource: 'Iron',
  //         minNodes: 3,
  //         dist: 
  //         {
  //           min: 3,
  //           max: 10
  //         }
  //       }
  //     ],
  //     mobs: {
  //       dist: {
  //         min: 4,
  //         max: -1
  //       }
  //     },
  //     scriptlings: {
  //       dist: {
  //         min: 10,
  //         max: -1
  //       }
  //     }
  //   },
  //   // mobFormulae: options.mobFormulae,
  //   // wallFormulae: options.wallFormulae, // REMINDER: I do want to add these features eventually, but I also want to get something working soonish.  Leaving them out for now.
  //   // itemFormulae: options.itemFormulae,
  //   // researchFormulae: options.researchFormulae
  // };
  // // console.log(req.body);
  createWorld(worldCreated, req.body);
  function worldCreated() {
    // console.log('World Created!');
  }
  res.send({ message: 'World Creation in progress!'});
}).post('/generateResources', function (req, res) {
  db.getWorld(gotWorld, req.body.worldID);

  function gotWorld(world) {
    db.getWorldBlock(gotWorldBlock, req.body.blockID);
  
    function gotWorldBlock(block) {
      // console.log(world);
      // console.log(block);
      generateResourcesForBlock(worldCreated, world, block);
    }
  }
  function worldCreated() {
    console.log('World Created!');
  }
  res.send({ message: 'World Creation in progress!'});
});

module.exports = router;
module.exports.close = close; 
