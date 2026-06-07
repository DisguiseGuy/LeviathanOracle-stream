const config = require('../../config.json');
const tracer = require('../utils/tracer');
const MigrationRunner = require('./migrations/MigrationRunner');

const db = config.database.postgresql?.enabled
  ? require('./postgres')
  : require('./sqlite3');

const dbType = config.database.postgresql?.enabled ? 'postgres' : 'sqlite';

if (config.database.postgresql?.enabled) {
  tracer.info('DATABASE', 'Using PostgreSQL database.');
} else {
  tracer.info('DATABASE', 'PostgreSQL DB is disabled, Using SQLite3 local database. Make sure you have enough disk space in your local machine or server if you are hosting.');
}

db.initializeMigrations = async () => {
  const runner = new MigrationRunner(db, dbType);
  await runner.initialize();
};

module.exports = db;
