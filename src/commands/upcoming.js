import { SlashCommandBuilder } from '@discordjs/builders'; // The command.
import { fetchDailySchedule, createAnimeEmbed, createPaginationButtons } from '../utils/anime-schedule.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show the upcoming anime episodes'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const dayButtons = daysOfWeek.map(day => 
        new ButtonBuilder()
          .setCustomId(day.toLowerCase())
          .setLabel(day)
          .setStyle(ButtonStyle.Primary)
      );

      // Properly split buttons into rows (max 5 per row)
      const rows = [];
      for (let i = 0; i < dayButtons.length; i += 5) {
        const rowComponents = dayButtons.slice(i, i + 5);
        if (rowComponents.length > 0) rows.push(new ActionRowBuilder().addComponents(rowComponents));
      }

      await interaction.editReply({ content: 'Please select a day of the week:', components: rows });

      const filter = i => daysOfWeek.map(day => day.toLowerCase()).includes(i.customId);
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          const selectedDay = i.customId;
          const airTypeButtons = ['sub', 'dub', 'raw'].map(type => 
            new ButtonBuilder()
              .setCustomId(type)
              .setLabel(type)
              .setStyle(ButtonStyle.Secondary)
          );

          const airTypeRow = new ActionRowBuilder().addComponents(airTypeButtons);

          await i.editReply({ content: `Selected day: ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}. Now select the air type:`, components: [airTypeRow] });

          const airTypeFilter = i => ['sub', 'dub', 'raw'].includes(i.customId);
          const airTypeCollector = interaction.channel.createMessageComponentCollector({ filter: airTypeFilter, time: 15000 });

          airTypeCollector.on('collect', async i => {
            try {
              await i.deferUpdate();
              const selectedAirType = i.customId;
              let animeData = [];
              try {
                animeData = await fetchDailySchedule(selectedDay, selectedAirType);
              } catch (fetchErr) {
                console.error('Error fetching daily schedule:', fetchErr);
                await i.editReply({ content: 'Failed to fetch schedule. Please try again later.', components: [] });
                return;
              }

              if (!animeData || animeData.length === 0) {
                await i.editReply({ content: `No upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} with air type ${selectedAirType}.`, components: [] });
                return;
              }

              const totalPages = Math.ceil(animeData.length / 10);
              let currentPage = 1;

              const embed = createAnimeEmbed(animeData, currentPage);
              const row = createPaginationButtons(currentPage, totalPages);

              await i.editReply({ content: `Upcoming anime episodes for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} (${selectedAirType}):`, embeds: [embed], components: [row] });

              const pageFilter = i => i.customId === 'prev' || i.customId === 'next';
              const pageCollector = interaction.channel.createMessageComponentCollector({ filter: pageFilter, time: 60000 });

              pageCollector.on('collect', async i => {
                try {
                  await i.deferUpdate();
                  if (i.customId === 'prev' && currentPage > 1) currentPage--;
                  if (i.customId === 'next' && currentPage < totalPages) currentPage++;

                  const newEmbed = createAnimeEmbed(animeData, currentPage);
                  const newRow = createPaginationButtons(currentPage, totalPages);

                  await i.editReply({ embeds: [newEmbed], components: [newRow] });
                } catch (err) {
                  console.error('Error in pagination:', err);
                }
              });

              pageCollector.on('end', () => {
                i.editReply({ components: [] }).catch(() => {});
              });
            } catch (err) {
              console.error('Error in airTypeCollector:', err);
              await i.editReply({ content: 'An error occurred while processing your request.', components: [] });
            }
          });

          airTypeCollector.on('end', collected => {
            if (collected.size === 0) {
              interaction.editReply({ content: 'No air type selected.', components: [] }).catch(() => {});
            }
          });
        } catch (err) {
          console.error('Error in day collector:', err);
          await i.editReply({ content: 'An error occurred while processing your request.', components: [] });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'No day selected.', components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error('upcoming command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};