const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

// Dependencies injected from index.js
let Garage, TradeListing, TradeOffer, cars, log;

function setTradeDependencies(deps) {
  Garage = deps.Garage;
  TradeListing = deps.TradeListing;
  TradeOffer = deps.TradeOffer;
  cars = deps.cars;
  log = deps.log;
}

// Helper: emoji, badge, color for rarity
function getCarEmbedVisuals(carName) {
  const trimmedName = carName.trim();
  const meta = cars.find(c => c.name.trim() === trimmedName);
  if (!meta && log) {
    log(`Car not found in cars array: "${carName}"`);
  }
  const rarity = meta?.rarity || "Unknown";
  const badge = {
    "Common": "⚪️ COMMON",
    "Uncommon": "🟢 UNCOMMON",
    "Rare": "🔵 RARE",
    "Epic": "🟣 EPIC",
    "Legendary": "🟠 LEGENDARY",
    "Mythic": "🔴 MYTHIC",
    "Ultra Mythic": "🟪 ULTRA MYTHIC",
    "Godly": "🟡 GODLY",
    "LIMITED EVENT": "✨ LIMITED EVENT"
  }[rarity] || "❓ UNKNOWN";
  const emoji = {
    "Common": "⚪️",
    "Uncommon": "🟢",
    "Rare": "🔵",
    "Epic": "🟣",
    "Legendary": "🟠",
    "Mythic": "🔴",
    "Ultra Mythic": "🟪",
    "Godly": "🟡",
    "LIMITED EVENT": "✨"
  }[rarity] ?? "❓";
  const colorMap = {
    "Common": 0xCECECE,
    "Uncommon": 0x4EFF8E,
    "Rare": 0x48B0FF,
    "Epic": 0xB983FF,
    "Legendary": 0xFFA726,
    "Mythic": 0xFF5A5A,
    "Ultra Mythic": 0xB266FF,
    "Godly": 0xFFD700,
    "LIMITED EVENT": 0xD726FF
  };
  return {
    rarity,
    badge,
    emoji,
    color: colorMap[rarity] || 0x888888
  };
}

// Utility: safe reply in error situations (flags: 64 makes ephemeral)
async function safeReply(interaction, msg) {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: msg, flags: 64 });
  } else {
    try {
      await interaction.editReply({ content: msg });
    } catch {}
  }
}

// --- Trade History Logger (for trade-history channel) ---
async function logTradeHistory({
  client,
  TRADE_HISTORY_CHANNEL_ID,
  action, // 'accepted', 'declined', 'cancelled', 'expired'
  offer,
  listingUser,
  offerUser
}) {
  try {
    if (!TRADE_HISTORY_CHANNEL_ID) {
      log && log("TRADE_HISTORY_CHANNEL_ID is missing!");
      return;
    }
    let color = 0x21d97a;
    let title = "✅ **Trade Completed**";
    if (action === "declined") {
      color = 0xc72c3b;
      title = "❌ **Trade Declined**";
    } else if (action === "cancelled") {
      color = 0xfba505;
      title = "🗑️ **Trade Cancelled**";
    } else if (action === "expired") {
      color = 0x888888;
      title = "⌛ **Trade Expired**";
    }

    const user1 = listingUser;
    const user2 = offerUser;
    const car1 = offer.requestedCar;
    const car2 = offer.offeredCar;
    const { emoji: emoji1, rarity: rarity1 } = getCarEmbedVisuals(car1.name);
    const { emoji: emoji2, rarity: rarity2 } = getCarEmbedVisuals(car2.name);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        `**${user1.username}** traded:\n` +
        `${emoji1} **${car1.name}** (#${car1.serial}) [${rarity1}]\n\n` +
        `with **${user2.username}** for:\n` +
        `${emoji2} **${car2.name}** (#${car2.serial}) [${rarity2}]`
      )
      .setTimestamp();

    const channel = await client.channels.fetch(TRADE_HISTORY_CHANNEL_ID);
    await channel.send({ embeds: [embed] });
  } catch (e) {
    log && log("Failed to log trade history: " + e);
  }
}

// ... all other handlers unchanged ...

// --- accept/decline/cancel offer handler ---
async function handleOfferButton(interaction, TRADE_POSTS_CHANNEL_ID, TRADEOFFERS_CHANNEL_ID, TRADE_HISTORY_CHANNEL_ID) {
  try {
    if (!TRADE_POSTS_CHANNEL_ID) log && log("TRADE_POSTS_CHANNEL_ID is missing!");
    if (!TRADEOFFERS_CHANNEL_ID) log && log("TRADEOFFERS_CHANNEL_ID is missing!");

    const parts = interaction.customId.split(':');
    const action = parts[0];
    const [, senderId, receiverId, offerId, confirmFlag] = parts;

    // --- Always fetch the offer from DB to get the correct toUserId (listing owner) ---
    const offer = await TradeOffer.findById(offerId);
    if (!offer) {
      return safeReply(interaction, '❌ Offer not found or already handled.');
    }
    if (interaction.user.id !== offer.toUserId) {
      return safeReply(interaction, "❌ Only the listing owner can accept or decline this trade.");
    }

    // Decline
    if (action === 'declineOffer') {
      await TradeOffer.findByIdAndUpdate(offerId, { status: 'declined' });
      await interaction.update({ content: '❌ Trade declined.', components: [] });
      // Remove offer embed
      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '❌ This trade offer was declined.',
          embeds: [],
          components: []
        });
      } catch (e) { log && log("Failed to update trade offer message: " + e); }
      // Also log decline to history
      if (TRADE_HISTORY_CHANNEL_ID) {
        await logTradeHistory({
          client: interaction.client,
          TRADE_HISTORY_CHANNEL_ID,
          action: 'declined',
          offer,
          listingUser: await interaction.client.users.fetch(offer.toUserId),
          offerUser: await interaction.client.users.fetch(offer.fromUserId)
        });
      }
      return;
    }

    // Cancel Confirm
    if (action === 'cancelTradeConfirm') {
      await interaction.update({ content: '❌ Trade was not accepted.', components: [] });
      // Remove offer embed
      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '🗑️ This trade offer is no longer active.',
          embeds: [],
          components: []
        });
      } catch (e) { log && log("Failed to update trade offer message: " + e); }
      if (TRADE_HISTORY_CHANNEL_ID) {
        await logTradeHistory({
          client: interaction.client,
          TRADE_HISTORY_CHANNEL_ID,
          action: 'cancelled',
          offer,
          listingUser: await interaction.client.users.fetch(offer.toUserId),
          offerUser: await interaction.client.users.fetch(offer.fromUserId)
        });
      }
      return;
    }

    // Accept
    if (action === 'acceptOffer') {
      // Double confirm
      if (confirmFlag !== 'confirmed') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`acceptOffer:${senderId}:${receiverId}:${offerId}:confirmed`)
            .setLabel('✅ Yes, confirm trade')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`cancelTradeConfirm:${senderId}:${receiverId}:${offerId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
        );
        await safeReply(
          interaction,
          'Are you sure you want to accept this trade?\nThis action is **final** and will swap the cars between users.'
        );
        if (interaction.replied || interaction.deferred)
          await interaction.editReply({ components: [row] });
        else
          await interaction.reply({ components: [row], flags: 0 });
        return;
      }

      // Actual trade logic, only runs on confirm!
      const offerUpdate = await TradeOffer.findOneAndUpdate(
        { _id: offerId, status: 'pending' },
        { status: 'accepted' }
      );
      if (!offerUpdate) {
        return safeReply(interaction, '❌ Offer no longer valid.');
      }

      const fromGarage = await Garage.findOne({ userId: offer.fromUserId });
      const toGarage = await Garage.findOne({ userId: offer.toUserId });

      fromGarage.cars = fromGarage.cars.filter(
        c => !(c.name === offer.offeredCar.name && c.serial === offer.offeredCar.serial)
      );
      toGarage.cars = toGarage.cars.filter(
        c => !(c.name === offer.requestedCar.name && c.serial === offer.requestedCar.serial)
      );
      fromGarage.cars.push(offer.requestedCar);
      toGarage.cars.push(offer.offeredCar);
      await fromGarage.save();
      await toGarage.save();

      // PATCH: Remove active:true from query so we always find the listing, even after marking inactive!
      const listing = await TradeListing.findOne({ 'car.name': offer.requestedCar.name, 'car.serial': offer.requestedCar.serial });
      if (listing) {
        listing.active = false;
        await listing.save();
        try {
          log && log(`Trying to update trade post: Channel: ${TRADE_POSTS_CHANNEL_ID}, Msg: ${listing?.messageId}`);
          const tradePostsChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
          const listingMsg = await tradePostsChannel.messages.fetch(listing.messageId);
          await listingMsg.edit({
            content: '✅ This trade has been completed and is no longer available.',
            embeds: [],
            components: []
          });
        } catch (err) {
          log && log("Failed to edit trade post: " + err);
        }
      } else {
        log && log('No TradeListing found for completed trade:', offer.requestedCar);
      }

      // Remove offer embed
      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '✅ This trade offer has been accepted and is no longer available.',
          embeds: [],
          components: []
        });
      } catch (e) { log && log("Failed to update trade offer message: " + e); }

      // Log the accepted trade to trade history
      if (TRADE_HISTORY_CHANNEL_ID) {
        try {
          await logTradeHistory({
            client: interaction.client,
            TRADE_HISTORY_CHANNEL_ID,
            action: 'accepted',
            offer,
            listingUser: await interaction.client.users.fetch(offer.toUserId),
            offerUser: await interaction.client.users.fetch(offer.fromUserId)
          });
        } catch (err) {
          log && log('Failed to log trade history: ' + err);
        }
      }

      await interaction.update({ content: '✅ Trade completed successfully!', components: [] });
      return;
    }
  } catch (error) {
    log && log("Error in handleOfferButton: " + error);
    await safeReply(interaction, '❌ An error occurred handling the trade action.');
  }
}

// ... all other handlers unchanged ...

module.exports = {
  setTradeDependencies,
  handleTradeCommand,
  handleCancelTradeCommand,
  handleTradeSelectMenu,
  handleTradeNoteModal,
  handleSendOfferButton,
  handleChooseOfferMenu,
  handleOfferButton,
  logTradeHistory,
};
