const session = require('express-session');

const sessionMiddleware = session({
    secret: 'KeySecreate',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});

module.exports = sessionMiddleware;
