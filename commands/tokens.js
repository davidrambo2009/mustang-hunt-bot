const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTokens } = require('../data/tokenHelper.js');

// Your garage channel ID:
const GARAGE_CHANNEL_ID = '1372749137413668884';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tokens')
    .setDescription('View your Hunt Token balance and booster status!'),
  async execute(interaction) {
    // Restrict usage to the garage channel only
    if (interaction.channel.id !== GARAGE_CHANNEL_ID) {
      return interaction.reply({
        content: '❌ You can only use `/tokens` in the garage channel!',
        flags: 64
      });
    }

    const userId = interaction.user.id;
    const member = interaction.member;
    const boosterRoleId = '1392720458960339005';
    const isBoosting = member.roles.cache.has(boosterRoleId);
    const tokens = await getTokens(userId);

    const embed = new EmbedBuilder()
      .setTitle('🏅 Hunt Tokens')
      .setDescription(`You have **${tokens}** Hunt Tokens.\n\nBooster: ${isBoosting ? '🟢 Active (2x tokens)' : '🔴 Not Active'}`)
      .setColor(isBoosting ? 0x00FF00 : 0xFF0000);
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
