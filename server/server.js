// project1/server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path'); 
const db = require('./db'); 
const cors = require('cors'); // Ensure cors is imported

// Import Routes
const authRoutes = require('./routes/authRoutes'); 
const projectRoutes = require('./routes/projectRoutes'); 
const taskRoutes = require('./routes/taskRoutes'); 
const userRoutes = require('./routes/userRoutes'); 
const tagRoutes = require('./routes/tagRoutes'); 
const notificationRoutes = require('./routes/notificationRoutes'); // NEW: Import notification routes
const activityLogRoutes = require('./routes/activityLogRoutes'); // NEW: Import activity log routes


// Load environment variables from .env file in the project root (for local development)
dotenv.config({ path: '../.env' }); 

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*", // Allow configured frontend URL or all origins for dev
        methods: ["GET", "POST", "PUT", "DELETE"], 
        credentials: true 
    }
});

const PORT = process.env.PORT || 5000;

// CORS Middleware for Express API routes
const corsOptions = {
    origin: process.env.FRONTEND_URL, 
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, 
    optionsSuccessStatus: 204 // For OPTIONS preflight requests
};

app.use(cors(corsOptions)); 

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Serve Static Frontend Files (primarily for local development) ---
// Point to the 'client/public' directory as the static root for index.html and other public assets
app.use(express.static(path.join(__dirname, '../client/public'))); 
// Serve the 'client/src' directory for bundled JS/CSS if needed directly (e.g., index.js, styles.css)
app.use('/src', express.static(path.join(__dirname, '../client/src'))); 

// Serve the main index.html file for the root route
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

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
app.use('/api/auth', authRoutes(io)); 
app.use('/api/projects', projectRoutes(io)); 
app.use('/api/tasks', taskRoutes(io)); 
app.use('/api/users', userRoutes(io)); 
app.use('/api/tags', tagRoutes(io)); 
app.use('/api/notifications', notificationRoutes(io)); // NEW: Use notification routes
app.use('/api/activity-logs', activityLogRoutes(io)); // NEW: Use activity log routes


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

    // You might want to track user-to-socket mapping here for targeted notifications
    // E.g., socket.on('authenticate', (token) => { /* verify token, map user_id to socket.id */ });

    socket.on('test_event', (data) => {
        console.log(`Received test_event from ${socket.id}:`, data);
        socket.emit('test_response', { message: 'Hello from server!' });
    });

    socket.on('disconnect', () => {
        console.log(`Socket.IO: User disconnected from ID: ${socket.id}`);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend URL (from env): ${process.env.FRONTEND_URL}`); 
    console.log(`Access frontend at: http://localhost:${PORT}/`); 
    console.log(`Access backend API at: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        db.end(); 
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1); 
});
