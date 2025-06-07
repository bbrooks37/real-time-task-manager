// project1/server/controllers/taskController.js
const db = require('../db'); // Import the database connection pool

// Load environment variables for JWT_SECRET and salt rounds for bcrypt
// Adjust path as per your .env location (assuming it's in the project root)
require('dotenv').config({ path: '../../.env' }); 

// Export a function that receives io
module.exports = (io) => { // <--- THIS LINE IS CRUCIAL FOR RECEIVING 'io'
    // --- Create a New Task ---
    const createTask = async (req, res) => {
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const created_by = req.user.user_id; // From authenticated user

        // Basic validation
        if (!title || !project_id) {
            return res.status(400).json({ message: 'Task title and project_id are required.' });
        }

        try {
            const newTaskResult = await db.query(
                `INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, project_id, parent_task_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, created_at, updated_at`,
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id]
            );
            const newTask = newTaskResult.rows[0];

            // Emit a Socket.IO event after successful creation
            io.emit('taskCreated', { task: newTask, creatorId: created_by }); 
            console.log(`Socket.IO: Emitted 'taskCreated' for task ID: ${newTask.id}`);

            res.status(201).json({
                message: 'Task created successfully!',
                task: newTask,
            });

        } catch (error) {
            console.error('Error creating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task creation.' });
        }
    };

    // --- Get All Tasks --- (No change in logic, as this is a read operation)
    const getTasks = async (req, res) => {
        const user_id = req.user.user_id; // Authenticated user
        const { project_id, assigned_to, status, priority, search } = req.query; // Filters from query params

        let query = `
            SELECT
                t.id, t.title, t.description, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
                p.id AS project_id, p.name AS project_name,
                u_assigned.username AS assigned_to_username,
                u_creator.username AS created_by_username,
                (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name))
                 FROM tags tg
                 JOIN task_tags tt ON tg.id = tt.tag_id
                 WHERE tt.task_id = t.id) AS tags
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
            LEFT JOIN users u_creator ON p.created_by = u_creator.id -- Assuming projects are created by users
            WHERE p.created_by = $1 OR t.assigned_to = $1 -- User can see tasks in their projects or assigned to them
        `;
        const queryParams = [user_id];
        let paramIndex = 2; // Start index for additional parameters

        // Apply filters
        if (project_id) {
            query += ` AND t.project_id = $${paramIndex++}`;
            queryParams.push(project_id);
        }
        if (assigned_to) {
            query += ` AND t.assigned_to = $${paramIndex++}`;
            queryParams.push(assigned_to);
        }
        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            queryParams.push(status);
        }
        if (priority) {
            query += ` AND t.priority = $${paramIndex++}`;
            queryParams.push(priority);
        }
        if (search) {
            query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
        }

        query += ` ORDER BY t.due_date ASC, t.priority DESC`; // Order by due date, then priority

        try {
            const tasks = await db.query(query, queryParams);

            res.status(200).json({
                message: 'Tasks retrieved successfully!',
                tasks: tasks.rows,
                count: tasks.rows.length,
            });

        } catch (error) {
            console.error('Error retrieving tasks:', error.message);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Get Task by ID --- (No change in logic, as this is a read operation)
    const getTaskById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;

        try {
            const taskResult = await db.query(
                `SELECT
                    t.id, t.title, t.description, t.due_date, t.priority, t.status, t.created_at, t.updated_at,
                    p.id AS project_id, p.name AS project_name,
                    u_assigned.username AS assigned_to_username,
                    u_creator.username AS created_by_username,
                    (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name))
                     FROM tags tg
                     JOIN task_tags tt ON tg.id = tt.tag_id
                     WHERE tt.task_id = t.id) AS tags
                FROM tasks t
                JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
                LEFT JOIN users u_creator ON p.created_by = u_creator.id
                WHERE t.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)`, // Ensure user has access
                [id, user_id]
            );
            const task = taskResult.rows[0];

            if (!task) {
                return res.status(404).json({ message: 'Task not found or you do not have access.' });
            }

            res.status(200).json({
                message: 'Task retrieved successfully!',
                task,
            });

        } catch (error) {
            console.error('Error retrieving task by ID:', error.message);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Update an Existing Task ---
    const updateTask = async (req, res) => {
        const { id } = req.params;
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const user_id = req.user.user_id; // Authenticated user ID for permission check

        try {
            // First, check if the user has permission to update this task
            // A user can update a task if they created the project it belongs to OR they are assigned to the task.
            const permissionCheck = await db.query(
                `SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)`,
                [id, user_id]
            );

            if (permissionCheck.rows.length === 0) {
                return res.status(403).json({ message: 'You do not have permission to update this task.' });
            }

            const updatedTaskResult = await db.query(
                `UPDATE tasks
                 SET title = COALESCE($1, title),
                     description = COALESCE($2, description),
                     due_date = COALESCE($3, due_date),
                     priority = COALESCE($4, priority),
                     status = COALESCE($5, status),
                     assigned_to = COALESCE($6, assigned_to),
                     project_id = COALESCE($7, project_id),
                     parent_task_id = COALESCE($8, parent_task_id),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9
                 RETURNING id, title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, created_at, updated_at`,
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, id]
            );
            const updatedTask = updatedTaskResult.rows[0];

            if (updatedTaskResult.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' }); // Should theoretically not happen if permissionCheck passed
            }

            // Emit a Socket.IO event after successful update
            io.emit('taskUpdated', { task: updatedTask, updaterId: user_id });
            console.log(`Socket.IO: Emitted 'taskUpdated' for task ID: ${updatedTask.id}`);


            res.status(200).json({
                message: 'Task updated successfully!',
                task: updatedTask,
            });

        } catch (error) {
            console.error('Error updating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task update.' });
        }
    };

    // --- Delete a Task ---
    const deleteTask = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;

        try {
            const permissionCheck = await db.query(
                `SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1 AND p.created_by = $2`,
                [id, user_id]
            );

            if (permissionCheck.rows.length === 0) {
                return res.status(403).json({ message: 'You do not have permission to delete this task.' });
            }

            const deletedTaskResult = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
            const deletedTask = deletedTaskResult.rows[0];

            if (deletedTaskResult.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            // Emit a Socket.IO event after successful deletion
            io.emit('taskDeleted', { taskId: deletedTask.id, deleterId: user_id });
            console.log(`Socket.IO: Emitted 'taskDeleted' for task ID: ${deletedTask.id}`);


            res.status(200).json({ message: 'Task deleted successfully!' });

        } catch (error) {
            console.error('Error deleting task:', error.message);
            res.status(500).json({ message: 'Internal server error during task deletion.' });
        }
    };

    // --- Add a Tag to a Task ---
    const addTagToTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            const taskPermissionCheck = await db.query(
                `SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)`,
                [taskId, user_id]
            );
            if (taskPermissionCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Task not found or you do not have permission to modify.' });
            }

            const tagCheck = await db.query('SELECT id FROM tags WHERE id = $1', [tagId]);
            if (tagCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found.' });
            }

            const existingTag = await db.query('SELECT * FROM task_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
            if (existingTag.rows.length > 0) {
                return res.status(409).json({ message: 'Tag already associated with this task.' });
            }

            await db.query('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);

            // Emit event for tag addition
            io.emit('taskTagAdded', { taskId: taskId, tagId: tagId, modifierId: user_id });
            console.log(`Socket.IO: Emitted 'taskTagAdded' for task ID: ${taskId}, tag ID: ${tagId}`);


            res.status(200).json({ message: 'Tag added to task successfully!' });

        } catch (error) {
            console.error('Error adding tag to task:', error.message);
            res.status(500).json({ message: 'Internal server error during tag addition.' });
        }
    };

    // --- Remove a Tag from a Task ---
    const removeTagFromTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            const taskPermissionCheck = await db.query(
                `SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)`,
                [taskId, user_id]
            );
            if (taskPermissionCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Task not found or you do not have permission to modify.' });
            }

            const deletedTag = await db.query('DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2 RETURNING *', [taskId, tagId]);

            if (deletedTag.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found for this task association.' });
            }

            // Emit event for tag removal
            io.emit('taskTagRemoved', { taskId: taskId, tagId: tagId, modifierId: user_id });
            console.log(`Socket.IO: Emitted 'taskTagRemoved' for task ID: ${taskId}, tag ID: ${tagId}`);


            res.status(200).json({ message: 'Tag removed from task successfully!' });

        } catch (error) {
            console.error('Error removing tag from task:', error.message);
            res.status(500).json({ message: 'Internal server error during tag removal.' });
        }
    };

    return { // <--- THIS RETURN IS CRUCIAL FOR EXPORTING THE FUNCTIONS
        createTask,
        getTasks,
        getTaskById,
        updateTask,
        deleteTask,
        addTagToTask,
        removeTagFromTask
    };
};
