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

// Helper to make shop embed
function getShopEmbed(shop) {
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

  let footer = getShopRefreshText();
  const expiring = shop.featured.filter(item => item.expiresAt);
  if (expiring.length) {
    const soonest = expiring.map(i => i.expiresAt).sort()[0];
    footer += ` | LIMITED EVENT items available until ${formatExpiryET(soonest)}`;
  }

  return new EmbedBuilder()
    .setTitle('🛒 Mustang Hunt Shop')
    .setDescription('Check out today’s featured and daily deals!\nClick the Buy button for the item you want!')
    .setColor(0x2ECC71)
    .addFields(
      { name: '🌟 Featured Items 🌟', value: featuredText },
      { name: '🛒 Daily Items 🛒', value: dailyText }
    )
    //.setThumbnail('https://cdn.discordapp.com/icons/yourguildid/shopicon.png') // Optional
    .setFooter({ text: footer });
}

// Helper to make buttons for shop items
function getShopButtons(shop) {
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
  return components;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View today\'s shop!'),
  async execute(interaction) {
    const shop = createShop();
    const embed = getShopEmbed(shop);
    const components = getShopButtons(shop);
    await interaction.reply({ embeds: [embed], components, flags: 64 });
  },

  // --- BUTTON HANDLER ---
  async handleButton(interaction) {
    // Buy buttons
    if (interaction.customId.startsWith('buy_')) {
      const [ , section, sectionIdx ] = interaction.customId.split('_');
      const shop = createShop();
      let item;
      if (section === 'featured') item = shop.featured[Number(sectionIdx)];
      else if (section === 'daily') item = shop.daily[Number(sectionIdx)];
      if (!item) {
        await interaction.reply({ content: "That item is no longer available.", flags: 64 });
        return;
      }

      // Confirmation buttons
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmbuy_${section}_${sectionIdx}`)
          .setLabel(`Yes, buy for ${item.price} coins`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelbuy')
          .setLabel("No, cancel")
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({
        content: `Are you sure you want to buy **${item.name}** for **${item.price}** coins?`,
        components: [confirmRow],
        flags: 64
      });
      return;
    }
    // Confirm buy
    if (interaction.customId.startsWith('confirmbuy_')) {
      const [ , section, sectionIdx ] = interaction.customId.split('_');
      const shop = createShop();
      let item;
      if (section === 'featured') item = shop.featured[Number(sectionIdx)];
      else if (section === 'daily') item = shop.daily[Number(sectionIdx)];
      if (!item) {
        await interaction.reply({ content: "That item is no longer available.", flags: 64 });
        return;
      }

      // --- TODO: Add your coin-check and inventory logic here ---
      // Example:
      // const userCoins = await getUserCoins(interaction.user.id);
      // if (userCoins < item.price) {
      //   await interaction.reply({ content: "You don't have enough coins!", flags: 64 });
      //   return;
      // }
      // await subtractUserCoins(interaction.user.id, item.price);
      // await giveUserItem(interaction.user.id, item);

      await interaction.reply({ content: `You bought **${item.name}** for **${item.price}** coins!`, flags: 64 });
      return;
    }
    // Cancel buy
    if (interaction.customId === 'cancelbuy') {
      await interaction.reply({ content: "Purchase cancelled.", flags: 64 });
      return;
    }
  }
};
