// project1/server/routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController'); // Import controller functions

const router = express.Router();

// Define authentication routes:
// POST /api/auth/register - Handles new user registration
router.post('/register', registerUser);

// POST /api/auth/login - Handles user login
router.post('/login', loginUser);

module.exports = router;
