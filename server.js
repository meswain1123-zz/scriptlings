const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const port = process.env.SERVER_PORT || 5000;
console.log(process.env);
const version = "0.0.1";
// API calls
app.get('/api/hello', (req, res) => {
    console.log('hello called');
    res.send({ express: 'Hello Matt!  You\'re freaking awesome!' });
});
app.get('/api/version', (req, res) => {
    console.log('version called');
    res.send({ version: version });
});
if (process.env.NODE_ENV === 'production') {
    // Serve any static files
    app.use(express.static(path.join(__dirname, 'client/build')));
    // Handle React routing, return all requests to React app
    app.get('*', function (req, res) {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}
app.listen(port, () => console.log(`Listening on port ${port}`));
