const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'backend/data/tristar.db');
const db = new sqlite3.Database(dbPath);

console.log('Clearing demo data from database...');

// Clear all members
db.run('DELETE FROM members', (err) => {
  if (err) {
    console.error('Error clearing members:', err);
  } else {
    console.log('✅ Cleared all members from database');
  }
});

// Clear all activities
db.run('DELETE FROM activities', (err) => {
  if (err) {
    console.error('Error clearing activities:', err);
  } else {
    console.log('✅ Cleared all activities from database');
  }
});

// Clear all check_ins
db.run('DELETE FROM check_ins', (err) => {
  if (err) {
    console.error('Error clearing check_ins:', err);
  } else {
    console.log('✅ Cleared all check_ins from database');
  }
});

// Close the database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('✅ Database cleared successfully');
    console.log('You can now add your real members (nikhil1 test, nikhil2 test, nikhil3 test)');
  }
});
