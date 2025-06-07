const { MongoClient } = require('mongodb');

// MongoDB connection string (replace password if needed)
const uri = "mongodb+srv://davidrambo2009:zZntRaFH96dtv-Z@cluster0.c4cbv7r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// Checks for duplicate userIds and prints them (does NOT delete)
async function checkDuplicateUserIds(collection) {
  // Aggregation pipeline to find userIds that appear more than once
  const duplicates = await collection.aggregate([
    {
      $group: {
        _id: "$userId",
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]).toArray();

  if (duplicates.length > 0) {
    console.log("Duplicate userIds found:");
    duplicates.forEach(dup => {
      console.log(`userId: ${dup._id}, count: ${dup.count}`);
    });
  } else {
    console.log("No duplicate userIds found.");
  }
}

// Finds and removes duplicates based on the 'serial' field (keeps one, deletes others)
// Skips documents where serial is null or missing
async function removeDuplicateSerials(collection) {
  // Only group by non-null serials
  const duplicates = await collection.aggregate([
    {
      $match: { serial: { $ne: null } } // Skip documents where serial is null
    },
    {
      $group: {
        _id: "$serial",
        ids: { $addToSet: "$_id" },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();

  for (const doc of duplicates) {
    // Keep the first _id, remove the rest
    const [keep, ...remove] = doc.ids;
    if (remove.length > 0) {
      await collection.deleteMany({ _id: { $in: remove } });
      console.log(`Removed ${remove.length} duplicates for serial: ${doc._id}`);
    }
  }
  console.log("Duplicate serial cleanup complete.");
}

// Main function: connects to DB, checks for duplicate userIds, and removes duplicate serials
async function main() {
  try {
    await client.connect();
    const db = client.db('test'); // Change this if your DB name is different
    const collection = db.collection('garages'); // Change this if your collection name is different

    // Check for duplicate userIds (does not delete)
    await checkDuplicateUserIds(collection);

    // Remove duplicate serials (keeps one, deletes others, skips null serials)
    await removeDuplicateSerials(collection);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

// Run the main function
main();
