// Role-based authentication middleware
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid authentication token'
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-in-production');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }
};

const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has manager or owner role
  const allowedRoles = ['manager', 'owner'];
  if (allowedRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ 
      error: 'Insufficient permissions',
      message: 'Manager or Owner role required'
    });
  }
};

const requireOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has owner role
  if (req.user.role === 'owner') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Insufficient permissions',
      message: 'Owner role required'
    });
  }
};

const requireAuth = (req, res, next) => {
  // Basic authentication check
  if (req.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

module.exports = {
  authenticateToken,
  requireManager,
  requireOwner,
  requireAuth
};