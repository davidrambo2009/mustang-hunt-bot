require('dotenv').config();
require('./keepAlive');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const DROP_CHANNEL_ID = '1372749024662257664';
const GARAGE_CHANNEL_ID = '1372749137413668884';
const garageFile = 'garage.json';

let garages = fs.existsSync(garageFile) ? JSON.parse(fs.readFileSync(garageFile)) : {};

const rarityColors = {
  'Common': 0xAAAAAA,
  'Uncommon': 0x00FF00,
  'Rare': 0x0099FF,
  'Epic': 0x8000FF,
  'Legendary': 0xFFA500,
  'Mythic': 0xFF0000,
  'Ultra Mythic': 0x9900FF,
  'Godly': 0xFFD700
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
  { name: '2024 Mustang GT3', rarity: 'Legendary', rarityLevel: 9 },
  { name: '2024 Mustang GT4', rarity: 'Epic', rarityLevel: 7 },
  { name: '2025 Mustang GTD', rarity: 'Legendary', rarityLevel: 9 },
  { name: '2000 SVT Cobra', rarity: 'Rare', rarityLevel: 5 },
  { name: '2004 SVT Cobra', rarity: 'Epic', rarityLevel: 7 },
  { name: '2000 SVT Cobra R', rarity: 'Ultra Mythic', rarityLevel: 11 },
  { name: 'Cobra Jet Mustang', rarity: 'Godly', rarityLevel: 12 }
];

const nascarUnlockCar = '2022 Mustang NASCAR Cup Car';
const requiredForNascar = ['2024 Mustang GT3', '2024 Mustang GT4', '2025 Mustang GTD'];

function saveGarages() {
  fs.writeFileSync(garageFile, JSON.stringify(garages, null, 2));
}

function getChanceFromRarity(level) {
  return 12 / level;
}

function getRarityTag(car) {
  if (!car || !car.rarity) return '[Unknown]';
  if (car.rarity === 'Godly') return '***[GODLY]***';
  if (car.rarity === 'Ultra Mythic') return '**[ULTRA MYTHIC]**';
  return `[${car.rarity.toUpperCase()}]`;
}

let activeDrop = null;
let dropTimeout = null;

function getRandomCar() {
  const weighted = cars.map(car => ({
    ...car,
    chance: getChanceFromRarity(car.rarityLevel)
  }));
  const total = weighted.reduce((acc, c) => acc + c.chance, 0);
  const roll = Math.random() * total;
  let sum = 0;
  for (const car of weighted) {
    sum += car.chance;
    if (roll <= sum) return car;
  }
  return weighted[0];
}

function scheduleNextDrop(channel) {
  const min = 10 * 60 * 1000;
  const max = 45 * 60 * 1000;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  setTimeout(() => {
    if (!activeDrop) dropCar(channel);
  }, delay);
}

function dropCar(channel) {
  if (activeDrop) return;
  const car = getRandomCar();
  const embed = new EmbedBuilder()
    .setTitle(`🚗 A wild ${car.name} appeared!`)
    .setDescription(`${getRarityTag(car)}\nType \`!claim\` within 1 minute to grab it!`)
    .setColor(rarityColors[car.rarity] || 0xFFFFFF);

  channel.send({ embeds: [embed] }).then(msg => {
    activeDrop = { car, claimed: false, message: msg };
    dropTimeout = setTimeout(() => {
      if (!activeDrop.claimed) {
        msg.delete().catch(() => {});
        channel.send(`⏱️ The **${car.name}** disappeared — no one claimed it in time.`);
      }
      activeDrop = null;
      scheduleNextDrop(channel);
    }, 60000);
  });
}

client.on('ready', () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
  const dropChannel = client.channels.cache.get(DROP_CHANNEL_ID);
  if (dropChannel) scheduleNextDrop(dropChannel);
});

client.on('messageCreate', (msg) => {
  const userId = msg.author.id;
  const isAdmin = msg.member?.permissions?.has('Administrator');

  if (msg.content === '!drop') {
  if (!msg.member?.permissions?.has('Administrator')) {
    return msg.reply('❌ You don’t have permission to use this command.');
  }
  dropCar(msg.channel);
}

  if (msg.content === '!claim') {
    if (!activeDrop) return msg.reply('❌ There\'s no car to claim right now.');
    if (activeDrop.claimed) return msg.reply('⚠️ This car was already claimed.');

    if (!garages[userId]) {
      garages[userId] = { cars: [] };
    } else if (!Array.isArray(garages[userId].cars)) {
      garages[userId].cars = [];
    }
if (msg.content === '!stats') {
    const totalUsers = Object.keys(garages).length;
    const totalCars = Object.values(garages).reduce((sum, g) => sum + g.cars.length, 0);

    const uptime = process.uptime(); // in seconds
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    msg.reply(`📊 **Bot Stats**
• 🧍 Users Registered: **${totalUsers}**
• 🚗 Total Cars in Garages: **${totalCars}**
• ⏱️ Uptime: **${hours}h ${minutes}m ${seconds}s**`);
}

    activeDrop.claimed = true;
    clearTimeout(dropTimeout);
    activeDrop.message.delete().catch(() => {});
    msg.channel.send(`${msg.author.username} has claimed the **${activeDrop.car.name}**! 🏁`);

    garages[userId].cars.push(activeDrop.car.name);

    const today = new Date();
    const cutoff = new Date('2025-05-31T23:59:59');
    const garage = garages[userId].cars;
    if (today <= cutoff && requiredForNascar.every(c => garage.includes(c)) && !garage.includes(nascarUnlockCar)) {
      garage.push(nascarUnlockCar);
      msg.channel.send(`🎉 **${msg.author.username}** has unlocked the **${nascarUnlockCar}**!`);
    }

    saveGarages();
    activeDrop = null;
    scheduleNextDrop(msg.channel);
  }

  if (msg.content.startsWith('!garage')) {
    if (msg.channel.id !== GARAGE_CHANNEL_ID) {
      return msg.reply('❌ You can only use !garage in the designated garage channel.');
    }

    const target = msg.mentions.users.first() || msg.author;
    if (!garages[target.id]) garages[target.id] = { cars: [] };

    const userGarage = garages[target.id].cars;

    if (!Array.isArray(userGarage) || userGarage.length === 0) {
      return msg.reply(target.id === msg.author.id ? '🚫 Your garage is empty.' : `🚫 ${target.username}'s garage is empty.`);
    }

    const globalCount = {};
    for (const g of Object.values(garages)) {
      for (const car of g.cars) {
        globalCount[car] = (globalCount[car] || 0) + 1;
      }
    }

    const count = {};
    const list = userGarage.map(car => {
      count[car] = (count[car] || 0) + 1;
      const serial = count[car];
      const total = globalCount[car];
      const carData = cars.find(c => c.name === car);
      const rarity = getRarityTag(carData);
      return `${car} (#${serial} out of ${total}) ${rarity}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(target.id === msg.author.id ? `🚗 Your Garage (${userGarage.length} cars)` : `🚗 ${target.username}'s Garage`)
      .setDescription(list)
      .setColor(0x00BFFF);

    msg.reply({ embeds: [embed] });
  }

  if (msg.content.startsWith('!resetgarage') && isAdmin) {
    const target = msg.mentions.users.first();
    if (!target) return msg.reply('❌ Tag a user to reset their garage.');
    garages[target.id] = { cars: [] };
    saveGarages();
    msg.reply(`♻️ Reset ${target.username}'s garage.`);
  }
});

client.login(process.env.TOKEN);
