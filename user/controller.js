// user controller module

import express from 'express';
// import session from 'express-session';
import db from './db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

db.open();

// // Test route
// router.get('/test/:email', function (req, res) {
//   // console.log(req.params);
//   db.getUserByEmail(res, 'meswain@gmail.com');
// }).post('/test', function (req, res) {
//   // console.log(req.session);
//   function respond(docs) {
//     res.send({ message: 'I love when you use me!', users: docs });
//   };

//   db.getUsersByText(respond, req.body.email);

//   // db.getUserByEmail(res, 'meswain@gmail.com');
//   // db.register(res, { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain' });
// }).put('/test', function (req, res) {
//   db.updateUser(res, "5bc0cc0dfb1a9c24b2f6944e", { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });
// });

// User routes
router.get('/getUsersByText/:text', function (req, res) {
  // console.log(req.params);
  function respond(docs) {
    res.send({ message: 'I love when you use me!', users: docs });
  };

  db.getUsersByText(respond, req.params.text);
}).post('/login', function (req, res) {
  function respond(user) {
    // console.log(req.session.user_id);
    // console.log(user);
    if (user != null && user.password == req.body.password) {
      // console.log(res);
      req.session.user_id = user._id;
      // console.log(res);
      res.send({ message: `Welcome to Scriptlings ${user.firstName} ${user.lastName}!  Prepare for awesomeness!`, user: user });
    } else {
      res.send({ message: 'There was a problem with your credentials.' });
    }
  };

  db.getUserByEmail(respond, req.body.email);
}).post('/logout', function (req, res) {
  req.session.user_id = null;
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
