// project1/server/routes/authRoutes.js
const express = require('express');
const { body, validationResult } = require('express-validator'); // NEW: Import body and validationResult

// Export a function that accepts io as an argument
module.exports = (io) => { 
    const { registerUser, loginUser } = require('../controllers/authController')(io); 

    const router = express.Router();

    // Define authentication routes:
    // POST /api/auth/register - Handles new user registration with validation
    router.post(
        '/register', 
        [
            // Validation chain for registration
            body('username')
                .trim()
                .notEmpty().withMessage('Username is required.')
                .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.'),
            body('email')
                .trim()
                .notEmpty().withMessage('Email is required.')
                .isEmail().withMessage('Please provide a valid email address.'),
            body('password')
                .notEmpty().withMessage('Password is required.')
                .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
        ],
        registerUser // Pass validation result to the controller
    );

    // POST /api/auth/login - Handles user login with validation
    router.post(
        '/login', 
        [
            // Validation chain for login
            body('email')
                .trim()
                .notEmpty().withMessage('Email is required.'),
            body('password')
                .notEmpty().withMessage('Password is required.')
        ],
        loginUser // Pass validation result to the controller
    );

    return router; 
};
