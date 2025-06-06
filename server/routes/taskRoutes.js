// project1/server/routes/taskRoutes.js
const express = require('express');
const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    addTagToTask, // New endpoint for managing task tags
    removeTagFromTask // New endpoint for managing task tags
} = require('../controllers/taskController');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware

const router = express.Router();

// All task routes will require authentication
router.use(verifyToken); // Apply middleware to all routes in this router

// Task CRUD Endpoints:

// GET /api/tasks - Get all tasks (with optional filters)
router.get('/', getTasks);

// GET /api/tasks/:id - Get a single task by its ID
router.get('/:id', getTaskById);

// POST /api/tasks - Create a new task
router.post('/', createTask);

// PUT /api/tasks/:id - Update an existing task by its ID
router.put('/:id', updateTask);

// DELETE /api/tasks/:id - Delete a task by its ID
router.delete('/:id', deleteTask);

// Task-Tag Management Endpoints:
// These could be part of updateTask, but explicit endpoints offer more granular control
// POST /api/tasks/:taskId/tags - Add a tag to a task
router.post('/:taskId/tags/:tagId', addTagToTask);

// DELETE /api/tasks/:taskId/tags - Remove a tag from a task
router.delete('/:taskId/tags/:tagId', removeTagFromTask);


module.exports = router;