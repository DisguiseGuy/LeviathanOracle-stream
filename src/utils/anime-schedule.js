import axios from 'axios';  // Noice
import pkg from 'discord.js';
import 'dotenv/config';

const { EmbedBuilder } = pkg;
const BASE_URL = 'https://animeschedule.net/api/v3';
const API_KEY = process.env.ANIMESCHEDULE_TOKEN;

export const fetchDailySchedule = async (day, airType = 'all') => {
  try {
    const response = await axios.get(`${BASE_URL}/timetables/${airType}?cb=${Date.now()}&random=${Math.random()}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    // Disabled debug logging for schedule data
    // console.log('Fetched Anime Schedule Data:', JSON.stringify(response.data, null, 2));
    // console.log('Raw episode dates before filtering:', response.data.map(anime => ({
    //   title: anime.english || anime.title || 'UNKNOWN',
    //   episodeNumber: anime.episodeNumber,
    //   episodeDate: anime.episodeDate
    // })));

    if (response.data && response.data.length > 0) {
      const dayOfWeek = day.toLowerCase();
      const filteredData = response.data.filter(anime => {
        const date = new Date(anime.episodeDate);
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return weekday === dayOfWeek;
      });

      // Disabled debug logging for filtered schedule
      // console.log('Filtered Schedule for', day, ':', filteredData);
      return filteredData;
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error fetching daily schedule:', error.response ? error.response.data : error.message);
    return [];
  }
};

export const createAnimeEmbed = (animeList, page = 1) => {
  const embed = new EmbedBuilder()
    .setTitle('Upcoming Anime Episodes')
    .setColor('#0099ff')
    .setFooter({ text: `Page ${page}` });

  const start = (page - 1) * 10;
  const end = start + 10;
  const pageData = animeList.slice(start, end);

  pageData.forEach(anime => {
    embed.addFields({ 
      name: `${anime.english || anime.title || 'UNKNOWN TITLE'}`, 
      value: `**Episode ${anime.episodeNumber || 'TBA'}** - Airs on ${new Date(anime.episodeDate).toLocaleString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      })}`
    });
  });

  return embed;
};

export const createPaginationButtons = (currentPage, totalPages) => {
  const row = new pkg.ActionRowBuilder()
    .addComponents(
      new pkg.ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle(pkg.ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new pkg.ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle(pkg.ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );

  return row;
};