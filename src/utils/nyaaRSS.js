import Parser from 'rss-parser';
const parser = new Parser();

// URL of the Nyaa RSS feed
const NYAA_RSS_FEED_URL = 'https://nyaa.si/?page=rss';

// Function to filter English-translated anime items
export function filterEnglishAnimeItems(items) {
  const englishKeywords = ['eng', 'english', 'sub', 'dub', 'subtitled'];
  return items.filter(item => {
    const title = item.title.toLowerCase();
    return englishKeywords.some(keyword => title.includes(keyword));
  });
}

// Function to fetch RSS feed with retries
export async function fetchRSSFeedWithRetries(url, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const feed = await parser.parseURL(url);
      return feed;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch and process the RSS feed
export async function fetchEnglishAnimeFromNyaa(interaction) {
  try {
    const feed = await fetchRSSFeedWithRetries(NYAA_RSS_FEED_URL);
    const englishAnimeItems = filterEnglishAnimeItems(feed.items);
    const embed = {
      color: 0x0099ff,
      title: 'English-translated Anime from Nyaa',
      fields: englishAnimeItems.slice(0, 10).map((item, index) => ({
        name: `${index + 1}. ${item.title}`,
        value: item.link,
      })),
      timestamp: new Date(),
    };
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching or parsing the RSS feed:', error);
    await interaction.reply({ content: 'Error fetching or parsing the RSS feed.', ephemeral: true });
  }
}