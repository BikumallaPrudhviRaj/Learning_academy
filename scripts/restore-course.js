#!/usr/bin/env node

/**
 * Restores the oracle-fusion-hcm course to MongoDB
 * Chapter titles and videos are based on what was added via scripts
 */

const path = require("path");
const { loadEnv } = require("../src/env");
const { connect, getDb } = require("../src/db");

const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);

const course = {
  id: "oracle-fusion-hcm",
  title: "Oracle Fusion HCM Techno Functional Course",
  level: "Beginner to Advanced",
  duration: "8 weeks",
  price: 30000,
  accent: "#2563eb",
  summary: "Comprehensive Oracle Fusion HCM Techno-Functional training that equips learners with both functional HR process knowledge and technical skills to configure, customize, integrate, and support Oracle Fusion HCM applications.",
  why: "This course is for learners who want a practical path into modern web development. Every module is tied to a portfolio-ready project, so students finish with proof of skill instead of only notes.",
  eligible: [
    "College students preparing for internships and placements",
    "Working professionals looking for career growth or change into HCM roles",
    "Working professionals switching into HCM roles",
    "Anyone comfortable using a computer and learning by building"
  ],
  outcomes: [
    "Learn end-to-end HCM",
    "All the modules will be covered in the course",
    "Job Support will be provided to the students",
    "Help in resume review and mock interviews"
  ],
  qrImage: "/payment-qr/full-stack-web.svg",
  chapters: [
    {
      id: "chapter-1",
      title: "Chapter 1: Introduction, Project Phases, Documentation",
      videos: [
        { id: "video-001", title: "1. Introduction", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-002", title: "2. Project Phases", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-003", title: "3. Phases, Documentation, and Oracle Resources", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" }
      ]
    },
    {
      id: "chapter-2",
      title: "Chapter 2: Core HR",
      videos: [
        { id: "video-004", title: "1. Security Console, User Account", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-005", title: "2. Geographies, Establish Enterprise Structures", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-006", title: "3. Enterprise Setup - 1", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-007", title: "4. Enterprise Setup - 2", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-008", title: "5. Enterprise Setup - 3", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-009", title: "6. Divisions, Legal Entities", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-010", title: "7. Reference Data Sets, Business Units", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-011", title: "8. Departments, Actions, Action Reasons", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-012", title: "9. Common Lookups", url: "https://drive.google.com/file/d/YOUR_FILE_ID/view" },
        { id: "video-013", title: "10. Profile Values and Locations", url: "https://drive.google.com/file/d/19XF32HY5q4oBhRF26xlwi5_C-EjpYl83/view?usp=drive_link" }
      ]
    }
  ]
};

async function restore() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    const db = await getDb();

    // Check if course already exists
    const existing = await db.collection("courses").findOne({ id: course.id });
    if (existing) {
      console.log("⚠️  Course already exists. Replacing it...");
      await db.collection("courses").replaceOne({ id: course.id }, course);
      console.log("✅ Course replaced successfully.");
    } else {
      await db.collection("courses").insertOne(course);
      console.log("✅ Course inserted successfully.");
    }

    // Verify
    const saved = await db.collection("courses").findOne({ id: course.id });
    console.log(`\n📚 Course: ${saved.title}`);
    saved.chapters.forEach((ch, i) => {
      console.log(`  Chapter ${i + 1}: ${ch.title} — ${ch.videos.length} videos`);
    });

    console.log("\n⚠️  NOTE: Most video URLs are placeholders (YOUR_FILE_ID).");
    console.log("   Only video-013 (10. Profile Values and Locations) has a real URL.");
    console.log("   Use the Admin panel to update the real Google Drive URLs for each video.\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

restore();
