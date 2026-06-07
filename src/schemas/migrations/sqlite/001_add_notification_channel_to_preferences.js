module.exports = {
    up: async (db) => {
        await db.query(`
            ALTER TABLE user_preferences 
            ADD COLUMN notification_channel_id TEXT;
        `);
    },
    down: async (db) => {
        await db.query(`
            ALTER TABLE user_preferences 
            DROP COLUMN notification_channel_id;
        `);
    }
};
