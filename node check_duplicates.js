require('dotenv').config();
const mongoose = require('mongoose');

// Define the Garage schema (should match your index.js)
const garageSchema = new mongoose.Schema({
  userId: String,
  cars: [{ name: String, serial: Number }]
});
const Garage = mongoose.model('Garage', garageSchema);

async function findDuplicateSerials() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const garages = await Garage.find();
  const serialMap = new Map();

  for (const garage of garages) {
    for (const car of garage.cars) {
      if (!car.name || typeof car.serial !== "number") continue;
      const key = `${car.name}::${car.serial}`;
      if (!serialMap.has(key)) {
        serialMap.set(key, []);
      }
      serialMap.get(key).push(garage.userId);
    }
  }

  let found = false;
  for (const [key, userIds] of serialMap.entries()) {
    if (userIds.length > 1) {
      found = true;
      const [name, serial] = key.split("::");
      console.log(`Duplicate found for ${name} serial #${serial}: Users: ${userIds.join(', ')}`);
    }
  }

  if (!found) {
    console.log('No duplicates found.');
  }
  await mongoose.disconnect();
}

findDuplicateSerials().catch(err => {
  console.error('Error running duplicate checker:', err);
  process.exit(1);
});
