import 'dotenv/config';
import pkg, { ActivityType } from 'discord.js';
import fs from 'fs';
import db from './database/db.js';
import { fetchAnimeDetailsById } from './utils/anilist.js';

const { Client, GatewayIntentBits, Collection } = pkg;

// Global error handlers to prevent bot from crashing
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();
let commandFiles = [];
try {
  commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.js')); // Change the readdirSync. In my case I seemed to have errors so I changed the path to avoid that.
} catch (err) {
  console.error('Error reading command files:', err);
}

for (const file of commandFiles) {
  try {
    const commandModule = await import(`./commands/${file}`);
    const command = commandModule.default; // Access the default export
    client.commands.set(command.data.name, command);
  } catch (err) {
    console.error(`Failed to load command ${file}:`, err);
  }
}

// --- Scheduler State ---
const scheduledTimeouts = new Map(); // key: watchlist id, value: timeout

// --- Helper: Send Notification ---
async function sendNotification(row, animeDetails, client) {
  const utcAiringTime = new Date(row.next_airing_at).toUTCString();
  const episodeNumber = animeDetails.nextAiringEpisode
    ? animeDetails.nextAiringEpisode.episode - 1
    : 'Latest';
  const embed = {
    color: 0x0099ff,
    title: `New Episode of ${animeDetails.title.english || animeDetails.title.romaji} Released!`,
    description: `Episode ${episodeNumber} is now available!\nAired at: ${utcAiringTime} UTC. Remember that the episode might take some time depending on what platform you are watching.`,
    timestamp: new Date(row.next_airing_at),
    thumbnail: { url: animeDetails.coverImage.large },
    footer: { text: 'Episode just released!' },
  };
  try {
    const user = await client.users.fetch(row.user_id);
    const channel = await user.createDM();
    await channel.send({ embeds: [embed] });
    console.log(`Notification sent to ${row.user_id} (DM) for ${animeDetails.title.english || animeDetails.title.romaji}`);
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

// --- Scheduler: Schedule a notification ---
function scheduleNotification(row, client) {
  const delay = row.next_airing_at - Date.now();
  if (delay <= 0) return; // Already passed, fallback polling will handle
  if (scheduledTimeouts.has(row.id)) clearTimeout(scheduledTimeouts.get(row.id));
  const timeout = setTimeout(async () => {
    try {
      const animeDetails = await fetchAnimeDetailsById(row.anime_id);
      await sendNotification(row, animeDetails, client);
      // Update next airing in DB
      if (
        animeDetails.nextAiringEpisode &&
        animeDetails.nextAiringEpisode.airingAt * 1000 !== row.next_airing_at &&
        animeDetails.nextAiringEpisode.airingAt * 1000 > Date.now()
      ) {
        db.run(
          `UPDATE watchlists SET next_airing_at = ? WHERE id = ?`,
          [animeDetails.nextAiringEpisode.airingAt * 1000, row.id]
        );
        // Reschedule
        row.next_airing_at = animeDetails.nextAiringEpisode.airingAt * 1000;
        scheduleNotification(row, client);
      }
    } catch (e) {
      console.error('Error in scheduled notification:', e);
    }
  }, delay);
  scheduledTimeouts.set(row.id, timeout);
}

// --- Fallback Polling ---
async function fallbackPoll(client, lastPollTime) {
  db.all(`SELECT * FROM watchlists`, async (err, rows) => {
    if (err) return console.error('DB Select Error:', err);
    for (const row of rows) {
      if (row.next_airing_at && row.next_airing_at > lastPollTime && row.next_airing_at <= Date.now()) {
        try {
          const animeDetails = await fetchAnimeDetailsById(row.anime_id);
          await sendNotification(row, animeDetails, client);
          // Update next airing in DB
          if (
            animeDetails.nextAiringEpisode &&
            animeDetails.nextAiringEpisode.airingAt * 1000 !== row.next_airing_at &&
            animeDetails.nextAiringEpisode.airingAt * 1000 > Date.now()
          ) {
            db.run(
              `UPDATE watchlists SET next_airing_at = ? WHERE id = ?`,
              [animeDetails.nextAiringEpisode.airingAt * 1000, row.id]
            );
            row.next_airing_at = animeDetails.nextAiringEpisode.airingAt * 1000;
            scheduleNotification(row, client);
          }
        } catch (e) {
          console.error('Error in fallback poll notification:', e);
        }
      }
    }
  });
}

// --- Restore last poll timestamp ---
function getLastPollTimestamp(cb) {
  db.get(`SELECT value FROM bot_state WHERE key = 'last_poll'`, (err, row) => {
    if (err || !row) cb(0);
    else cb(Number(row.value));
  });
}
function setLastPollTimestamp(ts) {
  db.run(`INSERT OR REPLACE INTO bot_state (key, value) VALUES ('last_poll', ?)`, [String(ts)]);
}

client.once('ready', () => {
  try {
    client.user.setPresence({
      status: 'online',
      activities: [{
        name: 'Sea of Knowledge',
        type: ActivityType.Listening,
      }],
    });
    console.log(`Logged in as ${client.user.tag}!`);

    // --- Rehydrate all scheduled notifications on startup ---
    db.all(`SELECT * FROM watchlists`, (err, rows) => {
      if (err) return console.error('DB Select Error:', err);
      for (const row of rows) {
        if (row.next_airing_at && row.next_airing_at > Date.now()) {
          scheduleNotification(row, client);
        }
      }
    });

    // --- Fallback polling every hour ---
    getLastPollTimestamp((lastPoll) => {
      fallbackPoll(client, lastPoll);
      setLastPollTimestamp(Date.now());
      setInterval(() => {
        getLastPollTimestamp((lastPoll2) => {
          fallbackPoll(client, lastPoll2);
          setLastPollTimestamp(Date.now());
        });
      }, 3600000);
    });
  } catch (err) {
    console.error('Error in ready event:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName.toLowerCase());

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Command execution error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err);
});
