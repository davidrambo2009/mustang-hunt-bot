const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
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
  if (hours > 0) return `Shop refreshes in ${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `Shop refreshes in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return 'Shop refreshes in less than a minute!';
}

// Format event expiry for ET (Eastern Time)
function formatExpiryET(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: true
    }) + ' ET';
  } catch {
    return '';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View today\'s shop!'),
  async execute(interaction) {
    const shop = createShop();

    // Show expiry next to any event featured item
    const featuredText = shop.featured.length
      ? shop.featured.map(item => {
          let line = `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} coins\``;
          if (item.expiresAt) {
            line += ` _(Available until ${formatExpiryET(item.expiresAt)})_`;
          }
          return line;
        }).join('\n')
      : 'No featured items today!';

    const dailyText = shop.daily.length
      ? shop.daily.map(item =>
          `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} coins\``
        ).join('\n')
      : 'No daily items today!';

    // If there are any expiring featured items, make it extra clear in the footer!
    let footer = getShopRefreshText();
    const expiring = shop.featured.filter(item => item.expiresAt);
    if (expiring.length) {
      // Find the latest expiration for summary
      const soonest = expiring.map(i => i.expiresAt).sort()[0];
      footer += ` | LIMITED EVENT items available until ${formatExpiryET(soonest)}`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🛒 Mustang Hunt Shop')
      .setDescription('Check out today’s featured and daily deals!\nClick the Buy button for the item you want!')
      .setColor(0x2ECC71) // Vibrant green
      .addFields(
        { name: '🌟 Featured Items 🌟', value: featuredText },
        { name: '🛒 Daily Items 🛒', value: dailyText }
      )
      //.setThumbnail('https://cdn.discordapp.com/icons/yourguildid/shopicon.png') // Optional
      .setFooter({ text: footer });

    // === BUTTONS ===
    const components = [];

    // Featured Items (row 1)
    if (shop.featured.length) {
      const featuredRow = new ActionRowBuilder();
      shop.featured.forEach((item, idx) => {
        featuredRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_featured_${idx}`)
            .setLabel(`Buy: ${item.name}`)
            .setStyle(ButtonStyle.Primary)
        );
      });
      components.push(featuredRow);
    }

    // Daily Items (row 2)
    if (shop.daily.length) {
      const dailyRow = new ActionRowBuilder();
      shop.daily.forEach((item, idx) => {
        dailyRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_daily_${idx}`)
            .setLabel(`Buy: ${item.name}`)
            .setStyle(ButtonStyle.Primary)
        );
      });
      components.push(dailyRow);
    }

    await interaction.reply({ embeds: [embed], components, ephemeral: true }); // ephemeral = only visible to the user
  },
};
