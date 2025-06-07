const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://davidrambo2009:zZntRaFH96dtv-Z@cluster0.c4cbv7r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function removeDuplicates() {
  try {
    await client.connect();
    const db = client.db('test'); // Change 'test' if your DB name is different
    const collection = db.collection('garages');

    // Find duplicate serials
    const duplicates = await collection.aggregate([
      { $group: {
        _id: "$serial", // or use your unique field
        ids: { $addToSet: "$_id" },
        count: { $sum: 1 }
      }},
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    for (const doc of duplicates) {
      const [keep, ...remove] = doc.ids;
      if (remove.length > 0) {
        await collection.deleteMany({ _id: { $in: remove } });
        console.log(`Removed ${remove.length} duplicates for serial: ${doc._id}`);
      }
    }
    console.log("Duplicate cleanup complete.");
  } finally {
    await client.close();
  }
}

removeDuplicates().catch(console.error);
