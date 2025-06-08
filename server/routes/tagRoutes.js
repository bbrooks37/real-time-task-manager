// project1/server/routes/tagRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware
const { body, param } = require('express-validator'); // NEW: Import body, param for validation

// Export a function that accepts io as an argument
module.exports = (io) => {
    // Require tagController.js and immediately call the exported function with 'io'
    const {
        createTag,
        getTags,
        getTagById,
        updateTag,
        deleteTag
    } = require('../controllers/tagController')(io); // Pass io to controller

    const router = express.Router();

    // Apply verifyToken middleware to all routes in this router
    router.use(verifyToken);

    // Tag CRUD Endpoints with validation:
    router.post(
        '/', 
        [
            body('name')
                .trim()
                .notEmpty().withMessage('Tag name is required.')
                .isLength({ min: 1, max: 50 }).withMessage('Tag name must be between 1 and 50 characters.')
                .escape() // Sanitize input
        ],
        createTag
    );

    router.get('/', getTags);

    router.get(
        '/:id', 
        [
            param('id').isInt().withMessage('Tag ID must be an integer.')
        ],
        getTagById
    );

    router.put(
        '/:id', 
        [
            param('id').isInt().withMessage('Tag ID must be an integer.'),
            body('name')
                .trim()
                .notEmpty().withMessage('Tag name is required.')
                .isLength({ min: 1, max: 50 }).withMessage('Tag name must be between 1 and 50 characters.')
                .escape()
        ],
        updateTag
    );

    router.delete(
        '/:id', 
        [
            param('id').isInt().withMessage('Tag ID must be an integer.')
        ],
        deleteTag
    );

    return router; 
};
