const { SlashCommandBuilder } = require('discord.js');
const { createShop } = require('../shop/shopManager'); // adjust to your path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View today\'s shop!'),
  async execute(interaction) {
    const shop = createShop();

    // Format featured items
    let featuredText = "**🌟 Featured Items 🌟**\n";
    shop.featured.forEach(item => {
      featuredText += `• ${item.name} [${item.rarity}] — ${item.price} coins\n`;
    });

    // Format daily items
    let dailyText = "\n**🛒 Daily Items 🛒**\n";
    shop.daily.forEach(item => {
      dailyText += `• ${item.name} [${item.rarity}] — ${item.price} coins\n`;
    });

    await interaction.reply({
      content: `${featuredText}${dailyText}`,
      flags: 64 // Always use flags: 64 for ephemeral replies
    });
  },
};
