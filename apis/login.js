const express = require('express');
const router = express.Router();
const connection = require('../config/database');
const path = require('path');


router.post('/login-user', (req, res) => {
    const { mobile } = req.body;

    const userCheckSql = 'SELECT * FROM registration WHERE mobile = ?';
    connection.query(userCheckSql, [mobile], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const insertLoginTimeSql = 'INSERT INTO login_times (mobile) VALUES (?)';
            connection.query(insertLoginTimeSql, [mobile], (err) => {
                if (err) throw err;
                
                // Set session details
                req.session.user = { mobile };
                
                res.redirect(`/chat?mobile=${encodeURIComponent(mobile)}`);
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