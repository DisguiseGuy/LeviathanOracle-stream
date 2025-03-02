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
      anime_title TEXT NOT NULL
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
// For retriving user data from the database
export function getUserByDiscordId(discordId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
      if (err) {
        console.error('Error fetching user:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

export function getUserWatchlist(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM watchlists WHERE user_id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching watchlist:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export default db;