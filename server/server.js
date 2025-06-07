// project1/server/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path'); 
const db = require('./db'); 
const authRoutes = require('./routes/authRoutes'); 
const projectRoutes = require('./routes/projectRoutes'); 
const taskRoutes = require('./routes/taskRoutes'); 
const userRoutes = require('./routes/userRoutes'); // Import user routes

// Load environment variables from .env file in the project root
dotenv.config({ path: '../.env' }); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Serve Static Frontend Files ---
// Point to the 'client' directory as the static root
app.use(express.static(path.join(__dirname, '../client/public'))); // Serve from public folder
app.use('/src', express.static(path.join(__dirname, '../client/src'))); // Serve src folder for index.js and styles.css


// Serve the main index.html file for the root route (e.g., http://localhost:5000/)
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
app.use('/api/users', userRoutes(io)); // Mount user routes under the /api/users path


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

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
