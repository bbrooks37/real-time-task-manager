// project1/server/db.js
const { Pool } = require('pg');
// REMOVED: require('dotenv').config({ path: '../.env' }); // Not needed for Heroku env vars

// IMPORTANT: On Heroku, the DATABASE_URL environment variable is automatically set.
// The 'pg' library can connect directly using this URL.
// If you're running locally, ensure your DATABASE_URL is set in your local .env file.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set. Please set it in your environment variables.');
    process.exit(1); // Exit if no database URL is found
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // This is CRITICAL for Heroku Postgres to work with Node.js
    }
});

// Test Database Connection
pool.query('SELECT NOW() AS current_time')
    .then(res => {
        console.log('Database connection successful (db.js):', res.rows[0].current_time);
    })
    .catch(err => {
        console.error('Database connection failed (db.js):', err.message);
        // Important: If this error occurs, your app will crash.
        // The process.exit(1) ensures Heroku knows the app failed to start.
        process.exit(1);
    });

module.exports = pool;
