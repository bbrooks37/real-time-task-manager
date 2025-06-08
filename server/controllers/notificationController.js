// server/controllers/notificationController.js
const db = require('../db');
const { logActivity } = require('../utils/activityLogger');

module.exports = (io) => {
    // Helper to emit notification to a specific user via Socket.IO
    // This assumes you have a way to map user_id to socket.id or a user-specific room
    const emitNotificationToUser = (userId, notificationData) => {
        // In a real app, you'd track active user sockets and send to specific socket IDs or rooms.
        // For simplicity here, we'll just emit a general event.
        // If you had user-specific rooms, it would be: io.to(`user-${userId}`).emit('newNotification', notificationData);
        io.emit('newNotification', notificationData); // Emitting to all for demo
        console.log(`Socket.IO: Emitted 'newNotification' for user ${userId}`);
    };

    /**
     * Create a new notification.
     * This is an internal function, not directly exposed via a route for client creation.
     */
    const createNotification = async (userId, type, message, entityId = null, entityType = null) => {
        try {
            const newNotification = await db.query(
                `INSERT INTO notifications (user_id, type, message, entity_id, entity_type)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [userId, type, message, entityId, entityType]
            );
            emitNotificationToUser(userId, newNotification.rows[0]);
            return newNotification.rows[0];
        } catch (error) {
            console.error('Error creating notification:', error.message, error.stack);
            // Don't throw error here, as notification creation shouldn't block main ops
            return null;
        }
    };

    /**
     * Get notifications for the authenticated user.
     */
    const getMyNotifications = async (req, res) => {
        const user_id = req.user.user_id;
        const { is_read, limit = 10, offset = 0 } = req.query; // Added pagination/filter

        let query = `
            SELECT id, user_id, type, message, entity_id, entity_type, is_read, created_at
            FROM notifications
            WHERE user_id = $1
        `;
        const queryParams = [user_id];
        let paramIndex = 2;

        if (is_read !== undefined) {
            query += ` AND is_read = $${paramIndex++}`;
            queryParams.push(is_read === 'true'); // Convert string 'true'/'false' to boolean
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        queryParams.push(parseInt(limit), parseInt(offset));

        try {
            const notifications = await db.query(query, queryParams);
            res.status(200).json({ message: 'Notifications retrieved successfully!', notifications: notifications.rows });
        } catch (error) {
            console.error('Error retrieving notifications:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during notification retrieval.' });
        }
    };

    /**
     * Mark notifications as read.
     */
    const markNotificationsAsRead = async (req, res) => {
        const user_id = req.user.user_id;
        const { notificationIds } = req.body; // Array of notification IDs to mark as read

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            return res.status(400).json({ message: 'No notification IDs provided.' });
        }

        try {
            // Ensure user can only mark their own notifications as read
            const result = await db.query(
                `UPDATE notifications SET is_read = TRUE, created_at = NOW() -- Using created_at for update time for simplicity
                 WHERE user_id = $1 AND id = ANY($2::int[]) RETURNING id`,
                [user_id, notificationIds]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'No matching notifications found or updated.' });
            }
            await logActivity(user_id, 'MARKED_NOTIFICATIONS_READ', 'NOTIFICATION', null, { notification_ids: result.rows.map(row => row.id) });
            res.status(200).json({ message: 'Notifications marked as read successfully!', updatedIds: result.rows.map(row => row.id) });
        } catch (error) {
            console.error('Error marking notifications as read:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error marking notifications as read.' });
        }
    };

    return {
        createNotification, // Exported for use by other controllers
        getMyNotifications,
        markNotificationsAsRead
    };
};
