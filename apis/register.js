// register.js
const express = require('express');
const router = express.Router();
const connection = require('../config/database');

router.post('/register-user', (req, res) => {
  const { username, mobile } = req.body;

  if (!username || !mobile) {
    return res.status(400).json({
      success: false,
      message: 'Both username and mobile are required',
    });
  }

  connection.query('SELECT * FROM registration WHERE mobile = ?', [mobile], (err, results) => {
    if (err) {
      console.error('Database query error:', err); 
      return res.status(500).json({
        success: false,
        message: 'Database query error',
      });
    }

    if (results.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered.',
      });
    }

   
    const query = 'INSERT INTO registration (username, mobile, created_at) VALUES (?, ?, NOW())';
    connection.query(query, [username, mobile], (err, result) => {
      if (err) {
        console.error('Failed to insert user:', err); 
        return res.status(500).json({
          success: false,
          message: 'Failed to register user',
        });
      }

      res.json({
        success: true,
        message: 'User registered successfully',
      });
    });
  });
});

module.exports = router;
