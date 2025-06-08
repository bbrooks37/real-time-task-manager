// server/utils/activityLogger.js
const db = require('../db');

/**
 * Logs an activity into the activity_log table.
 * @param {number} userId - The ID of the user performing the action.
 * @param {string} actionType - The type of action (e.g., 'CREATED', 'UPDATED', 'DELETED', 'LOGIN').
 * @param {string} entityType - The type of entity involved (e.g., 'PROJECT', 'TASK', 'TAG', 'USER').
 * @param {number|null} entityId - The ID of the entity involved (null if not applicable, e.g., login).
 * @param {object} details - Additional JSON details about the action (e.g., changes, old values).
 */
async function logActivity(userId, actionType, entityType = null, entityId = null, details = {}) {
    try {
        await db.query(
            `INSERT INTO activity_log (user_id, action_type, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, actionType, entityType, entityId, details]
        );
        // console.log(`Activity logged: User ${userId} ${actionType} ${entityType || 'N/A'} ${entityId || 'N/A'}`);
    } catch (error) {
        console.error('Error logging activity:', error.message, error.stack);
        // Log this error, but do not prevent the main operation from completing.
    }
}

module.exports = {
    logActivity
};
