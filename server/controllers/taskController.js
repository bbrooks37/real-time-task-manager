// project1/server/controllers/taskController.js
const db = require('../db');
const { validationResult } = require('express-validator');

module.exports = (io) => {
    // Helper function to emit Socket.IO events for tasks
    const emitTaskEvent = (eventName, task) => {
        io.emit(eventName, { task: task });
        console.log(`Socket.IO: Emitted '${eventName}' for task ID: ${task.id}`);
    };

    // --- Create Task ---
    const createTask = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const creator_id = req.user.user_id; // Get creator_id from authenticated user

        try {
            const newTask = await db.query(
                `INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, creator_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, creator_id]
            );
            emitTaskEvent('taskCreated', newTask.rows[0]); // Emit event on creation
            res.status(201).json({ message: 'Task created successfully!', task: newTask.rows[0] });
        } catch (error) {
            console.error('Error creating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task creation.' });
        }
    };

    // --- Get All Tasks (with user-specific filtering) ---
    const getTasks = async (req, res) => {
        const user_id = req.user.user_id; // Get authenticated user's ID
        const project_id = req.query.project_id; // Optional project filter
        const status = req.query.status;         // Optional status filter
        const priority = req.query.priority;     // Optional priority filter
        const assigned_to = req.query.assigned_to; // Optional assigned_to filter
        const search = req.query.search;         // Optional search by title/description

        let query = `
            SELECT 
                t.*,
                p.name AS project_name,
                u.username AS assigned_to_username,
                ARRAY_AGG(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL) AS tags
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN task_tags tt ON t.id = tt.task_id
            LEFT JOIN tags tg ON tt.tag_id = tg.id
            WHERE 
                t.creator_id = $1 
                OR t.assigned_to = $1 -- Tasks created by the user or assigned to the user
        `;
        const queryParams = [user_id];
        let paramIndex = 2; // Start index for additional parameters

        if (project_id) {
            query += ` AND t.project_id = $${paramIndex++}`;
            queryParams.push(project_id);
        }
        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            queryParams.push(status);
        }
        if (priority) {
            query += ` AND t.priority = $${paramIndex++}`;
            queryParams.push(priority);
        }
        if (assigned_to) {
            query += ` AND t.assigned_to = $${paramIndex++}`;
            queryParams.push(assigned_to);
        }
        if (search) {
            query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex++})`;
            queryParams.push(`%${search}%`);
        }

        query += ` GROUP BY t.id, p.name, u.username ORDER BY t.due_date ASC NULLS LAST, t.priority DESC`; // Group by task ID and order
        
        try {
            const tasks = await db.query(query, queryParams);
            res.status(200).json({ message: 'Tasks retrieved successfully!', tasks: tasks.rows });
        } catch (error) {
            console.error('Error retrieving tasks:', error.message);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Get Task by ID ---
    const getTaskById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Ensure task belongs to the user or is assigned to them
            const task = await db.query(
                `SELECT 
                    t.*,
                    p.name AS project_name,
                    u.username AS assigned_to_username,
                    ARRAY_AGG(json_build_object('id', tg.id, 'name', tg.name)) FILTER (WHERE tg.id IS NOT NULL) AS tags
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN task_tags tt ON t.id = tt.task_id
                LEFT JOIN tags tg ON tt.tag_id = tg.id
                WHERE t.id = $1 AND (t.creator_id = $2 OR t.assigned_to = $2)
                GROUP BY t.id, p.name, u.username`,
                [id, user_id]
            );

            if (task.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found or you do not have permission to access it.' });
            }
            res.status(200).json({ message: 'Task retrieved successfully!', task: task.rows[0] });
        } catch (error) {
            console.error('Error retrieving task by ID:', error.message);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Update Task ---
    const updateTask = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;

        try {
            // First, verify the user has permission to update this task
            const existingTask = await db.query('SELECT creator_id, assigned_to FROM tasks WHERE id = $1', [id]);
            if (existingTask.rows.length === 0 || (existingTask.rows[0].creator_id !== user_id && existingTask.rows[0].assigned_to !== user_id)) {
                return res.status(403).json({ message: 'You do not have permission to update this task.' });
            }

            const updatedTask = await db.query(
                `UPDATE tasks SET 
                    title = COALESCE($1, title), 
                    description = COALESCE($2, description), 
                    due_date = COALESCE($3, due_date), 
                    priority = COALESCE($4, priority), 
                    status = COALESCE($5, status), 
                    assigned_to = COALESCE($6, assigned_to), 
                    project_id = COALESCE($7, project_id),
                    parent_task_id = COALESCE($8, parent_task_id),
                    updated_at = NOW()
                 WHERE id = $9 RETURNING *`,
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, id]
            );
            emitTaskEvent('taskUpdated', updatedTask.rows[0]); // Emit event on update
            res.status(200).json({ message: 'Task updated successfully!', task: updatedTask.rows[0] });
        } catch (error) {
            console.error('Error updating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task update.' });
        }
    };

    // --- Delete Task ---
    const deleteTask = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Only allow the task creator or assigned user to delete the task
            const existingTask = await db.query('SELECT creator_id, assigned_to FROM tasks WHERE id = $1', [id]);
            if (existingTask.rows.length === 0 || (existingTask.rows[0].creator_id !== user_id && existingTask.rows[0].assigned_to !== user_id)) {
                return res.status(403).json({ message: 'You do not have permission to delete this task.' });
            }

            const deletedTask = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
            if (deletedTask.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }
            emitTaskEvent('taskDeleted', { id: id }); // Emit event on deletion
            res.status(200).json({ message: 'Task deleted successfully!' });
        } catch (error) {
            console.error('Error deleting task:', error.message);
            res.status(500).json({ message: 'Internal server error during task deletion.' });
        }
    };

    // --- Add Tag to Task ---
    const addTagToTask = async (req, res) => {
        const { taskId, tagId } = req.params; // Get taskId and tagId from URL parameters
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Verify task exists and user has permission (creator or assigned)
            const taskCheck = await db.query('SELECT creator_id, assigned_to FROM tasks WHERE id = $1', [taskId]);
            if (taskCheck.rows.length === 0 || (taskCheck.rows[0].creator_id !== user_id && taskCheck.rows[0].assigned_to !== user_id)) {
                return res.status(403).json({ message: 'You do not have permission to modify this task.' });
            }

            // Check if tag exists
            const tagCheck = await db.query('SELECT id FROM tags WHERE id = $1', [tagId]);
            if (tagCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found.' });
            }

            // Prevent duplicate tag assignments
            const existingTag = await db.query('SELECT * FROM task_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
            if (existingTag.rows.length > 0) {
                return res.status(409).json({ message: 'Tag already assigned to this task.' });
            }

            await db.query('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);
            emitTaskEvent('taskTagAdded', { taskId, tagId }); // Emit event
            res.status(201).json({ message: 'Tag added to task successfully!' });
        } catch (error) {
            console.error('Error adding tag to task:', error.message);
            res.status(500).json({ message: 'Internal server error.' });
        }
    };

    // --- Remove Tag from Task ---
    const removeTagFromTask = async (req, res) => {
        const { taskId, tagId } = req.params; // Get taskId and tagId from URL parameters
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Verify task exists and user has permission (creator or assigned)
            const taskCheck = await db.query('SELECT creator_id, assigned_to FROM tasks WHERE id = $1', [taskId]);
            if (taskCheck.rows.length === 0 || (taskCheck.rows[0].creator_id !== user_id && taskCheck.rows[0].assigned_to !== user_id)) {
                return res.status(403).json({ message: 'You do not have permission to modify this task.' });
            }

            const result = await db.query('DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2 RETURNING *', [taskId, tagId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found on this task.' });
            }
            emitTaskEvent('taskTagRemoved', { taskId, tagId }); // Emit event
            res.status(200).json({ message: 'Tag removed from task successfully!' });
        } catch (error) {
            console.error('Error removing tag from task:', error.message);
            res.status(500).json({ message: 'Internal server error.' });
        }
    };


    return {
        createTask,
        getTasks,
        getTaskById,
        updateTask,
        deleteTask,
        addTagToTask,
        removeTagFromTask
    };
};
