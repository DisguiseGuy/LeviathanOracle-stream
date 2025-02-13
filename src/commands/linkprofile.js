const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkprofile')
    .setDescription('Link your MAL or AniList account')
    .addSubcommand(subcommand =>
      subcommand
        .setName('mal')
        .setDescription('Your MyAnimeList username')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your MyAnimeList username')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('anilist')
        .setDescription('Your AniList username')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your AniList username')
            .setRequired(true))),

  async execute(interaction) {
    console.log('linkprofile command triggered'); // Add logging
    const discordId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');

    try {
      db.get(`SELECT * FROM users WHERE discord_id = ?`, [discordId], (err, row) => {
        if (err) {
          console.error('DB Select Error:', err);
          return interaction.reply('There was an error linking your account.');
        }

        if (row) {
          // Update existing user
          const updateField = subcommand === 'mal' ? 'mal_username' : 'anilist_username';
          db.run(`UPDATE users SET ${updateField} = ? WHERE discord_id = ?`, [username, discordId], (updateErr) => {
            if (updateErr) {
              console.error('DB Update Error:', updateErr);
              return interaction.reply('There was an error linking your account.');
            }
            interaction.reply(`${subcommand === 'mal' ? 'MyAnimeList' : 'AniList'} account linked: ${username}`);
          });
        } else {
          // Insert new user
          const malUsername = subcommand === 'mal' ? username : null;
          const anilistUsername = subcommand === 'anilist' ? username : null;
          db.run(`INSERT INTO users (discord_id, mal_username, anilist_username) VALUES (?, ?, ?)`, [discordId, malUsername, anilistUsername], (insertErr) => {
            if (insertErr) {
              console.error('DB Insert Error:', insertErr);
              return interaction.reply('There was an error linking your account.');
            }
            interaction.reply(`${subcommand === 'mal' ? 'MyAnimeList' : 'AniList'} account linked: ${username}`);
          });
        }
      });
    } catch (error) {
      console.error(error);
      await interaction.reply('There was an error linking your account.');
    }
  },
};