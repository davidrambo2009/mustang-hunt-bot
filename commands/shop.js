const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createShop } = require('../shop/shopManager');

// Add rarity emojis
const rarityEmojis = {
  'Common': '⚪',
  'Uncommon': '🟩',
  'Rare': '🟦',
  'Epic': '🟪',
  'Legendary': '🟨',
  'LIMITED EVENT': '🟥',
  'Godly': '🔶',
  'Mythic': '🔷',
  'Ultra Mythic': '✨',
  '???': '❓'
};

function formatRarity(rarity) {
  return `${rarityEmojis[rarity] || ''} ${rarity}`;
}

// Returns a string like "Shop refresh in 17 hours" or "Shop refresh in 23 minutes"
function getShopRefreshText() {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setUTCHours(24, 0, 0, 0); // Midnight UTC
  const msLeft = nextReset - now;
  const hours = Math.floor(msLeft / (1000 * 60 * 60));
  const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `Shop refresh in ${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `Shop refresh in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  return 'Shop refresh in less than a minute!';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View today\'s shop!'),
  async execute(interaction) {
    const shop = createShop();

    // Format featured and daily items
    const featuredText = shop.featured.length
      ? shop.featured.map(item =>
          `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} coins\``
        ).join('\n')
      : 'No featured items today!';

    const dailyText = shop.daily.length
      ? shop.daily.map(item =>
          `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} coins\``
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
      //.setThumbnail('https://cdn.discordapp.com/icons/yourguildid/shopicon.png') // Optional
      .setFooter({ text: getShopRefreshText() });

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
