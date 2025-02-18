const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchRSSFeedWithRetries, filterEnglishAnimeItems } = require('../utils/nyaaRSS');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nyaa')
    .setDescription('Search for English-translated anime on Nyaa.')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search term (e.g. anime title)')
        .setRequired(true)
    ),
  async execute(interaction) {
    // Defer the reply right away so the interaction doesn’t timeout
    await interaction.deferReply({ ephemeral: false });

    try {
      // Get the user’s search term
      const query = interaction.options.getString('query');

      // Build the RSS feed URL with the user’s search term
      // For example: https://nyaa.si/?page=rss&f=0&c=0_0&q=Naruto
      const url = `https://nyaa.si/?page=rss&f=0&c=0_0&q=${encodeURIComponent(query)}`;

      // Fetch and filter items
      const feed = await fetchRSSFeedWithRetries(url);
      const englishAnimeItems = filterEnglishAnimeItems(feed.items);

      // If no items were found, let the user know
      if (englishAnimeItems.length === 0) {
        await interaction.editReply(`No results found for "${query}".`);
        return;
      }

      // Create the embed with the first 10 items
      const embed = {
        color: 0x0099ff,
        title: `Search Results for "${query}"`,
        fields: englishAnimeItems.slice(0, 10).map((item, i) => ({
          name: `${i + 1}. ${item.title}`,
          value: item.link,
        })),
        timestamp: new Date(),
      };

      // Edit the deferred reply to include the embed
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching or parsing the RSS feed:', error);
      await interaction.editReply({
        content: 'Error fetching or parsing the RSS feed. Please try again later.',
      });
    }
  },
};