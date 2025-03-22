import { SlashCommandBuilder } from '@discordjs/builders';
import db from '../database/db.js';
import { fetchAnimeDetails } from '../utils/anilist.js';

export default {
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your anime watchlist')
    // /watchlist add <title>
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add anime to your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to add')
            .setRequired(true)))
    // /watchlist remove <title>
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove anime from your watchlist')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Anime title to remove')
            .setRequired(true)))
    // /watchlist show
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show your current watchlist')),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'add') {
      const title = interaction.options.getString('title');
      // Check if the user already has this anime
      db.get(
        `SELECT * FROM watchlists WHERE user_id = ? AND anime_title = ?`,
        [userId, title],
        async (err, row) => {
          if (err) {
            console.error('DB Error:', err);
            return interaction.reply({
              content: 'Database error. Please try again later.',
              ephemeral: false
            });
          }
          if (row) {
            // Already in watchlist
            return interaction.reply({
              embeds: [
                {
                  color: 0xff9900,
                  title: 'Watchlist Update',
                  description: `**${title}** is already in your watchlist.`
                }
              ],
              ephemeral: false
            });
          }

          // Fetch anime details from AniList
          try {
            const animeDetails = await fetchAnimeDetails(title);
            if (!animeDetails) {
              return interaction.reply({
                content: 'Anime not found. Please check the title and try again.',
                ephemeral: false
              });
            }

            // Verify the title before adding it to the database
            const verifiedTitle = animeDetails.title.romaji || animeDetails.title.english || title;

            // Not found yet, insert it
            db.run(
              `INSERT INTO watchlists (user_id, anime_title) VALUES (?, ?)`,
              [userId, verifiedTitle],
              function(insertErr) {
                if (insertErr) {
                  console.error('DB Insert Error:', insertErr);
                  return interaction.reply({
                    content: 'Could not add to watchlist. Please try again later.',
                    ephemeral: false
                  });
                }
                // Successfully added
                interaction.reply({
                  embeds: [
                    {
                      color: 0x00ff00,
                      title: 'Watchlist Update',
                      description: `**${verifiedTitle}** has been added to your watchlist.`
                    }
                  ],
                  ephemeral: false
                });
              }
            );
          } catch (error) {
            return interaction.reply({
              content: 'Error fetching anime details. Please try again later.',
              ephemeral: false
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
              ephemeral: false
            });
          }
          if (this.changes > 0) {
            // Actually removed something
            interaction.reply({
              embeds: [
                {
                  color: 0xff0000,
                  title: 'Watchlist Update',
                  description: `**${title}** has been removed from your watchlist.`
                }
              ],
              ephemeral: false
            });
          } else {
            // Nothing was removed (anime wasn’t in watchlist)
            interaction.reply({
              embeds: [
                {
                  color: 0xff0000,
                  title: 'Watchlist Update',
                  description: `**${title}** is not in your watchlist.`
                }
              ],
              ephemeral: false
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
              ephemeral: false
            });
          }

          if (!rows || rows.length === 0) {
            return interaction.reply({
              embeds: [
                {
                  color: 0x0099ff,
                  title: 'Your Watchlist',
                  description: 'Your watchlist is empty.'
                }
              ],
              ephemeral: false
            });
          }

          // Build a display string
          const watchlistDisplay = rows
            .map((row, i) => `${i + 1}. **${row.anime_title}**`)
            .join('\n');

          interaction.reply({
            embeds: [
              {
                color: 0x0099ff,
                title: 'Your Watchlist',
                description: watchlistDisplay
              }
            ],
            ephemeral: false
          });
        }
      );
    }
  }
};