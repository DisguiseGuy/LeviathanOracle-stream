import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('search-manga')
    .setDescription('Fetch manga details from Jikan API')
    .addStringOption(option =>
      option.setName('manga')
        .setDescription('Manga name')
        .setRequired(true)
        .setAutocomplete(true)),
  async execute(interaction) {
    try {
      const query = interaction.options.getString('manga');
      if (!query) {
        await interaction.reply({ content: 'Please provide a manga name.', ephemeral: true });
        return;
      }
      // If the field contains only digits, treat it as a MAL id (user selected autocomplete suggestion)
      if (/^\s*\d+\s*$/.test(query)) {
        const malId = query.trim();
        try {
          await interaction.deferReply();
          const fullResp = await axios.get(`https://api.jikan.moe/v4/manga/${malId}/full`, { timeout: 5000 });
          const manga = fullResp.data.data;
          let cleanSynopsis = manga.synopsis ? manga.synopsis.replace(/<[^>]*>/g, '') : 'No description available.';
          if (cleanSynopsis.length > 1000) cleanSynopsis = cleanSynopsis.substring(0, 1000) + '...';

          const embed = new EmbedBuilder()
            .setTitle(manga.title || `#${manga.mal_id}`)
            .setURL(manga.url)
            .setDescription(
              `**Score:** ${manga.score || 'N/A'}\n` +
              `**Volumes:** ${manga.volumes || 'N/A'}\n` +
              `**Status:** ${manga.status || 'N/A'}\n\n` +
              `**Synopsis:** ${cleanSynopsis}`
            )
            .setColor(0x00AE86);
          if (manga.images?.jpg?.image_url) embed.setImage(manga.images.jpg.image_url);

          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error('Error fetching manga by MAL id:', err.response ? err.response.data : err);
          try { await interaction.editReply({ content: 'Failed to fetch manga details for the selected suggestion.', ephemeral: true }); } catch (e) { try { await interaction.reply({ content: 'Failed to fetch manga details for the selected suggestion.', ephemeral: true }); } catch {} }
        }
        return;
      }

      // Non-numeric search: show a compact list embed (no interactive buttons)
      await interaction.deferReply();
      try {
        // GET request to Jikan API for manga search (limit to 10 results)
        const response = await axios.get('https://api.jikan.moe/v4/manga', {
          params: { q: query, limit: 10 },
          timeout: 5000
        });

        const mangaList = response.data.data;
        if (!mangaList || mangaList.length === 0) {
          await interaction.editReply('No results found.');
          return;
        }

        const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
        const embed = new EmbedBuilder()
          .setTitle(`Search results for "${truncate(query, 80)}"`)
          .setColor(0x00AE86)
          .setTimestamp();

        for (let i = 0; i < Math.min(10, mangaList.length); i++) {
          const a = mangaList[i];
          const name = a.title || a.title_english || `#${a.mal_id}`;
          const synopsis = truncate((a.synopsis || '').replace(/<[^>]*>/g, ''), 200) || 'No synopsis available.';
          embed.addFields({ name: `${i + 1}. ${truncate(name, 80)}`, value: `${synopsis}\n${a.url}` });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error fetching manga from Jikan:', error.response ? error.response.data : error);
        try { await interaction.editReply({ content: 'Failed to fetch manga details.', components: [] }); } catch (e) { try { await interaction.reply({ content: 'Failed to fetch manga details.', ephemeral: true }); } catch {} }
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
  
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const value = focused.value;
      if (!value || value.length === 0) {
        await interaction.respond([]);
        return;
      }

      const resp = await axios.get('https://api.jikan.moe/v4/manga', { params: { q: value, limit: 25 }, timeout: 2500 });
      const list = resp.data.data || [];
      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const suggestions = list.slice(0, 25).map(a => {
        const titleEnglish = a.title_english || a.title || `#${a.mal_id}`;
        const rawName = `${titleEnglish}${a.year ? ` (${a.year})` : ''}`.trim();
        const name = truncate(rawName, 100);
        return { name: name || `#${a.mal_id}`, value: String(a.mal_id) };
      });

      if (suggestions.length === 0) {
        await interaction.respond([]);
        return;
      }

      await interaction.respond(suggestions);
    } catch (err) {
      console.error('search-manga autocomplete error:', err);
      try { await interaction.respond([]); } catch (e) {}
    }
  },
};