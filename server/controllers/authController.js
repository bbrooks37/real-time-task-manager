// project1/server/controllers/authController.js
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens
const db = require('../db'); // Import the database connection pool

// Load environment variables for JWT_SECRET and salt rounds for bcrypt
require('dotenv').config({ path: '../../.env' }); 

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_SALT_ROUNDS = 10;

// Export a function that receives io (though auth generally doesn't emit data changes)
module.exports = (io) => { // <--- ENSURE THIS LINE IS PRESENT
    // --- User Registration Controller ---
    const registerUser = async (req, res) => {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields (username, email, password) are required.' });
        }

        try {
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
                { user_id: newUser.rows[0].id, username: newUser.rows[0].username },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Optional: Emit 'userRegistered' event if other parts of the app need to know about new users
            // io.emit('userRegistered', { user: newUser.rows[0], registrationIp: req.ip });


            res.status(201).json({
                message: 'User registered successfully!',
                user: {
                    id: newUser.rows[0].id,
                    username: newUser.rows[0].username,
                    email: newUser.rows[0].email,
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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        try {
            const userResult = await db.query('SELECT id, username, email, password_hash FROM users WHERE email = $1', [email]);
            const user = userResult.rows[0];

            if (!user) {
                return res.status(404).json({ message: 'User not found or invalid credentials.' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const token = jwt.sign(
                { user_id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Optional: Emit 'userLoggedIn' event
            // io.emit('userLoggedIn', { userId: user.id, username: user.username });

            res.status(200).json({
                message: 'Logged in successfully!',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                },
                token,
            });

        } catch (error) {
            console.error('Error logging in user:', error.message);
            res.status(500).json({ message: 'Internal server error during login.' });
        }
    };

    return { // <--- ENSURE THIS RETURN STATEMENT IS PRESENT
        registerUser,
        loginUser,
    };
};
