const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in your .env file!");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    console.error(msg);
    process.exit(1);
  }
}

testConnection();
