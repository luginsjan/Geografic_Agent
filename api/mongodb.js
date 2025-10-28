const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'geografic-agent';

if (!uri) {
  throw new Error('Missing MongoDB connection string. Set the MONGODB_URI environment variable.');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();

  cachedClient = client;
  cachedDb = client.db(dbName);

  return { client, db: cachedDb };
}

module.exports = {
  connectToDatabase
};
