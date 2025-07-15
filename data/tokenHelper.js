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

module.exports = { addTokens };
