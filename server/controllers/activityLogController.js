// server/controllers/activityLogController.js
const db = require('../db');
const { logActivity } = require('../utils/activityLogger'); // Not directly used here, but good practice

module.exports = (io) => { // io is not directly used here but passed for consistency
    /**
     * Get all activity logs (Admin only).
     * Supports filtering by user, action type, entity type, and date range.
     */
    const getAllActivityLogs = async (req, res) => {
        const { user_id, action_type, entity_type, start_date, end_date } = req.query;

        let query = `
            SELECT al.id, al.user_id, u.username, al.action_type, al.entity_type, al.entity_id, al.details, al.timestamp
            FROM activity_log al
            JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (user_id) {
            query += ` AND al.user_id = $${paramIndex++}`;
            queryParams.push(parseInt(user_id));
        }
        if (action_type) {
            query += ` AND al.action_type = $${paramIndex++}`;
            queryParams.push(action_type);
        }
        if (entity_type) {
            query += ` AND al.entity_type = $${paramIndex++}`;
            queryParams.push(entity_type);
        }
        if (start_date) {
            query += ` AND al.timestamp >= $${paramIndex++}`;
            queryParams.push(start_date);
        }
        if (end_date) {
            query += ` AND al.timestamp <= $${paramIndex++}`;
            queryParams.push(end_date);
        }

        query += ` ORDER BY al.timestamp DESC`;

        try {
            const logs = await db.query(query, queryParams);
            res.status(200).json({ message: 'Activity logs retrieved successfully!', logs: logs.rows });
        } catch (error) {
            console.error('Error retrieving activity logs:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during activity log retrieval.' });
        }
    };

    return {
        getAllActivityLogs
    };
};
