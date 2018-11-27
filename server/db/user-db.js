
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

function getUsersByText(respond, text) {
  // console.log(`Getting users: ${text}`); 
  const db = client.db(dbName);

  db.collection('user').find({ $text: { $search: text } }).toArray(function (err, docs) {
    if (err) throw err;
    respond(docs);
  });
}

function getUserByEmail(respond, email) {
  console.log(`Getting user: ${email}`);
  // respond(email);
  try {
    const db = client.db(dbName);
    db.collection('user').find({ email: email }).toArray(function (err, docs) {
      if (err) respond({ message: `Error: ${err}.  Try registering.`});
      if (docs == null || docs.length == 0) respond(null);
      respond(docs[0]);
    });
  }
  catch (e) {
    console.log(e);
    respond(e); 
  }
}

function register(respond, user) {
  // console.log(`Registering user: ${user.email}`);
  const db = client.db(dbName);

  db.collection('user').find({ email: user.email }).toArray(function (err, docs) {
    if (err) {
      throw err;
    }
    if (docs != null && docs.length > 0) {
      respond({ message: `There is already an account for ${user.email}.`});
    }
    else {
      const results = db.collection('user').insertOne({ 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email, 
        password: user.password 
      });
      respond({ message: `Registration successful for ${user.email}!`});
    }
  });
}

function updateUser(respond, id, user) {
  // console.log(`Updating user: ${user.email}`);
  const db = client.db(dbName);
  db.collection('user').updateOne(
    { _id: ObjectID(id) }, 
    { $set: 
      { 
        firstName: user.firstName, 
        lastName: user.lastName, 
        email: user.email, 
        password: user.password 
      }
    });
  respond({ message: `User ${user.email} updated!`});
}

module.exports = { open, close, getUserByEmail, getUsersByText, register, updateUser };
