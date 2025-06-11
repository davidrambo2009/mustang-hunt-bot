const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Car = require('../models/Car'); // Mongoose Car model (for stats)
const cars = require('../data/cars.js'); // Your full static car list

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carinfo')
    .setDescription('Select a car to view its detailed info.'),
  async execute(interaction) {
    // Use full static car list for dropdown
    const carOptions = cars.map(car => ({
      label: car.name,
      value: car.name
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('carinfo_select')
      .setPlaceholder('Select a car to view info')
      .addOptions(carOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: 'Select a car to view its info:',
      components: [row],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id,
      time: 60_000
    });

    collector.on('collect', async selectInteraction => {
      const carName = selectInteraction.values[0];
      const carStatic = cars.find(c => c.name === carName);

      // Try to get dynamic stats from MongoDB Car collection (if you use it for stats)
      // If you only track garage, you can skip this model entirely or do a summary query on user garages.
      let carDynamic = await Car.findOne({ name: carName });

      // Fallbacks if no dynamic data
      carDynamic = carDynamic || {};

      const embed = new EmbedBuilder()
        .setTitle(carStatic.name)
        .addFields(
          { name: 'Rarity', value: carStatic.rarity || 'Unknown', inline: false },
          { name: 'Serials in game', value: String(carDynamic.serialsExist ?? 0), inline: true },
          { name: 'Unique owners', value: String(carDynamic.uniqueOwners ?? 0), inline: true },
          { name: 'Still droppable', value: carDynamic.droppable === undefined ? 'Unknown' : (carDynamic.droppable ? 'YES' : 'NO'), inline: true },
          { name: 'Retirement date', value: carDynamic.retirementDate ? `<t:${Math.floor(new Date(carDynamic.retirementDate).getTime() / 1000)}:f>` : 'N/A', inline: true },
          { name: 'Last traded for', value: Array.isArray(carDynamic.lastTradedFor) && carDynamic.lastTradedFor.length ? carDynamic.lastTradedFor.map(c => `- ${c}`).join('\n') : 'N/A', inline: false },
          { name: 'Last owner', value: carDynamic.lastOwner || 'Unknown', inline: true },
          { name: 'Recent activity', value: carDynamic.recentActivity || 'No recent activity', inline: false }
        )
        .setColor(0x007fff);

      const ownersRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`owners_${carName.replace(/ /g, "_")}`)
          .setLabel('View Owners')
          .setStyle(ButtonStyle.Primary)
      );

      await selectInteraction.update({
        content: '',
        embeds: [embed],
        components: [ownersRow],
        ephemeral: true
      });
      collector.stop();
    });

    collector.on('end', () => {});
  }
};
