// project1/server/routes/taskRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware'); 
const { body, param, query } = require('express-validator'); // NEW: Import body, param, query for validation

module.exports = (io) => { 
    const {
        createTask,
        getTasks,
        getTaskById,
        updateTask,
        deleteTask,
        addTagToTask,
        removeTagFromTask
    } = require('../controllers/taskController')(io); 

    const router = express.Router();

    router.use(verifyToken); 

    // Task CRUD Endpoints with validation:
    router.get(
        '/',
        [
            query('project_id').optional().isInt().withMessage('Project ID must be an integer.'),
            query('search').optional().isString().trim().escape(),
            query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
            query('status').optional().isIn(['pending', 'in-progress', 'completed', 'blocked']).withMessage('Invalid status.'),
            query('assigned_to').optional().isInt().withMessage('Assigned To must be an integer (User ID).'),
            query('tags').optional().isString().withMessage('Tags must be a comma-separated string of IDs.'),
            query('due_date_start').optional().isISO8601().toDate().withMessage('Invalid start date format (YYYY-MM-DD).'),
            query('due_date_end').optional().isISO8601().toDate().withMessage('Invalid end date format (YYYY-MM-DD).'),
            query('order_by').optional().isIn(['created_at', 'due_date', 'priority', 'title', 'status']).withMessage('Invalid order by column.'),
            query('order_direction').optional().isIn(['ASC', 'DESC']).withMessage('Invalid order direction (ASC or DESC).')
        ],
        getTasks
    );
    
    router.get(
        '/:id', 
        [
            param('id').isInt().withMessage('Task ID must be an integer.')
        ],
        getTaskById
    );
    
    router.post(
        '/', 
        [
            body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 255 }).withMessage('Title too long.'),
            body('description').trim().optional({ nullable: true, checkFalsy: true }).isLength({ max: 1000 }).withMessage('Description too long.'),
            body('due_date').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('Invalid date format.'),
            body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
            body('status').optional().isIn(['pending', 'in-progress', 'completed', 'blocked']).withMessage('Invalid status.'),
            body('assigned_to').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Assigned To must be a user ID.'),
            body('project_id').isInt().withMessage('Project ID is required and must be an integer.'),
            body('parent_task_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Parent Task ID must be an integer.')
        ],
        createTask
    );
    
    router.put(
        '/:id', 
        [
            param('id').isInt().withMessage('Task ID must be an integer.'),
            body('title').trim().optional().notEmpty().withMessage('Title cannot be empty.').isLength({ max: 255 }).withMessage('Title too long.'),
            body('description').trim().optional({ nullable: true, checkFalsy: true }).isLength({ max: 1000 }).withMessage('Description too long.'),
            body('due_date').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('Invalid date format.'),
            body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
            body('status').optional().isIn(['pending', 'in-progress', 'completed', 'blocked']).withMessage('Invalid status.'),
            body('assigned_to').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Assigned To must be a user ID.'),
            body('project_id').optional().isInt().withMessage('Project ID must be an integer.'),
            body('parent_task_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Parent Task ID must be an integer.')
        ],
        updateTask
    );
    
    router.delete(
        '/:id', 
        [
            param('id').isInt().withMessage('Task ID must be an integer.')
        ],
        deleteTask
    );

    // Task-Tag Management Endpoints with validation:
    router.post(
        '/:taskId/tags/:tagId', 
        [
            param('taskId').isInt().withMessage('Task ID must be an integer.'),
            param('tagId').isInt().withMessage('Tag ID must be an integer.')
        ],
        addTagToTask
    );
    router.delete(
        '/:taskId/tags/:tagId', 
        [
            param('taskId').isInt().withMessage('Task ID must be an integer.'),
            param('tagId').isInt().withMessage('Tag ID must be an integer.')
        ],
        removeTagFromTask
    );

    return router; 
};
