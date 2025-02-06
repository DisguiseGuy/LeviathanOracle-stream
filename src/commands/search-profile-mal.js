const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-profile-mal')
    .setDescription('Fetch MyAnimeList user profile')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('MyAnimeList username')
        .setRequired(true)),
  async execute(interaction) {
    const username = interaction.options.getString('username');
    await interaction.deferReply();

    try {
      const userResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}`);
      const userData = userResponse.data.data;

      console.log('User Data:', userData); // Log the user data to verify the structure

      const animeStatsResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/statistics`);
      const animeStats = animeStatsResponse.data.data.anime || {};
      const mangaStats = animeStatsResponse.data.data.manga || {};

      console.log('Anime Stats:', animeStats); // Log the anime stats to verify the structure
      console.log('Manga Stats:', mangaStats); // Log the manga stats to verify the structure

      const embed = new EmbedBuilder()
        .setColor(0x2e51a2)
        .setTitle(`${userData.username}'s MyAnimeList Profile`)
        .setURL(`https://myanimelist.net/profile/${userData.username}`)
        .setThumbnail(userData.images.jpg.image_url)
        .addFields(
          { name: 'Anime Stats', value: `**Total Entries**: ${animeStats.total_entries || 'N/A'}\n**Mean Score**: ${animeStats.mean_score || 'N/A'}\n**Days Watched**: ${animeStats.days_watched || 'N/A'}`, inline: true },
          { name: 'Manga Stats', value: `**Total Entries**: ${mangaStats.total_entries || 'N/A'}\n**Mean Score**: ${mangaStats.mean_score || 'N/A'}\n**Days Read**: ${mangaStats.days_read || 'N/A'}`, inline: true },
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('fav_anime')
            .setLabel('Favorite Anime')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('fav_manga')
            .setLabel('Favorite Manga')
            .setStyle(ButtonStyle.Primary),
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

      const filter = i => i.customId === 'fav_anime' || i.customId === 'fav_manga';
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'fav_anime') {
          try {
            const favAnimeResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/favorites`);
            console.log('Favorite Anime:', favAnimeResponse.data); // Log the favorite anime data to verify the structure
            const favAnime = favAnimeResponse.data.data.anime || [];
            if (!favAnime.length) {
              await i.update({ content: 'No favorite anime found for this user.', components: [] });
              return;
            }

            const favAnimeOptions = favAnime.map(anime => ({
              label: anime.title,
              description: anime.title_english || 'No English title',
              value: anime.mal_id.toString(),
            }));

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('select_fav_anime')
              .setPlaceholder('Select your favorite anime')
              .addOptions(favAnimeOptions);

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            await i.update({ content: '**Select your favorite anime:**', components: [selectRow] });

            const selectFilter = si => si.customId === 'select_fav_anime';
            const selectCollector = interaction.channel.createMessageComponentCollector({ selectFilter, time: 60000 });

            selectCollector.on('collect', async selectInteraction => {
              if (!selectInteraction.values || !selectInteraction.values[0]) {
                await selectInteraction.reply({ content: 'No anime selected.', ephemeral: true });
                return;
              }

              const selectedAnimeId = selectInteraction.values[0];
              const selectedAnime = favAnime.find(anime => anime.mal_id.toString() === selectedAnimeId);

              if (!selectedAnime) {
                await selectInteraction.reply({ content: 'Could not find the selected anime.', ephemeral: true });
                return;
              }

              const animeEmbed = new EmbedBuilder()
                .setColor(0x2e51a2)
                .setTitle(selectedAnime.title)
                .setURL(`https://myanimelist.net/anime/${selectedAnime.mal_id}`)
                .setImage(selectedAnime.images.jpg.image_url)
                .addFields(
                  { name: 'English Title', value: selectedAnime.title_english || 'N/A', inline: true },
                  { name: 'Score', value: selectedAnime.score?.toString() || 'N/A', inline: true },
                );

              await selectInteraction.reply({ embeds: [animeEmbed], ephemeral: true });
            });
          } catch (error) {
            if (error.response && error.response.status === 404) {
              await i.update({ content: 'Favorite anime not found for this user.', components: [] });
            } else {
              console.error(error);
              await i.update({ content: 'Failed to fetch favorite anime.', components: [] });
            }
          }
        } else if (i.customId === 'fav_manga') {
          try {
            const favMangaResponse = await axios.get(`https://api.jikan.moe/v4/users/${username}/favorites`);
            console.log('Favorite Manga:', favMangaResponse.data); // Log the favorite manga data to verify the structure
            const favManga = favMangaResponse.data.data.manga || [];
            if (!favManga.length) {
              await i.update({ content: 'No favorite manga found for this user.', components: [] });
              return;
            }

            const favMangaOptions = favManga.map(manga => ({
              label: manga.title,
              description: manga.title_english || 'No English title',
              value: manga.mal_id.toString(),
            }));

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('select_fav_manga')
              .setPlaceholder('Select your favorite manga')
              .addOptions(favMangaOptions);

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            await i.update({ content: '**Select your favorite manga:**', components: [selectRow] });

            const selectFilter = si => si.customId === 'select_fav_manga';
            const selectCollector = interaction.channel.createMessageComponentCollector({ selectFilter, time: 60000 });

            selectCollector.on('collect', async selectInteraction => {
              if (!selectInteraction.values || !selectInteraction.values[0]) {
                await selectInteraction.reply({ content: 'No manga selected.', ephemeral: true });
                return;
              }

              const selectedMangaId = selectInteraction.values[0];
              const selectedManga = favManga.find(manga => manga.mal_id.toString() === selectedMangaId);

              if (!selectedManga) {
                await selectInteraction.reply({ content: 'Could not find the selected manga.', ephemeral: true });
                return;
              }

              const mangaEmbed = new EmbedBuilder()
                .setColor(0x2e51a2)
                .setTitle(selectedManga.title)
                .setURL(`https://myanimelist.net/manga/${selectedManga.mal_id}`)
                .setImage(selectedManga.images.jpg.image_url)
                .addFields(
                  { name: 'English Title', value: selectedManga.title_english || 'N/A', inline: true },
                  { name: 'Score', value: selectedManga.score?.toString() || 'N/A', inline: true },
                );

              await selectInteraction.reply({ embeds: [mangaEmbed], ephemeral: true });
            });
          } catch (error) {
            if (error.response && error.response.status === 404) {
              await i.update({ content: 'Favorite manga not found for this user.', components: [] });
            } else {
              console.error(error);
              await i.update({ content: 'Failed to fetch favorite manga.', components: [] });
            }
          }
        }
      });

    } catch (error) {
      if (error.response && error.response.status === 404) {
        await interaction.editReply({ content: 'User profile not found.', components: [] });
      } else {
        console.error(error);
        await interaction.editReply({ content: 'Failed to fetch user profile.', components: [] });
      }
    }
  },
};