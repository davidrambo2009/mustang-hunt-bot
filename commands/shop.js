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

    // Format featured and daily items for the embed
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

    // Footer for shop refresh and event expiry
    let footer = getShopRefreshText();
    const expiring = shop.featured.filter(item => item.expiresAt);
    if (expiring.length) {
      const soonest = expiring.map(i => i.expiresAt).sort()[0];
      footer += ` | LIMITED EVENT items available until ${formatExpiryET(soonest)}`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🛒 Mustang Hunt Shop')
      .setDescription('Check out today’s featured and daily deals!\nClick the Buy button for the item you want!')
      .setColor(0x2ECC71)
      .addFields(
        { name: '🌟 Featured Items 🌟', value: featuredText },
        { name: '🛒 Daily Items 🛒', value: dailyText }
      )
      //.setThumbnail('https://cdn.discordapp.com/icons/yourguildid/shopicon.png') // Optional
      .setFooter({ text: footer });

    // === BUTTONS ===
    // Combine all shop items, track which section (featured/daily) and index
    const allShopItems = [
      ...shop.featured.map((item, idx) => ({
        ...item,
        section: 'featured',
        sectionIdx: idx
      })),
      ...shop.daily.map((item, idx) => ({
        ...item,
        section: 'daily',
        sectionIdx: idx
      }))
    ];

    // Split buttons into chunks of 5 (max per row)
    const components = [];
    for (let i = 0; i < allShopItems.length; i += 5) {
      const row = new ActionRowBuilder();
      allShopItems.slice(i, i + 5).forEach((item) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_${item.section}_${item.sectionIdx}`)
            .setLabel(`Buy: ${item.name}`)
            .setStyle(ButtonStyle.Primary)
        );
      });
      components.push(row);
    }

    await interaction.reply({ embeds: [embed], components, flags: 64 });
  },
};
