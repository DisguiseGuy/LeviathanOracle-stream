import fetch from 'node-fetch';
import pkg from 'discord.js';
import 'dotenv/config';

const { MessageActionRow, MessageButton, EmbedBuilder } = pkg;

const fetchAnimeData = async (day) => {
  try {
    const token = process.env.ANIMESCHEDULE_TOKEN;
    const response = await fetch(`https://api.animeschedule.net/v3/titles/${day}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching anime data:', error);
    return [];
  }
};

const createAnimeEmbed = (animeList, page = 1) => {
  const embed = new EmbedBuilder()
    .setTitle('Upcoming Anime Episodes')
    .setColor('#0099ff')
    .setFooter(`Page ${page}`);

  const start = (page - 1) * 10;
  const end = start + 10;
  const pageData = animeList.slice(start, end);

  pageData.forEach(anime => {
    embed.addField(`${anime.time} ${anime.name}`, `Episode ${anime.episode}`);
  });

  return embed;
};

const createPaginationButtons = (currentPage, totalPages) => {
  const row = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('prev')
        .setLabel('Previous')
        .setStyle('SECONDARY')
        .setDisabled(currentPage === 1),
      new MessageButton()
        .setCustomId('next')
        .setLabel('Next')
        .setStyle('SECONDARY')
        .setDisabled(currentPage === totalPages)
    );

  return row;
};

export const handleButtonInteraction = async (interaction) => {
  if (!interaction.isButton()) return;

  const selectedDay = interaction.customId;
  await interaction.deferUpdate();

  const animeData = await fetchAnimeData(selectedDay);
  const totalPages = Math.ceil(animeData.length / 10);
  let currentPage = 1;

  const embed = createAnimeEmbed(animeData, currentPage);
  const row = createPaginationButtons(currentPage, totalPages);

  await interaction.editReply({ content: `You selected: ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}`, components: [row], embeds: [embed] });

  const filter = i => i.customId === 'prev' || i.customId === 'next';
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async i => {
    if (i.customId === 'prev') {
      currentPage--;
    } else if (i.customId === 'next') {
      currentPage++;
    }

    const newEmbed = createAnimeEmbed(animeData, currentPage);
    const newRow = createPaginationButtons(currentPage, totalPages);

    await i.update({ embeds: [newEmbed], components: [newRow] });
  });

  collector.on('end', collected => {
    console.log(`Collected ${collected.size} interactions.`);
    interaction.editReply({ components: [] });
  });
};