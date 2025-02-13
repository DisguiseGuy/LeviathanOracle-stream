const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database
const dbPath = path.resolve(__dirname, 'watchlist.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database opened successfully');
  }
});

// Create the watchlists table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      anime_title TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Watchlists table created successfully');
    }
  });

  // Create the users table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      mal_username TEXT,
      anilist_username TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Users table created successfully');
    }
  });
});

module.exports = db;