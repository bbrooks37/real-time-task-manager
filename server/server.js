// project1/server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path'); // Import path module for serving static files
const db = require('./db'); // Import the database connection pool
const authRoutes = require('./routes/authRoutes'); // Import authentication routes
const projectRoutes = require('./routes/projectRoutes'); // Import project routes
const taskRoutes = require('./routes/taskRoutes'); // Import task routes
const userRoutes = require('./routes/userRoutes'); // NEW: Import user routes for /api/users

// Load environment variables from .env file in the project root
dotenv.config({ path: '../.env' }); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for development. For production, specify your frontend URL.
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Middleware
// 1. JSON body parser: Parses incoming JSON requests and puts the parsed data in req.body
app.use(express.json());
// 2. URL-encoded body parser: Parses incoming URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// --- Serve Static Frontend Files ---
// This middleware serves files from the 'client' directory.
// For example, a request to /client/public/index.html will look for client/public/index.html on the file system.
// This matches the absolute paths used in index.html (e.g., /client/src/styles.css)
app.use(express.static(path.join(__dirname, '../client')));

// Serve the main index.html file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});


// Test Database Connection
// This will attempt to connect to the database when the server starts
db.query('SELECT NOW() AS current_time')
    .then(res => {
        console.log('Database connection successful at:', res.rows[0].current_time);
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
        // It's crucial to exit or handle this gracefully in a real application
        process.exit(1); // Exit if database connection fails at startup
    });

// API Routes
// Mount authentication routes under the /api/auth path
app.use('/api/auth', authRoutes(io)); // Pass io to the route setup function
// Mount project routes under the /api/projects path
app.use('/api/projects', projectRoutes(io)); // Pass io to the route setup function
// Mount task routes under the /api/tasks path
app.use('/api/tasks', taskRoutes(io)); // Pass io to the route setup function
app.use('/api/users', userRoutes(io)); // NEW LINE: Mount user routes under the /api/users path


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

    // Example: Listen for a 'test' event
    socket.on('test_event', (data) => {
        console.log(`Received test_event from ${socket.id}:`, data);
        socket.emit('test_response', { message: 'Hello from server!' });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Socket.IO: User disconnected from ID: ${socket.id}`);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access frontend at: http://localhost:${PORT}/`); 
    console.log(`Access backend API at: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        db.end(); // Close database connection pool
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Application specific logging, throwing an error, or other logic here
    process.exit(1); // Exit process
});
