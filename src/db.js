const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db("learning_academy");
    
    console.log("Connected to MongoDB successfully");
    
    // Create indexes for better performance
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("courses").createIndex({ id: 1 }, { unique: true });
    await db.collection("paidEnrollments").createIndex({ userId: 1, courseId: 1 });
    await db.collection("testimonials").createIndex({ published: 1 });
    
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
}

async function getDb() {
  if (!db) {
    await connect();
  }
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await close();
  process.exit(0);
});

module.exports = { connect, getDb, close };

// Made with Bob
