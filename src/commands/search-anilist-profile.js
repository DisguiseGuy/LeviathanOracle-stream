const { SlashCommandBuilder } = require('discord.js');
const { fetchAniListUser } = require('../utils/querry-anilist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search-anilist-user')
        .setDescription('Fetch AniList user profile')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('AniList username')
                .setRequired(true)),
    async execute(interaction) {
        const username = interaction.options.getString('username');

        await interaction.deferReply(); // If fetching takes time

        try {
            const userData = await fetchAniListUser(username);

            // Convert minutes watched to days watched
            const daysWatched = (userData.statistics.anime.minutesWatched / 1440).toFixed(1);

            const embed = {
                color: 0x2e51a2,
                title: `${userData.name}'s AniList Profile`,
                url: `https://anilist.co/user/${userData.name}`,
                thumbnail: {
                    url: userData.avatar.large,
                },
                fields: [
                    {
                        name: 'Anime Stats',
                        value: `**Total Anime**: ${userData.statistics.anime.count}\n**Mean Score**: ${userData.statistics.anime.meanScore}\n**Days Watched**: ${daysWatched}`,
                        inline: true,
                    },
                    {
                        name: 'Manga Stats',
                        value: `**Total Manga**: ${userData.statistics.manga.count}\n**Chapters Read**: ${userData.statistics.manga.chaptersRead}\n**Volumes Read**: ${userData.statistics.manga.volumesRead}`,
                        inline: true,
                    },
                ],
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('Failed to fetch AniList user data. Make sure the username is correct.');
        }
    },
};