import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const clientId = process.env.DISCORD_BOT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;

console.log('Client ID:', clientId);
console.log('Guild ID:', guildId);
console.log('Token:', token ? 'Loaded' : 'Not Loaded');

const rest = new REST({ version: '9' }).setToken(token);

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