// ui controller module

var express = require('express');
const assert = require('assert');
var router = express.Router();
require('dotenv').config({ silent: true });
const MongoClient = require('mongodb').MongoClient;
const dbName = 'scriptlingsDB';
const url = process.env.MONGO_DB_CONNECTION_STRING;
const client = new MongoClient(url);

// Test route
router.get('/test', function (req, res) {
  // client.connect(function(err) {
  //   assert.equal(null, err);
  //   console.log("Connected successfully to server");

  //   const db = client.db(dbName);

  //   client.close();
  // });
  res.send({ message: 'We should interface!'});
})

module.exports = router;
