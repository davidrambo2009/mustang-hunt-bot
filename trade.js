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

// --- /trade command handler ---
async function handleTradeCommand(interaction, TRADE_COMMAND_CHANNEL_ID) {
  const userId = interaction.user.id;
  if (interaction.channel.id !== TRADE_COMMAND_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ Please use this command in <#${TRADE_COMMAND_CHANNEL_ID}>.`,
      flags: 64
    });
  }
  const garage = await Garage.findOne({ userId });
  if (!garage || garage.cars.length === 0)
    return interaction.reply({ content: '🚫 Your garage is empty.', flags: 64 });

  const uniqueChoices = new Set();
  const carChoices = [];
  for (const c of garage.cars) {
    const value = `${encodeURIComponent(c.name)}#${c.serial}`;
    if (!uniqueChoices.has(value)) {
      uniqueChoices.add(value);
      carChoices.push({
        label: `${c.name} (#${c.serial})`,
        value
      });
    }
  }
  const limitedCarChoices = carChoices.slice(0, 25);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`tradeSelect:${userId}`)
      .setPlaceholder('Select a car to list for trade')
      .addOptions(limitedCarChoices)
  );
  await interaction.reply({ content: 'Select a car from your garage to list for trade:', components: [row], flags: 64 });
}

// --- /canceltrade command handler ---
async function handleCancelTradeCommand(interaction, TRADE_POSTS_CHANNEL_ID) {
  const userId = interaction.user.id;
  const listings = await TradeListing.find({ userId, active: true });
  if (!listings.length) return interaction.reply({ content: '🚫 No active listings found.', flags: 64 });

  const channel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
  for (const listing of listings) {
    try {
      const msg = await channel.messages.fetch(listing.messageId);
      await msg.edit({ components: [] });
    } catch (err) {
      log(`Failed to update listing message: ${err}`);
    }
    await TradeListing.findByIdAndUpdate(listing._id, { active: false });
  }
  await interaction.reply({ content: '🗑️ All active listings canceled.', flags: 64 });
}

// --- trade car selection menu handler ---
async function handleTradeSelectMenu(interaction) {
  const [_, userId] = interaction.customId.split(':');
  const [carNameEncoded, serial] = interaction.values[0].split('#');
  const carName = decodeURIComponent(carNameEncoded);

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
}

// --- modal submit handler for trade note ---
async function handleTradeNoteModal(interaction, TRADE_POSTS_CHANNEL_ID) {
  const [carNameEncoded, serial] = interaction.customId.replace('tradeNoteModal:', '').split('#');
  const carName = decodeURIComponent(carNameEncoded);
  const note = interaction.fields.getTextInputValue('tradeNote') || '';
  const userId = interaction.user.id;

  const tradeChannel = await interaction.client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
  const embed = new EmbedBuilder()
    .setTitle(`👤 ${interaction.user.username} is offering:`)
    .setDescription(`🚗 **${carName}** (#${serial})\n📝 ${note || 'No message'}\n⏳ Expires in 3 hours`)
    .setColor(0x00AAFF);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sendOffer:${userId}:${encodeURIComponent(carName)}:${serial}`)
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

 setTimeout(async () => {
  // Mark trade as inactive in DB
  await TradeListing.findByIdAndUpdate(listing._id, { active: false });
  // Delete or edit the Discord message
  try {
    const channel = await client.channels.fetch(TRADE_POSTS_CHANNEL_ID);
    const msg = await channel.messages.fetch(listing.messageId);
    await msg.delete();
  } catch (e) {
    // message may already be deleted, ignore
  }
}, 3 * 60 * 60 * 1000);

  await interaction.reply({ content: `✅ Trade listing posted to <#${TRADE_POSTS_CHANNEL_ID}>!`, flags: 64 });
}

// --- send offer button handler ---
async function handleSendOfferButton(interaction) {
  const parts = interaction.customId.split(':');
  const [ , listingOwnerId, carNameEncoded, serial ] = parts;
  const carName = decodeURIComponent(carNameEncoded);

  if (interaction.user.id === listingOwnerId) {
    return interaction.reply({ content: "❌ You can't send an offer to yourself.", flags: 64 });
  }

  const fromGarage = await Garage.findOne({ userId: interaction.user.id });
  if (!fromGarage || fromGarage.cars.length === 0)
    return interaction.reply({ content: '🚫 You have no cars to offer.', flags: 64 });

  const uniqueChoices = new Set();
  const carChoices = [];
  for (const c of fromGarage.cars) {
    const value = `${encodeURIComponent(c.name)}#${c.serial}`;
    if (!uniqueChoices.has(value)) {
      uniqueChoices.add(value);
      carChoices.push({
        label: `${c.name} (#${c.serial})`,
        value
      });
    }
  }
  const limitedCarChoices = carChoices.slice(0, 25);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`chooseOffer:${interaction.user.id}:${listingOwnerId}:${encodeURIComponent(carName)}:${serial}`)
      .setPlaceholder('Select a car to offer')
      .addOptions(limitedCarChoices)
  );

  return interaction.reply({ content: 'Select a car to offer in trade:', components: [row], flags: 64 });
}

// --- trade offer selection handler ---
async function handleChooseOfferMenu(interaction, TRADEOFFERS_CHANNEL_ID) {
  const msg = interaction.message;
  const [_, senderId, receiverId, carNameEncoded, serial] = interaction.customId.split(':');
  const carName = decodeURIComponent(carNameEncoded);
  const selected = interaction.values[0];
  const [offeredNameEncoded, offeredSerial] = selected.split('#');
  const offeredName = decodeURIComponent(offeredNameEncoded);

  const parsedSerial = parseInt(serial, 10);
  const parsedOfferedSerial = parseInt(offeredSerial, 10);
  if (isNaN(parsedSerial) || isNaN(parsedOfferedSerial)) {
    log(`Invalid serial(s): offeredSerial=${offeredSerial}, requestedSerial=${serial}, customId=${interaction.customId}, selected=${selected}`);
    return interaction.reply({ content: '❌ Invalid car serial number detected in trade.', flags: 64 });
  }

  await new TradeOffer({
    fromUserId: senderId,
    toUserId: receiverId,
    offeredCar: { name: offeredName, serial: parsedOfferedSerial },
    requestedCar: { name: carName, serial: parsedSerial },
    messageId: msg.id
  }).save();

  const sender = await interaction.client.users.fetch(senderId);
  const receiver = await interaction.client.users.fetch(receiverId);

  const tradeOfferEmbed = new EmbedBuilder()
    .setTitle('Trade Offer')
    .setDescription(
      `👤 **${sender.username}** is offering:\n` +
      `🚗 **${offeredName}** (#${parsedOfferedSerial})\n\n` +
      `For: **${carName}** (#${parsedSerial})`
    )
    .setColor(0x00AAFF);

  const offerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`acceptOffer:${senderId}:${receiverId}:${msg.id}`)
      .setLabel('✅ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`declineOffer:${senderId}:${receiverId}:${msg.id}`)
      .setLabel('❌ Decline')
      .setStyle(ButtonStyle.Danger)
  );

  const tradeOffersChannel = await interaction.client.channels.fetch(TRADEOFFERS_CHANNEL_ID);
  await tradeOffersChannel.send({ embeds: [tradeOfferEmbed], components: [offerRow] });

  await interaction.reply({ content: '✅ Trade offer sent!', flags: 64 });
}

// --- accept/decline/cancel offer handler ---
async function handleOfferButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const [ , senderId, receiverId, offerMsgId, confirmFlag ] = parts;

  // --- Always fetch the offer from DB to get the correct toUserId (listing owner) ---
  const offer = await TradeOffer.findOne({ messageId: offerMsgId });
  if (!offer) {
    return interaction.reply({ content: '❌ Offer not found or already handled.', flags: 64, ephemeral: true });
  }
  if (interaction.user.id !== offer.toUserId) {
    return interaction.reply({
      content: "❌ Only the listing owner can accept or decline this trade.",
      flags: 64,
      ephemeral: true
    });
  }

  if (action === 'acceptOffer') {
    // Double confirm
    if (confirmFlag !== 'confirmed') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`acceptOffer:${senderId}:${receiverId}:${offerMsgId}:confirmed`)
          .setLabel('✅ Yes, confirm trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancelTradeConfirm:${senderId}:${receiverId}:${offerMsgId}`)
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({
        content: 'Are you sure you want to accept this trade?\nThis action is **final** and will swap the cars between users.',
        components: [row],
        ephemeral: true
      });
      return;
    }

    // --- Actual trade logic, only runs on confirm! ---
    const offerUpdate = await TradeOffer.findOneAndUpdate(
      { messageId: offerMsgId, status: 'pending' },
      { status: 'accepted' }
    );
    if (!offerUpdate) {
      return interaction.reply({ content: '❌ Offer no longer valid.', flags: 64 });
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

    await interaction.update({ content: '✅ Trade completed successfully!', components: [] });
    return;
  }

  // --- Cancel confirmation handler ---
  if (action === 'cancelTradeConfirm') {
    await interaction.update({ content: '❌ Trade was not accepted.', components: [] });
    return;
  }

  // --- Decline handler ---
  if (action === 'declineOffer') {
    await TradeOffer.updateOne({ messageId: offerMsgId }, { status: 'declined' });
    await interaction.update({ content: '❌ Trade declined.', components: [] });
    return;
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
};
