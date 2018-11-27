// user service module

import express from 'express';
// import session from 'express-session';
import db from '../db/user-db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

db.open();

// User routes
router.get('/getUsersByText/:text', function (req, res) {
  // console.log(req.params);
  function respond(docs) {
    res.send({ message: 'I love when you use me!', users: docs });
  };

  db.getUsersByText(respond, req.params.text);
}).post('/login', function (req, res) {
  function respond(user) {
    // console.log(req.session.userID);
    // console.log(user);
    if (user != null && user.password == req.body.password) {
      // console.log(res);
      req.session.userID = user._id;
      // console.log(res);
      res.send({ message: `Welcome to Scriptlings, ${user.firstName}!  Prepare for awesomeness!`, user: user });
    } else {
      res.send({ message: 'There was a problem with your credentials.' });
    }
  };

  db.getUserByEmail(respond, req.body.email);
}).post('/logout', function (req, res) {
  req.session.userID = null;
  res.send({ message: 'Logout Success' });
}).post('/register', function (req, res) {
  function respond(messageObj) {
    res.send(messageObj);
  };
  db.register(respond, req.body);
});

function close() {
  db.close();
}

module.exports = router;
module.exports.close = close; 
