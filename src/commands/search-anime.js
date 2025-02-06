const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const anilistAPI = 'https://graphql.anilist.co';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from AniList')
    .addStringOption(option =>
      option.setName('anime')
        .setDescription('Anime name')
        .setRequired(true)),
  async execute(interaction) {
    const query = interaction.options.getString('anime');
    await interaction.deferReply();

    const searchQuery = `
      query ($search: String) {
        Page(page: 1, perPage: 10) {
          media(search: $search, type: ANIME) {
            id
            title {
              romaji
              english
            }
            averageScore
            description
            genres
            coverImage {
              large
            }
          }
        }
      }
    `;

    const variables = { search: query };

    try {
      const response = await axios.post(anilistAPI, {
        query: searchQuery,
        variables,
      });

      const animeList = response.data.data.Page.media;

      if (animeList.length === 0) {
        await interaction.editReply('No results found.');
        return;
      }

      const buttons = animeList.map(anime => new ButtonBuilder()
        .setCustomId(`anime_${anime.id}`)
        .setLabel(anime.title.romaji || anime.title.english)
        .setStyle(ButtonStyle.Primary)
      );

      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }

      await interaction.editReply({ content: 'Select an anime to view details:', components: rows });

      const filter = i => i.customId.startsWith('anime_') && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        const animeId = i.customId.split('_')[1];
        const selectedAnime = animeList.find(anime => anime.id == animeId);

        // Log the selected anime to check if genres are available
        console.log(selectedAnime);

        // Clean up the description by removing HTML tags
        const cleanDescription = selectedAnime.description ? selectedAnime.description.replace(/<\/?[^>]+(>|$)/g, "") : 'No description available.';

        // Join genres into a comma-separated string
        const genres = selectedAnime.genres ? selectedAnime.genres.join(', ') : 'No genres available';

        const embed = new EmbedBuilder()
          .setTitle(selectedAnime.title.romaji || selectedAnime.title.english)
          .setURL(`https://anilist.co/anime/${selectedAnime.id}`)
          .setDescription(`**Score**: **${selectedAnime.averageScore}**\n**Genres**: ${genres}\n**Description**: ${cleanDescription}`)
          .setImage(selectedAnime.coverImage.large);

        await i.update({ content: '', embeds: [embed], components: [] });
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'No selection made.', components: [] });
        }
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: 'Failed to fetch anime details.', components: [] });
    }
  },
};