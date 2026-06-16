#!/usr/bin/env node

/**
 * Update course pricing in MongoDB to remove discount
 * Sets price to Rs. 30,000 Incl GST without discount
 */

const path = require("path");
const { loadEnv } = require("../src/env");
const { connect, getDb } = require("../src/db");

// Load environment variables
const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);

async function updatePricing() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    const db = await getDb();

    console.log("Updating course pricing...");
    const result = await db.collection("courses").updateOne(
      { id: "oracle-fusion-hcm" },
      {
        $set: {
          price: 30000
        },
        $unset: {
          originalPrice: ""
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log("✅ Successfully updated course pricing");
      console.log("   Price: Rs. 30,000 Incl GST");
      console.log("   Discount: Removed");
    } else {
      console.log("⚠️  No changes made (course may already be updated)");
    }

    // Verify the update
    const course = await db.collection("courses").findOne({ id: "oracle-fusion-hcm" });
    console.log("\nCurrent course pricing:");
    console.log("   Price:", course.price);
    console.log("   Original Price:", course.originalPrice || "Not set");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating pricing:", error.message);
    process.exit(1);
  }
}

updatePricing();

// Made with Bob
