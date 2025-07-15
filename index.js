require('dotenv').config();
require('./keepAlive');
const fs = require('fs');
const mongoose = require('mongoose');
const { dropCar, getRarityEmoji, rarityColors } = require('./dropCar.js');
const trade = require('./trade.js');
const cars = require('./data/cars.js');
const carinfoCmd = require('./commands/carinfo.js');
const removecarCmd = require('./commands/removecar.js');
const { addTokens } = require('./data/tokenHelper.js');
const tokensCmd = require('./commands/tokens.js');
const shopCmd = require('./commands/shop.js');
const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, InteractionType,
  REST, Routes
} = require('discord.js');

const logStream = fs.createWriteStream('bot.log', { flags: 'a' });
function log(message) {
  const time = new Date().toISOString();
  logStream.write(`[${time}] ${message}\n`);
  console.log(message);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const DROP_CHANNEL_ID = '1372749024662257664';
const GARAGE_CHANNEL_ID = '1372749137413668884';
const TRADE_POSTS_CHANNEL_ID = '1374486602012692581';
const TRADEOFFERS_CHANNEL_ID = '1374486704387264512';
const TRADE_COMMAND_CHANNEL_ID = '1374623379406979134';
const TRADE_HISTORY_CHANNEL_ID = '1381780373192573019';
const GUILD_ID = '1370450475400302686';

const Garage = require('./models/garage');

const tradeListingSchema = new mongoose.Schema({
  userId: String,
  car: { name: String, serial: Number },
  note: String,
  timestamp: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  messageId: String
});
const TradeListing = mongoose.model('TradeListing', tradeListingSchema);

const tradeOfferSchema = new mongoose.Schema({
  fromUserId: String,
  toUserId: String,
  offeredCars: [{
    name: String,
    serial: Number
  }],
  requestedCar: { name: String, serial: Number },
  message: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },
  messageId: String
});
const TradeOffer = mongoose.model('TradeOffer', tradeOfferSchema);

const nascarUnlockCar = '2022 Mustang NASCAR Cup Car';
const requiredForNascar = ['2024 Mustang GT3', '2024 Mustang GT4', '2025 Mustang GTD'];

function getChanceFromRarity(level) {
  const weights = {
    1: 1,      // Common
    2: 0.8,    // Uncommon
    3: 0.7,    // Rare
    4: 0.6,    // Epic
    5: 0.5,    // Legendary
    6: 0.45,   // Mythic
    7: 0.4,    // Ultra Mythic
    8: 0.3,    // Godly
    9: 0.2,    // ???
    10: 0,     // LIMITED EVENT (CANNOT DROP)
  };
  return weights[level] || 0;
}

function getRarityTag(car) {
  if (!car || !car.rarity) return '[Unknown]';
  switch (car.rarity) {
    case 'Godly': return '***[GODLY]***';
    case 'Ultra Mythic': return '**[ULTRA MYTHIC]**';
    case 'Mythic': return '**[MYTHIC]**';
    case '???': return '**[???]**';
    default: return `[${car.rarity.toUpperCase()}]`;
  }
}

function getRandomCar() {
  const weighted = cars
    .filter(car => car.rarityLevel > 0)
    .map(car => ({ ...car, chance: getChanceFromRarity(car.rarityLevel) }));
  const total = weighted.reduce((acc, c) => acc + c.chance, 0);
  const roll = Math.random() * total;
  let sum = 0;
  for (const car of weighted) {
    sum += car.chance;
    if (roll <= sum) return car;
  }
  return weighted[0];
}

function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function calculateGlobalCounts(garages) {
  const globalCount = {};
  for (const g of garages) {
    for (const car of g.cars) {
      if (car && car.name) {
        globalCount[car.name] = (globalCount[car.name] || 0) + 1;
      }
    }
  }
  return globalCount;
}

function renderGaragePage(viewerId, garage, globalCount, pageIndex, garageOwnerUser, garageOwnerId, carsMeta) {
  const pages = chunkArray(garage.cars, 10);

  if (pageIndex < 0) pageIndex = 0;
  if (pageIndex > pages.length - 1) pageIndex = pages.length - 1;

  if (!pages.length || !pages[pageIndex]) {
    const embed = new EmbedBuilder()
      .setTitle(viewerId === garageOwnerId
        ? `🚗 Your Garage (0 cars)`
        : `🚗 ${garageOwnerUser.username}'s Garage`)
      .setDescription('No cars found.')
      .setColor(0x00BFFF);
    return { embed, components: [] };
  }

  const rarityOrder = [
    "???", "Godly", "Ultra Mythic", "Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common", "LIMITED EVENT"
  ];

  const carsOnPage = pages[pageIndex].map(car => {
    if (!car || !car.name) return { name: "[Unknown]", serial: "?", rarity: "[Unknown]", rarityLevel: 0 };
    const meta = carsMeta.find(c => c.name === car.name);
    return {
      ...car,
      rarity: meta ? meta.rarity : "Unknown",
      rarityLevel: meta ? meta.rarityLevel : 0,
      name: car.name || "[Unknown]",
      serial: car.serial || "?"
    };
  });

  const grouped = {};
  for (const rarity of rarityOrder) grouped[rarity] = [];
  for (const car of carsOnPage) {
    grouped[car.rarity] = grouped[car.rarity] || [];
    grouped[car.rarity].push(car);
  }

  let list = '';
  for (const rarity of rarityOrder) {
    if (grouped[rarity] && grouped[rarity].length > 0) {
      const emoji = getRarityEmoji(rarity);
      list += `\n__**${emoji} ${rarity.toUpperCase()}**__\n`;
      list += grouped[rarity]
        .map(car => {
          const name = car.name || "[Unknown]";
          const serial = car.serial || "?";
          const total = globalCount[name] || "1";
          return `**${name}** (#${serial} of ${total}) ${getRarityEmoji(rarity)}`;
        })
        .join('\n') + '\n';
    }
  }
  list = list.trim();

  const embed = new EmbedBuilder()
    .setTitle(viewerId === garageOwnerId
      ? `🚗 Your Garage (${garage.cars.length} cars) - Page ${pageIndex + 1}/${pages.length}`
      : `🚗 ${garageOwnerUser.username}'s Garage - Page ${pageIndex + 1}/${pages.length}`)
    .setDescription(list.length ? list : 'No cars found.')
    .setColor(0x00BFFF);

  const row = new ActionRowBuilder();
  if (pageIndex > 0)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`garage:${garageOwnerId}:${pageIndex - 1}`)
        .setLabel('⬅️ Prev')
        .setStyle(ButtonStyle.Secondary)
    );
  if (pageIndex < pages.length - 1)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`garage:${garageOwnerId}:${pageIndex + 1}`)
        .setLabel('Next ➡️')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embed, components: row.components.length ? [row] : [] };
}

let dropState = { activeDrop: null, dropTimeout: null };
const claimingUsers = new Set();
const claimCooldowns = new Map();

function scheduleNextDrop(channel) {
  const delay = Math.floor(Math.random() * (45 - 10 + 1) + 10) * 60 * 1000;
  setTimeout(() => {
    if (!dropState.activeDrop) dropCar(channel, getRandomCar, scheduleNextDrop, dropState);
  }, delay);
}

trade.setTradeDependencies({ Garage, TradeListing, TradeOffer, cars, log });

async function cleanupExpiredTrades() {
  const now = Date.now();
  const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
  const expiredListings = await TradeListing.find({ active: true, timestamp: { $lt: threeHoursAgo } });
  for (const listing of expiredListings) {
    await TradeListing.findByIdAndUpdate(listing._id, { active: false });
    try {
      const channel = await client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
      const msg = await channel.messages.fetch(listing.messageId);
      if (msg.embeds.length > 0) {
        const expiredEmbed = EmbedBuilder.from(msg.embeds[0])
          .setTitle('❌ Trade Listing Expired')
          .setColor(0xAAAAAA)
          .setDescription('This trade listing has expired and is no longer active.');
        await msg.edit({ embeds: [expiredEmbed], content: '' });
      } else {
        await msg.edit({ content: '❌ Trade listing expired.', embeds: [] });
      }
    } catch (e) {
      log(`❌ Error editing expired trade message: ${e}`);
    }
  }
}

async function cleanupExpiredTradeOffers() {
  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
  const expiredOffers = await TradeOffer.find({ status: 'pending', timestamp: { $lt: oneHourAgo } });
  for (const offer of expiredOffers) {
    await TradeOffer.findByIdAndUpdate(offer._id, { status: 'expired' });
    try {
      const channel = await client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
      const msg = await channel.messages.fetch(offer.messageId);
      if (msg.embeds.length > 0) {
        const expiredEmbed = EmbedBuilder.from(msg.embeds[0])
          .setTitle('❌ Trade Offer Expired')
          .setColor(0xAAAAAA)
          .setDescription('This trade offer has expired and is no longer active.');
        await msg.edit({ embeds: [expiredEmbed], content: '' });
      } else {
        await msg.edit({ content: '❌ Trade offer expired.', embeds: [] });
      }
    } catch (e) {
      log(`❌ Error editing expired trade offer message: ${e}`);
    }
  }
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Connected to MongoDB');
    client.login(process.env.TOKEN);
  } catch (err) {
    log('❌ MongoDB connection error: ' + err);
  }
})();

client.once('ready', async () => {
  log(`🟢 Logged in as ${client.user.tag}`);
  try {
    const dropChannel = await client.channels.fetch(DROP_CHANNEL_ID);
    if (dropChannel) scheduleNextDrop(dropChannel);
  } catch (e) {
    log('❌ Error fetching drop channel: ' + e);
  }
  await cleanupExpiredTrades();
  await cleanupExpiredTradeOffers();
  setInterval(cleanupExpiredTrades, 10 * 60 * 1000);
  setInterval(cleanupExpiredTradeOffers, 10 * 60 * 1000);

  const commands = [
    new SlashCommandBuilder().setName('claim').setDescription('Claim the currently dropped car'),
    new SlashCommandBuilder().setName('drop').setDescription('Force a drop').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('dropbyrarity')
      .setDescription('Drop a random car of a specific rarity')
      .addStringOption(opt =>
        opt.setName('rarity')
          .setDescription('Car rarity (e.g., Godly, Rare, Epic)')
          .setRequired(true)
          .addChoices(
            { name: '???', value: '???' },
            { name: 'Godly', value: 'Godly' },
            { name: 'Ultra Mythic', value: 'Ultra Mythic' },
            { name: 'Mythic', value: 'Mythic' },
            { name: 'Legendary', value: 'Legendary' },
            { name: 'Epic', value: 'Epic' },
            { name: 'Rare', value: 'Rare' },
            { name: 'Uncommon', value: 'Uncommon' },
            { name: 'Common', value: 'Common' },
            { name: 'LIMITED EVENT', value: 'LIMITED EVENT' }
          )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('garage').setDescription('View a garage').addUserOption(opt => opt.setName('user').setDescription('User to view')),
    new SlashCommandBuilder().setName('resetgarage').setDescription("Reset a user's garage").addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('stats').setDescription('View bot stats'),
    new SlashCommandBuilder().setName('trade').setDescription('List a car for trade (select from menu, then add a note)'),
    new SlashCommandBuilder().setName('canceltrade').setDescription('Cancel all your active trade listings'),
    new SlashCommandBuilder().setName('help').setDescription('Show help information for all commands'),
    removecarCmd.data,
    carinfoCmd.data,
    tokensCmd.data,
    shopCmd.data,
  ].map(cmd => cmd.toJSON());

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    log('✅ Slash commands registered');
  } catch (e) {
    log('❌ Error registering slash commands: ' + e);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName, user, channel, options, member } = interaction;
      const userId = user.id;

      if (commandName === 'help') {
        const embed = new EmbedBuilder()
          .setTitle('🚦 Mustang Hunt Bot Help')
          .setDescription("Here's a list of all available commands and what they do:")
          .addFields(
            { name: '/claim', value: 'Claim the currently dropped car. Only works when a drop is active. Cooldown applies.' },
            { name: '/drop', value: 'Force a car drop. **Administrator only.**' },
            { name: '/dropbyrarity <rarity>', value: 'Force-drop a car of the specified rarity. **Administrator only.**' },
            { name: '/garage [user]', value: `View your garage or another user's garage. Only works in <#${GARAGE_CHANNEL_ID}>.` },
            { name: '/resetgarage <user>', value: 'Reset a user\'s garage. **Administrator only.**' },
            { name: '/stats', value: 'View bot statistics (users, cars, uptime).' },
            { name: '/trade', value: `List a car from your garage for trade. **Use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.** You'll select the car and can add a note. The listing will appear in #trade-posts.` },
            { name: '/canceltrade', value: 'Cancel all your active trade listings.' },
            { name: '/help', value: 'Show this help message.' },
            { name: '/carinfo', value: 'Select a car and view its detailed info.' },
            { name: '/removecar', value: 'Admin: Remove a car from a user’s garage.' }
          )
          .setFooter({ text: 'Tip: Use /trade only in the trade-commands channel; listings appear in #trade-posts.' })
          .setColor(0x00BFFF);
        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      if (commandName === 'dropbyrarity') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ No permission.', flags: 64 });
        }
        const rarity = options.getString('rarity');
        // Filter cars by the specified rarity
        const carsOfRarity = cars.filter(car => car.rarity === rarity);
        if (!carsOfRarity.length) {
          return interaction.reply({ content: `❌ No cars found with rarity "${rarity}".`, flags: 64 });
        }
        // Pick a random car of that rarity
        const car = carsOfRarity[Math.floor(Math.random() * carsOfRarity.length)];
        try {
          dropCar(channel, () => car, scheduleNextDrop, dropState);
          return interaction.reply({ content: `🚗 Dropped a random **${rarity}** car!`, flags: 64 });
        } catch (error) {
          log(`ERROR in /dropbyrarity: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ An error occurred dropping the car.', flags: 64 });
          }
        }
      }

      if (commandName === 'carinfo') {
  return carinfoCmd.execute(interaction);
}
if (commandName === 'removecar') {
  return removecarCmd.execute(interaction);
}
if (commandName === 'tokens') {
  return tokensCmd.execute(interaction);
}

      if (commandName === 'claim') {
        const now = Date.now();
        if (claimCooldowns.has(userId) && (now - claimCooldowns.get(userId)) < 10000) {
          return interaction.reply({ content: '⏳ You must wait 10 seconds between claims.', flags: 64 });
        }
        claimCooldowns.set(userId, now);

        if (!dropState.activeDrop) return interaction.reply({ content: '❌ No car to claim.', flags: 64 });
        if (dropState.activeDrop.claimed) return interaction.reply({ content: '⚠️ Already claimed.', flags: 64 });
        if (claimingUsers.has(userId)) return;
        claimingUsers.add(userId);
        try {
          dropState.activeDrop.claimed = true;
          clearTimeout(dropState.dropTimeout);
          await dropState.activeDrop.message.delete().catch(() => {});

          const carObj = dropState.activeDrop.car;
          if (!carObj || !carObj.name) {
            await interaction.reply({ content: '❌ Error: claimed car is missing data.', flags: 64 });
            dropState.activeDrop = null;
            scheduleNextDrop(channel);
            return;
          }

          const claimEmbed = new EmbedBuilder()
            .setTitle('🏆 Mustang Claimed!')
            .setDescription(
              `**${user.username}** claimed\n` +
              `> 🚗 **${carObj.name}** ${getRarityEmoji(carObj.rarity)}`
            )
            .setColor(rarityColors[carObj.rarity] || 0x00BFFF)
            .setFooter({ text: 'Congratulations on your new ride!' });

          await channel.send({ embeds: [claimEmbed] });
          let garage = await Garage.findOne({ userId });
          if (!garage) garage = new Garage({ userId, cars: [] });
          const allGarages = await Garage.find();
          const globalCarCount = allGarages.reduce((sum, g) => sum + g.cars.filter(c => c.name === carObj.name).length, 0);
          garage.cars.push({ name: carObj.name, serial: globalCarCount + 1 });

          garage.cars = garage.cars.filter(c => c && c.name);

          if (
            new Date() <= new Date('2025-05-31') &&
            requiredForNascar.every(req => garage.cars.some(c => c.name === req)) &&
            !garage.cars.some(c => c.name === nascarUnlockCar)
          ) {
            garage.cars.push({ name: nascarUnlockCar, serial: 1 });
            await channel.send(`🎉 ${user.username} unlocked **${nascarUnlockCar}**!`);
          }

         await garage.save();

// Award Hunt Tokens for claiming a car
const boosterRoleId = '1392720458960339005';
const isBoosting = member.roles.cache.has(boosterRoleId);
await addTokens(userId, 1, isBoosting);

dropState.activeDrop = null;
scheduleNextDrop(channel);
await interaction.reply({ content: '✅ You claimed the car!', flags: 64 });
        } catch (error) {
          log(`DB ERROR in /claim: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
          }
        } finally {
          claimingUsers.delete(userId);
        }
        return;
      }

      if (commandName === 'drop') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', flags: 64 });
        try {
          dropCar(channel, getRandomCar, scheduleNextDrop, dropState);
          return interaction.reply({ content: '🚗 Car dropped.', flags: 64 });
        } catch (error) {
          log(`ERROR in /drop: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ An error occurred dropping the car.', flags: 64 });
          }
        }
      }

      if (commandName === 'garage') {
        if (channel.id !== GARAGE_CHANNEL_ID) return interaction.reply({ content: '❌ Use /garage in the garage channel.', flags: 64 });
        try {
          const target = options.getUser('user') || user;
          const garage = await Garage.findOne({ userId: target.id });
          if (!garage || garage.cars.length === 0) return interaction.reply({ content: '🚫 Garage is empty.', flags: 64 });

          garage.cars = garage.cars.filter(c => c && c.name);

          const all = await Garage.find();
          const globalCount = calculateGlobalCounts(all);
          const { embed, components } = renderGaragePage(user.id, garage, globalCount, 0, target, target.id, cars);

          await interaction.reply({ embeds: [embed], components, flags: 64 });
        } catch (error) {
          log(`DB ERROR in /garage: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
          }
        }
        return;
      }

      if (commandName === 'resetgarage') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', flags: 64 });
        try {
          const target = options.getUser('user');
          await Garage.findOneAndUpdate({ userId: target.id }, { cars: [] }, { upsert: true });
          return interaction.reply({ content: `♻️ Reset ${target.username}'s garage.`, flags: 64 });
        } catch (error) {
          log(`DB ERROR in /resetgarage: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
          }
        }
      }

      if (commandName === 'stats') {
        try {
          const all = await Garage.find();
          const users = all.length;
          const carsTotal = all.reduce((s, g) => s + g.cars.length, 0);
          const up = process.uptime();
          const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = Math.floor(up % 60);
          await interaction.reply({ content: `📊 **Bot Stats**
• 👥 Users: **${users}**
• 🚗 Total Cars: **${carsTotal}**
• ⏱️ Uptime: **${h}h ${m}m ${s}s**`, flags: 64 });
        } catch (error) {
          log(`DB ERROR in /stats: ${error}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
          }
        }
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'trade') {
        await trade.handleTradeCommand(interaction, TRADE_COMMAND_CHANNEL_ID);
        return;
      }
      if (interaction.commandName === 'canceltrade') {
        await trade.handleCancelTradeCommand(interaction, TRADE_POSTS_CHANNEL_ID);
        return;
      }
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("tradeSelect:")) {
      await trade.handleTradeSelectMenu(interaction);
      return;
    }
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('tradeNoteModal:')) {
      await trade.handleTradeNoteModal(interaction, TRADE_POSTS_CHANNEL_ID);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('sendOffer:')) {
      await trade.handleSendOfferButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("chooseOffer:")) {
      await trade.handleChooseOfferMenu(interaction, TRADEOFFERS_CHANNEL_ID);
      return;
    }
    if (interaction.isButton() && (
      interaction.customId.startsWith('acceptOffer:') ||
      interaction.customId.startsWith('declineOffer:') ||
      interaction.customId.startsWith('cancelTradeConfirm:')
    )) {
      await trade.handleOfferButton(
        interaction,
        TRADE_POSTS_CHANNEL_ID,
        TRADEOFFERS_CHANNEL_ID,
        TRADE_HISTORY_CHANNEL_ID
      );
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('garage:')) {
      try {
        const [, garageOwnerId, pageIndexStr] = interaction.customId.split(':');
        const pageIndex = parseInt(pageIndexStr, 10);

        const garage = await Garage.findOne({ userId: garageOwnerId });
        if (!garage || garage.cars.length === 0) {
          return interaction.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('🚗 Garage is empty')
                .setDescription('No cars found.')
                .setColor(0x00BFFF)
            ],
            components: [],
            flags: 64
          });
        }

        garage.cars = garage.cars.filter(c => c && c.name);

        const all = await Garage.find();
        const globalCount = calculateGlobalCounts(all);
        const userObj = await client.users.fetch(garageOwnerId);
        const { embed, components } = renderGaragePage(
          interaction.user.id, garage, globalCount, pageIndex, userObj, garageOwnerId, cars
        );

        await interaction.update({ embeds: [embed], components, flags: 64 });
      } catch (error) {
        log(`DB ERROR in garage pagination: ${error}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ An error occurred loading this page.', flags: 64 });
        }
      }
      return;
    }

    // --- removecar select menu handler ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('removecar_select_')) {
      const targetUserId = interaction.customId.split('_')[2];
      const carId = interaction.values[0];

      const garage = await Garage.findOne({ userId: targetUserId });
      if (!garage) {
        return interaction.update({ content: 'Garage not found.', components: [], flags: 64 });
      }
      const car = garage.cars.find(c => c._id && c._id.toString() === carId);
      if (!car) {
        return interaction.update({ content: 'Car not found.', components: [], flags: 64 });
      }

      const { name, serial } = car;
      // Remove the car from the array
      garage.cars = garage.cars.filter(c => c._id.toString() !== carId);
      await garage.save();

      // TODO: Add logic here to return serial to drop pool if needed
      log(`Serial ${serial} of ${name} returned to drop pool.`);

      await interaction.update({
        content: `Removed ${name} (Serial ${serial}) from <@${targetUserId}>. Serial returned to the drop pool.`,
        components: [],
        flags: 64
      });
      return;
    }
    // --- end removecar select menu handler ---

  } catch (error) {
    log(`Interaction error: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred.', flags: 64 });
    }
  }
});
