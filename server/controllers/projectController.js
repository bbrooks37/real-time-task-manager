// project1/server/controllers/projectController.js
const db = require('../db');
const { validationResult } = require('express-validator');
const { logActivity } = require('../utils/activityLogger'); // FIX: Corrected path from '../utils' to '../utlis'

module.exports = (io) => {
    // Helper function to emit Socket.IO events for projects
    const emitProjectEvent = (eventName, project) => {
        io.emit(eventName, { project: project });
        console.log(`Socket.IO: Emitted '${eventName}' for project ID: ${project.id}`);
    };

    // --- Create Project ---
    const createProject = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { name, description } = req.body;
        const created_by = req.user.user_id;
        const user_role = req.user.role;

        // Example: Only 'admin' or 'project_manager' roles can create projects (adjust as needed)
        // For now, allowing 'member' to create projects
        if (user_role !== 'admin' && user_role !== 'member') {
            return res.status(403).json({ message: 'You do not have permission to create projects.' });
        }

        try {
            const newProject = await db.query(
                `INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name, description, created_by`,
                [name, description, created_by]
            );
            await logActivity(created_by, 'CREATED', 'PROJECT', newProject.rows[0].id, { name: newProject.rows[0].name }); // Log activity
            emitProjectEvent('projectCreated', newProject.rows[0]);
            res.status(201).json({ message: 'Project created successfully!', project: newProject.rows[0] });
        } catch (error) {
            console.error('Error creating project:', error.message);
            res.status(500).json({ message: 'Internal server error during project creation.' });
        }
    };

    // --- Get All Projects (Expanded for associated tasks & Soft Deletion) ---
    const getProjects = async (req, res) => {
        const user_id = req.user.user_id;
        try {
            // Filter out soft-deleted projects
            const projects = await db.query(
                `SELECT DISTINCT p.id, p.name, p.description, p.created_at, p.updated_at,
                                p.is_deleted, -- Include is_deleted column
                                u.username AS created_by_username
                 FROM projects p
                 JOIN users u ON p.created_by = u.id
                 LEFT JOIN tasks t ON p.id = t.project_id
                 WHERE (p.created_by = $1 OR t.assigned_to = $1)
                   AND p.is_deleted = FALSE -- NEW: Exclude soft-deleted projects
                 ORDER BY p.created_at DESC`,
                [user_id]
            );
            res.status(200).json({ message: 'Projects retrieved successfully!', projects: projects.rows });
        } catch (error) {
            console.error('Error retrieving projects:', error.message);
            res.status(500).json({ message: 'Internal server error during project retrieval.' });
        }
    };

    // --- Get Project by ID (Soft Deletion check) ---
    const getProjectById = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;
        try {
            // Filter out soft-deleted projects
            const project = await db.query(
                `SELECT DISTINCT p.id, p.name, p.description, p.created_at, p.updated_at,
                                p.is_deleted, -- Include is_deleted column
                                u.username AS created_by_username
                 FROM projects p
                 JOIN users u ON p.created_by = u.id
                 LEFT JOIN tasks t ON p.id = t.project_id
                 WHERE p.id = $1 AND (p.created_by = $2 OR t.assigned_to = $2)
                   AND p.is_deleted = FALSE`, // NEW: Exclude soft-deleted projects
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

    // --- Update Project (Soft Deletion check) ---
    const updateProject = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description } = req.body;
        const user_id = req.user.user_id;
        const user_role = req.user.role;

        try {
            // Check if the project exists, is not deleted, and belongs to the current user
            const existingProjectResult = await db.query('SELECT created_by, name, description FROM projects WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingProjectResult.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found or already deleted.' });
            }
            const existingProject = existingProjectResult.rows[0];

            // Permission check: Only admin or creator can update
            if (user_role !== 'admin' && existingProject.created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to update this project.' });
            }

            const oldDetails = { name: existingProject.name, description: existingProject.description };
            const newDetails = { name: name, description: description };

            const updatedProject = await db.query(
                `UPDATE projects SET 
                    name = COALESCE($1, name), 
                    description = COALESCE($2, description), 
                    updated_at = NOW() 
                 WHERE id = $3 AND is_deleted = FALSE RETURNING *`, // NEW: Ensure not updating a deleted project
                [name, description, id]
            );
            
            if (updatedProject.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found or unable to update (might be deleted).' });
            }

            await logActivity(user_id, 'UPDATED', 'PROJECT', id, { old: oldDetails, new: newDetails }); // Log activity
            emitProjectEvent('projectUpdated', updatedProject.rows[0]);
            res.status(200).json({ message: 'Project updated successfully!', project: updatedProject.rows[0] });
        } catch (error) {
            console.error('Error updating project:', error.message);
            res.status(500).json({ message: 'Internal server error during project update.' });
        }
    };

    // --- Soft Delete Project ---
    const deleteProject = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;
        const user_role = req.user.role;

        try {
            // Check if the project exists and is not already deleted
            const existingProjectResult = await db.query('SELECT created_by, name FROM projects WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingProjectResult.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found or already deleted.' });
            }
            const existingProject = existingProjectResult.rows[0];

            // Permission check: Only 'admin' or the project creator can soft delete projects
            if (user_role !== 'admin' && existingProject.created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to delete this project.' });
            }

            // Soft delete the project
            const result = await db.query(
                'UPDATE projects SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id',
                [id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Project not found or unable to delete.' });
            }

            // Also soft delete all associated tasks
            await db.query(
                'UPDATE tasks SET is_deleted = TRUE, updated_at = NOW() WHERE project_id = $1',
                [id]
            );

            await logActivity(user_id, 'SOFT_DELETED', 'PROJECT', id, { name: existingProject.name }); // Log activity
            emitProjectEvent('projectDeleted', { id: id }); // Still emit, but note it's soft deleted
            res.status(200).json({ message: 'Project soft deleted successfully!' });
        } catch (error) {
            console.error('Error soft deleting project:', error.message);
            res.status(500).json({ message: 'Internal server error during project soft deletion.' });
        }
    };

    return {
        createProject,
        getProjects,
        getProjectById,
        updateProject,
        deleteProject, // This is now a soft delete
    };
};
