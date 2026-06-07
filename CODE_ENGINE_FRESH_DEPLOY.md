# Code Engine Fresh Deployment Guide

## Problem
Code Engine is serving cached old code despite multiple deployments and version updates. The old code causes errors because it references removed admin testimonial features.

## Solution: Create New Code Engine Application

### Step 1: Delete Old Application
```bash
ibmcloud ce application delete --name learning-academy
```

### Step 2: Create New Application
```bash
ibmcloud ce application create \
  --name learning-academy-v2 \
  --build-source https://github.com/BikumallaPrudhviRaj/Learning_academy.git \
  --build-context-dir . \
  --strategy dockerfile \
  --port 3000 \
  --min-scale 0 \
  --max-scale 1 \
  --cpu 0.25 \
  --memory 0.5G \
  --env MONGODB_URI=<your-mongodb-connection-string>
```

**Important:** Replace `<your-mongodb-connection-string>` with your actual MongoDB Atlas connection string.

### Step 3: Verify Deployment
1. Wait for deployment to complete (2-3 minutes)
2. Get the application URL:
   ```bash
   ibmcloud ce application get --name learning-academy-v2
   ```
3. Open the URL in browser
4. Check console - should show: `App.js loaded successfully - v3-testimonial-fix`

### Step 4: Test Functionality
- ✅ Login works without errors
- ✅ No TypeError about classList
- ✅ Paid users see "View course" button
- ✅ Paid users don't see pricing
- ✅ Testimonial submission works

## Alternative: Force Rebuild (Less Reliable)

If you want to try forcing a rebuild first:

```bash
# Update the application to force rebuild
ibmcloud ce application update \
  --name learning-academy \
  --build-source https://github.com/BikumallaPrudhviRaj/Learning_academy.git \
  --build-clear-cache
```

However, creating a new application is more reliable and ensures a clean slate.

## Environment Variables Needed

Make sure to set these environment variables in Code Engine:

```bash
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
PORT=3000
NODE_ENV=production
```

## Troubleshooting

### If still seeing old code:
1. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear browser cache completely
3. Try incognito/private window
4. Check console for version marker

### If deployment fails:
1. Check build logs: `ibmcloud ce buildrun logs --name <buildrun-name>`
2. Verify GitHub repository is accessible
3. Ensure Dockerfile is in repository root
4. Check MongoDB connection string is valid

## Success Indicators

✅ Console shows: `App.js loaded successfully - v3-testimonial-fix`
✅ No TypeError errors
✅ Login works smoothly
✅ All features functional