// MAXIMUM DEBUG VERSION FOR TRADE.JS
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
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: msg, flags: 64 });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: msg });
    } else {
      log && log('safeReply: interaction already acknowledged, skipping');
    }
  } catch (err) {
    log && log('safeReply error: ' + err);
  }
}

// Debug utility to log any array of menu options
function debugOptionsArray(label, optionsArray) {
  console.log(`=== DEBUG: ${label} ===`);
  if (!Array.isArray(optionsArray)) {
    console.error(`[ERROR] ${label} is not an array:`, optionsArray);
    throw new Error(`[ERROR] ${label} is not an array`);
  }
  optionsArray.forEach((opt, idx) => {
    console.log(`[${label}][${idx}]`, opt);
    if (!opt.value || opt.value.length < 6) {
      console.error(`[ERROR] ${label} option value too short [${idx}]:`, opt);
      throw new Error(`[ERROR] ${label} option value too short: ` + JSON.stringify(opt));
    }
    if (!opt.label || opt.label.length < 1) {
      console.error(`[ERROR] ${label} option label too short [${idx}]:`, opt);
      throw new Error(`[ERROR] ${label} option label too short: ` + JSON.stringify(opt));
    }
  });
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
    const offeredCars = offer.offeredCars || [offer.offeredCar || offer.offeredCars]; // fallback for single car

    const { emoji: emoji1, rarity: rarity1 } = getCarEmbedVisuals(car1.name);

    let offeredCarsDesc = '';
    for (const car2 of offeredCars) {
      const { emoji: emoji2, rarity: rarity2 } = getCarEmbedVisuals(car2.name);
      offeredCarsDesc += `${emoji2} **${car2.name}** (#${car2.serial}) [${rarity2}]\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        `**${user1.username}** traded:\n` +
        `${emoji1} **${car1.name}** (#${car1.serial}) [${rarity1}]\n\n` +
        `with **${user2.username}** for:\n` +
        offeredCarsDesc
      )
      .setTimestamp();

    const channel = await client.channels.fetch(TRADE_HISTORY_CHANNEL_ID);
    await channel.send({ embeds: [embed] });
  } catch (e) {
    log && log("Failed to log trade history: " + e);
  }
}

// --- /trade command handler ---
async function handleTradeCommand(interaction, TRADE_COMMAND_CHANNEL_ID) {
  try {
    console.log("=== DEBUG: handleTradeCommand called by user", interaction.user.id, interaction.user.username);
    const userId = interaction.user.id;
    if (interaction.channel.id !== TRADE_COMMAND_CHANNEL_ID) {
      return safeReply(interaction, `❌ Please use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.`);
    }
    const garage = await Garage.findOne({ userId });
    console.log("=== DEBUG: Garage for user", userId, "===", JSON.stringify(garage, null, 2));
    if (!garage || !Array.isArray(garage.cars) || garage.cars.length === 0)
      return safeReply(interaction, '🚫 Your garage is empty.');

    // Log every car object as found
    garage.cars.forEach((c, idx) => {
      console.log(`[DEBUG] Garage.cars[${idx}] =`, c);
      if (!c.name || c.name.length < 1) {
        console.error(`[ERROR] Car at idx ${idx} has no name`, c);
      }
      if (typeof c.serial === 'undefined') {
        console.error(`[ERROR] Car at idx ${idx} has no serial`, c);
      }
    });

    const uniqueChoices = new Set();
    const carChoices = [];
    for (const c of garage.cars) {
      if (!c.name || typeof c.serial === 'undefined' || c.name.trim().length === 0 || String(c.serial).length === 0) {
        console.error('[ERROR] Skipping car for menu:', c);
        continue;
      }
      const value = `car-${encodeURIComponent(c.name)}#${c.serial}`;
      if (value.length < 6) {
        console.error('[ERROR] Menu value too short:', value, c);
        continue;
      }
      if (!uniqueChoices.has(value)) {
        uniqueChoices.add(value);
        carChoices.push({
          label: `${c.name} (#${c.serial})`,
          value
        });
      }
    }
    const limitedCarChoices = carChoices.slice(0, 25);

    debugOptionsArray('limitedCarChoices (trade command)', limitedCarChoices);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`tradeSelect:${userId}`)
        .setPlaceholder('Select a car to list for trade')
        .addOptions(limitedCarChoices)
    );
    await interaction.reply({ content: 'Select a car from your garage to list for trade:', components: [row], flags: 64 });
  } catch (error) {
    log && log("Error in handleTradeCommand: " + error);
    await safeReply(interaction, '❌ An error occurred in /trade.');
  }
}

// --- /canceltrade command handler ---
async function handleCancelTradeCommand(interaction, TRADE_POSTS_CHANNEL_ID) {
  try {
    if (!TRADE_POSTS_CHANNEL_ID) log && log("TRADE_POSTS_CHANNEL_ID is missing!");
    const userId = interaction.user.id;
    const listings = await TradeListing.find({ userId, active: true });
    console.log("=== DEBUG: handleCancelTradeCommand listings ===", listings);
    if (!listings.length) return safeReply(interaction, '🚫 No active listings found.');

    const channel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
    for (const listing of listings) {
      try {
        const msg = await channel.messages.fetch(listing.messageId);
        await msg.edit({ content: '🗑️ This trade listing was cancelled.', embeds: [], components: [] });
      } catch (err) {
        log && log(`Failed to update listing message: ${err}`);
        if (err.code === 10008) {
          await TradeListing.findByIdAndDelete(listing._id);
          log && log("Deleted TradeListing because message no longer exists.");
        }
      }
      await TradeListing.findByIdAndUpdate(listing._id, { active: false });
    }
    await interaction.reply({ content: '🗑️ All active listings canceled.', flags: 64 });
  } catch (error) {
    log && log("Error in handleCancelTradeCommand: " + error);
    await safeReply(interaction, '❌ An error occurred.');
  }
}

// --- trade car selection menu handler ---
async function handleTradeSelectMenu(interaction) {
  try {
    console.log("=== DEBUG: handleTradeSelectMenu called ===", interaction.customId, interaction.values);
    const [_, userId] = interaction.customId.split(':');
    let [carNameEncodedWithPrefix, serial] = interaction.values[0].split('#');
    let carNameEncoded = carNameEncodedWithPrefix.startsWith('car-')
      ? carNameEncodedWithPrefix.slice(4)
      : carNameEncodedWithPrefix;
    const carName = decodeURIComponent(carNameEncoded).trim();
    console.log(`[DEBUG] Selected carName: ${carName}, serial: ${serial}`);

    // Show a modal to collect the note
    const noteModal = new ModalBuilder()
      .setCustomId(`tradeNoteModal:${encodeURIComponent(carName)}#${serial}`)
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
  } catch (error) {
    log && log("Error in handleTradeSelectMenu: " + error);
    await safeReply(interaction, '❌ An error occurred.');
  }
}

// --- modal submit handler for trade note ---
async function handleTradeNoteModal(interaction, TRADE_POSTS_CHANNEL_ID) {
  try {
    if (!TRADE_POSTS_CHANNEL_ID) log && log("TRADE_POSTS_CHANNEL_ID is missing!");
    let [carNameEncodedWithPrefix, serial] = interaction.customId.replace('tradeNoteModal:', '').split('#');
    let carNameEncoded = carNameEncodedWithPrefix.startsWith('car-')
      ? carNameEncodedWithPrefix.slice(4)
      : carNameEncodedWithPrefix;
    const carName = decodeURIComponent(carNameEncoded).trim();
    const note = interaction.fields.getTextInputValue('tradeNote') || '';
    const userId = interaction.user.id;

    console.log(`[DEBUG] handleTradeNoteModal carName: ${carName}, serial: ${serial}, note:`, note);

    const tradeChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);

    // Stylized embed
    const { badge, color, emoji } = getCarEmbedVisuals(carName);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${interaction.user.username} is offering:`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle(`${badge}`)
      .setDescription(
        `**${emoji} ${carName}**  \`#${serial}\`\n` +
        (note ? `\n📝 ${note}` : '') +
        `\n⏳ **Expires in 3 hours**`
      )
      .setFooter({ text: `Listed by ${interaction.user.username}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sendOffer:${userId}:${encodeURIComponent(carName)}:${serial}`)
        .setLabel('💬 Send Offer')
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await tradeChannel.send({ embeds: [embed], components: [row] });

    // Save listing only ONCE
    const newListing = await new TradeListing({
      userId,
      car: { name: carName, serial: parseInt(serial) },
      note,
      messageId: msg.id,
      active: true
    }).save();

    setTimeout(async () => {
      await TradeListing.findByIdAndUpdate(newListing._id, { active: false });
      try {
        const channel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
        const msgToEdit = await channel.messages.fetch(newListing.messageId);
        await msgToEdit.edit({
          content: '⌛ This trade listing expired.',
          embeds: [],
          components: []
        });
      } catch (e) {
        if (e.code === 10008) {
          await TradeListing.findByIdAndDelete(newListing._id);
          log && log("Deleted TradeListing because message no longer exists (on expire).");
        }
      }
    }, 3 * 60 * 60 * 1000);

    await interaction.reply({ content: `✅ Trade listing posted to <#${TRADE_POSTS_CHANNEL_ID}>!`, flags: 64 });
  } catch (error) {
    log && log("Error in handleTradeNoteModal: " + error);
    await safeReply(interaction, '❌ An error occurred posting your trade.');
  }
}

// --- send offer button handler ---
async function handleSendOfferButton(interaction) {
  try {
    console.log("=== DEBUG: handleSendOfferButton called ===", interaction.customId);
    const parts = interaction.customId.split(':');
    const [, listingOwnerId, carNameEncoded, serial] = parts;
    const carName = decodeURIComponent(carNameEncoded).trim();

    if (interaction.user.id === listingOwnerId) {
      return safeReply(interaction, "❌ You can't send an offer to yourself.");
    }

    const fromGarage = await Garage.findOne({ userId: interaction.user.id });
    console.log("=== DEBUG: fromGarage ===", JSON.stringify(fromGarage, null, 2));
    if (!fromGarage || !Array.isArray(fromGarage.cars) || fromGarage.cars.length === 0)
      return safeReply(interaction, '🚫 You have no cars to offer.');

    fromGarage.cars.forEach((c, idx) => {
      console.log(`[DEBUG] fromGarage.cars[${idx}] =`, c);
      if (!c.name || c.name.length < 1) {
        console.error(`[ERROR] Offered car at idx ${idx} has no name`, c);
      }
      if (typeof c.serial === 'undefined') {
        console.error(`[ERROR] Offered car at idx ${idx} has no serial`, c);
      }
    });

    const uniqueChoices = new Set();
    const carChoices = [];
    for (const c of fromGarage.cars) {
      if (!c.name || typeof c.serial === 'undefined' || c.name.trim().length === 0 || String(c.serial).length === 0) {
        console.error('[ERROR] Skipping car for offer menu:', c);
        continue;
      }
      const value = `car-${encodeURIComponent(c.name)}#${c.serial}`;
      if (value.length < 6) {
        console.error('[ERROR] Offered menu value too short:', value, c);
        continue;
      }
      if (!uniqueChoices.has(value)) {
        uniqueChoices.add(value);
        carChoices.push({
          label: `${c.name} (#${c.serial})`,
          value
        });
      }
    }
    const limitedCarChoices = carChoices.slice(0, 25);

    debugOptionsArray('limitedCarChoices (send offer)', limitedCarChoices);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`chooseOffer:${interaction.user.id}:${listingOwnerId}:${encodeURIComponent(carName)}:${serial}`)
        .setPlaceholder('Select up to 6 cars to offer')
        .addOptions(limitedCarChoices)
        .setMinValues(1)
        .setMaxValues(6)
    );

    return interaction.reply({ content: 'Select up to 6 cars to offer in trade:', components: [row], flags: 64 });
  } catch (error) {
    log && log("Error in handleSendOfferButton: " + error);
    await safeReply(interaction, '❌ An error occurred.');
  }
}

// --- trade offer selection handler ---
async function handleChooseOfferMenu(interaction, TRADEOFFERS_CHANNEL_ID) {
  try {
    if (!TRADEOFFERS_CHANNEL_ID) log && log("TRADEOFFERS_CHANNEL_ID is missing!");
    console.log("=== DEBUG: handleChooseOfferMenu called ===", interaction.customId, interaction.values);
    const [_, senderId, receiverId, carNameEncoded, serial] = interaction.customId.split(':');
    const carName = decodeURIComponent(carNameEncoded).trim();

    // Get all selected cars (up to 6)
    const offeredCars = interaction.values.map((selected, i) => {
      const [offeredNameEncodedWithPrefix, offeredSerial] = selected.split('#');
      const offeredNameEncoded = offeredNameEncodedWithPrefix.startsWith('car-')
        ? offeredNameEncodedWithPrefix.slice(4)
        : offeredNameEncodedWithPrefix;
      const name = decodeURIComponent(offeredNameEncoded).trim();
      console.log(`[DEBUG] handleChooseOfferMenu offeredCar[${i}]:`, { name, serial: offeredSerial });
      return {
        name,
        serial: parseInt(offeredSerial, 10)
      };
    });

    const parsedSerial = parseInt(serial, 10);

    const newOffer = await new TradeOffer({
      fromUserId: senderId,
      toUserId: receiverId,
      offeredCars: offeredCars,
      requestedCar: { name: carName, serial: parsedSerial },
      messageId: null,
      status: 'pending'
    }).save();

    const sender = await interaction.client.users.fetch(senderId);
    const recipient = await interaction.client.users.fetch(receiverId);

    // Build offered cars description
    let offeredCarsDesc = '';
    for (const car of offeredCars) {
      const { rarity, emoji } = getCarEmbedVisuals(car.name);
      offeredCarsDesc += `${emoji} **${car.name}** (#${car.serial}) [${rarity}]\n`;
    }
    const { rarity: reqRarity, emoji: reqEmoji, color: reqColor } = getCarEmbedVisuals(carName);

    // --- PERSONALIZED EMBED ---
    const tradeOfferEmbed = new EmbedBuilder()
      .setColor(reqColor)
      .setAuthor({
        name: `${sender.username} is offering you a trade!`,
        iconURL: sender.displayAvatarURL()
      })
      .setTitle("Trade Offer")
      .setDescription(
        `Hey <@${recipient.id}>,\n\n` +
        `${sender.username} would like to trade with you!\n\n` +
        `**${sender.username} is offering:**\n${offeredCarsDesc}\n` +
        `**For your:** ${reqEmoji} **${carName}** (#${parsedSerial}) [${reqRarity}]\n\n` +
        `*Only you can accept or decline this trade offer!*`
      )
      .setFooter({
        text: `Offer sent to ${recipient.username} • You have 3 hours to respond`
      });

    const offerRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`acceptOffer:${senderId}:${receiverId}:${newOffer._id}`)
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`declineOffer:${senderId}:${receiverId}:${newOffer._id}`)
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger)
    );

    const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
    const offerMsg = await tradeOffersChannel.send({ embeds: [tradeOfferEmbed], components: [offerRow] });

    // Save messageId to offer
    newOffer.messageId = offerMsg.id;
    await newOffer.save();

    await interaction.reply({ content: '✅ Trade offer sent!', flags: 64 });
  } catch (error) {
    log && log("Error in handleChooseOfferMenu: " + error);
    await safeReply(interaction, '❌ An error occurred sending your offer.');
  }
}

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
    console.log("=== DEBUG: handleOfferButton offer ===", offer);
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
          await interaction.reply({ components: [row], flags: 64 });
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

      // Remove all offered cars from sender's garage and add to receiver
      if (offer.offeredCars && Array.isArray(offer.offeredCars)) {
        for (const car of offer.offeredCars) {
          fromGarage.cars = fromGarage.cars.filter(
            c => !(c.name === car.name && c.serial === car.serial)
          );
          toGarage.cars.push(car);
        }
      } else if (offer.offeredCar) {
        // legacy fallback
        fromGarage.cars = fromGarage.cars.filter(
          c => !(c.name === offer.offeredCar.name && c.serial === offer.offeredCar.serial)
        );
        toGarage.cars.push(offer.offeredCar);
      }

      // Remove requested car from receiver's garage and add to sender
      toGarage.cars = toGarage.cars.filter(
        c => !(c.name === offer.requestedCar.name && c.serial === offer.requestedCar.serial)
      );
      fromGarage.cars.push(offer.requestedCar);

      await fromGarage.save();
      await toGarage.save();

      // PATCH: Remove active:true from query so we always find the listing, even after marking inactive!
      const listing = await TradeListing.findOne({ 'car.name': offer.requestedCar.name, 'car.serial': offer.requestedCar.serial });
      if (listing) {
        listing.active = false;
        await listing.save();
        try {
          log && log(`Trying to update trade post. Channel: ${TRADE_POSTS_CHANNEL_ID}, Msg: ${listing?.messageId}`);
          const tradePostsChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
          try {
            const listingMsg = await tradePostsChannel.messages.fetch(listing.messageId);
            await listingMsg.edit({
              content: '✅ This trade has been completed and is no longer available.',
              embeds: [],
              components: []
            });
            log && log('Trade post message edited.');
          } catch (err) {
            if (err.code === 10008) {
              await TradeListing.findByIdAndDelete(listing._id);
              log && log("Deleted TradeListing because message no longer exists.");
            } else {
              log && log("Failed to edit trade post: " + err);
            }
          }
        } catch (err) {
          log && log("Failed to fetch trade post channel: " + err);
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
