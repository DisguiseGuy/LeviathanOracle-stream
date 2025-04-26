import 'dotenv/config';
import pkg, { ActivityType } from 'discord.js';
import fs from 'fs';
import db from './database/db.js';
import { fetchAnimeDetailsById } from './utils/anilist.js';

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

      // 1. Check if the stored timestamp has been reached or passed
      if (row.next_airing_at && currentTime >= row.next_airing_at) {
        try {
          // 2. Fetch latest anime details only if the episode might have aired
          const animeDetails = await fetchAnimeDetailsById(row.anime_id);

          // Check if fetch was successful (assuming fetchAnimeDetailsById returns null/undefined on error or if details are missing)
          if (!animeDetails) {
            console.error(`Failed to fetch details for anime ID ${row.anime_id}. Skipping.`);
            continue; // Skip to the next watchlist entry
          }

          // 3. Notify the user for the episode that just aired
          const user = await client.users.fetch(row.user_id);

          // Format time as UTC string (Discord will localize)
          const utcAiringTime = new Date(row.next_airing_at).toUTCString();

          const episodeNumber = animeDetails.nextAiringEpisode
            ? animeDetails.nextAiringEpisode.episode - 1 // Previous episode just aired
            : 'Latest';

          const embed = {
            color: 0x0099ff,
            title: `New Episode of ${animeDetails.title.english || animeDetails.title.romaji} Released!`,
            description: `Episode ${episodeNumber} is now available!\nAired at: ${utcAiringTime} UTC`,
            timestamp: new Date(row.next_airing_at),
            thumbnail: { url: animeDetails.coverImage.large },
            footer: { text: 'Episode just released!' },
          };

          await user.send({ embeds: [embed] });
          console.log(`Notification sent to ${row.user_id} for ${animeDetails.title.english || animeDetails.title.romaji}`);

          // 4. Update the DB with the new next airing timestamp, if it's in the future and different
          if (
            animeDetails.nextAiringEpisode &&
            animeDetails.nextAiringEpisode.airingAt * 1000 !== row.next_airing_at &&
            animeDetails.nextAiringEpisode.airingAt * 1000 > currentTime
          ) {
            db.run(
              `UPDATE watchlists SET next_airing_at = ? WHERE user_id = ? AND anime_id = ?`,
              [animeDetails.nextAiringEpisode.airingAt * 1000, row.user_id, row.anime_id]
            );
          }
        } catch (error) {
          console.error(`Error processing watchlist entry for anime ID ${row.anime_id}:`, error);
        }
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

  // Check for new releases every hour
  setInterval(checkForNewReleases, 3600000); // 1 hour interval
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
