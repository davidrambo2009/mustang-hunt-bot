const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cars = require('../data/cars.js'); // Adjust path if needed
const Garage = require('../models/garage.js');

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

function formatDate(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date)) return dateString;
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carinfo')
    .setDescription('Select a car to view its drop/trade info.'),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    let page = 0;
    const totalPages = getTotalPages();

    function getSelectMenu(page) {
      return new StringSelectMenuBuilder()
        .setCustomId(`carinfo_select_${page}`)
        .setPlaceholder(`Select a car (Page ${page + 1} of ${totalPages})`)
        .addOptions(getCarOptions(page));
    }

    function getNavRow(page) {
      const row = new ActionRowBuilder().addComponents(getSelectMenu(page));
      if (totalPages > 1) {
        const nav = new ActionRowBuilder().addComponents(
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
      allowedMentions: { repliedUser: false }
    });

    const replyMsg = await interaction.fetchReply();
    const filter = i => i.user.id === interaction.user.id;
    const collector = replyMsg.createMessageComponentCollector({
      filter,
      time: 120_000,
    });

    collector.on('collect', async i => {
      try {
        if (i.isButton()) {
          if (i.customId === 'carinfo_prev' && page > 0) {
            page--;
            await i.update({
              content: 'Select a car to view its info:',
              components: getNavRow(page),
              embeds: [],
            });
            return;
          }
          if (i.customId === 'carinfo_next' && page < totalPages - 1) {
            page++;
            await i.update({
              content: 'Select a car to view its info:',
              components: getNavRow(page),
              embeds: [],
            });
            return;
          }
          if (i.customId.startsWith('carinfo_back_')) {
            const prevPage = parseInt(i.customId.split('_').pop(), 10);
            page = prevPage;
            await i.update({
              content: 'Select a car to view its info:',
              components: getNavRow(page),
              embeds: [],
            });
            return;
          }
        }
        if (i.isStringSelectMenu() && i.customId.startsWith('carinfo_select_')) {
          const carName = i.values[0];
          const car = cars.find(c => c.name === carName);

          const embed = new EmbedBuilder()
            .setTitle(car.name)
            .addFields(
              { name: 'Last Serial Dropped', value: formatDate(car.lastDrop), inline: true },
              { name: 'Droppable', value: car.droppable ? 'YES' : 'NO', inline: true },
              { name: 'Last Traded', value: formatDate(car.lastTraded), inline: true }
            )
            .setColor(0x007fff);

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
      } catch (err) {}
    });

    collector.on('end', async () => {
      try {
        await replyMsg.edit({ components: [] });
      } catch {}
    });
  }
};
