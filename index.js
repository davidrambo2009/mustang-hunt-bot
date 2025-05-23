require('dotenv').config();
require('./keepAlive');
const fs = require('fs');
const mongoose = require('mongoose');
const trade = require('./trade.js');
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
const GUILD_ID = '1370450475400302686';

const garageSchema = new mongoose.Schema({
  userId: String,
  cars: [{ name: String, serial: Number }]
});
const Garage = mongoose.model('Garage', garageSchema);

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
  offeredCar: { name: String, serial: Number },
  requestedCar: { name: String, serial: Number },
  message: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  messageId: String
});
const TradeOffer = mongoose.model('TradeOffer', tradeOfferSchema);

const rarityColors = {
  Common: 0xAAAAAA,
  Uncommon: 0x00FF00,
  Rare: 0x0099FF,
  Epic: 0x8000FF,
  Legendary: 0xFFA500,
  Mythic: 0xFF0000,
  'Ultra Mythic': 0x9900FF,
  Godly: 0xFFD700,
  'LIMITED EVENT': 0xD726FF
};

const cars = [
  { name: '2015 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1 },
  { name: '2018 Mustang GT', rarity: 'Uncommon', rarityLevel: 3 },
  { name: '2019 Mustang GT', rarity: 'Uncommon', rarityLevel: 3 },
  { name: '2020 Shelby GT500', rarity: 'Rare', rarityLevel: 5 },
  { name: '2021 Mustang Mach 1', rarity: 'Rare', rarityLevel: 5 },
  { name: '2024 Mustang GT', rarity: 'Uncommon', rarityLevel: 3 },
  { name: '2024 Mustang Dark Horse', rarity: 'Epic', rarityLevel: 7 },
  { name: '2024 Supercharged Mustang GT', rarity: 'Epic', rarityLevel: 7 },
  { name: '2025 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1 },
  { name: '2025 Mustang GT 60th Anniversary', rarity: 'Rare', rarityLevel: 5 },
  { name: '2025 GT350', rarity: 'Epic', rarityLevel: 7 },
  { name: '2025 Shelby Super Snake', rarity: 'Legendary', rarityLevel: 9 },
  { name: '2014 Mustang V6 Coupe', rarity: 'Common', rarityLevel: 1 },
  { name: '2014 Mustang GT', rarity: 'Common', rarityLevel: 1 },
  { name: '2019 Mustang EcoBoost Convertible', rarity: 'Common', rarityLevel: 1 },
  { name: '2023 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1 },
  { name: '2023 Mustang Mach-E', rarity: 'Uncommon', rarityLevel: 3 },
  { name: '2022 Mustang Mach-E GT', rarity: 'Rare', rarityLevel: 5 },
  { name: '2024 Mustang GT3', rarity: 'Legendary', rarityLevel: 5 },
  { name: '2024 Mustang GT4', rarity: 'Epic', rarityLevel: 4 },
  { name: '2025 Mustang GTD', rarity: 'Legendary', rarityLevel: 5 },
  // NASCAR Cup Car: This car is not included in drop pool (rarityLevel: 0)
  { name: '2022 Mustang NASCAR Cup Car', rarity: 'LIMITED EVENT', rarityLevel: 0 },
  { name: '2000 SVT Cobra', rarity: 'Rare', rarityLevel: 5 },
  { name: '2004 SVT Cobra', rarity: 'Epic', rarityLevel: 7 },
  { name: '2000 SVT Cobra R', rarity: 'Ultra Mythic', rarityLevel: 11 },
  { name: 'Cobra Jet Mustang', rarity: 'Godly', rarityLevel: 12 },
  { name: '1964 Mustang Coupe', rarity: 'Common', rarityLevel: 1 },
  { name: '1965 Shelby GT350R', rarity: 'Legendary', rarityLevel: 9 },
  { name: '1966 Mustang GT350', rarity: 'Rare', rarityLevel: 5 },
  { name: '1967 Shelby GT500', rarity: 'Godly', rarityLevel: 12 },
  { name: '1968 Shelby GT500KR', rarity: 'Epic', rarityLevel: 7 },
  { name: '1969 Mustang Mach 1', rarity: 'Rare', rarityLevel: 5 },
  { name: '1969 Boss 429', rarity: 'Ultra Mythic', rarityLevel: 11 },
  { name: '1969 Shelby GT500', rarity: 'Legendary', rarityLevel: 9 },
  { name: '1970 Boss 302', rarity: 'Rare', rarityLevel: 5 },
  { name: '1971 Mustang Mach 1', rarity: 'Uncommon', rarityLevel: 3 },
  { name: '1973 Mustang Convertible', rarity: 'Common', rarityLevel: 1 }
];

const nascarUnlockCar = '2022 Mustang NASCAR Cup Car';
const requiredForNascar = ['2024 Mustang GT3', '2024 Mustang GT4', '2025 Mustang GTD'];

let activeDrop = null;
let dropTimeout = null;
const claimingUsers = new Set();
const claimCooldowns = new Map();

function getChanceFromRarity(level) {
  return 12 / level;
}
function getRarityTag(car) {
  if (!car || !car.rarity) return '[Unknown]';
  if (car.rarity === 'Godly') return '***[GODLY]***';
  if (car.rarity === 'Ultra Mythic') return '**[ULTRA MYTHIC]**';
  return `[${car.rarity.toUpperCase()}]`;
}
function getRandomCar() {
  // Exclude cars with rarityLevel 0 from random drops
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
      globalCount[car.name] = (globalCount[car.name] || 0) + 1;
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

  const count = {};
  const list = pages[pageIndex].map(car => {
    count[car.name] = (count[car.name] || 0) + 1;
    const serial = car.serial;
    const total = globalCount[car.name];
    const meta = carsMeta.find(c => c.name === car.name);
    return `${car.name} (#${serial} of ${total}) ${getRarityTag(meta)}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(viewerId === garageOwnerId
      ? `🚗 Your Garage (${garage.cars.length} cars) - Page ${pageIndex + 1}/${pages.length}`
      : `🚗 ${garageOwnerUser.username}'s Garage - Page ${pageIndex + 1}/${pages.length}`)
    .setDescription(list)
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

function scheduleNextDrop(channel) {
  const delay = Math.floor(Math.random() * (45 - 10 + 1) + 10) * 60 * 1000;
  setTimeout(() => {
    if (!activeDrop) dropCar(channel);
  }, delay);
}
function dropCar(channel) {
  if (activeDrop) return;
  const car = getRandomCar();
  const embed = new EmbedBuilder()
    .setTitle(`🚗 A wild ${car.name} appeared!`)
    .setDescription(`${getRarityTag(car)}
Use \`/claim\` in 1 minute!`)
    .setColor(rarityColors[car.rarity] || 0xFFFFFF);

  channel.send({ embeds: [embed] }).then(msg => {
    activeDrop = { car, claimed: false, message: msg };
    dropTimeout = setTimeout(() => {
      if (!activeDrop.claimed) {
        msg.delete().catch(() => {});
        channel.send(`⏱️ The **${car.name}** disappeared.`);
      }
      activeDrop = null;
      scheduleNextDrop(channel);
    }, 60000);
  });
}

// ============================
// SET TRADE DEPENDENCIES HERE!
// ============================
trade.setTradeDependencies({ Garage, TradeListing, TradeOffer, cars, log });

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log('✅ Connected to MongoDB');

    // Migration block (runs only if RUN_MIGRATION is 'true')
    if (process.env.RUN_MIGRATION === 'true') {
      (async () => {
        try {
          const allGarages = await Garage.find();
          let totalChanged = 0;
          for (const garage of allGarages) {
            let changed = false;
            let newCars = [];

            for (let i = 0; i < garage.cars.length; i++) {
              let car = garage.cars[i];
              if (typeof car === 'string') {
                newCars.push({ name: car, serial: 1 });
                changed = true;
              } else if (!car) {
                newCars.push({ name: "Unknown Car", serial: 1 });
                changed = true;
              } else {
                let fixedCar = { ...car };
                if (!fixedCar.name) {
                  fixedCar.name = "Unknown Car";
                  changed = true;
                }
                if (typeof fixedCar.serial !== 'number') {
                  fixedCar.serial = 1;
                  changed = true;
                }
                newCars.push(fixedCar);
              }
            }

            if (changed) {
              garage.cars = newCars;
              await garage.save();
              console.log(`Updated garage for user ${garage.userId}`);
              totalChanged++;
            }
          }
          console.log(`✅ Migration complete! Updated ${totalChanged} garages.`);
          process.exit(0);
        } catch (err) {
          console.error('Migration failed:', err);
          process.exit(1);
        }
      })();
      return; // Important: stop further bot startup if migration runs
    }

    // ---- Start Discord bot after DB ready ----
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

  // ---- SLASH COMMANDS REGISTRATION ----
  const commands = [
    new SlashCommandBuilder().setName('claim').setDescription('Claim the currently dropped car'),
    new SlashCommandBuilder().setName('drop').setDescription('Force a drop').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('garage').setDescription('View a garage').addUserOption(opt => opt.setName('user').setDescription('User to view')),
    new SlashCommandBuilder().setName('resetgarage').setDescription("Reset a user's garage").addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('stats').setDescription('View bot stats'),
    new SlashCommandBuilder()
      .setName('trade')
      .setDescription('List a car for trade (select from menu, then add a note)'),
    new SlashCommandBuilder()
      .setName('canceltrade')
      .setDescription('Cancel all your active trade listings'),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show help information for all commands'),
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
  if (interaction.isChatInputCommand()) {
    const { commandName, user, channel, options, member } = interaction;
    const userId = user.id;

    // ==== /help ====
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🚦 Mustang Hunt Bot Help')
        .setDescription("Here's a list of all available commands and what they do:")
        .addFields(
          {
            name: '/claim',
            value: 'Claim the currently dropped car. Only works when a drop is active. Cooldown applies.'
          },
          {
            name: '/drop',
            value: 'Force a car drop. **Administrator only.**'
          },
          {
            name: '/garage [user]',
            value: `View your garage or another user's garage. Only works in <#${GARAGE_CHANNEL_ID}>.`
          },
          {
            name: '/resetgarage <user>',
            value: 'Reset a user\'s garage. **Administrator only.**'
          },
          {
            name: '/stats',
            value: 'View bot statistics (users, cars, uptime).'
          },
          {
            name: '/trade',
            value: `List a car from your garage for trade. **Use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.** You'll select the car and can add a note. The listing will appear in <#${TRADE_POSTS_CHANNEL_ID}>.`
          },
          {
            name: '/canceltrade',
            value: 'Cancel all your active trade listings.'
          },
          {
            name: '/help',
            value: 'Show this help message.'
          }
        )
        .setFooter({ text: 'Tip: Use /trade only in the trade-commands channel; listings appear in #trade-posts.' })
        .setColor(0x00BFFF);

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ==== /claim logic ====
    if (commandName === 'claim') {
      const now = Date.now();
      if (claimCooldowns.has(userId) && (now - claimCooldowns.get(userId)) < 10000) {
        return interaction.reply({ content: '⏳ You must wait 10 seconds between claims.', flags: 64 });
      }
      claimCooldowns.set(userId, now);

      if (!activeDrop) return interaction.reply({ content: '❌ No car to claim.', flags: 64 });
      if (activeDrop.claimed) return interaction.reply({ content: '⚠️ Already claimed.', flags: 64 });
      if (claimingUsers.has(userId)) return;
      claimingUsers.add(userId);
      try {
        activeDrop.claimed = true;
        clearTimeout(dropTimeout);
        await activeDrop.message.delete().catch(() => {});
        await channel.send(`${user.username} claimed **${activeDrop.car.name}**! 🏁`);
        let garage = await Garage.findOne({ userId });
        if (!garage) garage = new Garage({ userId, cars: [] });
        const carCount = garage.cars.filter(c => c.name === activeDrop.car.name).length;
        garage.cars.push({ name: activeDrop.car.name, serial: carCount + 1 });

        if (
          new Date() <= new Date('2025-05-31') &&
          requiredForNascar.every(req => garage.cars.some(c => c.name === req)) &&
          !garage.cars.some(c => c.name === nascarUnlockCar)
        ) {
          garage.cars.push({ name: nascarUnlockCar, serial: 1 });
          await channel.send(`🎉 ${user.username} unlocked **${nascarUnlockCar}**!`);
        }

        await garage.save();
        activeDrop = null;
        scheduleNextDrop(channel);
        await interaction.reply({ content: '✅ You claimed the car!', flags: 64 });
      } catch (error) {
        log(`DB ERROR in /claim: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
      } finally {
        claimingUsers.delete(userId);
      }
      return;
    }

    // ==== /drop logic ====
    if (commandName === 'drop') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', flags: 64 });
      try {
        dropCar(channel);
        return interaction.reply({ content: '🚗 Car dropped.', flags: 64 });
      } catch (error) {
        log(`ERROR in /drop: ${error}`);
        return interaction.reply({ content: '❌ An error occurred dropping the car.', flags: 64 });
      }
    }

    // ==== /garage logic ====
    if (commandName === 'garage') {
      if (channel.id !== GARAGE_CHANNEL_ID) return interaction.reply({ content: '❌ Use /garage in the garage channel.', flags: 64 });
      try {
        const target = options.getUser('user') || user; // garage owner
        const garage = await Garage.findOne({ userId: target.id });
        if (!garage || garage.cars.length === 0) return interaction.reply({ content: '🚫 Garage is empty.', flags: 64 });

        const all = await Garage.find();
        const globalCount = calculateGlobalCounts(all);
        const { embed, components } = renderGaragePage(user.id, garage, globalCount, 0, target, target.id, cars);

        await interaction.reply({ embeds: [embed], components, flags: 64 });
      } catch (error) {
        log(`DB ERROR in /garage: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
      }
      return;
    }

    // ==== /resetgarage logic ====
    if (commandName === 'resetgarage') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', flags: 64 });
      try {
        const target = options.getUser('user');
        await Garage.findOneAndUpdate({ userId: target.id }, { cars: [] }, { upsert: true });
        return interaction.reply({ content: `♻️ Reset ${target.username}'s garage.`, flags: 64 });
      } catch (error) {
        log(`DB ERROR in /resetgarage: ${error}`);
        return interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
      }
    }

    // ==== /stats logic ====
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
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', flags: 64 });
      }
      return;
    }
  }

  // =========================
  // TRADE SYSTEM HANDLING
  // =========================
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
    await trade.handleOfferButton(interaction);
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
          components: []
        });
      }

      const all = await Garage.find();
      const globalCount = calculateGlobalCounts(all);
      const userObj = await client.users.fetch(garageOwnerId);
      const { embed, components } = renderGaragePage(
        interaction.user.id, garage, globalCount, pageIndex, userObj, garageOwnerId, cars
      );

      // IMPORTANT: Do NOT use flags here!
      await interaction.update({ embeds: [embed], components });
    } catch (error) {
      log(`DB ERROR in garage pagination: ${error}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred loading this page.', flags: 64 });
      }
    }
    return;
  }
});

client.login(process.env.TOKEN);
