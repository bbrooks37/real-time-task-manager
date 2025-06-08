// project1/server/controllers/tagController.js
const db = require('../db'); // Ensure db is imported correctly
const { validationResult } = require('express-validator');
const { logActivity } = require('../utils/activityLogger'); // FIX: Corrected path from '../utils' to '../utlis'

module.exports = (io) => {
    // Helper function to emit Socket.IO events for tags
    const emitTagEvent = (eventName, tag) => {
        io.emit(eventName, { tag: tag });
        console.log(`Socket.IO: Emitted '${eventName}' for tag ID: ${tag.id}`);
    };

    // --- Create Tag ---
    const createTag = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Validation errors for createTag:', errors.array()); // More detailed logging
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { name } = req.body;
        const created_by = req.user.user_id; // Get creator_id from authenticated user

        if (!name) {
            return res.status(400).json({ message: 'Tag name is required.' });
        }

        try {
            // Check if tag already exists (case-insensitive for uniqueness) and is not soft-deleted
            const existingTag = await db.query('SELECT * FROM tags WHERE LOWER(name) = LOWER($1) AND is_deleted = FALSE', [name]);
            if (existingTag.rows.length > 0) {
                return res.status(409).json({ message: 'Tag with this name already exists.' });
            }

            const newTag = await db.query(
                `INSERT INTO tags (name, created_by) VALUES ($1, $2) RETURNING *`,
                [name, created_by]
            );
            await logActivity(created_by, 'CREATED', 'TAG', newTag.rows[0].id, { name: newTag.rows[0].name }); // Log activity
            emitTagEvent('tagCreated', newTag.rows[0]); // Emit event on creation
            res.status(201).json({ message: 'Tag created successfully!', tag: newTag.rows[0] });
        } catch (error) {
            console.error('Error creating tag (DB query failed):', error.message, error.stack); // ADDED error.stack for detailed debugging
            res.status(500).json({ message: 'Internal server error during tag creation.' });
        }
    };

    // --- Get All Tags (Soft Deletion check) ---
    const getTags = async (req, res) => {
        try {
            // Explicitly select columns from tags (t) and username from users (u)
            const tags = await db.query(
                `SELECT t.id, t.name, t.created_by, t.created_at, t.updated_at,
                        t.is_deleted, -- Include is_deleted column
                        u.username AS created_by_username
                 FROM tags t
                 JOIN users u ON t.created_by = u.id
                 WHERE t.is_deleted = FALSE -- NEW: Exclude soft-deleted tags
                 ORDER BY t.name ASC`
            );
            res.status(200).json({ message: 'Tags retrieved successfully!', tags: tags.rows });
        } catch (error) {
            console.error('Error retrieving tags (DB query failed):', error.message, error.stack); // ADDED error.stack for detailed debugging
            res.status(500).json({ message: 'Internal server error during tag retrieval.' });
        }
    };

    // --- Get Tag by ID (Soft Deletion check) ---
    const getTagById = async (req, res) => {
        const { id } = req.params;
        try {
            // Explicitly select columns from tags (t) and username from users (u)
            const tag = await db.query(
                `SELECT t.id, t.name, t.created_by, t.created_at, t.updated_at,
                        t.is_deleted, -- Include is_deleted column
                        u.username AS created_by_username
                 FROM tags t
                 JOIN users u ON t.created_by = u.id
                 WHERE t.id = $1 AND t.is_deleted = FALSE`, // NEW: Exclude soft-deleted tags
                [id]
            );
            if (tag.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found.' });
            }
            res.status(200).json({ message: 'Tag retrieved successfully!', tag: tag.rows[0] });
        } catch (error) {
            console.error('Error retrieving tag by ID:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during tag retrieval.' });
        }
    };

    // --- Update Tag (Soft Deletion check) ---
    const updateTag = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
        }

        const { id } = req.params;
        const { name } = req.body;
        const user_id = req.user.user_id; // Get authenticated user's ID

        if (!name) {
            return res.status(400).json({ message: 'Tag name cannot be empty.' });
        }

        try {
            // Check if tag exists, is not deleted, and was created by the current user
            const existingTagResult = await db.query('SELECT created_by, name FROM tags WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingTagResult.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found or already deleted.' });
            }
            const existingTag = existingTagResult.rows[0];

            if (existingTag.created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to update this tag.' });
            }

            // Check for duplicate name if changing and is not soft-deleted
            const duplicateNameCheck = await db.query('SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND id != $2 AND is_deleted = FALSE', [name, id]);
            if (duplicateNameCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Another active tag with this name already exists.' });
            }

            const oldDetails = { name: existingTag.name };
            const newDetails = { name: name };

            const updatedTag = await db.query(
                `UPDATE tags SET name = $1, updated_at = NOW() WHERE id = $2 AND is_deleted = FALSE RETURNING *`, // NEW: Ensure not updating a deleted tag
                [name, id]
            );
            
            if (updatedTag.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found or unable to update (might be deleted).' });
            }

            await logActivity(user_id, 'UPDATED', 'TAG', id, { old: oldDetails, new: newDetails }); // Log activity
            emitTagEvent('tagUpdated', updatedTag.rows[0]); // Emit event on update
            res.status(200).json({ message: 'Tag updated successfully!', tag: updatedTag.rows[0] });
        } catch (error) {
            console.error('Error updating tag:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during tag update.' });
        }
    };

    // --- Soft Delete Tag ---
    const deleteTag = async (req, res) => {
        const { id } = req.params;
        const user_id = req.user.user_id;

        try {
            // Check if tag exists and is not already deleted
            const existingTagResult = await db.query('SELECT created_by, name FROM tags WHERE id = $1 AND is_deleted = FALSE', [id]);
            if (existingTagResult.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found or already deleted.' });
            }
            const existingTag = existingTagResult.rows[0];

            if (existingTag.created_by !== user_id) {
                return res.status(403).json({ message: 'You do not have permission to delete this tag.' });
            }
            
            // Soft delete the tag
            const result = await db.query('UPDATE tags SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Tag not found or unable to delete.' });
            }

            // Note: task_tags associations will implicitly be filtered out if tag is_deleted=TRUE
            // You might want to explicitly delete task_tags associations or update them
            // For now, filtering in getTasks is sufficient.
            // await db.query('DELETE FROM task_tags WHERE tag_id = $1', [id]); // Only if hard deleting

            await logActivity(user_id, 'SOFT_DELETED', 'TAG', id, { name: existingTag.name }); // Log activity
            emitTagEvent('tagDeleted', { id: id }); // Emit event on deletion
            res.status(200).json({ message: 'Tag soft deleted successfully!' });
        } catch (error) {
            console.error('Error deleting tag:', error.message, error.stack);
            res.status(500).json({ message: 'Internal server error during tag deletion.' });
        }
    };

    return {
        createTag,
        getTags,
        getTagById,
        updateTag,
        deleteTag // This is now a soft delete
    };
};
