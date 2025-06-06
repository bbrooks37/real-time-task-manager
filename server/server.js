// project1/server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const db = require('./db'); // Import the database connection pool

// Import route modules as functions that accept 'io'
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Database Connection
db.query('SELECT NOW() AS current_time')
    .then(res => {
        console.log('Database connection successful at:', res.rows[0].current_time);
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    });

// API Routes
// Pass the 'io' instance to the route setup functions
app.use('/api/auth', authRoutes(io)); // Auth routes might not need io immediately, but it's consistent
app.use('/api/projects', projectRoutes(io));
app.use('/api/tasks', taskRoutes(io));


// Basic route for root URL - useful for checking if server is running
app.get('/', (req, res) => {
    res.status(200).send('Task Management System Backend is running!');
});

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
    console.log(`Access backend at: http://localhost:${PORT}`);
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
