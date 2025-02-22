import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';

export default {
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
    console.log('linkprofile command triggered');
    const discordId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');
    const updateField = subcommand === 'mal' ? 'mal_username' : 'anilist_username';

    // Prepare embed templates
    const successEmbed = (msg) => new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Account Linked')
      .setDescription(msg);
    const errorEmbed = (msg) => new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Linking Failed')
      .setDescription(msg);

    try {
      // Check if the username is already linked to another user
      const checkQuery = `SELECT discord_id FROM users WHERE ${updateField} = ?`;
      db.get(checkQuery, [username], (checkErr, row) => {
        if (checkErr) {
          console.error('DB Check Error:', checkErr);
          return interaction.reply({ embeds: [errorEmbed('There was an error linking your account.')], ephemeral: true });
        }

        if (row && row.discord_id !== discordId) {
          return interaction.reply({
            embeds: [errorEmbed(`That username is already linked to <@${row.discord_id}>.`)],
            ephemeral: true
          });
        }

        // Check if the current user already exists in the DB
        db.get(`SELECT * FROM users WHERE discord_id = ?`, [discordId], (selectErr, userRow) => {
          if (selectErr) {
            console.error('DB Select Error:', selectErr);
            return interaction.reply({ embeds: [errorEmbed('There was an error linking your account.')], ephemeral: true });
          }

          const replySuccess = () => {
            interaction.reply({ embeds: [successEmbed(`${subcommand === 'mal' ? 'MyAnimeList' : 'AniList'} account linked: ${username}`)] });
          };

          if (userRow) {
            // Update existing user
            const updateQuery = `UPDATE users SET ${updateField} = ? WHERE discord_id = ?`;
            db.run(updateQuery, [username, discordId], (updateErr) => {
              if (updateErr) {
                console.error('DB Update Error:', updateErr);
                return interaction.reply({ embeds: [errorEmbed('There was an error linking your account.')], ephemeral: true });
              }
              replySuccess();
            });
          } else {
            // Insert new user record
            const malUsername = subcommand === 'mal' ? username : null;
            const anilistUsername = subcommand === 'anilist' ? username : null;
            db.run(`INSERT INTO users (discord_id, mal_username, anilist_username) VALUES (?, ?, ?)`,
              [discordId, malUsername, anilistUsername],
              (insertErr) => {
                if (insertErr) {
                  console.error('DB Insert Error:', insertErr);
                  return interaction.reply({ embeds: [errorEmbed('There was an error linking your account.')], ephemeral: true });
                }
                replySuccess();
              });
          }
        });
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ embeds: [errorEmbed('There was an error linking your account.')], ephemeral: true });
    }
  },
};