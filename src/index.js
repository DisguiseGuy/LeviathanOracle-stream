import 'dotenv/config';
import pkg, { ActivityType } from 'discord.js';
import fs from 'fs';
import db from './database/db.js';
import { fetchAnimeDetails } from './utils/anilist.js';
import moment from 'moment-timezone';

const { Client, GatewayIntentBits, Collection } = pkg;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.js')); // Change the readdirSync. In my case I seemed to have errors so I changed the path to avoid that.

for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  const command = commandModule.default; // Access the default export
  client.commands.set(command.data.name, command);
}

// Function to check for new anime episodes
async function checkForNewReleases() {
  console.log('Checking for new releases...');
  db.all(`SELECT DISTINCT user_id, anime_id, next_airing_at FROM watchlists`, async (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return;
    }

    console.log(`Found ${rows.length} watchlist entries to check.`);

    for (const row of rows) {
      const currentTime = Date.now();

      // Skip if the next episode hasn't aired yet
      if (row.next_airing_at && row.next_airing_at > currentTime) {
        console.log(`Skipping anime ID ${row.anime_id}, next episode airs at ${new Date(row.next_airing_at).toISOString()}`);
        continue;
      }

      try {
        const animeDetails = await fetchAnimeDetails(row.anime_id); // Fetch by ID

        if (animeDetails.nextAiringEpisode) {
          const episodeNumber = animeDetails.nextAiringEpisode.episode;
          const airingTimestamp = animeDetails.nextAiringEpisode.airingAt * 1000;

          // Update the database with the new airing timestamp
          db.run(
            `UPDATE watchlists SET next_airing_at = ? WHERE user_id = ? AND anime_id = ?`,
            [airingTimestamp, row.user_id, row.anime_id]
          );

          if (currentTime >= airingTimestamp) {
            const user = await client.users.fetch(row.user_id);

            const userTimezone = row.timezone || 'UTC'; // Default to UTC if not set
            const localAiringTime = moment(airingTimestamp).tz(userTimezone).format('YYYY-MM-DD HH:mm:ss');
            console.log(`Notifying user in timezone ${userTimezone}: ${localAiringTime}`);

            const embed = {
              color: 0x0099ff,
              title: `New Episode of ${animeDetails.title.romaji} Released!`,
              description: `Episode ${episodeNumber} is now available!`,
              timestamp: new Date(airingTimestamp),
              thumbnail: { url: animeDetails.coverImage.large },
              footer: { text: 'Episode just released!' },
            };

            user.send({ embeds: [embed] }).then(() => {
              console.log(`Notification sent to ${row.user_id} for ${animeDetails.title.romaji}`);
            }).catch(error => {
              console.error(`Failed to send notification to ${row.user_id}:`, error);
            });
          }
        }
      } catch (error) {
        console.error(`Error processing watchlist entry for anime ID ${row.anime_id}:`, error);
      }
    }
  });
}

client.once('ready', () => {
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: 'Sea of Knowledge',
      type: ActivityType.Listening,
    }],
  });

  console.log(`Logged in as ${client.user.tag}!`);

  // Check for new releases every 30 minutes
  setInterval(checkForNewReleases, 1800000); // 30 minutes interval
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName.toLowerCase());

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);