const express = require('express');
const router = express.Router();
const connection = require('../config/database');
const path = require('path');


router.post('/logout', (req, res) => {
    const { mobile } = req.query;

    if (!mobile) {
        return res.status(400).send('Mobile number is required.');
    }

    const updateSql = 'UPDATE login_times SET logout_time = NOW() WHERE mobile = ?';

    connection.query(updateSql, [mobile], (err) => {
        if (err) {
            console.error('Error updating last online time:', err);
            return res.status(500).send('Error logging out.');
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Error logging out.');
            }

            res.status(200).send('Logged out successfully.');
        });
    });
});


module.exports = router;