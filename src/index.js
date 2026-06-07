const { DiscoBase } = require('discobase-core');
const { GatewayIntentBits, MessageFlags } = require('discord.js');
const path = require('path');
const db = require('./schemas/db');
const scheduler = require('./functions/notificationScheduler');
const { validateConfig } = require('./utils/config-validator');

validateConfig();

const bot = new DiscoBase({
    clientOptions: {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ]
    }
});

const client = bot.getClient();
const cache = new Map();

const getLevelRole = async (guildId) => {
    const cached = cache.get(guildId);
    if (cached && Date.now() - cached.ts < 60000) return cached.roleId;

    const { rows } = await db.query('SELECT level_role_id FROM guild_settings WHERE guild_id = $1', [guildId]);
    const roleId = rows[0]?.level_role_id || null;
    cache.set(guildId, { roleId, ts: Date.now() });
    return roleId;
};

const wrap = (commands, isPrefix) => {
    for (const [, cmd] of commands) {
        if (cmd.userPermissions?.includes('ManageGuild')) continue;
        const original = cmd.execute;

        cmd.execute = async (...args) => {
            const ctx = args[0];
            const roleId = ctx.guild ? await getLevelRole(ctx.guild.id) : null;

            if (roleId && !ctx.member.roles.cache.has(roleId)) {
                const content = `You need the <@&${roleId}> role to use bot commands.`;
                return isPrefix ? ctx.reply(content) : ctx.reply({ content, flags: MessageFlags.Ephemeral });
            }
            return original.apply(cmd, args);
        };
    }
};

client.once('clientReady', async () => {
    try {
        await db.initializeMigrations();
    } catch (err) {
        console.error('Failed to run migrations:', err);
        process.exit(1);
    }
    
    scheduler.initialize(client);
    
    wrap(client.commands || [], false);
    wrap(client.prefix || [], true);
});

bot.start();
