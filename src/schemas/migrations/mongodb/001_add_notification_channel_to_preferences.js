module.exports = {
    up: async (db) => {
        // MongoDB migration: add notification_channel_id field to all user_preferences documents
        // This is a data transformation migration
        // Example: db.collection('user_preferences').updateMany({}, { $set: { notification_channel_id: null } })
    },
    down: async (db) => {
        // MongoDB rollback: remove notification_channel_id field from all user_preferences documents
        // Example: db.collection('user_preferences').updateMany({}, { $unset: { notification_channel_id: '' } })
    }
};
