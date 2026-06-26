#!/usr/bin/env node

/**
 * Helper script to add new fields to MongoDB documents
 * Usage: node scripts/add-fields.js
 */

const path = require("path");
const { loadEnv } = require("../src/env");
const { connect, getDb } = require("../src/db");

// Load environment variables
const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);

async function addFields() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    const db = await getDb();

    // Example: Add new fields to courses collection
    // Modify this section based on what you need
    
    console.log("\n📝 What would you like to do?");
    console.log("1. Add field to a specific document");
    console.log("2. Add field to all documents in a collection");
    console.log("3. Update existing field value");
    console.log("\nEdit this script to customize the operation.\n");

    // Example 1: Add a field to a specific course
    const exampleAddField = async () => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" }, // Filter: which document
        {
          $set: {
            // Add your new fields here
            // newField: "value",
            // anotherField: 123,
          }
        }
      );
      console.log(`✅ Modified ${result.modifiedCount} document(s)`);
    };

    // Example 2: Add a field to all courses
    const exampleAddFieldToAll = async () => {
      const result = await db.collection("courses").updateMany(
        {}, // Empty filter = all documents
        {
          $set: {
            // Add your new fields here
            // newField: "value",
          }
        }
      );
      console.log(`✅ Modified ${result.modifiedCount} document(s)`);
    };

    // Example 3: Add array field
    const exampleAddArrayField = async () => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" },
        {
          $set: {
            // tags: ["HCM", "Oracle", "Fusion"],
            // features: []
          }
        }
      );
      console.log(`✅ Modified ${result.modifiedCount} document(s)`);
    };

    // Example 4: Add nested object field
    const exampleAddNestedField = async () => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" },
        {
          $set: {
            // "metadata.instructor": "John Doe",
            // "metadata.difficulty": "Intermediate",
          }
        }
      );
      console.log(`✅ Modified ${result.modifiedCount} document(s)`);
    };

    console.log("💡 Uncomment the function you want to use and customize it.");
    console.log("💡 Then run: node scripts/add-fields.js");

    // Uncomment one of these to run:
    // await exampleAddField();
    // await exampleAddFieldToAll();
    // await exampleAddArrayField();
    // await exampleAddNestedField();

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addFields();

// Made with Bob
