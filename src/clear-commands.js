const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config(); // Load environment variables from .env file

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;

console.log('Client ID:', clientId);
console.log('Guild ID:', guildId);
console.log('Token:', token ? 'Loaded' : 'Not Loaded');

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started clearing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] },
        );

        console.log('Successfully cleared application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();