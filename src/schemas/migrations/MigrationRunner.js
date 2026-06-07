const fs = require('fs');
const path = require('path');
const tracer = require('../../utils/tracer');

class MigrationRunner {
    constructor(db, dbType) {
        this.db = db;
        this.dbType = dbType;
        this.migrationsPath = path.join(__dirname, this.dbType);
    }

    async initialize() {
        try {
            await this.createMigrationsTable();
            await this.runPendingMigrations();
        } catch (err) {
            tracer.error('MIGRATIONS', 'Migration initialization failed', err);
            throw err;
        }
    }

    async createMigrationsTable() {
        const queries = {
            postgres: `
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `,
            sqlite: `
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `
        };

        if (queries[this.dbType]) {
            await this.db.query(queries[this.dbType]);
        }
    }

    async getAppliedMigrations() {
        if (this.dbType === 'mongodb') {
            return [];
        }

        const query = 'SELECT name FROM migrations ORDER BY applied_at ASC';
        try {
            const result = await this.db.query(query);
            return result.rows?.map(row => row.name) || [];
        } catch {
            return [];
        }
    }

    async getMigrationFiles() {
        if (!fs.existsSync(this.migrationsPath)) {
            return [];
        }
        return fs.readdirSync(this.migrationsPath)
            .filter(f => f.endsWith('.js') && !f.startsWith('.'))
            .sort();
    }

    async runPendingMigrations() {
        const appliedMigrations = await this.getAppliedMigrations();
        const migrationFiles = await this.getMigrationFiles();

        const pending = migrationFiles.filter(file => !appliedMigrations.includes(file));

        if (pending.length === 0) {
            tracer.info('MIGRATIONS', 'All migrations are up to date');
            return;
        }

        for (const file of pending) {
            try {
                await this.runMigration(file);
                tracer.info('MIGRATIONS', `✓ Applied: ${file}`);
            } catch (err) {
                tracer.error('MIGRATIONS', `Failed to apply migration ${file}`, err);
                throw new Error(`Migration failed: ${file}\n${err.message}`);
            }
        }
    }

    async runMigration(filename) {
        const migrationPath = path.join(this.migrationsPath, filename);
        const migration = require(migrationPath);

        if (!migration.up || typeof migration.up !== 'function') {
            throw new Error(`Migration ${filename} must export an 'up' function`);
        }

        await migration.up(this.db);

        if (this.dbType !== 'mongodb') {
            const params = this.dbType === 'postgres' ? [filename] : [filename];
            const query = this.dbType === 'postgres'
                ? 'INSERT INTO migrations (name) VALUES ($1)'
                : 'INSERT INTO migrations (name) VALUES (?)';
            await this.db.query(query, params);
        }
    }

    async rollbackMigration(filename) {
        const migrationPath = path.join(this.migrationsPath, filename);
        const migration = require(migrationPath);

        if (!migration.down || typeof migration.down !== 'function') {
            throw new Error(`Migration ${filename} must export a 'down' function for rollback`);
        }

        await migration.down(this.db);

        if (this.dbType !== 'mongodb') {
            const query = this.dbType === 'postgres'
                ? 'DELETE FROM migrations WHERE name = $1'
                : 'DELETE FROM migrations WHERE name = ?';
            const params = [filename];
            await this.db.query(query, params);
        }
    }
}

module.exports = MigrationRunner;
