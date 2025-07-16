const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} = require('discord.js');
const { createShop } = require('../shop/shopManager');
const Garage = require('../models/garage');

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
function getShopEmbed(shop) {
  const featuredText = shop.featured.length
    ? shop.featured.map(item => {
        let line = `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} Hunt Tokens\``;
        if (item.type === 'theme') line += ' _(Garage Theme)_';
        if (item.type === 'title') line += ' _(Garage Title)_';
        if (item.expiresAt) {
          line += ` _(Available until ${formatExpiryET(item.expiresAt)})_`;
        }
        return line;
      }).join('\n')
    : 'No featured items today!';
  const dailyText = shop.daily.length
    ? shop.daily.map(item => {
        let line = `• **${item.name}** [${formatRarity(item.rarity)}] — \`${item.price} Hunt Tokens\``;
        if (item.type === 'theme') line += ' _(Garage Theme)_';
        if (item.type === 'title') line += ' _(Garage Title)_';
        return line;
      }).join('\n')
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
    .setFooter({ text: footer });
}
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

// Helper functions for Hunt Tokens/inventory
async function getUserTokens(userId) {
  let garage = await Garage.findOne({ userId });
  return garage?.tokens ?? 0;
}
async function subtractUserTokens(userId, amount) {
  let garage = await Garage.findOne({ userId });
  if (!garage) return false;
  if (garage.tokens < amount) return false;
  garage.tokens -= amount;
  await garage.save();
  return true;
}

// Give item (car, theme, or title) to user
async function giveUserItem(userId, item) {
  let garage = await Garage.findOne({ userId });
  if (!garage) {
    garage = new Garage({ userId, cars: [], tokens: 0, ownedThemes: [], ownedTitles: [] });
  }
  // Theme
  if (item.type === 'theme') {
    if (!garage.ownedThemes) garage.ownedThemes = [];
    if (!garage.ownedThemes.includes(item.name)) {
      garage.ownedThemes.push(item.name);
    }
  }
  // Title
  else if (item.type === 'title') {
    if (!garage.ownedTitles) garage.ownedTitles = [];
    if (!garage.ownedTitles.includes(item.name)) {
      garage.ownedTitles.push(item.name);
    }
  }
  // Car
  else {
    const allGarages = await Garage.find();
    const globalCount = allGarages.reduce(
      (sum, g) => sum + g.cars.filter(c => c.name === item.name).length, 0
    );
    garage.cars.push({ name: item.name, serial: globalCount + 1 });
  }
  await garage.save();
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

      // Show confirmation
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmbuy_${section}_${sectionIdx}`)
          .setLabel(`Yes, buy for ${item.price} Hunt Tokens`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelbuy')
          .setLabel("No, cancel")
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({
        content: `Are you sure you want to buy **${item.name}** for **${item.price}** Hunt Tokens?`,
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

      // HUNT TOKEN CHECK
      const tokens = await getUserTokens(interaction.user.id);
      if (tokens < item.price) {
        await interaction.reply({ content: "You don't have enough Hunt Tokens!", flags: 64 });
        return;
      }

      // DEDUCT HUNT TOKENS & GIVE ITEM
      await subtractUserTokens(interaction.user.id, item.price);
      await giveUserItem(interaction.user.id, item);

      let itemTypeText = '';
      if (item.type === 'theme') itemTypeText = ' (Garage Theme)';
      if (item.type === 'title') itemTypeText = ' (Garage Title)';
      if (item.type === 'car') itemTypeText = ' (Car)';

      await interaction.reply({ content: `You bought **${item.name}**${itemTypeText} for **${item.price}** Hunt Tokens!`, flags: 64 });
      return;
    }
    // Cancel buy
    if (interaction.customId === 'cancelbuy') {
      await interaction.reply({ content: "Purchase cancelled.", flags: 64 });
      return;
    }
  }
};
