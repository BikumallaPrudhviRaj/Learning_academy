#!/usr/bin/env node

const path = require("path");
const { loadEnv } = require("../src/env");
const { connect, getDb } = require("../src/db");

const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);

// ✏️ ADD NEW USER IDs HERE before running the script
const newUserIds = [
  u-03259f4d6a46
  // "u-xxxxxxxxxxxxxx",
  // "u-yyyyyyyyyyyyyy",
];

const COURSE_ID = "oracle-fusion-hcm";

async function addEnrollments() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    const db = await getDb();

    for (const userId of newUserIds) {
      const existing = await db.collection("paidEnrollments").findOne({ userId, courseId: COURSE_ID });
      if (existing) {
        console.log(`⚠️  Already enrolled: ${userId}`);
        continue;
      }

      // Look up user details from users collection
      const user = await db.collection("users").findOne({ id: userId });
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        continue;
      }

      await db.collection("paidEnrollments").insertOne({
        userId,
        courseId: COURSE_ID,
        paid: true,
        name: user.name,
        email: user.email,
        mobile: user.mobile || null
      });
      console.log(`✅ Enrolled: ${user.name} (${user.email})`);
    }

    const total = await db.collection("paidEnrollments").countDocuments({ courseId: COURSE_ID });
    console.log(`\n📊 Total enrollments for ${COURSE_ID}: ${total}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addEnrollments();
