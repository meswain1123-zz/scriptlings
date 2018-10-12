// ui controller module

var express = require('express');
const assert = require('assert');
var router = express.Router();
require('dotenv').config({ silent: true });
const MongoClient = require('mongodb').MongoClient;
const dbName = 'scriptlingsDB';
const url = process.env.MONGO_DB_CONNECTION_STRING;
console.log(url); 
const client = new MongoClient(url);

// Test route
router.get('/test', function (req, res) {
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    client.close();
  });
  res.send({ message: 'I love when you use me!'}); 
}).post('/test', function (req, res) {
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    client.close();
  });
  res.send({ message: 'I love when you post me!'}); 
}).put('/test', function (req, res) {
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    client.close();
  });
  res.send({ message: 'I love when you put me!'}); 
});

module.exports = router;
