// project1/server/routes/projectRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware
const { body } = require('express-validator'); // NEW: Import body for validation

// Export a function that accepts io as an argument
module.exports = (io) => { 
    const {
        createProject,
        getProjects,
        getProjectById,
        updateProject,
        deleteProject
    } = require('../controllers/projectController')(io); 

    const router = express.Router();

    // Project Routes:
    // All these routes will require authentication using verifyToken middleware

    // GET /api/projects - Get all projects
    router.get('/', verifyToken, getProjects);

    // GET /api/projects/:id - Get a single project by its ID
    router.get('/:id', verifyToken, getProjectById);

    // POST /api/projects - Create a new project with validation
    router.post(
        '/', 
        verifyToken, 
        [
            body('name')
                .trim()
                .notEmpty().withMessage('Project name is required.')
                .isLength({ min: 3, max: 100 }).withMessage('Project name must be between 3 and 100 characters.')
                .escape(), // Sanitize input
            body('description')
                .trim()
                .optional({ nullable: true, checkFalsy: true }) // Description is optional
                .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.')
                .escape() // Sanitize input
        ],
        createProject
    );

    // PUT /api/projects/:id - Update an existing project by its ID with validation
    router.put(
        '/:id', 
        verifyToken, 
        [
            body('name')
                .trim()
                .optional({ nullable: true, checkFalsy: true }) // Name is optional for partial updates
                .isLength({ min: 3, max: 100 }).withMessage('Project name must be between 3 and 100 characters.')
                .escape(),
            body('description')
                .trim()
                .optional({ nullable: true, checkFalsy: true })
                .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.')
                .escape()
        ],
        updateProject
    );

    // DELETE /api/projects/:id - Delete a project by its ID
    router.delete('/:id', verifyToken, deleteProject);

    return router; 
};
