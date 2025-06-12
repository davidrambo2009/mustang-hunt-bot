const mongoose = require('mongoose');

const garageSchema = new mongoose.Schema({
  userId: String,
  cars: [{ name: String, serial: Number }]
});

module.exports = mongoose.model('Garage', garageSchema);
