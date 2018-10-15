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
// app.get('/', function (req, res, next) {
//     if (req.session.views) {
//         req.session.views++
//         res.setHeader('Content-Type', 'text/html')
//         res.write('<p>views: ' + req.session.views + '</p>')
//         res.write('<p>expires in: ' + (req.session.cookie.maxAge / 1000) + 's</p>')
//         res.end()
//     } else {
//         req.session.views = 1
//         res.end('welcome to the session demo. refresh!')
//     }
// });
// app.use(express.json());       // to support JSON-encoded bodies
// app.use(express.urlencoded()); // to support URL-encoded bodies

// const worldController = require('./world/controller.js');
// app.use('/world', worldController);
// const mindController = require('./mind/controller.js');
// app.use('/mind', mindController);
// const uiController = require('./ui/controller.js');
// app.use('/ui', uiController);
import userController from './user/controller.js';
app.use('/user', userController);
const port = process.env.SERVER_PORT || 5000;
// console.log(process.env);
const version = "0.0.1";

// API calls
app.get('/hello', (req, res) => {
    // console.log('hello called');
    res.send({ express: 'Hello Matt!  You\'re freaking awesome!' });
});
app.route('/version')
    .get(function (req, res) {
        // console.log('version called');
        res.send({ version: version });
    });
// .post(function (req, res) {
//     res.send({ message: 'Add a book' })
// })
// .put(function (req, res) {
//     res.send({ message: 'Update the book' })
// });
// if (process.env.NODE_ENV === 'production') {
//     // Serve any static files
//     app.use(express.static(path.join(__dirname, 'client/build')));
//     // Handle React routing, return all requests to React app
//     app.get('*', function (req, res) {
//         res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
//     });
// }

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
    console.log(options);
    console.log(exitCode);
    // if (options.cleanup) console.log('clean');
    // if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) { 
        userController.close(); 
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
// process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

app.listen(port, () => console.log(`Listening on port ${port}`));
