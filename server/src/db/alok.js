// Change this line:
const db = require('./database'); 

/**
 * Deletes EVERY user from the users table
 */
function deleteAllUsers() {
  const stmt = db.prepare('DELETE FROM users');
  const info = stmt.run();
  
  return info;
}

const result = deleteAllUsers();
console.log(`Cleared table. Deleted ${result.changes} users.`);