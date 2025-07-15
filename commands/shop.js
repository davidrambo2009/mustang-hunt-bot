const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createShop } = require('../shop/shopManager'); // adjust path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View today\'s shop!'),
  async execute(interaction) {
    const shop = createShop();

    // Format featured and daily items
    const featuredText = shop.featured.length
      ? shop.featured.map(item =>
          `• **${item.name}** [${item.rarity}] — \`${item.price} coins\``
        ).join('\n')
      : 'No featured items today!';

    const dailyText = shop.daily.length
      ? shop.daily.map(item =>
          `• **${item.name}** [${item.rarity}] — \`${item.price} coins\``
        ).join('\n')
      : 'No daily items today!';

    const embed = new EmbedBuilder()
      .setTitle('🛒 Mustang Hunt Shop')
      .setDescription('Check out today’s featured and daily deals!')
      .setColor(0x2ECC71) // Vibrant green
      .addFields(
        { name: '🌟 Featured Items 🌟', value: featuredText },
        { name: '🛒 Daily Items 🛒', value: dailyText }
      )
      //.setThumbnail('https://cdn.discordapp.com/icons/yourguildid/shopicon.png') // Optional: put your icon URL here
      .setFooter({ text: 'Shop refreshes daily!' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
