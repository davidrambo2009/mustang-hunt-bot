const mongoose = require('mongoose');

const garageSchema = new mongoose.Schema({
  userId: String,
  cars: [{ name: String, serial: Number }]
});

// Check if the model is already compiled (prevents OverwriteModelError)
module.exports = mongoose.models.Garage || mongoose.model('Garage', garageSchema);
