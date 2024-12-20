const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const socketHandlers = require('./apis/socketHandlers');
const sessionMiddleware = require('../chat-app/middleware/index');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);


// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(sessionMiddleware);



app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/socketImages', express.static(path.join(__dirname, 'socketImages')));


// Serve HTML files from the 'view' folder
app.use(express.static(path.join(__dirname, 'view')));


// API Routes
const register = require('./apis/register'); 
const login = require('./apis/login');
const logout = require('./apis/logout');

app.use('/register', register);
app.use('/login', login);
app.use('/', logout);


function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        res.redirect('/login.html');
    }
}

// Serve the chat.html file
app.get('/chat', isAuthenticated, (req, res) => {
    const userMobile = req.query.mobile;
    if (!userMobile) {
        return res.status(400).send('Mobile number is required.');
    }
    res.sendFile(path.join(__dirname, 'view/chat.html'));
});


app.get('/check-auth', (req, res) => {
    if (req.session && req.session.user) {
        res.status(200).send('Authenticated');
    } else {
        res.status(401).send('Unauthorized');
    }
});


socketHandlers(io);


const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
