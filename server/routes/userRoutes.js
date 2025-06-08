// project1/server/routes/userRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware'); // NEW: Import admin auth middleware

// Export a function that accepts io as an argument
module.exports = (io) => { 
    const { 
        getUsers, 
        getAllProjectsAdmin, // NEW: Admin function
        getAllTasksAdmin,    // NEW: Admin function
        getAllUsersAdmin     // NEW: Admin function
    } = require('../controllers/userController')(io);

    const router = express.Router();

    // User Routes:
    // GET /api/users - Get all users (requires authentication, public for dropdowns)
    router.get('/', verifyToken, getUsers);

    // NEW ADMIN ROUTES (requires 'admin' role)
    // GET /api/users/admin/projects - Get all projects (admin view)
    router.get('/admin/projects', verifyToken, adminAuthMiddleware, getAllProjectsAdmin);

    // GET /api/users/admin/tasks - Get all tasks (admin view)
    router.get('/admin/tasks', verifyToken, adminAuthMiddleware, getAllTasksAdmin);

    // GET /api/users/admin/all-users - Get all users with roles (admin view)
    router.get('/admin/all-users', verifyToken, adminAuthMiddleware, getAllUsersAdmin);

    return router; 
};
