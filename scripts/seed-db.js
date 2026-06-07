const fs = require("fs");
const path = require("path");

// Load environment variables
const rootDir = path.join(__dirname, "..");
require("../src/env").loadEnv(rootDir);

const { connect, close } = require("../src/db");

async function seedDatabase() {
  console.log("Starting database seeding...");
  
  try {
    // Connect to MongoDB
    const db = await connect();
    
    // Read the existing db.json file
    const dbPath = path.join(__dirname, "..", "data", "db.json");
    const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    
    console.log("Loaded data from db.json");
    
    // Clear existing collections
    console.log("Clearing existing collections...");
    await db.collection("users").deleteMany({});
    await db.collection("courses").deleteMany({});
    await db.collection("paidEnrollments").deleteMany({});
    await db.collection("testimonials").deleteMany({});
    await db.collection("contact").deleteMany({});
    
    // Insert users
    if (data.users && data.users.length > 0) {
      await db.collection("users").insertMany(data.users);
      console.log(`✓ Inserted ${data.users.length} users`);
    }
    
    // Insert courses
    if (data.courses && data.courses.length > 0) {
      await db.collection("courses").insertMany(data.courses);
      console.log(`✓ Inserted ${data.courses.length} courses`);
    }
    
    // Insert paid enrollments
    if (data.paidEnrollments && data.paidEnrollments.length > 0) {
      await db.collection("paidEnrollments").insertMany(data.paidEnrollments);
      console.log(`✓ Inserted ${data.paidEnrollments.length} paid enrollments`);
    }
    
    // Insert testimonials
    if (data.testimonials && data.testimonials.length > 0) {
      await db.collection("testimonials").insertMany(data.testimonials);
      console.log(`✓ Inserted ${data.testimonials.length} testimonials`);
    }
    
    // Insert contact info (as a single document)
    if (data.contact) {
      await db.collection("contact").insertOne(data.contact);
      console.log("✓ Inserted contact information");
    }
    
    console.log("\n✅ Database seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding database:", error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

// Run the seeding
seedDatabase();

// Made with Bob
