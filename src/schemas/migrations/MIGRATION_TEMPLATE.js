module.exports = {
    up: async (db) => {
        // Write your migration logic here
        // The db object has a .query(sql, params) method
        // Example for PostgreSQL:
        // await db.query('ALTER TABLE users ADD COLUMN new_field VARCHAR(255)');
        
        // Example for SQLite:
        // await db.query('ALTER TABLE users ADD COLUMN new_field TEXT');
    },
    down: async (db) => {
        // Write rollback logic here - revert the changes made in 'up'
        // Example for PostgreSQL:
        // await db.query('ALTER TABLE users DROP COLUMN IF EXISTS new_field');
        
        // Example for SQLite:
        // await db.query('ALTER TABLE users DROP COLUMN new_field');
    }
};
