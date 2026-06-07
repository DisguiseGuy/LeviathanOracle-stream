module.exports = {
    up: async (db) => {
        await db.query(`
            ALTER TABLE user_preferences 
            ADD COLUMN IF NOT EXISTS notification_channel_id VARCHAR(255);
        `);
    },
    down: async (db) => {
        await db.query(`
            ALTER TABLE user_preferences 
            DROP COLUMN IF EXISTS notification_channel_id;
        `);
    }
};
