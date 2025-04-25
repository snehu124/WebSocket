const express = require('express');
const bcrypt = require('bcrypt'); 
const router = express.Router();
const connection = require('../config/database');

router.post('/register-user', async (req, res) => {
  const { firstName, lastName, email, password, mobile } = req.body;

  try {
    connection.query('SELECT * FROM registration WHERE mobile = ?', [mobile], async (err, results) => {
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

      const hashedPassword = await bcrypt.hash(password, 10);

      const query = 'INSERT INTO registration (first_name, last_name, email, password, mobile, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
      connection.query(query, [firstName, lastName, email, hashedPassword, mobile], (err, result) => {
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
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
    });
  }
});

module.exports = router;