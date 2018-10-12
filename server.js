const express = require('express');
const path = require('path');
require('dotenv').config({ silent: true });

const app = express();
const worldController = require('./world/worldController.js');
app.use('/world', worldController);
const mindController = require('./mind/mindController.js');
app.use('/mind', mindController);
const uiController = require('./ui/uiController.js');
app.use('/ui', uiController);
const userController = require('./user/userController.js');
app.use('/user', userController);
const port = process.env.SERVER_PORT || 5000;
// console.log(process.env);
const version = "0.0.1";
// API calls

app.get('/hello', (req, res) => {
    console.log('hello called');
    res.send({ express: 'Hello Matt!  You\'re freaking awesome!' });
});
app.route('/version')
    .get(function (req, res) {
        console.log('version called');
        res.send({ version: version });
    })
    // .post(function (req, res) {
    //     res.send({ message: 'Add a book' })
    // })
    // .put(function (req, res) {
    //     res.send({ message: 'Update the book' })
    // });
if (process.env.NODE_ENV === 'production') {
    // Serve any static files
    app.use(express.static(path.join(__dirname, 'client/build')));
    // Handle React routing, return all requests to React app
    app.get('*', function (req, res) {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}
app.listen(port, () => console.log(`Listening on port ${port}`));
