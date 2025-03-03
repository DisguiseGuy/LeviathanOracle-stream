import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show the weekly animes that are ongoing'),

  async execute(interaction) {
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    const row1 = new ActionRowBuilder()
      .addComponents(
        days.slice(0, 5).map(day => new ButtonBuilder()
          .setCustomId(day.toLowerCase())
          .setLabel(day)
          .setStyle(ButtonStyle.Primary))
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        days.slice(5).map(day => new ButtonBuilder()
          .setCustomId(day.toLowerCase())
          .setLabel(day)
          .setStyle(ButtonStyle.Primary))
      );

    await interaction.reply({ content: 'Please select a day:', components: [row1, row2] });
  },
};