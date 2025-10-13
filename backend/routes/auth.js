const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

// Login endpoint
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Find user in SQLite database
        const db = req.app.locals.db?.db;
        if (!db) {
            return res.status(500).json({ 
                error: 'Database not available',
                message: 'Please try again later'
            });
        }

        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({ 
                error: 'Authentication failed',
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                error: 'Authentication failed',
                message: 'Invalid credentials'
            });
        }

        // Update last login
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

            // Generate JWT token
        const token = jwt.sign(
          { userId: user.id, role: user.role, name: user.name },
          process.env.JWT_SECRET || 'change-this-in-production',
          { expiresIn: '24h' }
        );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      // Try to verify JWT token first
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-in-production');
      
      // Find user in SQLite database
      const db = req.app.locals.db?.db;
      if (db) {
        const user = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (user) {
          return res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              name: user.name,
              role: user.role
            }
          });
        }
      }
    } catch (jwtError) {
      // JWT verification failed - no demo fallback in production
      console.error('JWT verification failed:', jwtError.message);
    }

    res.status(401).json({ error: 'Invalid token' });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Production authentication endpoint - no demo mode
router.post('/demo-login', (req, res) => {
    res.status(404).json({
        error: 'Demo login disabled',
        message: 'Please use the main login endpoint'
    });
});

// Change password endpoint
router.post('/change-password', [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Password confirmation does not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-in-production');
            
            // Find user in SQLite database
            const db = req.app.locals.db?.db;
            if (!db) {
                return res.status(500).json({ error: 'Database not available' });
            }

            const user = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    error: 'Invalid current password' 
                });
            }

            // Update password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                    [hashedPassword, user.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({ 
                success: true, 
                message: 'Password updated successfully' 
            });
        } catch (jwtError) {
            // No demo token handling in production
            throw jwtError;
        }
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
