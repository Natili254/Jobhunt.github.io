require("dotenv").config();
const mysql = require("mysql2");

// Use a pool to avoid crashing the app if the DB is temporarily unavailable.
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "job_hunt_user",
    password: process.env.DB_PASSWORD || "Natili!254",
    database: process.env.DB_NAME || "job_hunt",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL Connection Error:", err.message);
        console.error("The server will continue running but DB queries will fail until the database is reachable.");
        return;
    }
    console.log("MySQL Connected");
    connection.release();
});

module.exports = pool;

