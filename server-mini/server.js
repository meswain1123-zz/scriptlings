// Get dependencies
var express     = require('express');
var morgan      = require('morgan');
var session     = require('express-session');
// const path = require('path');
var dotenv      = require('dotenv');
var bodyParser  = require('body-parser');
var uuidv1      = require('uuid/v1');

dotenv.config({ silent: true });

var app = express();
var server = require('http').Server(app);
port = process.env.PORT || 8080;

let myEnv = process.env;
process.env = {};
// console.log(myEnv);
// Catch all other routes and return the index file
app.get('/', (req, res) => {
  res.send('Good morning, Dave!');
});

// use morgan to log requests to the console
app.use(morgan('dev')); 

var worldService    = require('./services/world-service.js');
app.use('/world', worldService);

server.listen(port);
console.log('App running at http://localhost:' + port);
