// world controller module

import express from 'express';
// import session from 'express-session';
import db from './db';
var router = express.Router();
let myEnv = process.env;
process.env = {};

// Test route
router.get('/test', function (req, res) {
  res.send({ message: 'Becky is hot!'});
})

module.exports = router;
