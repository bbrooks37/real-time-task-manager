// project1/server/controllers/taskController.js
const db = require('../db');
const { logActivity } = require('../utils/activityLogger'); // FIX: Corrected path from '../utils' to '../utlis'
const { createNotification } = require('./notificationController')(); // NEW: Import createNotification

module.exports = (io) => {
    // Helper function to emit Socket.IO events for tasks
    const emitTaskEvent = (eventName, task) => {
        io.emit(eventName, { task: task });
        console.log(`Socket.IO: Emitted '${eventName}' for task ID: ${task.id}`);
    };

    // --- Create Task ---
    const createTask = async (req, res) => {
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const created_by = req.user.user_id;

        try {
            const newTask = await db.query(
                `INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, created_by) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, created_by]
            );

            await logActivity(created_by, 'CREATED', 'TASK', newTask.rows[0].id, { title: newTask.rows[0].title, project_id: newTask.rows[0].project_id }); // Log activity
            
            // NEW: Create notification if task is assigned
            if (assigned_to && assigned_to !== created_by) {
                await createNotification(assigned_to, 'task_assigned', `Task "${title}" assigned to you!`, newTask.rows[0].id, 'TASK');
            }

            emitTaskEvent('taskCreated', newTask.rows[0]);
            res.status(201).json({ message: 'Task created successfully!', task: newTask.rows[0] });
        } catch (error) {
            console.error('Error creating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task creation.' });
        }
    };

    // --- Get Tasks with Advanced Filters and Sorting (Soft Deletion check) ---
    const getTasks = async (req, res) => {
        const user_id = req.user.user_id;
        const {
            project_id,
            search,
            priority,
            status,
            assigned_to,
            tags, // Comma-separated tag IDs
            due_date_start,
            due_date_end,
            order_by = 'created_at',
            order_direction = 'DESC'
        } = req.query;

        let query = `
            SELECT 
                t.id, t.title, t.description, t.due_date, t.priority, t.status, 
                t.assigned_to, t.created_by, t.project_id, t.parent_task_id, t.created_at, t.updated_at,
                t.is_deleted, -- Include is_deleted column
                p.name AS project_name, 
                u.username AS assigned_to_username,
                (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name)) 
                 FROM tags tg JOIN task_tags tt ON tg.id = tt.tag_id WHERE tt.task_id = t.id AND tg.is_deleted = FALSE) AS tags
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE (t.created_by = $1 OR t.assigned_to = $1)
              AND t.is_deleted = FALSE -- NEW: Exclude soft-deleted tasks
              AND p.is_deleted = FALSE -- NEW: Ensure parent project is not soft-deleted
        `;
        const queryParams = [user_id];
        let paramIndex = 2;

        // Filtering conditions
        if (project_id) {
            query += ` AND t.project_id = $${paramIndex++}`;
            queryParams.push(project_id);
        }
        if (search) {
            query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex++})`;
            queryParams.push(`%${search}%`);
        }
        if (priority) {
            query += ` AND t.priority = $${paramIndex++}`;
            queryParams.push(priority);
        }
        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            queryParams.push(status);
        }
        if (assigned_to) {
            query += ` AND t.assigned_to = $${paramIndex++}`;
            queryParams.push(assigned_to);
        }
        if (tags) {
            const tagIds = tags.split(',').map(id => parseInt(id.trim()));
            if (tagIds.length > 0) {
                // Ensure all specified tags are associated with the task
                query += ` AND t.id IN (
                    SELECT task_id FROM task_tags WHERE tag_id = ANY($${paramIndex++}::int[])
                    GROUP BY task_id HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
                )`;
                queryParams.push(tagIds);
            }
        }
        if (due_date_start) {
            query += ` AND t.due_date >= $${paramIndex++}`;
            queryParams.push(due_date_start);
        }
        if (due_date_end) {
            query += ` AND t.due_date <= $${paramIndex++}`;
            queryParams.push(due_date_end);
        }

        // Sorting (ensure order_by is a valid column name to prevent SQL injection)
        const validOrderByColumns = ['created_at', 'due_date', 'priority', 'title', 'status'];
        const finalOrderBy = validOrderByColumns.includes(order_by) ? order_by : 'created_at';
        const finalOrderDirection = order_direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        query += ` ORDER BY t.${finalOrderBy} ${finalOrderDirection}`;

        try {
            const tasks = await db.query(query, queryParams);
            res.status(200).json({ message: 'Tasks retrieved successfully!', tasks: tasks.rows });
        } catch (error) {
            console.error('Error retrieving tasks with filters:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during task retrieval.' });
        }
    };

    // --- Get Task by ID (Soft Deletion check) ---
    const getTaskById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;
        try {
            // Filter out soft-deleted tasks
            const task = await db.query(
                `SELECT 
                    t.id, t.title, t.description, t.due_date, t.priority, t.status, 
                    t.assigned_to, t.created_by, t.project_id, t.parent_task_id, t.created_at, t.updated_at,
                    t.is_deleted, -- Include is_deleted column
                    p.name AS project_name, 
                    u.username AS assigned_to_username,
                    (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name)) 
                     FROM tags tg JOIN task_tags tt ON tg.id = tt.tag_id WHERE tt.task_id = t.id AND tg.is_deleted = FALSE) AS tags
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 LEFT JOIN users u ON t.assigned_to = u.id
                 WHERE t.id = $1 AND (t.created_by = $2 OR t.assigned_to = $2)
                   AND t.is_deleted = FALSE`, // NEW: Exclude soft-deleted tasks
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

    // --- Update Task (Soft Deletion check & Notification) ---
    const updateTask = async (req, res) => {
        const { id } = req.params;
        const { title, description, due_date, priority, status, assigned_to, project_id, parent_task_id } = req.body;
        const user_id = req.user.user_id;

        try {
            // Check if task exists and is not deleted
            const existingTaskResult = await db.query('SELECT created_by, assigned_to, title, status FROM tasks WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingTaskResult.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found or already deleted.' });
            }
            const existingTask = existingTaskResult.rows[0];

            // Permission check: Only creator or assignee can update
            if (existingTask.created_by !== user_id && existingTask.assigned_to !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to update this task.' });
            }

            const oldDetails = {
                title: existingTask.title,
                assigned_to: existingTask.assigned_to,
                status: existingTask.status
            };
            const newDetails = {
                title: title || existingTask.title,
                assigned_to: assigned_to || existingTask.assigned_to,
                status: status || existingTask.status
            };

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
                 WHERE id = $9 AND is_deleted = FALSE RETURNING *`, // NEW: Ensure not updating a deleted task
                [title, description, due_date, priority, status, assigned_to, project_id, parent_task_id, id]
            );
            
            if (updatedTask.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found or unable to update (might be deleted).' });
            }

            await logActivity(user_id, 'UPDATED', 'TASK', id, { old: oldDetails, new: newDetails }); // Log activity

            // NEW: Create notification if task is reassigned
            if (assigned_to && assigned_to !== oldDetails.assigned_to) {
                await createNotification(assigned_to, 'task_reassigned', `Task "${updatedTask.rows[0].title}" has been reassigned to you!`, updatedTask.rows[0].id, 'TASK');
            }
            // Add notification for status change to completed
            if (status && status === 'completed' && oldDetails.status !== 'completed') {
                await createNotification(user_id, 'task_completed', `You marked "${updatedTask.rows[0].title}" as completed.`, updatedTask.rows[0].id, 'TASK');
            }


            emitTaskEvent('taskUpdated', updatedTask.rows[0]);
            res.status(200).json({ message: 'Task updated successfully!', task: updatedTask.rows[0] });
        } catch (error) {
            console.error('Error updating task:', error.message);
            res.status(500).json({ message: 'Internal server error during task update.' });
        }
    };

    // --- Soft Delete Task ---
    const deleteTask = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;

        try {
            // Check if task exists and is not already deleted
            const existingTaskResult = await db.query('SELECT created_by, assigned_to, title FROM tasks WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingTaskResult.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found or already deleted.' });
            }
            const existingTask = existingTaskResult.rows[0];

            // Permission check: Only creator or assignee can soft delete
            if (existingTask.created_by !== user_id && existingTask.assigned_to !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to delete this task.' });
            }

            // Soft delete the task
            const result = await db.query('UPDATE tasks SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Task not found or unable to delete.' });
            }

            await logActivity(user_id, 'SOFT_DELETED', 'TASK', id, { title: existingTask.title }); // Log activity
            emitTaskEvent('taskDeleted', { id: id });
            res.status(200).json({ message: 'Task soft deleted successfully!' });
        } catch (error) {
            console.error('Error soft deleting task:', error.message);
            res.status(500).json({ message: 'Internal server error during task soft deletion.' });
        }
    };

    // --- Add Tag to Task (Soft Deletion check) ---
    const addTagToTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            // Verify task existence and user's permission to access it AND task is not deleted
            const taskCheck = await db.query(
                'SELECT created_by, assigned_to FROM tasks WHERE id = $1 AND (created_by = $2 OR assigned_to = $2) AND is_deleted = FALSE',
                [taskId, user_id]
            );
            if (taskCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Task not found, already deleted, or you do not have permission to modify it.' });
            }

            // Verify tag existence and it's not deleted
            const tagCheck = await db.query('SELECT id FROM tags WHERE id = $1 AND is_deleted = FALSE', [tagId]);
            if (tagCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found or already deleted.' });
            }

            // Check if tag already exists for this task
            const existingAssociation = await db.query('SELECT * FROM task_tags WHERE task_id = $1 AND tag_id = $2', [taskId, tagId]);
            if (existingAssociation.rows.length > 0) {
                return res.status(409).json({ message: 'Tag already associated with this task.' });
            }

            await db.query('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)', [taskId, tagId]);
            await logActivity(user_id, 'TAG_ADDED', 'TASK', taskId, { tag_id: tagId }); // Log activity
            emitTaskEvent('taskTagAdded', { taskId: taskId, tagId: tagId }); // Emit event
            res.status(200).json({ message: 'Tag added to task successfully!' });
        } catch (error) {
            console.error('Error adding tag to task:', error.message);
            res.status(500).json({ message: 'Internal server error adding tag to task.' });
        }
    };

    // --- Remove Tag from Task (Soft Deletion check) ---
    const removeTagFromTask = async (req, res) => {
        const { taskId, tagId } = req.params;
        const user_id = req.user.user_id;

        try {
            // Verify task existence and user's permission to access it AND task is not deleted
            const taskCheck = await db.query(
                'SELECT created_by, assigned_to FROM tasks WHERE id = $1 AND (created_by = $2 OR assigned_to = $2) AND is_deleted = FALSE',
                [taskId, user_id]
            );
            if (taskCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Task not found, already deleted, or you do not have permission to modify it.' });
            }

            const deletedAssociation = await db.query('DELETE FROM task_tags WHERE task_id = $1 AND tag_id = $2 RETURNING *', [taskId, tagId]);
            if (deletedAssociation.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found on this task.' });
            }
            await logActivity(user_id, 'TAG_REMOVED', 'TASK', taskId, { tag_id: tagId }); // Log activity
            emitTaskEvent('taskTagRemoved', { taskId: taskId, tagId: tagId }); // Emit event
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
        deleteTask, // This is now a soft delete
        addTagToTask,
        removeTagFromTask
    };
};
