// project1/server/db.js
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Adjust path if .env is in project root

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432, // Default PostgreSQL port
});

pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database!');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); // Exit process if cannot connect or critical error
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // Added to allow individual client connections
};