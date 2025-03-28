import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';

const commands = [];
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  const command = commandModule.default; // Get the default export
  if (command?.data) {  // Check if command and data exist
    commands.push(command.data.toJSON());
  } else {
    console.warn(`Command file ${file} is missing required data property`);
  }
}

// Register commands globally
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Started refreshing application (/) commands.');

  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_BOT_ID),
    { body: commands },
  );

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}