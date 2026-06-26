# Guide: Adding Videos to Course Chapters

## Current Course Structure

**Course:** Oracle Fusion HCM Techno Functional Course

- **Chapter 1:** Introduction, Project Phases, Documentation (3 videos)
- **Chapter 2:** Core HR (9 videos)

## Why MongoDB Atlas UI Doesn't Work Well

MongoDB Atlas UI has limitations when adding array elements:
- ❌ UI can be buggy with nested arrays
- ❌ No limit on fields, but UI is unreliable
- ❌ Changes may not save properly
- ✅ **Solution:** Use scripts for reliable updates

## How to Add Videos (3 Easy Methods)

### Method 1: Add ONE Video to an Existing Chapter

**Example:** Add a video to Chapter 1

1. Open [`scripts/add-videos.js`](scripts/add-videos.js:1)
2. Find this section (around line 115):
   ```javascript
   // Example 1: Add ONE video to Chapter 1 (index 0)
   /*
   await addVideoToChapter(0, {
     id: "video-007",
     title: "New Video Title Here",
     url: "https://drive.google.com/file/d/YOUR_FILE_ID/view"
   });
   */
   ```
3. **Uncomment** it (remove `/*` and `*/`)
4. **Customize** the values:
   ```javascript
   await addVideoToChapter(0, {
     id: "video-010",
     title: "Oracle Fusion HCM Overview",
     url: "https://drive.google.com/file/d/1ABC123XYZ/view"
   });
   ```
5. **Run:** `node scripts/add-videos.js`

**Chapter Index Reference:**
- Chapter 1 = index `0`
- Chapter 2 = index `1`
- Chapter 3 = index `2` (and so on)

### Method 2: Add MULTIPLE Videos at Once

**Example:** Add 3 videos to Chapter 2

1. Open [`scripts/add-videos.js`](scripts/add-videos.js:1)
2. Find this section (around line 125):
   ```javascript
   // Example 2: Add MULTIPLE videos to Chapter 2 (index 1)
   /*
   await addMultipleVideos(1, [
     {
       id: "video-008",
       title: "First New Video",
       url: "https://drive.google.com/file/d/YOUR_FILE_ID_1/view"
     },
     ...
   ]);
   */
   ```
3. **Uncomment** and **customize**:
   ```javascript
   await addMultipleVideos(1, [
     {
       id: "video-010",
       title: "Locations and Grades",
       url: "https://drive.google.com/file/d/1ABC123/view"
     },
     {
       id: "video-011",
       title: "Jobs and Positions",
       url: "https://drive.google.com/file/d/1DEF456/view"
     },
     {
       id: "video-012",
       title: "Person Management",
       url: "https://drive.google.com/file/d/1GHI789/view"
     }
   ]);
   ```
4. **Run:** `node scripts/add-videos.js`

### Method 3: Add a NEW Chapter with Videos

**Example:** Create Chapter 3

1. Open [`scripts/add-videos.js`](scripts/add-videos.js:1)
2. Find this section (around line 145):
   ```javascript
   // Example 3: Add a COMPLETELY NEW CHAPTER
   /*
   await addNewChapter({
     id: "chapter-4",
     title: "Chapter 4: Advanced Topics",
     videos: [...]
   });
   */
   ```
3. **Uncomment** and **customize**:
   ```javascript
   await addNewChapter({
     id: "chapter-3",
     title: "Chapter 3: Talent Management",
     videos: [
       {
         id: "video-013",
         title: "Performance Management",
         url: "https://drive.google.com/file/d/1JKL012/view"
       },
       {
         id: "video-014",
         title: "Goal Management",
         url: "https://drive.google.com/file/d/1MNO345/view"
       }
     ]
   });
   ```
4. **Run:** `node scripts/add-videos.js`

## Important Notes

### Video ID Naming Convention
- Use sequential IDs: `video-001`, `video-002`, etc.
- Current last ID in Chapter 2: `video-009`
- Next available: `video-010`, `video-011`, etc.

### Google Drive URL Format
```
https://drive.google.com/file/d/FILE_ID_HERE/view
```

**How to get FILE_ID:**
1. Open video in Google Drive
2. Click "Share" → "Copy link"
3. URL looks like: `https://drive.google.com/file/d/1ABC123XYZ456/view?usp=sharing`
4. Extract the FILE_ID: `1ABC123XYZ456`

### Chapter ID Naming Convention
- Use sequential IDs: `chapter-1`, `chapter-2`, `chapter-3`, etc.
- Current chapters: `chapter-1`, `chapter-2`
- Next available: `chapter-3`

## Quick Reference Commands

```bash
# View current structure
node scripts/add-videos.js

# After editing the script, run it again to apply changes
node scripts/add-videos.js

# Verify changes in MongoDB Atlas
# Or check the application at your Code Engine URL
```

## Troubleshooting

**Q: I get "video-XXX already exists" error**
- Use a unique video ID that doesn't exist yet
- Check current IDs by running: `node scripts/add-videos.js`

**Q: Changes don't appear in the app**
- Refresh the browser (Ctrl+F5 or Cmd+Shift+R)
- Check MongoDB Atlas to verify the data was updated
- Restart the application if running locally

**Q: I want to remove a video**
- Create a new script or manually delete in MongoDB Atlas
- Or let me know and I'll create a removal script

## Example: Complete Workflow

Let's say you want to add 5 new videos to Chapter 2:

1. **Open** `scripts/add-videos.js`
2. **Find** Example 2 (line ~125)
3. **Uncomment** the code
4. **Replace** with your videos:
   ```javascript
   await addMultipleVideos(1, [
     {
       id: "video-010",
       title: "Locations Setup",
       url: "https://drive.google.com/file/d/1ABC/view"
     },
     {
       id: "video-011",
       title: "Grades Configuration",
       url: "https://drive.google.com/file/d/1DEF/view"
     },
     {
       id: "video-012",
       title: "Jobs and Positions",
       url: "https://drive.google.com/file/d/1GHI/view"
     },
     {
       id: "video-013",
       title: "Person Management",
       url: "https://drive.google.com/file/d/1JKL/view"
     },
     {
       id: "video-014",
       title: "Assignment Management",
       url: "https://drive.google.com/file/d/1MNO/view"
     }
   ]);
   ```
5. **Save** the file
6. **Run:** `node scripts/add-videos.js`
7. **Verify:** Check the output shows "✅ Added 5 videos to chapter 2"
8. **Test:** Login to your app and check if videos appear

## Need Help?

If you need assistance:
1. Tell me which chapter you want to add videos to
2. Provide the video titles and Google Drive links
3. I'll prepare the exact code for you to run