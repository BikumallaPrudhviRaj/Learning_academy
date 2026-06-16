# Session Persistence Fix for Video Link Redirects

## Problem
When clicking on video links, users were being redirected to `/#login` instead of the Google Drive URLs. This happened because:

1. **Sessions were stored only in memory** - When Code Engine restarts or scales, all sessions are lost
2. **No session persistence** - Users had to re-login after every app restart
3. **Session not found** - The `/watch` endpoint couldn't find the session, so it redirected to login

## Solution
Implemented **persistent session storage in MongoDB** with the following changes:

### Changes Made to `src/server.js`

1. **Login endpoint** - Now stores sessions in both memory and MongoDB with 7-day expiration
2. **Registration endpoint** - Auto-login now also persists session to MongoDB
3. **getCurrentUser function** - Now checks MongoDB if session not found in memory cache
4. **Logout endpoint** - Deletes session from both memory and MongoDB
5. **Added logging** - Debug logs to track session flow

### How It Works

```
User Login
    ↓
Generate session token
    ↓
Store in memory (sessions Map) ← Fast access
    ↓
Store in MongoDB (sessions collection) ← Persistent storage
    ↓
Set cookie with 7-day expiration
```

When user clicks video link:
```
/watch/courseId/videoId
    ↓
Check session cookie
    ↓
Look in memory cache → Not found?
    ↓
Look in MongoDB → Found!
    ↓
Restore to memory cache
    ↓
Verify user is paid
    ↓
Redirect to Google Drive URL ✓
```

## Deployment Steps

### Option 1: Quick Deploy (Recommended)
```bash
# Build and push new image
docker build --platform linux/amd64 -t us.icr.io/your-namespace/edtech-app:latest .
docker push us.icr.io/your-namespace/edtech-app:latest

# Update Code Engine application
ibmcloud ce application update --name application-85 \
  --image us.icr.io/your-namespace/edtech-app:latest
```

### Option 2: Deploy from Source
```bash
# Update from source code
ibmcloud ce application update --name application-85 \
  --build-source . \
  --strategy dockerfile
```

### Option 3: Use Existing Deployment Script
```bash
# If you have a deployment script
./deploy.sh
```

## MongoDB Collection
A new `sessions` collection will be automatically created with documents like:
```json
{
  "token": "abc123...",
  "userId": "u-prudhvi",
  "expiresAt": "2026-06-23T12:00:00.000Z",
  "createdAt": "2026-06-16T12:00:00.000Z"
}
```

## Testing After Deployment

1. **Login to the application**
2. **Navigate to a paid course**
3. **Click on a video link**
4. **Expected**: Redirects to Google Drive URL
5. **Check logs** for debug messages:
   ```bash
   ibmcloud ce application logs --name application-85 --tail 100
   ```

## Session Cleanup (Optional)
To clean up expired sessions periodically, you can create a MongoDB TTL index:

```javascript
// Run this in MongoDB Atlas or mongosh
db.sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
```

This will automatically delete expired sessions from the database.

## Benefits

✅ **Sessions persist across restarts** - Users stay logged in
✅ **Works with multiple instances** - Sessions shared via MongoDB
✅ **7-day session lifetime** - Better user experience
✅ **Automatic fallback** - Memory cache for speed, MongoDB for persistence
✅ **Debug logging** - Easy to troubleshoot session issues

## Rollback Plan
If issues occur, you can rollback to the previous revision:
```bash
# List revisions
ibmcloud ce revision list --application application-85

# Rollback to previous revision
ibmcloud ce application update --name application-85 \
  --revision <previous-revision-name>