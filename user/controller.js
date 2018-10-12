// ui controller module

import express from 'express';
import db from './db';
var router = express.Router();

// Test route
router.get('/test', function (req, res) {
  db.getUserByEmail(res, 'meswain@gmail.com');
}).post('/test', function (req, res) {
  db.register(res, { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain' });
}).put('/test', function (req, res) {
  console.log('putting');
  db.updateUser(res, "5bc0cc0dfb1a9c24b2f6944e", { email: 'meswain@gmail.com', firstName: 'Matt', lastName: 'Swain', password: 'that1guy' });
});

module.exports = router;
