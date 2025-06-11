const { EmbedBuilder } = require('discord.js');

// Rarity emojis and colors (updated for ??? and Mythic)
const rarityEmojis = {
  "Common": '⬜',
  "Uncommon": '🟩',
  "Rare": '🟦',
  "Epic": '🟪',
  "Legendary": '🟧',
  "Mythic": '🟥',
  "Ultra Mythic": '🟫',
  "Godly": '🟨',
  "???": '⬛',
  "LIMITED EVENT": '🎉'
};
const rarityColors = {
  "Common": 0xAAAAAA,
  "Uncommon": 0x00FF00,
  "Rare": 0x0099FF,
  "Epic": 0x8000FF,
  "Legendary": 0xFFA500,
  "Mythic": 0xFF0000,
  "Ultra Mythic": 0x9900FF,
  "Godly": 0xFFD700,
  "???": 0x111111,
  "LIMITED EVENT": 0xD726FF
};

function getRarityEmoji(rarity) {
  return rarityEmojis[rarity] || '';
}

// Drop flavor lines
const dropFlavors = [
  "Don't let this beauty get away!",
  "First to claim it gets the keys!",
  "Claim this ride before someone else does!",
  "This Mustang won't last long!",
  "Who will take it home?",
  "Ready to burn some rubber?",
  "Will you be the lucky owner?",
  "Hurry, it's up for grabs!",
  "Step on the gas and claim it!",
  "The clock is ticking..."
];

// Disappear flavor lines
const disappearFlavors = [
  "The hunt is over... for now.",
  "Nobody was quick enough this time!",
  "Another Mustang lost to history.",
  "The Mustang sped off into the sunset.",
  "Maybe next time someone will catch it!",
  "No one claimed it in time!",
  "The crowd sighs as it disappears.",
  "Another Mustang vanishes before your eyes.",
  "The keys remain unclaimed.",
  "The Mustang slipped away unnoticed."
];

// The dropCar function
async function dropCar(channel, getRandomCar, scheduleNextDrop, dropState) {
  const car = getRandomCar();
  const flavor = dropFlavors[Math.floor(Math.random() * dropFlavors.length)];
  const embed = new EmbedBuilder()
    .setTitle('⚡ A new Mustang has entered the hunt! ⚡')
    .setDescription(
      `---\n` +
      `🚗 **${car.name}** ${getRarityEmoji(car.rarity)} *${car.rarity}*\n\n` +
      `*${flavor}*\n\n` +
      '🔑 **First to claim it gets the keys — type `/claim` now!** 🎉'
    )
    .setColor(rarityColors[car.rarity] || 0x00BFFF);

  const msg = await channel.send({ embeds: [embed] });
  dropState.activeDrop = { car, message: msg, claimed: false };

  dropState.dropTimeout = setTimeout(() => {
    if (!dropState.activeDrop.claimed) {
      msg.delete().catch(() => {});
      const flavor = disappearFlavors[Math.floor(Math.random() * disappearFlavors.length)];
      const disappearEmbed = new EmbedBuilder()
        .setTitle('⌛ Mustang Disappeared!')
        .setDescription(
          `**${car.name}** ${getRarityEmoji(car.rarity)}\n\n${flavor}`
        )
        .setColor(0x555555)
        .setFooter({ text: 'Better luck next time!' });
      channel.send({ embeds: [disappearEmbed] });
    }
    dropState.activeDrop = null;
    scheduleNextDrop(channel);
  }, 60000);
}

module.exports = {
  dropCar,
  getRarityEmoji,
  rarityColors
};
