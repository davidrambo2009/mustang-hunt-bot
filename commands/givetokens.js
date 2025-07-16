const { SlashCommandBuilder } = require('discord.js');
const Garage = require('../models/garage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givetokens')
    .setDescription('Give Hunt Tokens to a user (admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('User to give Hunt Tokens to').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of Hunt Tokens to give').setRequired(true)),
  async execute(interaction) {
    // Only allow admins
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.reply({ content: '❌ No permission.', flags: 64 });
      return;
    }
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (amount <= 0) {
      await interaction.reply({ content: 'Amount must be positive.', flags: 64 });
      return;
    }
    let garage = await Garage.findOne({ userId: target.id });
    if (!garage) {
      garage = new Garage({ userId: target.id, cars: [], tokens: 0 });
    }
    garage.tokens = (garage.tokens ?? 0) + amount;
    await garage.save();
    await interaction.reply({ content: `Gave ${amount} Hunt Tokens to ${target.username}.`, flags: 64 });
  }
};
