// project1/server/controllers/projectController.js
const db = require('../db'); // Import the database connection pool

// --- Create a New Project ---
const createProject = async (req, res) => {
    // Extract project details from request body
    const { name, description } = req.body;
    // req.user is populated by verifyToken middleware, contains user_id of the authenticated user
    const created_by = req.user.user_id; 

    // Basic validation
    if (!name) {
        return res.status(400).json({ message: 'Project name is required.' });
    }

    try {
        // Insert the new project into the database
        const newProject = await db.query(
            'INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name, description, created_by, created_at, updated_at',
            [name, description, created_by]
        );

        // Send success response
        res.status(201).json({
            message: 'Project created successfully!',
            project: newProject.rows[0],
        });

    } catch (error) {
        console.error('Error creating project:', error.message);
        res.status(500).json({ message: 'Internal server error during project creation.' });
    }
};

// --- Get All Projects ---
const getProjects = async (req, res) => {
    const user_id = req.user.user_id; // Get the ID of the authenticated user

    try {
        // Fetch all projects that are created by the authenticated user
        // Or you might want to fetch projects that the user is assigned to tasks in, etc.
        // For simplicity, let's fetch projects created by the user or public projects.
        // For now, let's fetch only projects created by the user for clear ownership.
        const projects = await db.query('SELECT id, name, description, created_by, created_at, updated_at FROM projects WHERE created_by = $1 ORDER BY created_at DESC', [user_id]);

        res.status(200).json({
            message: 'Projects retrieved successfully!',
            projects: projects.rows,
            count: projects.rows.length,
        });

    } catch (error) {
        console.error('Error retrieving projects:', error.message);
        res.status(500).json({ message: 'Internal server error during project retrieval.' });
    }
};

// --- Get Project by ID ---
const getProjectById = async (req, res) => {
    const { id } = req.params; // Get project ID from URL parameters
    const user_id = req.user.user_id; // Get the ID of the authenticated user

    try {
        // Fetch the project by ID, ensuring it belongs to the authenticated user
        const projectResult = await db.query(
            'SELECT id, name, description, created_by, created_at, updated_at FROM projects WHERE id = $1 AND created_by = $2',
            [id, user_id]
        );
        const project = projectResult.rows[0];

        if (!project) {
            return res.status(404).json({ message: 'Project not found or you do not have access.' });
        }

        res.status(200).json({
            message: 'Project retrieved successfully!',
            project,
        });

    } catch (error) {
        console.error('Error retrieving project by ID:', error.message);
        res.status(500).json({ message: 'Internal server error during project retrieval.' });
    }
};

// --- Update an Existing Project ---
const updateProject = async (req, res) => {
    const { id } = req.params; // Project ID from URL
    const { name, description } = req.body; // Updated details from body
    const user_id = req.user.user_id; // Authenticated user ID

    // Basic validation
    if (!name) { // Project name is required for update as well
        return res.status(400).json({ message: 'Project name is required for update.' });
    }

    try {
        // Update the project, ensuring it belongs to the authenticated user
        const updatedProject = await db.query(
            'UPDATE projects SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND created_by = $4 RETURNING id, name, description, created_by, created_at, updated_at',
            [name, description, id, user_id]
        );

        if (updatedProject.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found or you do not have permission to update.' });
        }

        res.status(200).json({
            message: 'Project updated successfully!',
            project: updatedProject.rows[0],
        });

    } catch (error) {
        console.error('Error updating project:', error.message);
        res.status(500).json({ message: 'Internal server error during project update.' });
    }
};

// --- Delete a Project ---
const deleteProject = async (req, res) => {
    const { id } = req.params; // Project ID from URL
    const user_id = req.user.user_id; // Authenticated user ID

    try {
        // Delete the project, ensuring it belongs to the authenticated user
        const deletedProject = await db.query('DELETE FROM projects WHERE id = $1 AND created_by = $2 RETURNING id', [id, user_id]);

        if (deletedProject.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found or you do not have permission to delete.' });
        }

        res.status(200).json({ message: 'Project deleted successfully!' });

    } catch (error) {
        console.error('Error deleting project:', error.message);
        res.status(500).json({ message: 'Internal server error during project deletion.' });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
};