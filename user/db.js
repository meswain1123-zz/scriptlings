
import dotenv from 'dotenv';
dotenv.config({ silent: true });
import { MongoClient, ObjectID } from 'mongodb';
import assert from 'assert';
const dbName = 'hephestus';
const url = process.env.MONGO_DB_CONNECTION_STRING;
const client = new MongoClient(url);

function getUserByEmail(res, email) {
  console.log(`Getting user: ${email}`);
  let user = null;
  client.connect(function(err) {
    assert.equal(null, err); 
    const db = client.db(dbName);

    var cursor = db.collection('user').find({ email: email });
    cursor.each(function(err, doc) {
      if (doc != null) {
        user = doc;
        console.log(20, user);
        res.send({ message: 'I love when you use me!', user: user }); 
      }
    });
    console.log(22, user);

    client.close();
  });
  console.log(26, user);
  return user;
}

function register(res, user) {
  console.log(`Registering user: ${user.email}`);
  client.connect(function(err) {
    assert.equal(null, err); 
    const db = client.db(dbName);

    db.collection('user').insertOne({ 
      firstName: user.firstName, 
      lastName: user.lastName, 
      email: user.email, 
      password: user.password 
    });
    res.send({ message: 'I love when you post me!'}); 

    client.close();
  });
}

function updateUser(res, id, user) {
  console.log(`Updating user: ${user.email}`);
  client.connect(function(err) {
    assert.equal(null, err); 
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
    res.send({ message: 'I love when you put me!'}); 

    client.close();
  });
}

module.exports = { getUserByEmail, register, updateUser };
