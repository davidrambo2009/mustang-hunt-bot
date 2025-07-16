const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Garage = require('../models/garage');

// The ID of the garage channel
const GARAGE_CHANNEL_ID = '1372749137413668884';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equiptheme')
    .setDescription('Equip a garage theme you own!'),

  async execute(interaction) {
    // Restrict to garage channel
    if (interaction.channelId !== GARAGE_CHANNEL_ID) {
      await interaction.reply({ content: 'You can only use this command in the garage channel!', ephemeral: true });
      return;
    }

    // Fetch user's garage
    const garage = await Garage.findOne({ userId: interaction.user.id });
    if (!garage || !garage.ownedThemes || garage.ownedThemes.length === 0) {
      await interaction.reply({ content: 'You don’t own any garage themes!', ephemeral: true });
      return;
    }

    // Build select menu options from owned themes
    const options = garage.ownedThemes.map(theme => ({
      label: theme,
      value: theme
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('equiptheme_select')
      .setPlaceholder('Select a theme to equip')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Choose a theme to equip:",
      components: [row],
      ephemeral: true
    });
  },

  // This needs to be wired into your interaction handler for select menus
  async handleSelect(interaction) {
    if (interaction.customId === 'equiptheme_select') {
      const selectedTheme = interaction.values[0];
      const garage = await Garage.findOne({ userId: interaction.user.id });
      if (!garage || !garage.ownedThemes.includes(selectedTheme)) {
        await interaction.update({ content: "You don't own that theme!", components: [] });
        return;
      }
      garage.equippedTheme = selectedTheme;
      await garage.save();
      await interaction.update({ content: `Equipped theme: **${selectedTheme}**!`, components: [] });
    }
  }
};
