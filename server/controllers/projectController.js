// project1/server/controllers/projectController.js
const db = require('../db');
const { validationResult } = require('express-validator'); // Import validationResult

module.exports = (io) => {
    // Helper function to emit Socket.IO events for projects
    const emitProjectEvent = (eventName, project) => {
        io.emit(eventName, { project: project });
        console.log(`Socket.IO: Emitted '${eventName}' for project ID: ${project.id}`);
    };

    // --- Create Project ---
    const createProject = async (req, res) => {
        // Check for validation errors (assuming project validation will be added later if needed)
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { name, description } = req.body;
        const created_by = req.user.user_id; // Get creator_id from authenticated user

        // Basic validation (can be replaced by express-validator if preferred)
        if (!name) {
            return res.status(400).json({ message: 'Project name is required.' });
        }

        try {
            // FIX: Removed duplicate 'description' column from the INSERT query
            const newProject = await db.query(
                `INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name, description, created_by`,
                [name, description, created_by]
            );
            emitProjectEvent('projectCreated', newProject.rows[0]);
            res.status(201).json({ message: 'Project created successfully!', project: newProject.rows[0] });
        } catch (error) {
            console.error('Error creating project:', error.message);
            res.status(500).json({ message: 'Internal server error during project creation.' });
        }
    };

    // --- Get All Projects (Expanded for associated tasks) ---
    const getProjects = async (req, res) => {
        const user_id = req.user.user_id; // Get authenticated user's ID
        try {
            // Fetch projects created by the authenticated user OR
            // projects that have tasks assigned to the authenticated user
            const projects = await db.query(
                `SELECT DISTINCT p.id, p.name, p.description, p.created_at, p.updated_at,
                                u.username AS created_by_username
                 FROM projects p
                 JOIN users u ON p.created_by = u.id
                 LEFT JOIN tasks t ON p.id = t.project_id
                 WHERE p.created_by = $1 OR t.assigned_to = $1
                 ORDER BY p.created_at DESC`,
                [user_id]
            );
            res.status(200).json({ message: 'Projects retrieved successfully!', projects: projects.rows });
        } catch (error) {
            console.error('Error retrieving projects:', error.message);
            res.status(500).json({ message: 'Internal server error during project retrieval.' });
        }
    };

    // --- Get Project by ID ---
    const getProjectById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID
        try {
            // Fetch project if created by the authenticated user OR
            // if there's a task in this project assigned to the user
            const project = await db.query(
                `SELECT DISTINCT p.id, p.name, p.description, p.created_at, p.updated_at,
                                u.username AS created_by_username
                 FROM projects p
                 JOIN users u ON p.created_by = u.id
                 LEFT JOIN tasks t ON p.id = t.project_id
                 WHERE p.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)`,
                [id, user_id]
            );

            if (project.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found or you do not have permission to access it.' });
            }
            res.status(200).json({ message: 'Project retrieved successfully!', project: project.rows[0] });
        } catch (error) {
            console.error('Error retrieving project by ID:', error.message);
            res.status(500).json({ message: 'Internal server error during project retrieval.' });
        }
    };

    // --- Update Project ---
    const updateProject = async (req, res) => {
        const errors = validationResult(req); // Assuming project validation will be added later
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description } = req.body;
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Check if the project exists and belongs to the current user
            const existingProject = await db.query('SELECT created_by FROM projects WHERE id = $1', [id]);
            if (existingProject.rows.length === 0 || existingProject.rows[0].created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to update this project.' });
            }

            const updatedProject = await db.query(
                `UPDATE projects SET 
                    name = COALESCE($1, name), 
                    description = COALESCE($2, description), 
                    updated_at = NOW() 
                 WHERE id = $3 RETURNING *`,
                [name, description, id]
            );
            emitProjectEvent('projectUpdated', updatedProject.rows[0]);
            res.status(200).json({ message: 'Project updated successfully!', project: updatedProject.rows[0] });
        } catch (error) {
            console.error('Error updating project:', error.message);
            res.status(500).json({ message: 'Internal server error during project update.' });
        }
    };

    // --- Delete Project ---
    const deleteProject = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id; // Get authenticated user's ID

        try {
            // Check if the project exists and belongs to the current user
            const existingProject = await db.query('SELECT created_by FROM projects WHERE id = $1', [id]);
            if (existingProject.rows.length === 0 || existingProject.rows[0].created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to delete this project.' });
            }

            // Note: ON DELETE CASCADE on foreign keys in tasks will handle associated tasks
            const deletedProject = await db.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
            if (deletedProject.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found.' });
            }
            emitProjectEvent('projectDeleted', { id: id });
            res.status(200).json({ message: 'Project deleted successfully!' });
        } catch (error) {
            console.error('Error deleting project:', error.message);
            res.status(500).json({ message: 'Internal server error during project deletion.' });
        }
    };

    return {
        createProject,
        getProjects,
        getProjectById,
        updateProject,
        deleteProject,
    };
};
