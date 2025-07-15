const Garage = require('../models/garage.js');

/**
 * Adds Hunt Tokens to a user, applying booster multiplier if needed.
 * @param {String} userId - Discord user ID
 * @param {Number} baseAmount - Amount of tokens to add (before multiplier)
 * @param {Boolean} isBoosting - Whether the user is currently boosting
 */
async function addTokens(userId, baseAmount, isBoosting = false) {
  let multiplier = isBoosting ? 2 : 1;
  let tokensToAdd = baseAmount * multiplier;

  // Find and update the user's garage
  let garage = await Garage.findOne({ userId });
  if (!garage) {
    // If the user doesn't have a garage yet, create one
    garage = new Garage({ userId, cars: [], tokens: tokensToAdd });
  } else {
    garage.tokens = (garage.tokens || 0) + tokensToAdd;
  }
  await garage.save();
  return garage.tokens;
}

/**
 * Gets the Hunt Token balance for a user.
 * @param {String} userId - Discord user ID
 * @returns {Promise<Number>} - The number of tokens, or 0 if none found
 */
async function getTokens(userId) {
  const garage = await Garage.findOne({ userId });
  return garage && typeof garage.tokens === "number" ? garage.tokens : 0;
}

module.exports = { addTokens, getTokens };
