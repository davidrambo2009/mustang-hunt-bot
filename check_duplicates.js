const { MongoClient } = require('mongodb');

// MongoDB connection string (replace password if needed)
const uri = "mongodb+srv://davidrambo2009:zZntRaFH96dtv-Z@cluster0.c4cbv7r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function checkForDuplicateCarsInGarages(collection) {
  const garages = await collection.find({}).toArray();
  let foundAny = false;
  for (const garage of garages) {
    if (!garage.cars || !Array.isArray(garage.cars)) continue;
    const seen = new Set();
    const duplicates = [];
    for (const car of garage.cars) {
      const key = `${car.name}|${car.serial}`;
      if (seen.has(key)) {
        duplicates.push(key);
      } else {
        seen.add(key);
      }
    }
    if (duplicates.length > 0) {
      foundAny = true;
      console.log(`Duplicate car/serials found in userId ${garage.userId}:`);
      duplicates.forEach(d => {
        const [name, serial] = d.split('|');
        console.log(`  Car: ${name}, Serial: ${serial}`);
      });
    }
  }
  if (!foundAny) {
    console.log("No duplicate (car name + serial) combos found within any user's garage.");
  }
}

async function main() {
  try {
    await client.connect();
    const db = client.db('test'); // Change if needed
    const collection = db.collection('garages'); // Change if needed

    await checkForDuplicateCarsInGarages(collection);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

main();
