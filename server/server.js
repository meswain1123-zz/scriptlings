
import express from 'express';
import session from 'express-session';
// const path = require('path');
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import uuidv1 from 'uuid/v1';

dotenv.config({ silent: true });

const app = express();
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

if (app.get('env') === 'production') {
  app.set('trust proxy', 1); // trust first proxy
  // sess.cookie.secure = true // serve secure cookies
  app.use(session({
    genid: function (req) {
      return uuidv1() // use UUIDs for session IDs
    },
    secret: 'keyboard cat',
    cookie: {
      maxAge: 60000,
      secure: true
    },
    resave: true,
    saveUninitialized: true
  }));
} else {
  app.use(session({
    genid: function (req) {
      return uuidv1() // use UUIDs for session IDs
    },
    secret: 'keyboard cat',
    cookie: { maxAge: 60000 },
    resave: true,
    saveUninitialized: true
  }));
}
let myEnv = process.env;
process.env = {};
// Access the session as req.session
// app.use(express.json());       // to support JSON-encoded bodies
// app.use(express.urlencoded()); // to support URL-encoded bodies

import genesisService from './services/genesis-service';
app.use('/genesis', genesisService);
import worldService from './services/world-service.js';
app.use('/world', worldService);
import mindService from './services/mind-service.js';
app.use('/mind', mindService);
import uiService from './services/ui-service.js';
app.use('/ui', uiService);
import userService from './services/user-service.js';
app.use('/user', userService);
const port = process.env.SERVER_PORT || 5010;
// console.log(process.env);
const version = "0.0.1";

// API calls
app.route('/version')
  .get(function (req, res) {
    // console.log('version called');
    res.send({ version: version });
  });

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
  console.log(options);
  console.log(exitCode);
  // if (options.cleanup) console.log('clean');
  // if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) {
    userService.close();
    process.exit();
  }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
// process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

app.listen(port, () => console.log(`Listening on port ${port}`));
