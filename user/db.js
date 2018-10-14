
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
 
// console.log(process.env);

function getUsersByText(respond, text) {
  // console.log(`Getting users: ${text}`); 
  // client.connect(function(err) {
  //   assert.equal(null, err); 
    const db = client.db(dbName);

    db.collection('user').find({ $text: { $search: text } }).toArray(function (err, docs) {
      // client.close();
      if (err) throw err;
      respond(docs);
    });
  // });
}

function getUserByEmail(respond, email) {
  // console.log(`Getting user: ${email}`);
  // client.connect(function(err) {
  //   assert.equal(null, err); 
    const db = client.db(dbName);

    // console.log(email);
    db.collection('user').find({ email: email }).toArray(function (err, docs) {
      // console.log(docs);
      // client.close();
      if (err) throw err;
      if (docs == null || docs.length == 0) respond(null);
      respond(docs[0]);
    });
  // });
}

function register(respond, user) {
  // console.log(`Registering user: ${user.email}`);
  // console.log(user);
  // client.connect(function(err) {
  //   assert.equal(null, err); 
    const db = client.db(dbName);

    db.collection('user').find({ email: user.email }).toArray(function (err, docs) {
      if (err) {
        // client.close();
        throw err;
      }
      if (docs != null && docs.length > 0) {
        // client.close();
        respond({ message: `There is already an account for ${user.email}.`});
      }
      else {
        const results = db.collection('user').insertOne({ 
          firstName: user.firstName, 
          lastName: user.lastName, 
          email: user.email, 
          password: user.password 
        });
        // console.log(57, results);
        // client.close();
        respond({ message: `Registration successful for ${user.email}!`});
      }
    });
  // });
}

function updateUser(respond, id, user) {
  // console.log(`Updating user: ${user.email}`);
  // client.connect(function(err) {
    // assert.equal(null, err); 
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
    // client.close();
    respond({ message: `User ${user.email} updated!`});
  // });
}

module.exports = { open, close, getUserByEmail, getUsersByText, register, updateUser };
