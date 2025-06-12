const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Garage = require('../models/garage.js'); // Update path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecar')
    .setDescription('Admin: Remove a car from a user’s garage')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('User to remove a car from')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only admins

  async execute(interaction) {
    // Check admin (if not using default permissions)
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You must be an admin to use this command.', flags: 64 });
    }
    const targetUser = interaction.options.getUser('target');
    const garage = await Garage.findOne({ userId: targetUser.id });
    if (!garage || !garage.cars.length) {
      return interaction.reply({ content: 'That user has no cars.', flags: 64 });
    }

    // Build select menu: each car as an option
    const options = garage.cars.map(car => ({
      label: `${car.name} (Serial ${car.serial})`,
      value: car._id.toString()
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`removecar_select_${targetUser.id}`)
      .setPlaceholder('Select a car to remove')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: `Select a car to remove from ${targetUser}'s garage:`,
      components: [row],
      flags: 64
    });
  }
};
