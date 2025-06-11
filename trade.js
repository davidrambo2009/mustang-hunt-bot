const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

function getCarEmbedVisuals(carName) {
  const trimmedName = carName.trim();
  const meta = cars.find(c => c.name.trim() === trimmedName);
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

async function safeReply(interaction, msg) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: msg, flags: 64 });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content: msg });
    }
  } catch (err) {
    // ignore
  }
}

// Pads select menu options to at least 10 with disabled dummy options
function padSelectMenuOptions(options) {
  const padded = [...options];
  let count = 1;
  while (padded.length < 10) {
    padded.push({
      label: '—',
      value: `disabled-${count++}-${Math.random().toString(36).slice(2, 8)}`,
      description: ' ',
      disabled: true
    });
  }
  return padded;
}

async function logTradeHistory({
  client,
  TRADE_HISTORY_CHANNEL_ID,
  action,
  offer,
  listingUser,
  offerUser
}) {
  try {
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
    const offeredCars = offer.offeredCars || [offer.offeredCar || offer.offeredCars];

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
  } catch (e) {}
}

async function handleTradeCommand(interaction, TRADE_COMMAND_CHANNEL_ID) {
  try {
    const userId = interaction.user.id;
    if (interaction.channel.id !== TRADE_COMMAND_CHANNEL_ID) {
      return safeReply(interaction, `❌ Please use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.`);
    }
    const garage = await Garage.findOne({ userId });
    if (!garage || !Array.isArray(garage.cars) || garage.cars.length === 0)
      return safeReply(interaction, '🚫 Your garage is empty.');

    const uniqueChoices = new Set();
    const carChoices = [];
    for (const c of garage.cars) {
      if (!c.name || typeof c.serial === 'undefined' || c.name.trim().length === 0 || String(c.serial).length === 0) {
        continue;
      }
      const value = `car-${encodeURIComponent(c.name)}#${c.serial}`;
      if (value.length < 6) continue;
      if (!uniqueChoices.has(value)) {
        uniqueChoices.add(value);
        carChoices.push({
          label: `${c.name} (#${c.serial})`,
          value
        });
      }
    }
    let limitedCarChoices = carChoices.slice(0, 25);
    limitedCarChoices = padSelectMenuOptions(limitedCarChoices);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`tradeSelect:${userId}`)
        .setPlaceholder('Select a car to list for trade')
        .addOptions(
          ...limitedCarChoices.map(opt => {
            const builder = new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
              .setDescription(opt.description || " ");
            return builder;
          })
        )
    );
    await interaction.reply({ content: 'Select a car from your garage to list for trade:', components: [row], flags: 64 });
  } catch (error) {
    await safeReply(interaction, '❌ An error occurred in /trade.');
  }
}

async function handleCancelTradeCommand(interaction, TRADE_POSTS_CHANNEL_ID) {
  try {
    const userId = interaction.user.id;
    const listings = await TradeListing.find({ userId, active: true });
    if (!listings.length) return safeReply(interaction, '🚫 No active listings found.');

    const channel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
    for (const listing of listings) {
      try {
        const msg = await channel.messages.fetch(listing.messageId);
        await msg.edit({ content: '🗑️ This trade listing was cancelled.', embeds: [], components: [] });
      } catch (err) {
        if (err.code === 10008) {
          await TradeListing.findByIdAndDelete(listing._id);
        }
      }
      await TradeListing.findByIdAndUpdate(listing._id, { active: false });
    }
    await interaction.reply({ content: '🗑️ All active listings canceled.', flags: 64 });
  } catch (error) {
    await safeReply(interaction, '❌ An error occurred.');
  }
}

async function handleTradeSelectMenu(interaction) {
  try {
    const [_, userId] = interaction.customId.split(':');
    let [carNameEncodedWithPrefix, serial] = interaction.values[0].split('#');
    let carNameEncoded = carNameEncodedWithPrefix.startsWith('car-')
      ? carNameEncodedWithPrefix.slice(4)
      : carNameEncodedWithPrefix;
    const carName = decodeURIComponent(carNameEncoded).trim();

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
    await safeReply(interaction, '❌ An error occurred.');
  }
}

async function handleTradeNoteModal(interaction, TRADE_POSTS_CHANNEL_ID) {
  try {
    let [carNameEncodedWithPrefix, serial] = interaction.customId.replace('tradeNoteModal:', '').split('#');
    let carNameEncoded = carNameEncodedWithPrefix.startsWith('car-')
      ? carNameEncodedWithPrefix.slice(4)
      : carNameEncodedWithPrefix;
    const carName = decodeURIComponent(carNameEncoded).trim();
    const note = interaction.fields.getTextInputValue('tradeNote') || '';
    const userId = interaction.user.id;

    const tradeChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);

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
        }
      }
    }, 3 * 60 * 60 * 1000);

    await interaction.reply({ content: `✅ Trade listing posted to <#${TRADE_POSTS_CHANNEL_ID}>!`, flags: 64 });
  } catch (error) {
    await safeReply(interaction, '❌ An error occurred posting your trade.');
  }
}

async function handleSendOfferButton(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const [, listingOwnerId, carNameEncoded, serial] = parts;
    const carName = decodeURIComponent(carNameEncoded).trim();

    if (interaction.user.id === listingOwnerId) {
      return safeReply(interaction, "❌ You can't send an offer to yourself.");
    }

    const fromGarage = await Garage.findOne({ userId: interaction.user.id });
    if (!fromGarage || !Array.isArray(fromGarage.cars) || fromGarage.cars.length === 0)
      return safeReply(interaction, '🚫 You have no cars to offer.');

    const uniqueChoices = new Set();
    const carChoices = [];
    for (const c of fromGarage.cars) {
      if (!c.name || typeof c.serial === 'undefined' || c.name.trim().length === 0 || String(c.serial).length === 0) {
        continue;
      }
      const value = `car-${encodeURIComponent(c.name)}#${c.serial}`;
      if (value.length < 6) continue;
      if (!uniqueChoices.has(value)) {
        uniqueChoices.add(value);
        carChoices.push({
          label: `${c.name} (#${c.serial})`,
          value
        });
      }
    }
    let limitedCarChoices = carChoices.slice(0, 25);
    limitedCarChoices = padSelectMenuOptions(limitedCarChoices);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`chooseOffer:${interaction.user.id}:${listingOwnerId}:${encodeURIComponent(carName)}:${serial}`)
        .setPlaceholder('Select up to 6 cars to offer')
        .setMinValues(1)
        .setMaxValues(6)
        .addOptions(
          ...limitedCarChoices.map(opt => {
            const builder = new StringSelectMenuOptionBuilder()
              .setLabel(opt.label)
              .setValue(opt.value)
              .setDescription(opt.description || " ");
            return builder;
          })
        )
    );
    return interaction.reply({ content: 'Select up to 6 cars to offer in trade:', components: [row], flags: 64 });
  } catch (error) {
    await safeReply(interaction, '❌ An error occurred.');
  }
}

async function handleChooseOfferMenu(interaction, TRADEOFFERS_CHANNEL_ID) {
  try {
    const [_, senderId, receiverId, carNameEncoded, serial] = interaction.customId.split(':');
    const carName = decodeURIComponent(carNameEncoded).trim();

    const offeredCars = interaction.values.map((selected) => {
      const [offeredNameEncodedWithPrefix, offeredSerial] = selected.split('#');
      const offeredNameEncoded = offeredNameEncodedWithPrefix.startsWith('car-')
        ? offeredNameEncodedWithPrefix.slice(4)
        : offeredNameEncodedWithPrefix;
      const name = decodeURIComponent(offeredNameEncoded).trim();
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

    let offeredCarsDesc = '';
    for (const car of offeredCars) {
      const { rarity, emoji } = getCarEmbedVisuals(car.name);
      offeredCarsDesc += `${emoji} **${car.name}** (#${car.serial}) [${rarity}]\n`;
    }
    const { rarity: reqRarity, emoji: reqEmoji, color: reqColor } = getCarEmbedVisuals(carName);

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

    newOffer.messageId = offerMsg.id;
    await newOffer.save();

    await interaction.reply({ content: '✅ Trade offer sent!', flags: 64 });
  } catch (error) {
    await safeReply(interaction, '❌ An error occurred sending your offer.');
  }
}

async function handleOfferButton(interaction, TRADE_POSTS_CHANNEL_ID, TRADEOFFERS_CHANNEL_ID, TRADE_HISTORY_CHANNEL_ID) {
  try {
    const parts = interaction.customId.split(':');
    const action = parts[0];
    const [, senderId, receiverId, offerId, confirmFlag] = parts;

    const offer = await TradeOffer.findById(offerId);
    if (!offer) {
      return safeReply(interaction, '❌ Offer not found or already handled.');
    }
    if (interaction.user.id !== offer.toUserId) {
      return safeReply(interaction, "❌ Only the listing owner can accept or decline this trade.");
    }

    if (action === 'declineOffer') {
      await TradeOffer.findByIdAndUpdate(offerId, { status: 'declined' });
      await interaction.update({ content: '❌ Trade declined.', components: [] });
      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '❌ This trade offer was declined.',
          embeds: [],
          components: []
        });
      } catch (e) {}
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

    if (action === 'cancelTradeConfirm') {
      await interaction.update({ content: '❌ Trade was not accepted.', components: [] });
      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '🗑️ This trade offer is no longer active.',
          embeds: [],
          components: []
        });
      } catch (e) {}
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

    if (action === 'acceptOffer') {
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

      const offerUpdate = await TradeOffer.findOneAndUpdate(
        { _id: offerId, status: 'pending' },
        { status: 'accepted' }
      );
      if (!offerUpdate) {
        return safeReply(interaction, '❌ Offer no longer valid.');
      }

      const fromGarage = await Garage.findOne({ userId: offer.fromUserId });
      const toGarage = await Garage.findOne({ userId: offer.toUserId });

      if (offer.offeredCars && Array.isArray(offer.offeredCars)) {
        for (const car of offer.offeredCars) {
          fromGarage.cars = fromGarage.cars.filter(
            c => !(c.name === car.name && c.serial === car.serial)
          );
          toGarage.cars.push(car);
        }
      } else if (offer.offeredCar) {
        fromGarage.cars = fromGarage.cars.filter(
          c => !(c.name === offer.offeredCar.name && c.serial === offer.offeredCar.serial)
        );
        toGarage.cars.push(offer.offeredCar);
      }

      toGarage.cars = toGarage.cars.filter(
        c => !(c.name === offer.requestedCar.name && c.serial === offer.requestedCar.serial)
      );
      fromGarage.cars.push(offer.requestedCar);

      await fromGarage.save();
      await toGarage.save();

      // PATCH: always update or delete the trade post after trade completion
      const listing = await TradeListing.findOne({ 'car.name': offer.requestedCar.name, 'car.serial': offer.requestedCar.serial });
      if (listing) {
        listing.active = false;
        await listing.save();
        try {
          const tradePostsChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
          try {
            const listingMsg = await tradePostsChannel.messages.fetch(listing.messageId);
            await listingMsg.edit({
              content: '✅ This trade has been completed and is no longer available.',
              embeds: [],
              components: []
            });
          } catch (err) {
            if (err.code === 10008) {
              await TradeListing.findByIdAndDelete(listing._id);
            }
          }
        } catch (err) {}
      }

      try {
        const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
        const offerMsg = await tradeOffersChannel.messages.fetch(offer.messageId);
        await offerMsg.edit({
          content: '✅ This trade offer has been accepted and is no longer available.',
          embeds: [],
          components: []
        });
      } catch (e) {}

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
        } catch (err) {}
      }

      await interaction.update({ content: '✅ Trade completed successfully!', components: [] });
      return;
    }
  } catch (error) {
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
