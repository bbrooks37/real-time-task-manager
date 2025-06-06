// project1/server/controllers/authController.js
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens
const db = require('../db'); // Import the database connection pool

// Load environment variables for JWT_SECRET and salt rounds for bcrypt
require('dotenv').config({ path: '.../.env' }); // Adjust path as per your .env location

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = 10; // A good default for bcrypt salt rounds

// --- User Registration Controller ---
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields (username, email, password) are required.' });
    }

    try {
        // Check if user already exists
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ message: 'User with that email or username already exists.' });
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Insert new user into the database
        const newUser = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, hashedPassword]
        );

        // Generate a JWT for the newly registered user
        const token = jwt.sign(
            { user_id: newUser.rows[0].id, username: newUser.rows[0].username },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // Send success response with user info and token
        res.status(201).json({
            message: 'User registered successfully!',
            user: {
                id: newUser.rows[0].id,
                username: newUser.rows[0].username,
                email: newUser.rows[0].email,
            },
            token, // Send the JWT back to the client
        });

    } catch (error) {
        console.error('Error registering user:', error.message);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
};

// --- User Login Controller ---
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Retrieve user from database by email
        const userResult = await db.query('SELECT id, username, email, password_hash FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found or invalid credentials.' });
        }

        // Compare provided password with hashed password in database
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Generate a JWT for the logged-in user
        const token = jwt.sign(
            { user_id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // Send success response with user info and token
        res.status(200).json({
            message: 'Logged in successfully!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
            token, // Send the JWT back to the client
        });

    } catch (error) {
        console.error('Error logging in user:', error.message);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
};
