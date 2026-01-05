// testDb.js
const db = require("./db");

async function testConnection() {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    console.log("MySQL connected, test query result:", rows[0].result);
  } catch (err) {
    console.error("MySQL connection failed:", err);
  }
}

testConnection();
