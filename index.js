require('dotenv').config();
require('./keepAlive');
const fs = require('fs'); 
const mongoose = require('mongoose');

const { REST, Routes } = require('discord.js'); //delete this

(async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    console.log('Deleting all global application commands...');
    await rest.put(
      Routes.applicationCommands('1372635185731997767'),
      { body: [] }
    );
    console.log('✅ All global commands deleted!');
  } catch (error) {
    console.error(error);
  }
})(); //and this

const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, InteractionType
} = require('discord.js');

// ---- Persistent logging ----
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

// ----- UPDATED CHANNEL IDs ----- 
const DROP_CHANNEL_ID = '1372749024662257664';
const GARAGE_CHANNEL_ID = '1372749137413668884';
const TRADE_POSTS_CHANNEL_ID = '1374486602012692581'; // Renamed from TRADEBOARD_CHANNEL_ID to TRADE_POSTS_CHANNEL_ID
const TRADEOFFERS_CHANNEL_ID = '1374486704387264512';
const TRADE_COMMAND_CHANNEL_ID = '1374623379406979134'; // new trade-commands channel for /trade

// ---- GUILD ID ----
const GUILD_ID = '1370450475400302686';

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => log('✅ Connected to MongoDB'))
  .catch(err => log('❌ MongoDB connection error: ' + err));

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
  Godly: 0xFFD700
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
  const weighted = cars.map(car => ({ ...car, chance: getChanceFromRarity(car.rarityLevel) }));
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
function renderGaragePage(garage, globalCount, pageIndex, user, userId, carsMeta) {
  const pages = chunkArray(garage.cars, 10);
  const count = {};

  const list = pages[pageIndex].map(car => {
    count[car.name] = (count[car.name] || 0) + 1;
    const serial = car.serial;
    const total = globalCount[car.name];
    const meta = carsMeta.find(c => c.name === car.name);
    return `${car.name} (#${serial} of ${total}) ${getRarityTag(meta)}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(user.id === userId
      ? `🚗 Your Garage (${garage.cars.length} cars) - Page ${pageIndex + 1}/${pages.length}`
      : `🚗 ${user.username}'s Garage - Page ${pageIndex + 1}/${pages.length}`)
    .setDescription(list)
    .setColor(0x00BFFF);

  const row = new ActionRowBuilder();
  if (pageIndex > 0) row.addComponents(new ButtonBuilder().setCustomId(`garage:${userId}:${pageIndex - 1}`).setLabel('⬅️ Prev').setStyle(ButtonStyle.Secondary));
  if (pageIndex < pages.length - 1) row.addComponents(new ButtonBuilder().setCustomId(`garage:${userId}:${pageIndex + 1}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary));

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

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ==== /trade channel restriction ====
    if (commandName === 'trade') {
      if (interaction.channel.id !== TRADE_COMMAND_CHANNEL_ID) {
        return interaction.reply({
          content: `❌ Please use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.`,
          ephemeral: true
        });
      }
    }

    // --- The rest of your unchanged command bodies ---

    if (commandName === 'claim') {
      const now = Date.now();
      if (claimCooldowns.has(userId) && (now - claimCooldowns.get(userId)) < 10000) {
        return interaction.reply({ content: '⏳ You must wait 10 seconds between claims.', ephemeral: true });
      }
      claimCooldowns.set(userId, now);

      if (!activeDrop) return interaction.reply({ content: '❌ No car to claim.', ephemeral: true });
      if (activeDrop.claimed) return interaction.reply({ content: '⚠️ Already claimed.', ephemeral: true });
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
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
      } finally {
        claimingUsers.delete(userId);
      }
    }

    if (commandName === 'trade') {
      try {
        const garage = await Garage.findOne({ userId });
        if (!garage || garage.cars.length === 0)
          return interaction.reply({ content: '🚫 Your garage is empty.', ephemeral: true });

        const carChoices = garage.cars.map(c => ({
          label: `${c.name} (#${c.serial})`,
          value: `${c.name}#${c.serial}`
        })).slice(0, 25);

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`tradeSelect:${userId}`)
            .setPlaceholder('Select a car to list for trade')
            .addOptions(carChoices)
        );

        await interaction.reply({ content: 'Select a car from your garage to list for trade:', components: [row], ephemeral: true });
      } catch (error) {
        log(`DB ERROR in /trade: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
      }
    }

    if (commandName === 'canceltrade') {
      try {
        const listings = await TradeListing.find({ userId, active: true });
        if (!listings.length) return interaction.reply({ content: '🚫 No active listings found.', ephemeral: true });

        for (const listing of listings) {
          const channel = await client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
          try {
            const msg = await channel.messages.fetch(listing.messageId);
            await msg.edit({ components: [] });
          } catch (err) {
            log(`Failed to update listing message: ${err}`);
          }
          await TradeListing.findByIdAndUpdate(listing._id, { active: false });
        }
        await interaction.reply({ content: '🗑️ All active listings canceled.', ephemeral: true });
      } catch (error) {
        log(`DB ERROR in /canceltrade: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
      }
    }

    if (commandName === 'drop') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
      try {
        dropCar(channel);
        return interaction.reply({ content: '🚗 Car dropped.', ephemeral: true });
      } catch (error) {
        log(`ERROR in /drop: ${error}`);
        return interaction.reply({ content: '❌ An error occurred dropping the car.', ephemeral: true });
      }
    }

    if (commandName === 'garage') {
      if (channel.id !== GARAGE_CHANNEL_ID) return interaction.reply({ content: '❌ Use /garage in the garage channel.', ephemeral: true });
      try {
        const target = options.getUser('user') || user;
        const garage = await Garage.findOne({ userId: target.id });
        if (!garage || garage.cars.length === 0) return interaction.reply({ content: '🚫 Garage is empty.', ephemeral: true });

        const all = await Garage.find();
        const globalCount = calculateGlobalCounts(all);
        const { embed, components } = renderGaragePage(garage, globalCount, 0, user, target.id, cars);

        await interaction.reply({ embeds: [embed], components, ephemeral: false });
      } catch (error) {
        log(`DB ERROR in /garage: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
      }
    }

    if (commandName === 'resetgarage') {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
      try {
        const target = options.getUser('user');
        await Garage.findOneAndUpdate({ userId: target.id }, { cars: [] }, { upsert: true });
        return interaction.reply({ content: `♻️ Reset ${target.username}'s garage.`, ephemeral: true });
      } catch (error) {
        log(`DB ERROR in /resetgarage: ${error}`);
        return interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
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
• ⏱️ Uptime: **${h}h ${m}m ${s}s**`, ephemeral: false });
      } catch (error) {
        log(`DB ERROR in /stats: ${error}`);
        await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
      }
    }
  }

  // --- Select Menu for /trade (car pick) ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("tradeSelect:")) {
    const [carName, serial] = interaction.values[0].split('#');
    // Show a modal to collect the note
    const noteModal = new ModalBuilder()
      .setCustomId(`tradeNoteModal:${carName}#${serial}`)
      .setTitle('Add a note to your listing (optional)');

    const noteInput = new TextInputBuilder()
      .setCustomId('tradeNote')
      .setLabel('Trade note (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('Ex: Looking for something rare!');

    noteModal.addComponents(
      new ActionRowBuilder().addComponents(noteInput)
    );
    await interaction.showModal(noteModal);
    return;
  }

  // --- Modal submit for /trade (note) ---
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('tradeNoteModal:')) {
    const [carName, serial] = interaction.customId.replace('tradeNoteModal:', '').split('#');
    const note = interaction.fields.getTextInputValue('tradeNote') || '';
    try {
      const userId = interaction.user.id;
      // Now allows up to 5 active listings
      const activeListings = await TradeListing.countDocuments({ userId, active: true });
      if (activeListings >= 5) return interaction.reply({ content: '⚠️ You already have 5 active listings.', ephemeral: true });

      const tradeChannel = await client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle(`👤 ${interaction.user.username} is offering:`)
        .setDescription(`🚗 **${carName}** (#${serial})\n📝 ${note || 'No message'}\n⏳ Expires in 6 hours`)
        .setColor(0x00AAFF);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`sendOffer:${userId}:${carName}:${serial}`)
          .setLabel('💬 Send Offer')
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await tradeChannel.send({ embeds: [embed], components: [row] });

      await new TradeListing({
        userId,
        car: { name: carName, serial: parseInt(serial) },
        note,
        messageId: msg.id
      }).save();

      // listing disappears after 6 hours
      setTimeout(async () => {
        try {
          await TradeListing.findOneAndUpdate({ messageId: msg.id }, { active: false });
          const m = await tradeChannel.messages.fetch(msg.id);
          await m.edit({ components: [] });
        } catch (err) {
          log(`Failed to update trade message (timeout): ${err}`);
        }
      }, 6 * 60 * 60 * 1000);

      await interaction.reply({ content: `✅ Trade listing posted to <#${TRADE_POSTS_CHANNEL_ID}>!`, ephemeral: true });
    } catch (error) {
      log(`DB ERROR in tradeNoteModal: ${error}`);
      await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
    }
    return;
  }

  // --- Select Menu for Trade Offers ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("chooseOffer:")) {
    try {
      const [_, senderId, receiverId, carName, serial] = interaction.customId.split(':');
      const selected = interaction.values[0];
      const [offeredName, offeredSerial] = selected.split('#');

      const embed = new EmbedBuilder()
        .setTitle('📥 Trade Offer')
        .setDescription(`🔁 <@${senderId}> offers:\n**${offeredName} (#${offeredSerial})**\n📩 For: **${carName} (#${serial})**`)
        .setColor(0x00CC99);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('acceptOffer').setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('declineOffer').setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      const tradeChannel = await client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
      const msg = await tradeChannel.send({ embeds: [embed], components: [row] });

      await new TradeOffer({
        fromUserId: senderId,
        toUserId: receiverId,
        offeredCar: { name: offeredName, serial: parseInt(offeredSerial) },
        requestedCar: { name: carName, serial: parseInt(serial) },
        messageId: msg.id
      }).save();

      await interaction.update({ content: '📨 Offer sent!', components: [] });
    } catch (error) {
      log(`DB ERROR in select menu: ${error}`);
      await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
    }
  }

  // --- Button Handlers ---
  if (interaction.isButton()) {
    try {
      const [action, userId, pageOrOther, carName, serial] = interaction.customId.split(':');

      if (action === 'garage') {
        const userGarage = await Garage.findOne({ userId });
        if (!userGarage || userGarage.cars.length === 0)
          return interaction.reply({ content: '🚫 Garage is empty.', ephemeral: true });

        userGarage.userId = userId;
        const globalCount = calculateGlobalCounts(await Garage.find());
        const page = parseInt(pageOrOther);

        const { embed, components } = renderGaragePage(userGarage, globalCount, page, interaction.user, userId, cars);
        await interaction.update({ embeds: [embed], components });
      }

      if (action === 'sendOffer') {
        // Prevent sending offers to yourself
        if (interaction.user.id === userId) {
          return interaction.reply({ content: "❌ You can't send an offer to yourself.", ephemeral: true });
        }

        const fromGarage = await Garage.findOne({ userId: interaction.user.id });
        if (!fromGarage || fromGarage.cars.length === 0)
          return interaction.reply({ content: '🚫 You have no cars to offer.', flags: 64 });

        const carChoices = fromGarage.cars.map(c => ({
          label: `${c.name} (#${c.serial})`,
          value: `${c.name}#${c.serial}`
        })).slice(0, 25);

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`chooseOffer:${interaction.user.id}:${userId}:${carName}:${serial}`)
            .setPlaceholder('Select a car to offer')
            .addOptions(carChoices)
        );

        return interaction.reply({ content: 'Select a car to offer in trade:', components: [row], flags: 64 });
      }

      if (action === 'acceptOffer') {
        const offer = await TradeOffer.findOne({ messageId: interaction.message.id });
        if (!offer || offer.status !== 'pending') {
          return interaction.reply({ content: '❌ Offer no longer valid.', flags: 64 });
        }

        const fromGarage = await Garage.findOne({ userId: offer.fromUserId });
        const toGarage = await Garage.findOne({ userId: offer.toUserId });

        fromGarage.cars = fromGarage.cars.filter(c => !(c.name === offer.offeredCar.name && c.serial === offer.offeredCar.serial));
        toGarage.cars = toGarage.cars.filter(c => !(c.name === offer.requestedCar.name && c.serial === offer.requestedCar.serial));
        fromGarage.cars.push(offer.requestedCar);
        toGarage.cars.push(offer.offeredCar);
        await fromGarage.save();
        await toGarage.save();

        await TradeOffer.updateOne({ _id: offer._id }, { status: 'accepted' });
        await interaction.update({ content: '✅ Trade completed successfully!', components: [] });
      }

      if (action === 'declineOffer') {
        await TradeOffer.updateOne({ messageId: interaction.message.id }, { status: 'declined' });
        await interaction.update({ content: '❌ Trade declined.', components: [] });
      }
    } catch (error) {
      log(`DB ERROR in button handler: ${error}`);
      await interaction.reply({ content: '❌ An error occurred. Please try again later.', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
