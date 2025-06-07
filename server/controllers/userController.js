// project1/server/controllers/userController.js
const db = require('../db'); // Import the database connection pool

// Export a function that receives io (though not directly used for user fetching)
module.exports = (io) => {
    // --- Get All Users (for assignment dropdowns, etc.) ---
    const getUsers = async (req, res) => {
        try {
            // Fetch all users, excluding sensitive data like password hashes
            const users = await db.query('SELECT id, username, email FROM users ORDER BY username ASC');

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

    return {
        getUsers
    };
};
