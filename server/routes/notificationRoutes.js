// server/routes/notificationRoutes.js
const express = require('express');
const verifyToken = require('../middleware/authMiddleware');
const { body } = require('express-validator');

module.exports = (io) => {
    const { getMyNotifications, markNotificationsAsRead } = require('../controllers/notificationController')(io);

    const router = express.Router();

    // GET /api/notifications - Get notifications for the authenticated user
    router.get(
        '/',
        verifyToken,
        getMyNotifications
    );

    // POST /api/notifications/mark-read - Mark notifications as read
    router.post(
        '/mark-read',
        verifyToken,
        [
            body('notificationIds')
                .isArray({ min: 1 }).withMessage('notificationIds must be an array with at least one ID.')
                .custom(value => value.every(id => typeof id === 'number' && Number.isInteger(id))).withMessage('All notification IDs must be integers.')
        ],
        markNotificationsAsRead
    );

    return router;
};
