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

router.post('/generate-otp', (req, res) => {
    const { identifier } = req.body;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const query = isEmail
        ? 'SELECT * FROM registration WHERE email = ?'
        : 'SELECT * FROM registration WHERE mobile = ?';

    connection.query(query, [identifier], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        const insertOtpSql = 'INSERT INTO otps (identifier, otp, expires_at) VALUES (?, ?, ?)';
        connection.query(insertOtpSql, [identifier, otp, expiresAt], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }

            console.log(`OTP for ${identifier}: ${otp}`);

            res.json({ message: 'OTP generated and sent.' });
        });
    });
});

router.post('/reset-password', async (req, res) => {
    const { identifier, otp, newPassword } = req.body;

    const verifyOtpSql = 'SELECT * FROM otps WHERE identifier = ? AND otp = ? AND expires_at > NOW()';
    connection.query(verifyOtpSql, [identifier, otp], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        const updatePasswordSql = isEmail
            ? 'UPDATE registration SET password = ? WHERE email = ?'
            : 'UPDATE registration SET password = ? WHERE mobile = ?';

        connection.query(updatePasswordSql, [hashedPassword, identifier], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }

            const deleteOtpSql = 'DELETE FROM otps WHERE identifier = ?';
            connection.query(deleteOtpSql, [identifier], (err) => {
                if (err) {
                    console.error(err);
                }
                res.json({ message: 'Password reset successfully.' });
            });
        });
    });
});

router.post('/change-password', async (req, res) => {
    const { mobile, oldPassword, newPassword } = req.body;

    const query = 'SELECT * FROM registration WHERE mobile = ?';
    connection.query(query, [mobile], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Incorrect old password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updatePasswordSql = 'UPDATE registration SET password = ? WHERE mobile = ?';
        connection.query(updatePasswordSql, [hashedPassword, mobile], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ message: 'Password changed successfully.' });
        });
    });
});

module.exports = router;