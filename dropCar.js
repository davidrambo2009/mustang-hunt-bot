const { EmbedBuilder } = require('discord.js');

// Rarity color and emoji maps
const rarityColors = {
  Common:         0xAAAAAA,
  Uncommon:       0x00FF00,
  Rare:           0x0099FF,
  Epic:           0x8000FF,
  Legendary:      0xFFA500,
  Mythic:         0xFF0000,
  'Ultra Mythic': 0x9900FF,
  Godly:          0xFFD700,
  'LIMITED EVENT':0xD726FF
};

function getRarityEmoji(rarity) {
  switch (rarity) {
    case 'Common':         return '⬜';
    case 'Uncommon':       return '🟨';
    case 'Rare':           return '🟦';
    case 'Epic':           return '🟪';
    case 'Legendary':      return '🟧';
    case 'Mythic':         return '🟥';
    case 'Ultra Mythic':   return '🟫';
    case 'Godly':          return '✨';
    case 'LIMITED EVENT':  return '🏁';
    default:               return '';
  }
}

// Fun flavor lines to randomize
const dropFlavors = [
  "A new legend roars onto the street!",
  "Who will be the fastest to respond?",
  "Can you catch this Mustang first?",
  "Don't let this beauty get away!",
  "The hunt is on!"
];

/**
 * Drops a car and manages drop state.
 * @param {TextChannel} channel - Discord channel to drop in
 * @param {Function} getRandomCar - Function returning a random car object { name, rarity }
 * @param {Function} scheduleNextDrop - Function to schedule the next drop
 * @param {Object} dropState - Object reference containing { activeDrop, dropTimeout }
 */
function dropCar(channel, getRandomCar, scheduleNextDrop, dropState) {
  if (dropState.activeDrop) return;
  const car = getRandomCar();
  const rarityEmoji = getRarityEmoji(car.rarity);
  const flavor = dropFlavors[Math.floor(Math.random() * dropFlavors.length)];

  const embed = new EmbedBuilder()
    .setTitle('🏁⚡ A new Mustang has entered the hunt! ⚡🏁')
    .setDescription(
      `━━━\n` +
      `🚗 **${car.name}**  ${rarityEmoji} *${car.rarity}*\n` +
      `━━━\n` +
      `*${flavor}*\n\n` +
      `🔑 **First to claim it gets the keys — type \`/claim\` now!** 🎉`
    )
    .setColor(rarityColors[car.rarity] || 0xF8D568);

  channel.send({ embeds: [embed] }).then(msg => {
    dropState.activeDrop = { car, claimed: false, message: msg };
    dropState.dropTimeout = setTimeout(() => {
      if (!dropState.activeDrop.claimed) {
        msg.delete().catch(() => {});
        channel.send(`⏱️ The **${car.name}** disappeared.`);
      }
      dropState.activeDrop = null;
      scheduleNextDrop(channel);
    }, 60000);
  });
}

module.exports = {
  dropCar,
  rarityColors,
  getRarityEmoji,
  dropFlavors
};
