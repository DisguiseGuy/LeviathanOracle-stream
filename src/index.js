import 'dotenv/config';
import pkg from 'discord.js';
import fs from 'fs';
import db from './database/db.js';
import { fetchAnimeDetails } from './utils/anilist.js';
import { fetchMangaDetails } from './utils/querry.js';
import { setInterval } from 'timers/promises';
import { handleButtonInteraction } from './utils/anime-schedule.js';

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
const commandFiles = fs.readdirSync('./LeviathanOracle-stream/src/commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  const command = commandModule.default;
  client.commands.set(command.data.name, command);
}

async function checkForNewReleases() {
  console.log('Checking for new releases...');
  db.all(`SELECT DISTINCT user_id, anime_title, manga_title FROM watchlists`, async (err, rows) => {
    if (err) {
      console.error('DB Select Error:', err);
      return;
    }

    console.log(`Found ${rows.length} watchlist entries to check.`);

    for (const row of rows) {
      try {
        if (row.anime_title) {
          console.log(`Fetching details for anime: ${row.anime_title}`);
          const animeDetails = await fetchAnimeDetails(row.anime_title);
          if (animeDetails.nextAiringEpisode && animeDetails.nextAiringEpisode.timeUntilAiring < 3600) {
            console.log(`New episode of ${animeDetails.title.romaji} airing soon!`);
            const user = await client.users.fetch(row.user_id);
            user.send({
              embeds: [
                {
                  color: 0x0099ff,
                  title: `New Episode of ${animeDetails.title.romaji}`,
                  description: `Episode ${animeDetails.nextAiringEpisode.episode} is airing soon!`,
                  image: {
                    url: animeDetails.coverImage.large,
                  },
                },
              ],
            });
          } else {
            console.log(`No new episodes for ${row.anime_title} within the next hour.`);
          }
        }

        if (row.manga_title) {
          console.log(`Fetching details for manga: ${row.manga_title}`);
          const mangaDetails = await fetchMangaDetails(row.manga_title);
          if (mangaDetails.chapters && mangaDetails.chapters.length > 0) {
            const latestChapter = mangaDetails.chapters[0];
            console.log(`New chapter of ${mangaDetails.title.romaji} is out: Chapter ${latestChapter.chapter}`);
            const user = await client.users.fetch(row.user_id);
            user.send({
              embeds: [
                {
                  color: 0x0099ff,
                  title: `New Chapter of ${mangaDetails.title.romaji}`,
                  description: `Chapter ${latestChapter.chapter} is out now!`,
                  image: {
                    url: mangaDetails.coverImage.large,
                  },
                },
              ],
            });
          } else {
            console.log(`No new chapters for ${row.manga_title} available.`);
          }
        }
      } catch (error) {
        console.error('Error fetching details:', error);
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
  setInterval(checkForNewReleases, 3600000);
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
  } else {
    await handleButtonInteraction(interaction);
  }
});

client.login(process.env.DISCORD_TOKEN);