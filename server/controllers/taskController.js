// project1/server/controllers/taskController.js
const db = require('../db');
const { validationResult } = require('express-validator');

module.exports = (io) => {
    // Helper function to emit Socket.IO events for tasks
    const emitTaskEvent = (eventName, task) => {
        io.emit(eventName, { task: task });
        console.log(`Socket.IO: Emitted '${eventName}' for task ID: ${task.id}`);
    };

    // Helper function to emit Socket.IO events for task_tags
    const emitTaskTagEvent = (eventName, data) => {
        io.emit(eventName, data);
        console.log(`Socket.IO: Emitted '${eventName}' for Task ID: ${data.taskId}, Tag ID: ${data.tagId}`);
    };

    // --- Create Task ---
    const createTask = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const creator_id = req.user.user_id; // Get creator_id from authenticated user

        if (!title || !project_id) {
            return res.status(400).json({ message: 'Task title and project ID are required.' });
        }

        try {
            const newTask = await db.query(
                `INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, project_id, creator_id, parent_task_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [title, description, due_date, priority, status, assigned_to, project_id, creator_id, parent_task_id]
            );
            emitTaskEvent('taskCreated', newTask.rows[0]);
            res.status(201).json({ message: 'Task created successfully!', task: newTask.rows[0] });
        } catch (error) {
            console.error('Error creating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task creation.' });
        }
    };

    // --- Get All Tasks with Filtering, Searching, and Tag Joins ---
    const getTasks = async (req, res) => {
        const user_id = req.user.user_id; // Get authenticated user's ID
        const { project_id, search, priority, status, assigned_to, tags } = req.query;

        let query = `
            SELECT 
                t.id, t.title, t.description, t.due_date, t.priority, t.status,
                t.assigned_to, u.username AS assigned_to_username,
                t.project_id, p.name AS project_name,
                t.creator_id, creator.username AS creator_username,
                t.parent_task_id,
                t.created_at, t.updated_at,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name))
                     FROM task_tags tt
                     JOIN tags tg ON tt.tag_id = tg.id
                     WHERE tt.task_id = t.id),
                    '[]'
                ) AS tags
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            JOIN projects p ON t.project_id = p.id
            JOIN users creator ON t.creator_id = creator.id
        `;

        const queryParams = [user_id];
        const conditions = [];
        let paramIndex = 2; // Start param index for dynamic conditions

        // Filter by user's ownership or assignment
        conditions.push(`(t.creator_id = $1 OR t.assigned_to = $1 OR p.created_by = $1)`);

        if (project_id) {
            conditions.push(`t.project_id = $${paramIndex++}`);
            queryParams.push(project_id);
        }
        if (search) {
            conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (priority) {
            conditions.push(`t.priority = $${paramIndex++}`);
            queryParams.push(priority);
        }
        if (status) {
            conditions.push(`t.status = $${paramIndex++}`);
            queryParams.push(status);
        }
        if (assigned_to) {
            conditions.push(`t.assigned_to = $${paramIndex++}`);
            queryParams.push(assigned_to);
        }
        if (tags) {
            // If tags are provided, we need to filter tasks that have ALL selected tags.
            // This is typically handled by checking if the count of matching tags equals the count of provided tags.
            const tagIds = tags.split(',').map(Number);
            if (tagIds.length > 0) {
                // Using a subquery to filter tasks that have all specified tags
                const tagPlaceholders = tagIds.map((_, i) => `$${paramIndex + i}`).join(',');
                conditions.push(`t.id IN (
                    SELECT tt.task_id
                    FROM task_tags tt
                    WHERE tt.tag_id IN (${tagPlaceholders})
                    GROUP BY tt.task_id
                    HAVING COUNT(DISTINCT tt.tag_id) = ${tagIds.length}
                )`);
                queryParams.push(...tagIds);
                paramIndex += tagIds.length;
            }
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC`;

        try {
            const tasks = await db.query(query, queryParams);
            res.status(200).json({ message: 'Tasks retrieved successfully!', tasks: tasks.rows });
        } catch (error) {
            console.error('Error retrieving tasks:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Get Task by ID ---
    const getTaskById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID
        try {
            const task = await db.query(
                `SELECT 
                    t.id, t.title, t.description, t.due_date, t.priority, t.status,
                    t.assigned_to, u.username AS assigned_to_username,
                    t.project_id, p.name AS project_name,
                    t.creator_id, creator.username AS creator_username,
                    t.parent_task_id,
                    t.created_at, t.updated_at,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name))
                         FROM task_tags tt
                         JOIN tags tg ON tt.tag_id = tg.id
                         WHERE tt.task_id = t.id),
                        '[]'
                    ) AS tags
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                JOIN projects p ON t.project_id = p.id
                JOIN users creator ON t.creator_id = creator.id
                WHERE t.id = $1 AND (t.creator_id = $2 OR t.assigned_to = $2 OR p.created_by = $2)`,
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
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Check if task exists and belongs to the current user, or is assigned to them, or project created by them
            const existingTask = await db.query(
                `SELECT t.creator_id, t.assigned_to, p.created_by
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [id]
            );

            if (existingTask.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            const taskOwner = existingTask.rows[0].creator_id;
            const taskAssignee = existingTask.rows[0].assigned_to;
            const projectOwner = existingTask.rows[0].created_by;

            // Only allow update if user is creator, assignee, or project owner
            if (taskOwner !== user_id && taskAssignee !== user_id && projectOwner !== user_id) {
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
            emitTaskEvent('taskUpdated', updatedTask.rows[0]);
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
            // Check if task exists and belongs to the current user, or project created by them
            const existingTask = await db.query(
                `SELECT t.creator_id, p.created_by
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [id]
            );

            if (existingTask.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            const taskCreator = existingTask.rows[0].creator_id;
            const projectCreator = existingTask.rows[0].created_by;

            // Only allow delete if user is creator or project owner
            if (taskCreator !== user_id && projectCreator !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to delete this task.' });
            }

            // Delete associated task_tags entries first (if not handled by CASCADE)
            await db.query('DELETE FROM task_tags WHERE task_id = $1', [id]);

            const deletedTask = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
            if (deletedTask.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }
            emitTaskEvent('taskDeleted', { id: id });
            res.status(200).json({ message: 'Task deleted successfully!' });
        } catch (error) {
            console.error('Error deleting task:', error.message);
            res.status(500).json({ message: 'Internal server error during task deletion.' });
        }
    };

    // --- Add Tag to Task ---
    const addTagToTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            // Verify task existence and user permission (creator/assignee/project owner)
            const taskCheck = await db.query(
                `SELECT t.creator_id, t.assigned_to, p.created_by
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [taskId]
            );

            if (taskCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            const taskOwner = taskCheck.rows[0].creator_id;
            const taskAssignee = taskCheck.rows[0].assigned_to;
            const projectOwner = taskCheck.rows[0].created_by;

            if (taskOwner !== user_id && taskAssignee !== user_id && projectOwner !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to modify this task.' });
            }

            // Check if tag already linked to task to prevent duplicates
            const existingLink = await db.query('SELECT * FROM task_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
            if (existingLink.rows.length > 0) {
                return res.status(409).json({ message: 'Tag already associated with this task.' });
            }

            await db.query('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);
            emitTaskTagEvent('taskTagAdded', { taskId: taskId, tagId: tagId });
            res.status(200).json({ message: 'Tag added to task successfully!' });
        } catch (error) {
            console.error('Error adding tag to task:', error.message);
            res.status(500).json({ message: 'Internal server error adding tag to task.' });
        }
    };

    // --- Remove Tag from Task ---
    const removeTagFromTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            // Verify task existence and user permission (creator/assignee/project owner)
            const taskCheck = await db.query(
                `SELECT t.creator_id, t.assigned_to, p.created_by
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE t.id = $1`,
                [taskId]
            );

            if (taskCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found.' });
            }

            const taskOwner = taskCheck.rows[0].creator_id;
            const taskAssignee = taskCheck.rows[0].assigned_to;
            const projectOwner = taskCheck.rows[0].created_by;

            if (taskOwner !== user_id && taskAssignee !== user_id && projectOwner !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to modify this task.' });
            }

            const deleted = await db.query('DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2 RETURNING *', [taskId, tagId]);
            if (deleted.rows.length === 0) {
                return res.status(404).json({ message: 'Tag association not found for this task.' });
            }
            emitTaskTagEvent('taskTagRemoved', { taskId: taskId, tagId: tagId });
            res.status(200).json({ message: 'Tag removed from task successfully!' });
        } catch (error) {
            console.error('Error removing tag from task:', error.message);
            res.status(500).json({ message: 'Internal server error removing tag from task.' });
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
