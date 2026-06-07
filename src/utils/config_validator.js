const fs = require('fs');
const path = require('path');

const validateConfig = () => {
    const configPath = path.join(__dirname, '../../config.json');
    
    if (!fs.existsSync(configPath)) {
        throw new Error('config.json not found');
    }

    let config;
    try {
        config = require(configPath);
    } catch (e) {
        throw new Error(`Invalid config.json: ${e.message}`);
    }

    const errors = [];

    // Bot config
    if (!config.bot) {
        errors.push('Missing bot configuration');
    } else {
        if (!config.bot.token || typeof config.bot.token !== 'string' || config.bot.token === 'DISCORD_TOKEN_HERE') {
            errors.push('bot.token is REQUIRED - Set your Discord bot token');
        }
        if (!config.bot.id || typeof config.bot.id !== 'string' || config.bot.id === 'DISCORD_BOT_ID_HERE') {
            errors.push('bot.id is REQUIRED - Set your Discord bot ID');
        }
        if (!Array.isArray(config.bot.admins) || config.bot.admins.length === 0) {
            errors.push('bot.admins is REQUIRED - Provide at least one admin Discord ID');
        }
        if (!Array.isArray(config.bot.ownerId) || config.bot.ownerId.length === 0) {
            errors.push('bot.ownerId is REQUIRED - Provide at least one owner Discord ID');
        }
    }

    // Prefix config
    if (!config.prefix || !config.prefix.value || typeof config.prefix.value !== 'string') {
        errors.push('prefix.value is REQUIRED - Set a bot command prefix (e.g., "!")');
    }

    // API tokens
    if (!config.apitokens) {
        errors.push('apitokens configuration is REQUIRED');
    } else if (!config.apitokens.animeschedule || config.apitokens.animeschedule === 'ANIMESCHEDULE_API_TOKEN_HERE') {
        errors.push('apitokens.animeschedule is REQUIRED - Get your AnimeSchedule API token');
    }

    // Database config (validate only if enabled)
    if (config.database) {
        if (config.database.postgresql?.enabled === true) {
            const pg = config.database.postgresql.config;
            if (!pg || !pg.host || !pg.port || !pg.database || !pg.user || !pg.password) {
                errors.push('PostgreSQL is enabled but missing required config - Provide host, port, database, user, and password');
            }
        }
        if (config.database.redis?.enabled === true) {
            const redis = config.database.redis.config;
            if (!redis || !redis.host || !redis.port) {
                errors.push('Redis is enabled but missing required config - Provide host and port');
            }
        }
    }

    // Logging config (optional but validate if present)
    if (config.logging) {
        if (config.logging.errorLogs && typeof config.logging.errorLogs !== 'string') {
            errors.push('logging.errorLogs must be a valid webhook URL');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }

    return true;
};

module.exports = { validateConfig };
