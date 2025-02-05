const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const anilistAPI = 'https://graphql.anilist.co';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search-manga')
        .setDescription('Search for manga on AniList')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');

        await interaction.deferReply(); // If fetching takes time

        const searchQuery = `
        query ($search: String) {
            Page(perPage: 10) {
                media(search: $search, type: MANGA) {
                    id
                    title {
                        romaji
                        english
                    }
                    averageScore
                    description
                    genres
                    coverImage {
                        large
                    }
                }
            }
        }
        `;
        
        const variables = { search: query };
        
        try {
            const response = await axios.post(anilistAPI, {
                query: searchQuery,
                variables,
            });
        
            const mangaList = response.data.data.Page.media;
        
            if (mangaList.length === 0) {
                await interaction.editReply('No results found.');
                return;
            }
        
            const buttons = mangaList.map(manga => new ButtonBuilder()
                .setCustomId(`manga_${manga.id}`)
                .setLabel(manga.title.romaji || manga.title.english)
                .setStyle(ButtonStyle.Primary)
            );
        
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }
        
            await interaction.editReply({ content: 'Select a manga to view details:', components: rows });
        
            const filter = i => i.customId.startsWith('manga_') && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
        
            collector.on('collect', async i => {
                const mangaId = i.customId.split('_')[1];
                const selectedManga = mangaList.find(manga => manga.id == mangaId);
        
                // Log the selected manga to check if genres are available
                console.log(selectedManga);
        
                // Clean up the description by removing HTML tags
                const cleanDescription = selectedManga.description ? selectedManga.description.replace(/<\/?[^>]+(>|$)/g, "") : 'No description available.';
        
                // Join genres into a comma-separated string
                const genres = selectedManga.genres ? selectedManga.genres.join(', ') : 'No genres available';
        
                const embed = new EmbedBuilder()
                .setTitle(selectedManga.title.romaji || selectedManga.title.english)
                .setURL(`https://anilist.co/manga/${selectedManga.id}`)
                .setDescription(`**Score**: **${selectedManga.averageScore}**\n**Genres**: ${genres}\n**Description**: ${cleanDescription}`)
                .setImage(selectedManga.coverImage.large);
        
                await i.update({ content: '', embeds: [embed], components: [] });
            });
        
            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: 'No selection made.', components: [] });
                }
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply('There was an error fetching the manga details.');
        }
    }
};