import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

// AnimeSchedule API Configuration for fetching timetable
const API_KEY = process.env.ANIMESCHEDULE_TOKEN;
const BASE_URL = 'https://animeschedule.net/api/v3';

export default {
  data: new SlashCommandBuilder()
    .setName('search-anime')
    .setDescription('Fetch anime details from Jikan API')
    .addStringOption(option =>
      option.setName('anime')
        .setDescription('Anime name')
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction) {
    const query = interaction.options.getString('anime');
    if (!query) {
      await interaction.reply({ content: 'Please provide an anime name.', ephemeral: true });
      return;
    }

    // If the field contains only digits, treat it as a MAL id (user selected autocomplete suggestion)
    if (/^\s*\d+\s*$/.test(query)) {
      const malId = query.trim();
      try {
        await interaction.deferReply();
        const fullResp = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/full`, { timeout: 5000 });
        const anime = fullResp.data.data;
        let cleanSynopsis = anime.synopsis ? anime.synopsis.replace(/<[^>]*>/g, '') : 'No description available.';
        if (cleanSynopsis.length > 1000) cleanSynopsis = cleanSynopsis.substring(0, 1000) + '...';
        let status = anime.status || 'Unknown';
        let nextEpisode = '';
        if (status.toLowerCase() === 'currently airing') {
          try {
            const timetableResponse = await axios.get(`${BASE_URL}/timetables/sub`, { headers: { 'Authorization': `Bearer ${API_KEY}` }, timeout: 3000 });
            const scheduleData = timetableResponse.data;
            if (scheduleData && scheduleData.length > 0) {
              const scheduledAnime = scheduleData.find(a => a.title.toLowerCase() === (anime.title || '').toLowerCase());
              if (scheduledAnime) {
                const episodeDate = new Date(scheduledAnime.episodeDate);
                const formattedDate = `${episodeDate.getMonth() + 1}/${episodeDate.getDate()}/${episodeDate.getFullYear()}, ${episodeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
                nextEpisode = `**Episode ${scheduledAnime.episodeNumber || 'TBA'}** - ${formattedDate}`;
              } else {
                nextEpisode = '**Next Episode:** To be aired.';
              }
            } else {
              nextEpisode = '**Next Episode:** To be aired.';
            }
          } catch (scheduleError) {
            console.error('Error fetching anime schedule (autocomplete):', scheduleError.response ? scheduleError.response.data : scheduleError);
          }
        }

        const embed = new EmbedBuilder()
          .setTitle(anime.title || anime.title_english || anime.title_japanese || `#${anime.mal_id}`)
          .setURL(anime.url)
          .setDescription(
            `**Score:** ${anime.score || 'N/A'}\n` +
            `**Episodes:** ${anime.episodes || 'N/A'}\n` +
            `**Status:** ${status}\n` +
            (nextEpisode ? `${nextEpisode}\n\n` : '\n') +
            `**Synopsis:** ${cleanSynopsis}`
          )
          .setImage(anime.images?.jpg?.image_url || null)
          .setColor(0x00AE86);

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error fetching anime by MAL id:', err.response ? err.response.data : err);
        try { await interaction.editReply({ content: 'Failed to fetch anime details for the selected suggestion.', ephemeral: true }); } catch (e) { try { await interaction.reply({ content: 'Failed to fetch anime details for the selected suggestion.', ephemeral: true }); } catch {} }
      }
      return;
    }

    // Non-numeric search: show a compact list embed (Removed interactive buttons)
    try {
      await interaction.deferReply();
      const jikanResponse = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: query, limit: 10 }, timeout: 5000 });
      const animeList = jikanResponse.data.data;
      if (!animeList || animeList.length === 0) {
        await interaction.editReply('No results found.');
        return;
      }

      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const embed = new EmbedBuilder()
        .setTitle(`Search results for "${truncate(query, 80)}"`)
        .setColor(0x00AE86)
        .setTimestamp();

      for (let i = 0; i < Math.min(10, animeList.length); i++) {
        const a = animeList[i];
        const name = a.title || a.title_english || `#${a.mal_id}`;
        const synopsis = truncate((a.synopsis || '').replace(/<[^>]*>/g, ''), 200) || 'No synopsis available.';
        embed.addFields({ name: `${i + 1}. ${truncate(name, 80)}`, value: `${synopsis}\n${a.url}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching anime from Jikan:', error.response ? error.response.data : error);
      try { await interaction.editReply({ content: 'Failed to fetch anime details.', components: [] }); } catch (e) { try { await interaction.reply({ content: 'Failed to fetch anime details.', ephemeral: true }); } catch {} }
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

      const resp = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: value, limit: 25 }, timeout: 2500 });
      const list = resp.data.data || [];
      const truncate = (s, n) => (s && s.length > n ? s.substring(0, n - 1) + '…' : s || '');
      const suggestions = list.slice(0, 25).map(a => {
        // Prefer the English title when available, fall back to canonical title or Japanese
        const titleEnglish = a.title_english || a.title || a.title_japanese || `#${a.mal_id}`;
        const rawName = `${titleEnglish}${a.year ? ` (${a.year})` : ''}`.trim();
        // Discord autocomplete name max length is 100 characters
        const name = truncate(rawName, 100);
        return { name: name || `#${a.mal_id}`, value: String(a.mal_id) };
      });

      if (suggestions.length === 0) {
        await interaction.respond([{ name: 'No suggestions', value: '' }]);
        return;
      }

      await interaction.respond(suggestions);
    } catch (err) {
      console.error('search-anime autocomplete error:', err);
      try { await interaction.respond([]); } catch (e) {}
    }
  }
};