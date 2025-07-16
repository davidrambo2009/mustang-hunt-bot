const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Garage = require('../models/garage');

// The ID of the garage channel
const GARAGE_CHANNEL_ID = '1372749137413668884';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equiptitle')
    .setDescription('Equip a garage title you own!'),

  async execute(interaction) {
    // Restrict to garage channel
    if (interaction.channelId !== GARAGE_CHANNEL_ID) {
      await interaction.reply({ content: 'You can only use this command in the garage channel!', ephemeral: true });
      return;
    }

    // Fetch user's garage
    const garage = await Garage.findOne({ userId: interaction.user.id });
    if (!garage || !garage.ownedTitles || garage.ownedTitles.length === 0) {
      await interaction.reply({ content: 'You don’t own any garage titles!', ephemeral: true });
      return;
    }

    // Build select menu options from owned titles
    const options = garage.ownedTitles.map(title => ({
      label: title,
      value: title
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('equiptitle_select')
      .setPlaceholder('Select a title to equip')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Choose a title to equip:",
      components: [row],
      ephemeral: true
    });
  },

  // This needs to be wired into your interaction handler for select menus
  async handleSelect(interaction) {
    if (interaction.customId === 'equiptitle_select') {
      const selectedTitle = interaction.values[0];
      const garage = await Garage.findOne({ userId: interaction.user.id });
      if (!garage || !garage.ownedTitles.includes(selectedTitle)) {
        await interaction.update({ content: "You don't own that title!", components: [] });
        return;
      }
      garage.equippedTitle = selectedTitle;
      await garage.save();
      await interaction.update({ content: `Equipped title: **${selectedTitle}**!`, components: [] });
    }
  }
};
