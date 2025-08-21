import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { fetchAnimeDetails, fetchAnimeDetailsById } from '../utils/anilist.js';
import { scheduleNotification } from '../index.js';

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
            .setRequired(true)
            .setAutocomplete(true)))
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
        .setDescription('Show your current watchlist')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'add') {
      const title = interaction.options.getString('title');
  // Quick-add by AniList numeric ID if user provided a number
  const numericId = /^\s*\d+\s*$/;
  if (numericId.test(title)) {
        // Treat title as numeric AniList ID and fetch details directly
        const animeId = Number(title.trim());
        await interaction.deferReply({ ephemeral: true });
        try {
          const selectedAnime = await fetchAnimeDetailsById(animeId);
          if (!selectedAnime) {
            return interaction.editReply({ content: 'Could not find anime with that AniList ID.', ephemeral: true });
          }
          // Insert directly (avoid duplicate)
          db.get(`SELECT * FROM watchlists WHERE user_id = ? AND anime_id = ?`, [userId, animeId], (err, row) => {
            if (err) {
              console.error('DB Error:', err);
              return interaction.editReply({ content: 'Database error while adding.', ephemeral: true });
            }
            if (row) return interaction.editReply({ content: 'Anime already in watchlist.', ephemeral: true });
            const displayTitle = selectedAnime.title.english || selectedAnime.title.romaji || selectedAnime.title.native;
            const nextAiringAt = selectedAnime.nextAiringEpisode?.airingAt * 1000 || null;
            db.run(`INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES (?, ?, ?, ?)`, [userId, animeId, displayTitle, nextAiringAt], function(insertErr) {
              if (insertErr) {
                console.error('DB Insert Error:', insertErr);
                return interaction.editReply({ content: 'Failed to add to watchlist.', ephemeral: true });
              }
              if (nextAiringAt) {
                const newRow = { id: this.lastID, user_id: userId, anime_id: animeId, anime_title: displayTitle, next_airing_at: nextAiringAt };
                scheduleNotification(newRow, interaction.client);
              }
              return interaction.editReply({ content: `**${displayTitle}** added to your watchlist.`, ephemeral: true });
            });
          });
        } catch (err) {
          console.error('Error fetching by ID:', err);
          return interaction.editReply({ content: 'Error fetching anime details by ID.', ephemeral: true });
        }
        // After handling numeric quick-add, stop further processing
        return;
      }
      await interaction.deferReply();

      try {
        // Fetch anime details from AniList API
        const animeList = await fetchAnimeDetails(title); // Modify fetchAnimeDetails to return multiple results if needed

        if (!Array.isArray(animeList) || animeList.length === 0) {
          const embed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('No Results Found')
            .setDescription('No anime found with the provided title. Please try again with a different title.');
          return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Instead of interactive buttons, present a compact selection embed and instruct
        // the user to either re-run with the AniList ID (quick-add) or use autocomplete
        // in the /watchlist add command for faster selection.
        const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
        const embed = new EmbedBuilder()
          .setTitle('Search results (use autocomplete or quick-add by ID)')
          .setColor(0x00AE86)
          .setDescription('This command no longer uses interactive buttons. Use the autocomplete suggestions or pass a numeric AniList ID to add directly.')
          .setTimestamp();

        for (let i = 0; i < Math.min(10, animeList.length); i++) {
          const a = animeList[i];
          const displayTitle = a.title.english || a.title.romaji || a.title.native || `#${a.id}`;
          const short = truncate(displayTitle, 80);
          embed.addFields({ name: `${i + 1}. ${short}`, value: `AniList ID: ${a.id}` });
        }

        await interaction.editReply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Error fetching anime details:', error);
        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('Error Fetching Anime')
          .setDescription('An error occurred while fetching anime details. Please try again later.');
        await interaction.editReply({ embeds: [embed], ephemeral: true });
      }
    } else if (subcommand === 'remove') {
      const inputTitle = interaction.options.getString('title').toLowerCase();
      // Defer the reply ephemerally as all responses in this block are ephemeral
      await interaction.deferReply({ ephemeral: true });

      // Fetch all watchlist entries for the user
      db.all(
        `SELECT anime_id, anime_title FROM watchlists WHERE user_id = ?`,
        [userId],
        async (err, rows) => {
          if (err) {
            console.error('DB Select Error:', err);
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setTitle('Error Removing Anime')
              .setDescription('An error occurred while accessing your watchlist.');
            return interaction.editReply({ embeds: [embed] });
          }

          // Find a match by comparing input to anime_title (case-insensitive, partial match)
          const inputWords = inputTitle.split(/\s+/).filter(Boolean);
          const matchedRow = rows.find(row => {
            const titleLower = row.anime_title.toLowerCase();
            return inputWords.every(word => titleLower.includes(word));
          });

          // If not found, try fetching AniList details for more title variants
          if (!matchedRow) {
            // Try to find by fetching AniList details for each anime_id
            for (const row of rows) {
              try {
                const animeDetails = await fetchAnimeDetails(row.anime_title);
                const possibleTitles = [
                  animeDetails.title.english,
                  animeDetails.title.romaji,
                  animeDetails.title.native
                ].filter(Boolean).map(t => t.toLowerCase());

                // Partial match for any title variant
                if (possibleTitles.some(title => inputWords.every(word => title.includes(word)))) {
                  // Found a match, remove it
                  db.run(
                    `DELETE FROM watchlists WHERE user_id = ? AND anime_id = ?`,
                    [userId, row.anime_id],
                    function (delErr) {
                      if (delErr) {
                        console.error('DB Delete Error:', delErr);
                        const embed = new EmbedBuilder()
                          .setColor('Red')
                          .setTitle('Error Removing Anime')
                          .setDescription('An error occurred while removing the anime from your watchlist.');
                        return interaction.editReply({ embeds: [embed] });
                      }
                      const embed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('Anime Removed')
                        .setDescription(`**${row.anime_title}** has been removed from your watchlist.`);
                      return interaction.editReply({ embeds: [embed] });
                    }
                  );
                  return;
                }
              } catch (fetchErr) {
                // Ignore fetch errors and continue
              }
            }

            // No match found
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Anime Not Found')
              .setDescription(`No matching anime found in your watchlist for **${inputTitle}**.`);
            return interaction.editReply({ embeds: [embed] });
          }

          // If found by anime_title, remove it
          db.run(
            `DELETE FROM watchlists WHERE user_id = ? AND anime_id = ?`,
            [userId, matchedRow.anime_id],
            function (delErr) {
              if (delErr) {
                console.error('DB Delete Error:', delErr);
                const embed = new EmbedBuilder()
                  .setColor('Red')
                  .setTitle('Error Removing Anime')
                  .setDescription('An error occurred while removing the anime from your watchlist.');
                return interaction.editReply({ embeds: [embed] });
              }
              const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('Anime Removed')
                .setDescription(`**${matchedRow.anime_title}** has been removed from your watchlist.`);
              return interaction.editReply({ embeds: [embed] });
            }
          );
        }
      );
    } else if (subcommand === 'show') {
      // Defer the reply ephemerally as all responses in this block are ephemeral
      await interaction.deferReply({ ephemeral: true });

      db.all(
        `SELECT anime_title FROM watchlists WHERE user_id = ?`,
        [userId],
        async (err, rows) => {
          if (err) {
            console.error('DB Select Error:', err);
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setTitle('Error Fetching Watchlist')
              .setDescription('An error occurred while fetching your watchlist. Please try again later.');
            return interaction.editReply({ embeds: [embed] });
          }

          if (!rows || rows.length === 0) {
            const embed = new EmbedBuilder()
              .setColor('Yellow')
              .setTitle('Watchlist Empty')
              .setDescription('Your watchlist is currently empty.');
            return interaction.editReply({ embeds: [embed] });
          }

          const watchlistDisplay = rows
            .map((row, i) => `${i + 1}. **${row.anime_title}**`)
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('Your Watchlist')
            .setDescription(watchlistDisplay);
          interaction.editReply({ embeds: [embed] });
        }
      );
    }
  }
,

  // Autocomplete handler for the "title" option on the add subcommand
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value;
      // If user typed a numeric ID, suggest that as a direct-add option
      if (/^\d+$/.test(value)) {
        await interaction.respond([
          { name: `Add AniList ID ${value}`, value: value }
        ]);
        return;
      }

      // Otherwise, call AniList search for suggestions
      const results = await fetchAnimeDetails(value);
      if (!Array.isArray(results) || results.length === 0) {
        await interaction.respond([]);
        return;
      }

      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const suggestions = results.slice(0, 25).map(a => {
        const titleEnglish = a.title?.english || a.title?.romaji || a.title?.native || `#${a.id}`;
        const name = truncate(titleEnglish, 100);
        return { name: name, value: String(a.id) };
      });

      await interaction.respond(suggestions);
    } catch (err) {
      console.error('Watchlist autocomplete error:', err);
    }
  }
};