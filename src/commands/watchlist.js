import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
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
        .setDescription('Show your current watchlist')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'add') {
      const title = interaction.options.getString('title');
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

        // Create buttons for selection
        const buttons = animeList.map((anime, index) => {
          let displayTitle = anime.title.english || anime.title.romaji || anime.title.native;
          displayTitle = displayTitle.length > 80 ? displayTitle.substring(0, 77) + '...' : displayTitle;
          return new ButtonBuilder()
            .setCustomId(`add_anime_${anime.id}_${index}`)
            .setLabel(displayTitle)
            .setStyle(ButtonStyle.Primary);
        });

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        await interaction.editReply({ content: 'Select the anime you want to add to your watchlist:', components: rows });

        const filter = i => i.customId.startsWith('add_anime_') && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          try {
            await i.update({ content: 'Adding anime to your watchlist...', components: [] });

            const animeId = i.customId.split('_')[2];
            const selectedAnime = animeList.find(anime => String(anime.id) === animeId);

            if (!selectedAnime) {
              return await i.followUp({ content: 'Anime not found. Please try again.', ephemeral: true });
            }

            const verifiedTitle = selectedAnime.title.romaji || selectedAnime.title.native || selectedAnime.title.english;

            // Check if the anime is already in the watchlist
            db.get(
              `SELECT * FROM watchlists WHERE user_id = ? AND anime_id = ?`,
              [userId, animeId],
              (err, row) => {
                if (err) {
                  console.error('DB Error:', err);
                  const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('Database Error')
                    .setDescription('An error occurred while accessing the database. Please try again later.');
                  return i.followUp({ embeds: [embed], ephemeral: true });
                }

                if (row) {
                  const embed = new EmbedBuilder()
                    .setColor('Yellow')
                    .setTitle('Already in Watchlist')
                    .setDescription(`**${verifiedTitle}** is already in your watchlist.`);
                  return i.followUp({ embeds: [embed], ephemeral: true });
                }

                // Add the anime to the watchlist
                const displayTitle = selectedAnime.title.english || selectedAnime.title.romaji || selectedAnime.title.native;
                const nextAiringAt = selectedAnime.nextAiringEpisode?.airingAt * 1000 || null;

                db.run(
                  `INSERT INTO watchlists (user_id, anime_id, anime_title, next_airing_at) VALUES (?, ?, ?, ?)`,
                  [userId, animeId, displayTitle, nextAiringAt],
                  function(insertErr) {
                    if (insertErr) {
                      console.error('DB Insert Error:', insertErr);
                      const embed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('Error Adding to Watchlist')
                        .setDescription('Could not add the anime to your watchlist. Please try again later.');
                      return i.followUp({ embeds: [embed], ephemeral: true });
                    }

                    const embed = new EmbedBuilder()
                      .setColor('Green')
                      .setTitle('Anime Added')
                      .setDescription(`**${verifiedTitle}** has been added to your watchlist.`);
                    i.followUp({ embeds: [embed], ephemeral: true });
                  }
                );
              }
            );
          } catch (error) {
            console.error('Error adding anime to watchlist:', error);
            const embed = new EmbedBuilder()
              .setColor('Red')
              .setTitle('Error Adding Anime')
              .setDescription('An error occurred while adding the anime to your watchlist. Please try again later.');
            i.followUp({ embeds: [embed], ephemeral: true });
          }
        });

        collector.on('end', async collected => {
          if (collected.size === 0) {
            try {
              await interaction.editReply({ content: 'Watchlist selection timed out.', components: [] });
            } catch (error) {
              console.error("Failed to edit interaction reply on collector end:", error);
            }
          }
        });
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
};