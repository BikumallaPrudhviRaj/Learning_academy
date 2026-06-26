#!/usr/bin/env node

/**
 * Add video links to course chapters in MongoDB
 * Usage: node scripts/add-videos.js
 */

const path = require("path");
const { loadEnv } = require("../src/env");
const { connect, getDb } = require("../src/db");

// Load environment variables
const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);

async function addVideos() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    const db = await getDb();

    // Get the current course
    const course = await db.collection("courses").findOne({ id: "oracle-fusion-hcm" });
    
    if (!course) {
      console.error("❌ Course not found");
      process.exit(1);
    }

    console.log("\n📚 Current course structure:");
    console.log(`Course: ${course.title}`);
    console.log(`Chapters: ${course.chapters?.length || 0}`);
    
    if (course.chapters) {
      course.chapters.forEach((chapter, idx) => {
        console.log(`\n  Chapter ${idx + 1}: ${chapter.title}`);
        console.log(`  Videos: ${chapter.videos?.length || 0}`);
        if (chapter.videos) {
          chapter.videos.forEach((video, vIdx) => {
            console.log(`    ${vIdx + 1}. ${video.title}`);
          });
        }
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("📝 INSTRUCTIONS TO ADD VIDEOS:");
    console.log("=".repeat(60));
    console.log("\nEdit this script and uncomment one of the examples below:\n");

    // ============================================================
    // EXAMPLE 1: Add a new video to an existing chapter
    // ============================================================
    const addVideoToChapter = async (chapterIndex, newVideo) => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" },
        {
          $push: {
            [`chapters.${chapterIndex}.videos`]: newVideo
          }
        }
      );
      console.log(`✅ Added video to chapter ${chapterIndex + 1}`);
      return result;
    };

    // ============================================================
    // EXAMPLE 2: Add multiple videos to a chapter at once
    // ============================================================
    const addMultipleVideos = async (chapterIndex, videos) => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" },
        {
          $push: {
            [`chapters.${chapterIndex}.videos`]: { $each: videos }
          }
        }
      );
      console.log(`✅ Added ${videos.length} videos to chapter ${chapterIndex + 1}`);
      return result;
    };

    // ============================================================
    // EXAMPLE 3: Add a completely new chapter with videos
    // ============================================================
    const addNewChapter = async (newChapter) => {
      const result = await db.collection("courses").updateOne(
        { id: "oracle-fusion-hcm" },
        {
          $push: {
            chapters: newChapter
          }
        }
      );
      console.log(`✅ Added new chapter: ${newChapter.title}`);
      return result;
    };

    // ============================================================
    // UNCOMMENT AND CUSTOMIZE ONE OF THESE EXAMPLES:
    // ============================================================

    // Example 1: Add ONE video to Chapter 1 (index 0)
    
    await addVideoToChapter(1, {
      id: "video-020",
      title: "17. FSM, Clones, Approvals",
      url: "https://drive.google.com/file/d/1LZfGcmYpGqc-qGRE2vO5lOyaYxirGGa9/view?usp=drive_link"
    });
    

    // Example 2: Add MULTIPLE videos to Chapter 2 (index 1)
    /*
    await addMultipleVideos(1, [
      {
        id: "video-014",
        title: "11. HSDL",
        url: "https://drive.google.com/file/d/1jZi4tJjl-Nwl89Ngb63FckenrAWXX3eh/view?usp=drive_link"
      },
      {
        id: "video-015",
        title: "12. Grades, Grade Rates, Grade Ladder",
        url: "https://drive.google.com/file/d/1d-5Z9PGxitthnMf-HQtYkLZzPhDBSO40/view?usp=drive_link"
      },
      {
        id: "video-016",
        title: "13. Jobs Part -1",
        url: "https://drive.google.com/file/d/167xHf-vVyD9KIlsiJFPcnrzbOTOhmSoi/view?usp=drive_link"
      },
      {
        id: "video-017",
        title: "14. Jobs Part -2",
        url: "https://drive.google.com/file/d/1--A3-zwdFI4BkdXzVFAArMz9yiZNiqHr/view?usp=drive_link"
      },
      {
        id: "video-018",
        title: "15. Positions",
        url: "https://drive.google.com/file/d/1_fJiMcQGRfPbcCECzr0D7ezi2yaPgBhj/view?usp=drive_link"
      },
      {
        id: "video-019",
        title: "16. Trees",
        url: "https://drive.google.com/file/d/1bCyUaBeTe0reltInaoN8ukICW9NMkuCs/view?usp=drive_link"
      }
    ]);

    // Example 3: Add a COMPLETELY NEW CHAPTER
    /*
    await addNewChapter({
      id: "chapter-4",
      title: "Chapter 4: Advanced Topics",
      videos: [
        {
          id: "video-011",
          title: "Advanced Feature 1",
          url: "https://drive.google.com/file/d/YOUR_FILE_ID/view"
        },
        {
          id: "video-012",
          title: "Advanced Feature 2",
          url: "https://drive.google.com/file/d/YOUR_FILE_ID/view"
        }
      ]
    });
    */

    console.log("\n💡 After uncommenting and customizing, run:");
    console.log("   node scripts/add-videos.js\n");

    // Verify the current state
    const updatedCourse = await db.collection("courses").findOne({ id: "oracle-fusion-hcm" });
    console.log("\n📊 Current video count by chapter:");
    updatedCourse.chapters?.forEach((chapter, idx) => {
      console.log(`   Chapter ${idx + 1}: ${chapter.videos?.length || 0} videos`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addVideos();

// Made with Bob
