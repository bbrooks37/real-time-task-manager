// project1/server/controllers/userController.js
const db = require('../db'); // Import the database connection pool

// Export a function that receives io (though not directly used for user fetching)
module.exports = (io) => {
    // --- Get All Users (for assignment dropdowns, etc.) ---
    const getUsers = async (req, res) => {
        try {
            // Fetch all users, excluding sensitive data like password hashes
            const users = await db.query('SELECT id, username, email, role FROM users ORDER BY username ASC');

            res.status(200).json({
                message: 'Users retrieved successfully!',
                users: users.rows,
                count: users.rows.length,
            });

        } catch (error) {
            console.error('Error retrieving users:', error.message);
            res.status(500).json({ message: 'Internal server error during user retrieval.' });
        }
    };

    // --- Admin: Get All Projects (ignoring user_id) ---
    const getAllProjectsAdmin = async (req, res) => {
        try {
            const projects = await db.query(
                `SELECT p.id, p.name, p.description, p.created_at, p.updated_at, p.is_deleted,
                        u.username AS created_by_username, u.id AS created_by_user_id
                 FROM projects p
                 JOIN users u ON p.created_by = u.id
                 ORDER BY p.created_at DESC`
            );
            res.status(200).json({ message: 'All projects retrieved successfully (Admin View)!', projects: projects.rows });
        } catch (error) {
            console.error('Error retrieving all projects (Admin):', error.message);
            res.status(500).json({ message: 'Internal server error during admin project retrieval.' });
        }
    };

    // --- Admin: Get All Tasks (ignoring user_id) ---
    const getAllTasksAdmin = async (req, res) => {
        try {
            const tasks = await db.query(
                `SELECT 
                    t.id, t.title, t.description, t.due_date, t.priority, t.status, 
                    t.assigned_to, t.created_by, t.project_id, t.parent_task_id, t.created_at, t.updated_at, t.is_deleted,
                    p.name AS project_name, 
                    u_assigned.username AS assigned_to_username,
                    u_created.username AS created_by_username,
                    (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name)) 
                     FROM tags tg JOIN task_tags tt ON tg.id = tt.tag_id WHERE tt.task_id = t.id AND tg.is_deleted = FALSE) AS tags
                FROM tasks t
                JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
                JOIN users u_created ON t.created_by = u_created.id -- Assuming created_by is always present
                ORDER BY t.created_at DESC`
            );
            res.status(200).json({ message: 'All tasks retrieved successfully (Admin View)!', tasks: tasks.rows });
        } catch (error) {
            console.error('Error retrieving all tasks (Admin):', error.message);
            res.status(500).json({ message: 'Internal server error during admin task retrieval.' });
        }
    };

    // --- Admin: Get All Users (including role) ---
    const getAllUsersAdmin = async (req, res) => {
        try {
            const users = await db.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at ASC');
            res.status(200).json({ message: 'All users retrieved successfully (Admin View)!', users: users.rows });
        } catch (error) {
            console.error('Error retrieving all users (Admin):', error.message);
            res.status(500).json({ message: 'Internal server error during admin user retrieval.' });
        }
    };


    return {
        getUsers,
        getAllProjectsAdmin, // Export for admin routes
        getAllTasksAdmin,    // Export for admin routes
        getAllUsersAdmin     // Export for admin routes
    };
};
