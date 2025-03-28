import { SlashCommandBuilder } from '@discordjs/builders';
import db from '../database/db.js';
import { fetchAnimeDetails } from '../utils/anilist.js';

export default {
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add anime to your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to add')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove anime from your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to remove')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show your current watchlist'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-timezone')
        .setDescription('Set your timezone')
        .addStringOption(option =>
          option.setName('timezone')
            .setDescription('Your timezone (e.g., UTC, America/New_York)')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'add') {
      const title = interaction.options.getString('title');
      db.get(
        `SELECT * FROM watchlists WHERE user_id = ? AND anime_title = ?`,
        [userId, title],
        async (err, row) => {
          if (err) {
            console.error('DB Error:', err);
            return interaction.reply({
              content: 'Database error. Please try again later.',
              ephemeral: true
            });
          }
          if (row) {
            return interaction.reply({
              content: `**${title}** is already in your watchlist.`,
              ephemeral: true
            });
          }

          try {
            const animeDetails = await fetchAnimeDetails(title);
            if (!animeDetails) {
              return interaction.reply({
                content: 'Anime not found. Please check the title and try again.',
                ephemeral: true
              });
            }

            const verifiedTitle = animeDetails.title.romaji || animeDetails.title.english || title;
            const nextAiringAt = animeDetails.nextAiringEpisode?.airingAt * 1000 || null;
            const animeId = animeDetails.id; // Fetch the anime ID from AniList

            db.run(
              `INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES (?, ?, ?, ?)`,
              [userId, animeId, verifiedTitle, nextAiringAt],
              function(insertErr) {
                if (insertErr) {
                  console.error('DB Insert Error:', insertErr);
                  return interaction.reply({
                    content: 'Could not add to watchlist. Please try again later.',
                    ephemeral: true
                  });
                }
                interaction.reply({
                  content: `**${verifiedTitle}** has been added to your watchlist.`,
                  ephemeral: true
                });
              }
            );
          } catch (error) {
            return interaction.reply({
              content: 'Error fetching anime details. Please try again later.',
              ephemeral: true
            });
          }
        }
      );
    } else if (subcommand === 'remove') {
      const title = interaction.options.getString('title');
      db.run(
        `DELETE FROM watchlists WHERE user_id = ? AND anime_title = ?`,
        [userId, title],
        function(err) {
          if (err) {
            console.error('DB Delete Error:', err);
            return interaction.reply({
              content: 'Error removing anime from watchlist.',
              ephemeral: true
            });
          }
          if (this.changes > 0) {
            interaction.reply({
              content: `**${title}** has been removed from your watchlist.`,
              ephemeral: true
            });
          } else {
            interaction.reply({
              content: `**${title}** is not in your watchlist.`,
              ephemeral: true
            });
          }
        }
      );
    } else if (subcommand === 'show') {
      db.all(
        `SELECT anime_title FROM watchlists WHERE user_id = ?`,
        [userId],
        async (err, rows) => {
          if (err) {
            console.error('DB Select Error:', err);
            return interaction.reply({
              content: 'Error reading watchlist from database.',
              ephemeral: true
            });
          }

          if (!rows || rows.length === 0) {
            return interaction.reply({
              content: 'Your watchlist is empty.',
              ephemeral: true
            });
          }

          const watchlistDisplay = rows
            .map((row, i) => `${i + 1}. **${row.anime_title}**`)
            .join('\n');

          interaction.reply({
            content: `Your watchlist:\n${watchlistDisplay}`,
            ephemeral: true
          });
        }
      );
    }
  }
};