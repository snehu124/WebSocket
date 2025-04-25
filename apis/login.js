const express = require('express');
const bcrypt = require('bcrypt'); 
const router = express.Router();
const connection = require('../config/database');
const path = require('path');

router.post('/login-user', (req, res) => {
    const { identifier, password } = req.body;

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const query = isEmail
        ? 'SELECT * FROM registration WHERE email = ?'
        : 'SELECT * FROM registration WHERE mobile = ?';

    connection.query(query, [identifier], async (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.redirect('/login.html?error=invalid');
            }

            const insertLoginTimeSql = 'INSERT INTO login_times (mobile) VALUES (?)';
            connection.query(insertLoginTimeSql, [user.mobile], (err) => {
                if (err) throw err;

                req.session.user = { mobile: user.mobile };

                res.redirect(`/chat?mobile=${encodeURIComponent(user.mobile)}`);
            });
        } else {
            res.redirect('/login.html?error=invalid');
        }
    });
});

router.get('/chat', (req, res) => {
    const userMobile = req.query.mobile;

    if (!userMobile) {
        return res.status(400).send('Mobile number is required.');
    }

    res.sendFile(path.join(__dirname, '../apis/chat.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../view/login.html'));
});

module.exports = router;