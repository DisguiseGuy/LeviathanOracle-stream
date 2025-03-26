import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import db from './database/db.js';
import { fetchAnimeDetailsById } from './utils/anilist.js';
import { setInterval } from 'timers/promises';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('LeviathanOracle-stream/src/commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  const command = commandModule.default; // Access the default export
  client.commands.set(command.data.name, command);
}

db.run(`
  ALTER TABLE watchlists ADD COLUMN last_notified INTEGER DEFAULT 0
`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding last_notified column:', err);
  }
});

// Function to check for new episodes
async function checkForNewEpisodes() {
  console.log('Checking for new episodes...');
  db.all(`SELECT user_id, anime_id, anime_title, last_notified FROM watchlists`, async (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return;
    }

    for (const row of rows) {
      try {
        const animeDetails = await fetchAnimeDetailsById(row.anime_id);
        if (
          animeDetails.nextAiringEpisode &&
          animeDetails.nextAiringEpisode.timeUntilAiring > 0 && // Exactly at release time
          row.last_notified !== animeDetails.nextAiringEpisode.episode
        ) {
          const user = await client.users.fetch(row.user_id);
          await user.send({
            embeds: [
              {
                color: 0x0099ff,
                title: `New Episode of ${animeDetails.title.romaji} is out!`,
                description: `Episode ${animeDetails.nextAiringEpisode.episode} is now airing!`,
                image: {
                  url: animeDetails.coverImage.large,
                },
              },
            ],
          });

          db.run(
            `UPDATE watchlists SET last_notified = ? WHERE user_id = ? AND anime_id = ?`,
            [animeDetails.nextAiringEpisode.episode, row.user_id, row.anime_id]
          );
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  });
}

client.once('ready', () => {
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: 'Sea of Knowledge',
      type: 'PLAYING'
    }],
  });

  console.log(`Logged in as ${client.user.tag}!`);
  setInterval(checkForNewEpisodes, 900000); // Run every 15 minutes
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName.toLowerCase());

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);