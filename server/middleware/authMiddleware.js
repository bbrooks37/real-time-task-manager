// project1/server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// REMOVED: require('dotenv').config({ path: '../.env' }); // Not needed for Heroku env vars

const verifyToken = (req, res, next) => {
    // Get token from header, cookie, or body
    // For simplicity, we'll primarily use the 'Authorization' header (Bearer Token)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN"

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables for authMiddleware.');
        return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
    }

    if (!token) {
        // No token provided, user is not authenticated
        return res.status(401).json({ message: 'Authentication required: No token provided.' });
    }

    try {
        // Verify the token using the secret key from environment variables
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach the decoded user payload to the request object
        // This makes user information (like user_id, username) available in subsequent route handlers
        req.user = decoded; 
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        // Token is invalid (e.g., expired, malformed, incorrect signature)
        console.error('Token verification failed:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Authentication failed: Token expired.' });
        }
        return res.status(403).json({ message: 'Authentication failed: Invalid token.' });
    }
};

module.exports = verifyToken;
