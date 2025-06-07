// project1/server/routes/userRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware

// Export a function that accepts io as an argument
module.exports = (io) => { // This route file now accepts 'io'
    // Now, require userController.js and immediately call the exported function with 'io'
    const { getUsers } = require('../controllers/userController')(io);

    const router = express.Router();

    // User Routes:
    // GET /api/users - Get all users (requires authentication)
    router.get('/', verifyToken, getUsers);

    return router; // Return the configured router
};
