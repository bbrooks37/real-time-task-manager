// server/routes/activityLogRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware'); // NEW: Import admin auth middleware
const { query } = require('express-validator');

module.exports = (io) => {
    const { getAllActivityLogs } = require('../controllers/activityLogController')(io);

    const router = express.Router();

    // GET /api/activity-logs - Get all activity logs (Admin only)
    router.get(
        '/',
        verifyToken,        // First, verify token
        adminAuthMiddleware, // Then, check if user is admin
        [
            query('user_id').optional().isInt().withMessage('User ID must be an integer.'),
            query('action_type').optional().isString().trim().escape(),
            query('entity_type').optional().isString().trim().escape(),
            query('start_date').optional().isISO8601().toDate().withMessage('Invalid start date format (YYYY-MM-DD).'),
            query('end_date').optional().isISO8601().toDate().withMessage('Invalid end date format (YYYY-MM-DD).')
        ],
        getAllActivityLogs
    );

    return router;
};
