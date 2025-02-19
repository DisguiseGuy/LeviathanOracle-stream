const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { fetchAniListUser } = require('../utils/querry.js');
const db = require('../database/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkedprofile')
    .setDescription('View your linked profile(s)'),
    
  async execute(interaction) {
    const discordId = interaction.user.id;

    // Query the DB for linked profiles by this user.
    db.get(`SELECT * FROM users WHERE discord_id = ?`, [discordId], async (err, row) => {
      if (err) {
        console.error('DB Error:', err);
        return interaction.reply({ content: 'There was an error accessing your linked profiles.', ephemeral: true });
      }
      if (!row) {
        return interaction.reply({ content: 'You have not linked any profiles yet.', ephemeral: true });
      }
      
      const malUsername = row.mal_username;
      const anilistUsername = row.anilist_username;

      // Helper function to fetch and update MAL profile
      const sendMalProfile = async (updateFn) => {
        try {
          const userResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}`);
          const userData = userResponse.data.data;
          const statsResponse = await axios.get(`https://api.jikan.moe/v4/users/${malUsername}/statistics`);
          const animeStats = statsResponse.data.data.anime || {};
          const mangaStats = statsResponse.data.data.manga || {};

          const embed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(`${userData.username}'s MyAnimeList Profile`)
            .setURL(`https://myanimelist.net/profile/${userData.username}`)
            .setThumbnail(userData.images.jpg.image_url)
            .addFields(
              { name: 'Anime Stats', value: `**Total Entries:** ${animeStats.total_entries || 'N/A'}\n**Mean Score:** ${animeStats.mean_score || 'N/A'}\n**Days Watched:** ${animeStats.days_watched || 'N/A'}`, inline: true },
              { name: 'Manga Stats', value: `**Total Entries:** ${mangaStats.total_entries || 'N/A'}\n**Mean Score:** ${mangaStats.mean_score || 'N/A'}\n**Days Read:** ${mangaStats.days_read || 'N/A'}`, inline: true }
            );
          await updateFn({ embeds: [embed], content: undefined, components: [] });
        } catch (error) {
          console.error('MAL Profile Error:', error);
          await updateFn({ content: 'Failed to fetch MyAnimeList profile.', components: [] });
        }
      };

      // Helper function to fetch and update AniList profile
      const sendAniListProfile = async (updateFn) => {
        try {
          const userData = await fetchAniListUser(anilistUsername);
          const daysWatched = (userData.statistics.anime.minutesWatched / 1440).toFixed(1);
          const embed = new EmbedBuilder()
            .setColor(0x2e51a2)
            .setTitle(`${userData.name}'s AniList Profile`)
            .setURL(`https://anilist.co/user/${userData.name}`)
            .setThumbnail(userData.avatar.large)
            .addFields(
              { name: 'Anime Stats', value: `**Total Anime:** ${userData.statistics.anime.count}\n**Mean Score:** ${userData.statistics.anime.meanScore}\n**Days Watched:** ${daysWatched}`, inline: true },
              { name: 'Manga Stats', value: `**Total Manga:** ${userData.statistics.manga.count}\n**Chapters Read:** ${userData.statistics.manga.chaptersRead}\n**Volumes Read:** ${userData.statistics.manga.volumesRead}`, inline: true }
            );
          await updateFn({ embeds: [embed], content: undefined, components: [] });
        } catch (error) {
          console.error('AniList Profile Error:', error);
          await updateFn({ content: 'Failed to fetch AniList profile.', components: [] });
        }
      };

      // If only one profile is linked, reply and update that message.
      if (malUsername && !anilistUsername) {
        await interaction.reply({ content: 'Fetching your MyAnimeList profile...', ephemeral: true });
        sendMalProfile(interaction.editReply.bind(interaction));
      } else if (anilistUsername && !malUsername) {
        await interaction.reply({ content: 'Fetching your AniList profile...', ephemeral: true });
        sendAniListProfile(interaction.editReply.bind(interaction));
      } else if (malUsername && anilistUsername) {
        // Both profiles linked; ask user which profile to view.
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('profile_mal')
            .setLabel('MyAnimeList')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('profile_anilist')
            .setLabel('AniList')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ content: 'Which profile would you like to view?', components: [buttons], ephemeral: true });
        
        // Create a collector to handle the button interaction.
        const collectorFilter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
          filter: collectorFilter,
          time: 60000,
          max: 1
        });
        
        collector.on('collect', async i => {
          if (i.customId === 'profile_mal') {
            sendMalProfile(i.update.bind(i));
          } else if (i.customId === 'profile_anilist') {
            sendAniListProfile(i.update.bind(i));
          }
        });
        
        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ content: 'No selection was made. Please try again.', components: [] });
          }
        });
      } else {
        return interaction.reply({ content: 'No profiles are linked to your account.', ephemeral: true });
      }
    });
  }
};