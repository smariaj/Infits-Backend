// db.js
const mysql = require("mysql2");

// Create a connection pool
const pool = mysql.createPool({
  host: "localhost",       // MySQL host
  user: "root",            // your MySQL username
  password: "root", // your MySQL password
  database: "truecaller_db"  // your database name
});

// Export the promise pool for async/awat
module.exports = pool.promise();
