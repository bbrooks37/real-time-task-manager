// project1/server/controllers/authController.js
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens
const db = require('../db'); // Import the database connection pool
const { validationResult } = require('express-validator'); // Import validationResult
const { logActivity } = require('../utils/activityLogger'); // FIX: Reverted path to '../utils'

const JWT_SECRET = process.env.JWT_SECRET; 
const BCRYPT_SALT_ROUNDS = 10;

module.exports = (io) => { 
    // --- User Registration Controller ---
    const registerUser = async (req, res) => {
        // Check for validation errors from express-validator
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { username, email, password } = req.body;

        try {
            // Check if JWT_SECRET is available
            if (!JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables.');
                return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
            }

            const userCheck = await db.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
            if (userCheck.rows.length > 0) {
                return res.status(409).json({ message: 'User with that email or username already exists.' });
            }

            const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

            const newUser = await db.query(
                'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
                [username, email, hashedPassword]
            );

            const token = jwt.sign(
                { user_id: newUser.rows[0].id, username: newUser.rows[0].username, role: 'member' }, // NEW: Add default role 'member' to token
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            await logActivity(newUser.rows[0].id, 'REGISTERED', 'USER', newUser.rows[0].id, { username: newUser.rows[0].username }); // Log registration

            res.status(201).json({
                message: 'User registered successfully!',
                user: {
                    id: newUser.rows[0].id,
                    username: newUser.rows[0].username,
                    email: newUser.rows[0].email,
                    role: 'member' // NEW: Include role in response
                },
                token,
            });

        } catch (error) {
            console.error('Error registering user:', error.message);
            res.status(500).json({ message: 'Internal server error during registration.' });
        }
    };

    // --- User Login Controller ---
    const loginUser = async (req, res) => {
        // Check for validation errors from express-validator
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            // Check if JWT_SECRET is available
            if (!JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables.');
                return res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
            }

            // NEW: Fetch user role from DB
            const userResult = await db.query('SELECT id, username, email, password_hash, role FROM users WHERE email = $1', [email]);
            const user = userResult.rows[0];

            if (!user) {
                return res.status(404).json({ message: 'User not found or invalid credentials.' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const token = jwt.sign(
                { user_id: user.id, username: user.username, role: user.role }, // NEW: Include user's role in token
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            await logActivity(user.id, 'LOGGED_IN', 'USER', user.id); // Log login

            res.status(200).json({
                message: 'Logged in successfully!',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role, // NEW: Include role in response
                },
                token,
            });

        } catch (error) {
            console.error('Error logging in user:', error.message);
            res.status(500).json({ message: 'Internal server error during login.' });
        }
    };

    return { 
        registerUser,
        loginUser,
    };
};
