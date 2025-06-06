// project1/server/routes/projectRoutes.js
const express = require('express');
const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
} = require('../controllers/projectController');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware

const router = express.Router();

// Project Routes:
// All these routes will require authentication using verifyToken middleware

// GET /api/projects - Get all projects (could be filtered by user, or public/private)
router.get('/', verifyToken, getProjects);

// GET /api/projects/:id - Get a single project by its ID
router.get('/:id', verifyToken, getProjectById);

// POST /api/projects - Create a new project
router.post('/', verifyToken, createProject);

// PUT /api/projects/:id - Update an existing project by its ID
router.put('/:id', verifyToken, updateProject);

// DELETE /api/projects/:id - Delete a project by its ID
router.delete('/:id', verifyToken, deleteProject);

module.exports = router;
