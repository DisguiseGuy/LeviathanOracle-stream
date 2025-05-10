import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Fetch manga details from Jikan API')
    .addStringOption(option =>
      option.setName('manga')
        .setDescription('Manga name')
        .setRequired(true)),
  async execute(interaction) {
    try {
      const query = interaction.options.getString('manga');
      if (!query) {
        await interaction.reply({ content: 'Please provide a manga name.', ephemeral: true });
        return;
      }
      await interaction.deferReply();

      try {
        // GET request to Jikan API for manga search (limit to 10 results)
        const response = await axios.get('https://api.jikan.moe/v4/manga', {
          params: { q: query, limit: 10 },
        });

        const mangaList = response.data.data;
        if (!mangaList || mangaList.length === 0) {
          await interaction.editReply('No results found.');
          return;
        }

        // Create buttons for each manga result using Jikan's mal_id as identifier
        const buttons = mangaList.map(manga =>
          new ButtonBuilder()
            .setCustomId(`manga_${manga.mal_id}`)
            .setLabel(manga.title)
            .setStyle(ButtonStyle.Primary)
        );

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        await interaction.editReply({ content: 'Select a manga to view details:', components: rows });

        const filter = i => i.customId.startsWith('manga_') && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          const mangaId = i.customId.split('_')[1];
          const selectedManga = mangaList.find(manga => String(manga.mal_id) === mangaId);
          if (!selectedManga) {
            await i.reply({ content: 'Manga not found.', ephemeral: true });
            return;
          }

          // Clean up the synopsis by removing HTML tags and limiting its length
          let cleanSynopsis = selectedManga.synopsis
            ? selectedManga.synopsis.replace(/<\/?[^>]+(>|$)/g, '')
            : 'No description available.';
          if (cleanSynopsis.length > 500) {
            cleanSynopsis = cleanSynopsis.substring(0, 500) + '...';
          }

          const embed = new EmbedBuilder()
            .setTitle(selectedManga.title)
            .setURL(selectedManga.url)
            .setDescription(`**Score:** ${selectedManga.score || 'N/A'}\n**Volumes:** ${selectedManga.volumes || 'N/A'}\n**Synopsis:** ${cleanSynopsis}`)
            .setImage(selectedManga.images.jpg.image_url)
            .setColor(0x00AE86);

          await i.update({ content: '', embeds: [embed], components: [] });
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ content: 'No selection made.', components: [] });
          }
        });
      } catch (error) {
        console.error('Error fetching manga from Jikan:', error.response ? error.response.data : error);
        await interaction.editReply({ content: 'Failed to fetch manga details.', components: [] });
      }
    } catch (error) {
      console.error('search-manga command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};