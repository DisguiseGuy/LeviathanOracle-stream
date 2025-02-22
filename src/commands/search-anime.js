import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from Jikan API')
    .addStringOption(option =>
      option.setName('anime')
        .setDescription('Anime name')
        .setRequired(true)),
  async execute(interaction) {
    const query = interaction.options.getString('anime');
    if (!query) {
      await interaction.reply({ content: 'Please provide an anime name.', ephemeral: true });
      return;
    }
    await interaction.deferReply();

    try {
      // GET request to Jikan API for anime search (limit to 10 results)
      const response = await axios.get('https://api.jikan.moe/v4/anime', {
        params: { q: query, limit: 10 },
      });

      const animeList = response.data.data;
      if (!animeList || animeList.length === 0) {
        await interaction.editReply('No results found.');
        return;
      }

      // Create buttons for each anime result using Jikan's mal_id as identifier
      const buttons = animeList.map(anime =>
        new ButtonBuilder()
          .setCustomId(`anime_${anime.mal_id}`)
          .setLabel(anime.title)
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
        const selectedAnime = animeList.find(anime => String(anime.mal_id) === animeId);

        if (!selectedAnime) {
          await i.reply({ content: 'Anime not found.', ephemeral: true });
          return;
        }

        // Clean up the synopsis by removing HTML tags and limiting its length
        let cleanSynopsis = selectedAnime.synopsis
          ? selectedAnime.synopsis.replace(/<\/?[^>]+(>|$)/g, '')
          : 'No description available.';
        if (cleanSynopsis.length > 500) {
          cleanSynopsis = cleanSynopsis.substring(0, 500) + '...';
        }

        const embed = new EmbedBuilder()
          .setTitle(selectedAnime.title)
          .setURL(selectedAnime.url)
          .setDescription(`**Score:** ${selectedAnime.score || 'N/A'}\n**Episodes:** ${selectedAnime.episodes || 'N/A'}\n**Synopsis:** ${cleanSynopsis}`)
          .setImage(selectedAnime.images.jpg.image_url)
          .setColor(0x00AE86);

        await i.update({ content: '', embeds: [embed], components: [] });
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'No selection made.', components: [] });
        }
      });
    } catch (error) {
      console.error('Error fetching anime from Jikan:', error.response ? error.response.data : error);
      await interaction.editReply({ content: 'Failed to fetch anime details.', components: [] });
    }
  },
};