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
const io = socketIO(server, {
    maxHttpBufferSize: 1e8 // Set to 100 MB
});


// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(sessionMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/style', express.static(path.join(__dirname, 'style')));
app.use('/socketImages', express.static(path.join(__dirname, 'socketImages')));
app.use('/bootstrap-3.3.7', express.static(path.join(__dirname, 'bootstrap-3.3.7')));
app.use('/view', express.static(path.join(__dirname, 'view')));


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
