const mongoose = require('mongoose');

const garageSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  // Cars owned by the user
  cars: [
    {
      name: { type: String, required: true },
      serial: { type: Number, required: true }
    }
  ],

  // Number of tokens the user has
  tokens: { type: Number, default: 0 },

  // Number of coins the user has (for shop purchases)
  coins: { type: Number, default: 0 }, // <-- ADDED

  // Titles
  ownedTitles:    { type: [String], default: [] },
  equippedTitle:  { type: String, default: "" },

  // Garage Themes
  ownedThemes:    { type: [String], default: [] },
  equippedTheme:  { type: String, default: "" }
});

module.exports = mongoose.models.Garage || mongoose.model('Garage', garageSchema);
