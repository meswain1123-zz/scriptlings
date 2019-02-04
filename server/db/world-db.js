
import dotenv from 'dotenv';
dotenv.config({ silent: true });
import { MongoClient, ObjectID } from 'mongodb';
import assert from 'assert';
const dbType = process.env.DB_TYPE;
const dbName = process.env.DB_NAME;
const url = process.env.DB_CONNECTION_STRING;
const client = new MongoClient(url, { useNewUrlParser: true });
function open() {
  // console.log('opening');
  client.connect(function(err) {
    assert.equal(null, err); 
  });
}
function close() {
  // console.log('closing');
  client.close();
}

function getScriptlings(respond, worldID, skip, take) {
  // console.log(`Getting scriptlings: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling')
  .find({ worldID: ObjectID(worldID) })
  .skip(skip).limit(take).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

function getScriptlingsForUser(respond, userID, worldID) {
  // console.log(`Getting scriptlings: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling')
  .find({ userID: ObjectID(userID), worldID: ObjectID(worldID) })
  .toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

function createScriptlingForUser(respond, userID, worldID, location) {
  // console.log(`Creating scriptling for user: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling').insertOne(
    { 
      userID: ObjectID(userID), 
      worldID: ObjectID(worldID), 
      location, 
      memory: {}, 
      health: { HP: 100 },
      inventory: {
        full: false,
        max: 100,
        current: 0, // This is a sum of all the quantities in resources.
        resources: {
          // resourceType: 'string', quantity: 'int'
        }
      },
      weapon: null,
      armor: null,
      item: null
    });
  respond({ message: 'scriptling created' });
}

// REMINDER: need to change it so each user can have access to multiple worlds, and have different scripts for each.
function getUsersForWorld(respond, worldID) {
  // console.log(`Getting users for world`); 
  const db = client.db(dbName);

  db.collection('worldUser').find({ worldID: ObjectID(worldID) }, { userID: 1, mindScript: 1, home: 1 }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

// I don't think I'm actually going to use this, but I feel better having it here.
function getCommand(respond, userID, worldID) {
  // console.log(`Get user command: ${userID}`); 
  const db = client.db(dbName);

  db.collection('worldUser').find(
    { userID : ObjectID(userID), worldID: ObjectID(worldID) }, 
    { _id : 1, commandFromUI: 1 }).toArray(function (err, docs) {

    if (err) throw err;
    if (docs.length == 0) {
      respond({});
    }
    else {
      respond(docs[0]);
    }
  });
}

// I don't think I'm actually going to use this, but I feel better having it here.
function updateCommand(userID, worldID, commandFromUI) {
  // console.log(`Update user command: ${userID}`); 
  const db = client.db(dbName);

  db.collection('worldUser').updateOne(
    { userID : ObjectID(userID), worldID: ObjectID(worldID) }, 
    { $set: 
      { 
        commandFromUI
      }
    });
  respond({ message: `User ${user.email} updated!`});
}

function setScriptlingActionAndMemory(respond, scriptlingID, action, memory) {
  // console.log(`Set Scriptling Action And Memory: ${scriptlingID}`);
  const db = client.db(dbName);
  db.collection('scriptling').updateOne(
    { _id: ObjectID(scriptlingID) }, 
    { $set: 
      { 
        action: action,
        memory: memory 
      }
    });
  respond({ message: `Scriptling ${scriptlingID} updated!`});
}

function senseScriptlings(respond, scriptling, worldID, senseRange) {
  const db = client.db(dbName);

  const minY = scriptling.location.y - senseRange;
  const maxY = scriptling.location.y + senseRange;
  const minX = scriptling.location.x - senseRange;
  const maxX = scriptling.location.x + senseRange;

  db.collection('scriptling').find({ 
    worldID: ObjectID(worldID), 
    "location.x": { $gte: minX, $lte: maxX }, 
    "location.y": { $gte: minY, $lte: maxY } 
   }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

function senseResources(respond, scriptling, worldID, senseRange) {
  const db = client.db(dbName);

  // db.collection('worldResource').find({ location : { $near : [scriptling.location[0], scriptling.location[1]] }}).toArray(function (err, docs) {
  //   if (err) throw err;
  //   respond(docs);
  // });

  const minY = scriptling.location.y - senseRange;
  const maxY = scriptling.location.y + senseRange;
  const minX = scriptling.location.x - senseRange;
  const maxX = scriptling.location.x + senseRange;
  // console.log(minX);
  // console.log(maxX);
  // console.log(minY);
  // console.log(maxY);
  db.collection('worldResource')
    .find({ 
      worldID: ObjectID(worldID), 
      "location.x": { $gte: minX, $lte: maxX }, 
      "location.y": { $gte: minY, $lte: maxY },
      quantity: { $gt: 0 },
      respawnTime: null
    }).sort( { _id: 1 } )
    .toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

function senseDroppedResources(respond, scriptling, worldID, senseRange) {
  const db = client.db(dbName);

  // db.collection('worldResource').find({ location : { $near : [scriptling.location[0], scriptling.location[1]] }}).toArray(function (err, docs) {
  //   if (err) throw err;
  //   respond(docs);
  // });

  const minY = scriptling.location.y - senseRange;
  const maxY = scriptling.location.y + senseRange;
  const minX = scriptling.location.x - senseRange;
  const maxX = scriptling.location.x + senseRange;
  // console.log(minX);
  // console.log(maxX);
  // console.log(minY);
  // console.log(maxY);
  db.collection('droppedResource')
    .find({ 
      worldID: ObjectID(worldID), 
      "location.x": { $gte: minX, $lte: maxX }, 
      "location.y": { $gte: minY, $lte: maxY } 
    }).sort( { _id: 1 } )
    .toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

// This creates their home and their first scriptlings.
function addUserToWorld(respond, userID, worldID, startLocation, mindScript, uiScript) {
  // console.log(`Adding user: ${userID}`);
  const db = client.db(dbName);

  db.collection('worldUser').insertOne(
    { 
      userID: ObjectID(userID), 
      worldID: ObjectID(worldID),
      home: startLocation, 
      mindScript,
      uiScript
    });
  respond({ message: "User added to world."});
}

function getUserForWorld(respond, userID, worldID) {
  const db = client.db(dbName);
  db.collection('worldUser').find(
    { userID: ObjectID(userID), worldID: ObjectID(worldID) }, 
    { userID : 1, mindScript: 1, home: 1 }).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs[0]);
  });
}

function updateScriptlingLocation(scriptling) {
  // console.log(`Set Scriptling Location: ${scriptlingID}`);
  const db = client.db(dbName);
  db.collection('scriptling').updateOne(
    { _id: ObjectID(scriptling._id) }, 
    { $set: 
      { 
        location: scriptling.location
      }
    });
  // respond({ message: `Scriptling ${scriptlingID} updated!`});
}

function updateScriptlingInventory(respond, scriptling) {
  // console.log(`Update Scriptling Inventory: ${scriptlingID}`);
  const db = client.db(dbName);
  db.collection('scriptling').updateOne(
    { _id: ObjectID(scriptling._id) }, 
    { $set: 
      { 
        inventory: scriptling.inventory
      }
    });
  respond({ message: `Scriptling ${scriptling._id} updated!`});
}

// Gets a location with good resources nearby (worldGenerator will intentionally make these and mark them)
// includes a sense object for each location, along with the distance to the nearest other user.
// REMINDER: In the future I should make it so there are multiple realms, each with its own set of users.  
// Different realms could have different world rules that make the world, scriptlings, and commands work a little differently.
// Maybe gendered scriptlings where the genders have to work together to make scriptlings.
// Regen worlds where scriptlings heal automatically instead of needing to repair.
// Limited resource worlds where there are fewer resources and they don't respawn.
// Competitive worlds where everyone starts at the same time, and there's no rejoining.  Whoever lasts longest wins, etc.
// This is done with an aggregate which utilizes the world's startLocationFormula, worldResources, worldMobs, and scriptlings.
function getAvailableStartLocations(respond, worldID) {

}

// Creates a new world based on the options.
// This includes dimensions, parameters for resource placements, etc.
// It also defines the startLocations for the new world.
// options: resourceFormulae (which resources, how common, how dense, respawn rate, passability (can it be passed through, 
// if so what effects does that have?  Speed, health, senses?)), default UIScript, 
// scriptlingFormula (default mindScript, resource cost, birthScript, upkeepScript, deathScript), 
// wallFormulae, itemFormulae, researchFormulae
function createWorld(respond, options) { 
  const db = client.db(dbName);
  // console.log(178, options); 
  db.collection('world').insertOne(
    { 
      name: options.name,
      worldBlockFormula: options.worldBlockFormula,
      resourceFormulae: options.resourceFormulae,
      defaultUIScript: options.defaultUIScript,
      scriptlingFormula: options.scriptlingFormula,
      startLocationFormula: options.startLocationFormula,
      // mobFormulae: options.mobFormulae,
      // wallFormulae: options.wallFormulae, // REMINDER: I do want to add these features eventually, but I also want to get something working soonish.  Leaving them out for now.
      // itemFormulae: options.itemFormulae,
      // researchFormulae: options.researchFormulae,
    }, function(err, res) {
      // console.log(err);
      // console.log(194, res.ops[0]);
      respond(res.ops[0]);
    }
  );
}

function getWorld(respond, worldID) {
  const db = client.db(dbName);
  db.collection('world').find(
    { _id: ObjectID(worldID) }).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs[0]);
  });
}

function createWorldBlock(respond, wB) {  
  const db = client.db(dbName);
  db.collection('worldBlock').insertOne(
    wB, function(err, res) {
      // console.log(res);
      respond(res.ops[0]);
    }
  );
}

function getWorldBlock(respond, blockID) {
  const db = client.db(dbName);
  db.collection('worldBlock').find(
    { _id: ObjectID(blockID) }).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs[0]);
  });
}

// // Decided to remove this because I'm just going to use the resourceFormulae on the world.
// // As part of that I'm going to be changing the typeIDs for resources to just type, and they'll be strings.
// function addResourceType(respond, worldID, name, passability, spawnTimer) {
//   db.collection('resourceType').insertOne(
//     {
//       worldID: ObjectID(worldID), name,
//       passability, spawnTimer
//     }, function(err, res) {
//       respond(res.ops[0]);
//     }
//   );
// }

function addWorldResource(respond, worldID, location, resourceType) {
  const db = client.db(dbName);
  db.collection('worldResource').insertOne(
    {
      worldID: ObjectID(worldID), location, resourceType, quantity: 100, respawnTime: null
    }, function(err, res) {
      respond(res.ops[0]);
    }
  );
}

function addWorldResources(respond, array) {
  if (array.length > 0) {
    const db = client.db(dbName);
    db.collection('worldResource').insertMany(array, 
      function(err, docsInserted) {
        if (err) {
          // console.log(err);
          throw err;
        }
        respond(docsInserted);
      }
    );
  }
  else {
    respond([]);
  }
}

function respawnResource(respond, worldResourceID) {
  const db = client.db(dbName);
  db.collection('worldResource').updateOne(
    {
      _id: ObjectID(worldResourceID)
    }, 
    { $set: 
      { 
        respawnTime: null, quantity: 100
      }
    });
  respond({ message: `Scriptling ${scriptlingID} updated!`});
}

function getWorldResources(respond, worldID, skip, take) {
  // console.log(`Getting resources: ${worldID}`); 
  const db = client.db(dbName);
  // console.log(skip);
  // console.log(take);
  db.collection('worldResource')
    .find({ worldID: ObjectID(worldID) })
    .skip(skip).limit(take).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

function updateResource(respond, worldResourceID, quantity, respawnTime) {
  const db = client.db(dbName);
  db.collection('worldResource').updateOne(
    {
      _id: ObjectID(worldResourceID)
    }, 
    { $set: 
      { 
        quantity, respawnTime
      }
    });
  respond({ message: `Resource ${worldResourceID} updated!`});
}

function getDroppedResources(respond, worldID, skip, take) {
  // console.log(`Getting dropped resources: ${worldID}`); 
  const db = client.db(dbName);

  db.collection('droppedResource')
    .find({ worldID: ObjectID(worldID) }).sort( { _id: 1 } )
    .skip(skip).limit(take).toArray(function (err, docs) {
    // console.log(docs);
    if (err) throw err;
    respond(docs);
  });
}

function addDroppedResource(respond, droppedResource) {
  const db = client.db(dbName);
  db.collection('droppedResource').insertOne(
    { 
      worldID: ObjectID(droppedResource.worldID),
      location: droppedResource.location, 
      type: droppedResource.type, 
      quantity: droppedResource.quantity
    }, function(err, res) {
      // console.log(res);
      respond(res.ops[0]);
    }
  );
}

function updateDroppedResource(respond, droppedResource) {
  const db = client.db(dbName);
  db.collection('droppedResource').updateOne(
    {
      _id: ObjectID(droppedResource._id)
    }, 
    { $set: 
      { 
        quantity: droppedResource.quantity
      }
    });
  respond({ message: `Dropped Resource ${droppedResource._id} updated!`});
}

function deleteDroppedResource(respond, droppedResource) {
  const db = client.db(dbName);
  db.collection('droppedResource').deleteOne(
    {
      _id: ObjectID(droppedResource._id)
    });
  respond({ message: `Dropped Resource ${droppedResource._id} deleted!`});
}

// // Mobs are auto-spawned scriptlings.  
// // They are spawned with stats, inventory, location, and a simple mindScript.
// // They also have a spawn timer that determines how long after they die before they respawn.
// function addWorldMob(respond, worldID, location, stats, inventoryBag, mindScript, spawnTimer, inventory) {
//   db.collection('worldMob').insertOne(
//     {
//       worldID: ObjectID(worldID), 
//       location, stats, inventoryBag, mindScript, spawnTimer, 
//       currentLocation: location, respawnTime: null,
//       currentStats: stats, inventory
//     }, function(err, res) {
//       respond(res.ops[0]);
//     }
//   );
// }

// function respawnMob(respond, worldMobID, location, inventory) {
//   db.collection('worldMob').updateOne(
//     {
//       _id: ObjectID(worldMobID)
//     }, 
//     { $set: 
//       { 
//         respawnTime: null, currentLocation: location, inventory
//       }
//     });
//   respond({ message: `Scriptling ${scriptlingID} updated!`});
// }

// function getMobsForWorld(respond, worldID) {
//   // console.log(`Getting mobs: ${worldID}`); 
//   const db = client.db(dbName);

//   db.collection('worldMob').find({ worldID: ObjectID(worldID) }).toArray(function (err, docs) {
//     // console.log(docs);
//     if (err) throw err;
//     respond(docs);
//   });
// }

// function updateMobLocation(respond, worldMobID, location) {
//   // console.log(`Set Mob Location: ${worldMobID}`);
//   const db = client.db(dbName);
//   db.collection('worldMob').updateOne(
//     { _id: ObjectID(worldMobID) }, 
//     { $set: 
//       { 
//         location
//       }
//     });
//   respond({ message: `Scriptling ${worldMobID} updated!`});
// }

// function updateMobStats(respond, worldMobID) {
//   // db.collection('worldMob').updateOne(
//   //   {
//   //     _id: ObjectID(worldMobID)
//   //   }, 
//   //   { $set: 
//   //     { 
//   //       quantity, respawnTime
//   //     }
//   //   });
//   // respond({ message: `Scriptling ${scriptlingID} updated!`});
// }

function updateScriptlingStats(scriptling) {

}

module.exports = { 
  open, close, 
  getScriptlings, getScriptlingsForUser, createScriptlingForUser, getUsersForWorld,
  senseScriptlings, senseResources, senseDroppedResources, getCommand, updateCommand, 
  setScriptlingActionAndMemory, 
  updateScriptlingLocation, updateScriptlingStats, updateScriptlingInventory,
  addUserToWorld, getUserForWorld, getAvailableStartLocations, 
  createWorld, getWorld, createWorldBlock, getWorldBlock,
  addWorldResource, addWorldResources, 
  respawnResource, getWorldResources, updateResource, 
  addDroppedResource, updateDroppedResource, deleteDroppedResource, getDroppedResources,
  // addWorldMob, respawnMob, getMobsForWorld, updateMobLocation, updateMobStats
};

