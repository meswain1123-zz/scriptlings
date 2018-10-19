
import dotenv from 'dotenv';
dotenv.config({ silent: true });
import { MongoClient, ObjectID } from 'mongodb';
import assert from 'assert';
const dbType = process.env.DB_TYPE;
const dbName = process.env.DB_NAME;
const url = process.env.DB_CONNECTION_STRING;
const client = new MongoClient(url, { useNewUrlParser: true });
function open() {
  console.log('opening');
  client.connect(function(err) {
    assert.equal(null, err); 
  });
}
function close() {
  console.log('closing');
  client.close();
}

function getScriptlingsForUser(respond, userID) {
  console.log(`Getting scriptlings: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling').find({ userID }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

function createScriptlingForUser(respond, userID, location) {
  console.log(`Creating scriptling for user: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling').insertOne({ userID: ObjectID(userID), location, memory: {}, health: { HP: 100 } });
  respond({ message: 'scriptling created'});
}

function getUsersForWorld(respond) {
  console.log(`Getting users for world`); 
  const db = client.db(dbName);

  db.collection('worldUser').find({ }, { _id : 1, mindCode: 1, home: 1 }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

// I don't think I'm actually going to use this, but I feel better having it here.
function getCommand(respond, userID) {
  console.log(`Get user command: ${userID}`); 
  const db = client.db(dbName);

  db.collection('user').find({ _id : ObjectID(userID) }, { _id : 1, commandFromUI: 1 }).toArray(function (err, docs) {
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
function updateCommand(userID, commandFromUI) {
  console.log(`Update user command: ${userID}`); 
  const db = client.db(dbName);

  db.collection('user').updateOne(
    { _id : ObjectID(userID) }, 
    { $set: 
      { 
        commandFromUI
      }
    });
  respond({ message: `User ${user.email} updated!`});
}

function setScriptlingActionAndMemory(respond, scriptlingID, action, memory) {
  console.log(`Set Scriptling Action And Memory: ${scriptlingID}`);
  const db = client.db(dbName);
  db.collection('scriptling').updateOne(
    { _id: ObjectID(scriptlingID) }, 
    { $set: 
      { 
        action: action,
        memory: memory 
      }
    });
  respond({ message: `User ${user.email} updated!`});
}

// This is a nasty aggregate function.
// It has to get all the objects within range of the scriptling and create a sense object from them.
// I think I want to wait a little while before I finish this.  I need to make sure I've got the structure fully planned first.
function getSense(respond, scriptling) {
  // console.log(`Getting users for world`); 
  // const db = client.db(dbName);

  // db.collection('user').aggregate([{  }]).toArray(function (err, docs) {
  //   if (err) throw err;
  //   respond(docs);
  // });
}

// This creates their home and their first scriptlings.
function addUserToWorld(respond, userID, startLocation) {
  console.log(`Adding user: ${userID}`);
  const db = client.db(dbName);

  db.collection('home').find({ userID: ObjectID(userID) }).toArray(function (err, docs) {
    if (err) {
      throw err;
    }
    if (docs != null && docs.length > 0) {
      // Check if they have any scriptlings.  If so then respond with error.
      // If not then move home to new location and spawn starting scriptlings.
    }
    else {
      db.collection('home').insertOne({ 
        userID: ObjectID(userID),
        location: startLocation 
      });
      respond({ message: `Registration successful for ${user.email}!`});
    }
  });
}

function updateScriptlingLocation(respond, scriptling) {

}

// Gets a location with good resources nearby (worldGenerator will intentionally make these and mark them)
// includes a sense object for each location, along with the distance to the nearest other user.
// REMINDER: In the future I should make it so there are multiple realms, each with its own set of users.  
// Different realms could have different world rules that make the world, scriptlings, and commands work a little differently.
// Maybe gendered scriptlings where the genders have to work together to make scriptlings.
// Regen worlds where scriptlings heal automatically instead of needing to repair.
// Limited resource worlds where there are fewer resources and they don't respawn.
// Competitive worlds where everyone starts at the same time, and there's no rejoining.  Whoever lasts longest wins, etc.
function getAvailableStartLocations(respond) {

}

function updateScriptlingStats(scriptling) {

}

module.exports = { 
  open, close, 
  getScriptlingsForUser, createScriptlingForUser, getUsersForWorld,
  getSense, getCommand, updateCommand, 
  setScriptlingActionAndMemory,
  addUserToWorld
};
