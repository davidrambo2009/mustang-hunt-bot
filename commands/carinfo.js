const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const cars = require('../data/cars.js'); // adjust path as needed

const PAGE_SIZE = 25;

function getCarOptions(page = 0) {
  return cars.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(car => ({
    label: car.name,
    value: car.name,
  }));
}

function getTotalPages() {
  return Math.ceil(cars.length / PAGE_SIZE);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carinfo')
    .setDescription('Select a car to view its detailed info.'),
  async execute(interaction) {
    let page = 0;
    const totalPages = getTotalPages();

    function getSelectMenu(page) {
      return new StringSelectMenuBuilder()
        .setCustomId(`carinfo_select_${page}`)
        .setPlaceholder(`Select a car (Page ${page + 1} of ${totalPages})`)
        .addOptions(getCarOptions(page));
    }

    function getNavRow(page) {
      const row = new ActionRowBuilder();
      row.addComponents(getSelectMenu(page));
      if (totalPages > 1) {
        const nav = new ActionRowBuilder();
        nav.addComponents(
          new ButtonBuilder()
            .setCustomId('carinfo_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('carinfo_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
        return [row, nav];
      }
      return [row];
    }

    await interaction.reply({
      content: 'Select a car to view its info:',
      components: getNavRow(page),
      ephemeral: true,
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 120_000,
    });

    collector.on('collect', async i => {
      // Pagination navigation
      if (i.isButton()) {
        if (i.customId === 'carinfo_prev' && page > 0) {
          page--;
          await i.update({
            content: 'Select a car to view its info:',
            components: getNavRow(page),
            embeds: [],
          });
        }
        if (i.customId === 'carinfo_next' && page < totalPages - 1) {
          page++;
          await i.update({
            content: 'Select a car to view its info:',
            components: getNavRow(page),
            embeds: [],
          });
        }
        return;
      }
      // Car selection
      if (i.isStringSelectMenu() && i.customId.startsWith('carinfo_select_')) {
        const carName = i.values[0];
        const carStatic = cars.find(c => c.name === carName);

        const embed = new EmbedBuilder()
          .setTitle(carStatic.name)
          .addFields(
            { name: 'Rarity', value: carStatic.rarity || 'Unknown', inline: true },
            { name: 'Rarity Level', value: String(carStatic.rarityLevel ?? '?'), inline: true },
          )
          .setColor(0x007fff);

        // Show a back button to return to the same page
        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`carinfo_back_${page}`)
            .setLabel('Back to list')
            .setStyle(ButtonStyle.Primary)
        );

        await i.update({
          content: '',
          embeds: [embed],
          components: [backRow],
        });
        return;
      }
      // Back to list
      if (i.isButton() && i.customId.startsWith('carinfo_back_')) {
        const prevPage = parseInt(i.customId.split('_').pop(), 10);
        page = prevPage;
        await i.update({
          content: 'Select a car to view its info:',
          components: getNavRow(page),
          embeds: [],
        });
        return;
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {}
    });
  }
};
