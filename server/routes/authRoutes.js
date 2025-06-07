// project1/server/routes/authRoutes.js
const express = require('express');

// Export a function that accepts io as an argument
module.exports = (io) => { // <--- THIS LINE IS CRUCIAL: authRoutes now accepts 'io'
    // Now, require authController.js and immediately call the exported function with 'io'
    const { registerUser, loginUser } = require('../controllers/authController')(io); 

    const router = express.Router();

    // Define authentication routes:
    // POST /api/auth/register - Handles new user registration
    router.post('/register', registerUser);

    // POST /api/auth/login - Handles user login
    router.post('/login', loginUser);

    return router; // Return the configured router
};
