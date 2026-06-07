# Testing Guide for Learning Academy

## Test the Paid User Features

### 1. Check if Database is Seeded

The seed data includes:
- **User:** prudhvibikumalla@gmail.com / Prudhvi@9 (admin, has paid access)
- **Course:** oracle-fusion-hcm (paid by prudhvi)

### 2. Login as Paid User

1. Go to your deployed application
2. Login with:
   - Email: `prudhvibikumalla@gmail.com`
   - Password: `Prudhvi@9`

### 3. Expected Behavior for Paid Course

For the "Oracle Fusion HCM" course, you should see:
- ✅ **"Paid access"** badge (green)
- ✅ **"View course"** button
- ❌ **NO pricing** (no Rs. amount shown)

### 4. Expected Behavior for Unpaid Courses

For any other courses (if you add more), you should see:
- ✅ Pricing displayed (Rs. 17,999 Incl GST)
- ✅ **"Choose course"** button
- ❌ NO "Paid access" badge

## Troubleshooting

### Issue: Not seeing paid user changes

**Possible causes:**

1. **Database not seeded**
   - Run: `npm run seed` locally
   - Or manually add a paid enrollment in MongoDB Atlas

2. **Wrong user logged in**
   - Make sure you're logged in as `prudhvibikumalla@gmail.com`
   - Check the user ID matches `u-prudhvi` in the database

3. **Code not deployed**
   - Check Code Engine deployment status
   - Verify latest commit (`3a99c1b`) is deployed
   - Hard refresh browser (Ctrl+Shift+R)

4. **MongoDB not connected**
   - Check Code Engine logs for MongoDB connection errors
   - Verify MONGODB_URI environment variable is set

### Issue: "Choose course" button not working

**Check:**
1. Open browser console (F12)
2. Click the button
3. Look for JavaScript errors
4. Verify the `openCourse()` function is defined

**Expected behavior:**
- Clicking button should open course detail view
- URL should change to `#course/oracle-fusion-hcm`
- Course details should load

## Manual Database Check

### Check Paid Enrollments in MongoDB Atlas

1. Go to MongoDB Atlas → Browse Collections
2. Select `learning_academy` database
3. Open `paidEnrollments` collection
4. Verify this document exists:
```json
{
  "userId": "u-prudhvi",
  "courseId": "oracle-fusion-hcm",
  "paid": true
}
```

### Check User ID

1. Open `users` collection
2. Find user with email `prudhvibikumalla@gmail.com`
3. Verify `id` field is `u-prudhvi`

## Adding More Paid Enrollments

To test with your own account:

1. **Find your user ID:**
   - Login to the application
   - Open browser console
   - Type: `localStorage` or check Network tab for `/api/courses` response

2. **Add paid enrollment in MongoDB Atlas:**
   - Go to `paidEnrollments` collection
   - Click "Insert Document"
   - Add:
```json
{
  "userId": "your-user-id-here",
  "courseId": "oracle-fusion-hcm",
  "paid": true
}
```

3. **Refresh the page** - you should now see paid access

## Current Deployment

- **GitHub:** https://github.com/BikumallaPrudhviRaj/Learning_academy.git
- **Latest commit:** `3a99c1b` - "Hide pricing for paid courses"
- **Changes:**
  - Pricing hidden for paid courses
  - "View course" button for paid courses
  - "Choose course" button for unpaid courses
  - Testimonial toggle fixed