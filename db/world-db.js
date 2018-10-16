
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
  // console.log(`Getting users: ${text}`); 
  const db = client.db(dbName);

  db.collection('scriptling').find({ userID }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

function createScriptlingForUser(respond, userID, location) {
  // console.log(`Creating scriptling for user: ${userID}`); 
  const db = client.db(dbName);

  db.collection('scriptling').insertOne({ userID, location, memory: {} });
  respond({ message: 'scriptling created'});
}

function getUsersForWorld(respond) {
  // console.log(`Getting users for world`); 
  const db = client.db(dbName);

  db.collection('user').find({ $text: { $search: text } }, { _id : 1, mindCode: 1 }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

// This is a nasty aggregate function.
// It has to get all the objects within range of the scriptling and create a sense object from them.
function getSense(respond, scriptling) {

}

function getCommand(respond, userID) {
  // console.log(`Get user command: ${userID}`); 
  const db = client.db(dbName);

  db.collection('user').find({ _id : userID }, { _id : 1, commandFromUI: 1 }).toArray(function (err, docs) {
    if (err) throw err;
    if (docs.length == 0) {
      respond({});
    }
    else {
      respond(docs[0]);
    }
  });
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
  respond({ message: `User ${user.email} updated!`});
}

function performAction(respond, scriptling) {

}

function getScriptlings(respond, userID) {

}

module.exports = { 
  open, close, 
  getScriptlingsForUser, createScriptlingForUser, getUsersForWorld,
  getSense, getCommand, setScriptlingActionAndMemory, performAction, getScriptlings
};
