// project1/server/routes/taskRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware

// Export a function that accepts io as an argument
module.exports = (io) => { // <--- THIS LINE IS CRUCIAL: taskRoutes now accepts 'io'
    // Now, require taskController.js and immediately call the exported function with 'io'
    const {
        createTask,
        getTasks,
        getTaskById,
        updateTask,
        deleteTask,
        addTagToTask,
        removeTagFromTask
    } = require('../controllers/taskController')(io); // Pass io to controller

    const router = express.Router();

    // All task routes will require authentication
    router.use(verifyToken); // Apply middleware to all routes in this router

    // Task CRUD Endpoints:
    router.get('/', getTasks);
    router.get('/:id', getTaskById);
    router.post('/', createTask);
    router.put('/:id', updateTask);
    router.delete('/:id', deleteTask);

    // Task-Tag Management Endpoints:
    router.post('/:taskId/tags/:tagId', addTagToTask);
    router.delete('/:taskId/tags/:tagId', removeTagFromTask);

    return router; // Return the configured router
};
