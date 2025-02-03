require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;

if (!clientId || !guildId || !token) {
  console.error('Error: DISCORD_CLIENT_ID, GUILD_ID, and DISCORD_TOKEN must be set in the .env file.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (!command.data) {
      console.error(`Error: Command ${file} is missing a data property.`);
      continue;
    }
    commands.push(command.data.toJSON());
  } catch (error) {
    console.error(`Error: Failed to load command ${file}.`, error);
  }
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error: Failed to register commands.', error);
  }
})();