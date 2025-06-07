// project1/server/routes/tagRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); // Import authentication middleware

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

    // Tag CRUD Endpoints:
    // POST /api/tags - Create a new tag
    router.post('/', createTag);

    // GET /api/tags - Get all tags
    router.get('/', getTags);

    // GET /api/tags/:id - Get a single tag by its ID
    router.get('/:id', getTagById);

    // PUT /api/tags/:id - Update an existing tag by its ID
    router.put('/:id', updateTag);

    // DELETE /api/tags/:id - Delete a tag by its ID
    router.delete('/:id', deleteTag);

    return router; // Return the configured router
};
