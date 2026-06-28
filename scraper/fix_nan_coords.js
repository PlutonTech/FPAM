// Deletes assets with nan coordinates so import can re-insert them cleanly
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');

async function run() {
  const col = client.db('assetspatial').collection('assets');
  // Can't query nan directly — find all zero-coord scraped assets and check
  const all = await col.find({ 'location.coordinates': [0, 0], assetId: /^FGN-/ }).toArray();
  // Also find any that errored — they'll have no photos and wrong coords
  // Safest: just delete all FGN- assets that have [0,0] coords and no photos
  const result = await col.deleteMany({
    assetId: /^FGN-/,
    'location.coordinates': { $in: [[0, 0]] },
    photos: { $size: 0 }
  });
  await client.close();
  console.log(`Deleted ${result.deletedCount} assets with bad coordinates`);
}
run().catch(console.error);
