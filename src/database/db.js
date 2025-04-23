import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create or open the database
const dbPath = path.resolve(__dirname, 'watchlist.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database opened successfully');
  }
});

// Create the watchlists and users tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      anime_title TEXT NOT NULL,
      anime_id INTEGER NOT NULL,
      next_airing_at INTEGER
    )
  `, (err) => {
    if (err) {
      console.error('Error creating watchlists table:', err);
    } else {
      console.log('Watchlists table created successfully');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id TEXT PRIMARY KEY,
      mal_username TEXT,
      anilist_username TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table created successfully');
    }
  });
});

export default db;