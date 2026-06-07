# Code Engine Deployment Guide

## Prerequisites
1. MongoDB Atlas cluster created and running
2. MongoDB connection string ready
3. GitHub repository: https://github.com/BikumallaPrudhviRaj/Learning_academy.git

## Step-by-Step Deployment

### 1. Set Environment Variables in Code Engine

**CRITICAL**: You must set these environment variables BEFORE deploying, or the app will crash:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
SESSION_SECRET=your-random-secret-here-min-32-chars
PORT=8080
NODE_ENV=production
```

**How to set environment variables in Code Engine:**
1. Go to IBM Cloud Console → Code Engine
2. Select your application
3. Click "Environment variables" tab
4. Click "Add" for each variable:
   - Name: `MONGODB_URI`
   - Value: Your MongoDB Atlas connection string
   - Click "Add"
5. Repeat for `SESSION_SECRET` (generate a random 32+ character string)
6. `PORT` and `NODE_ENV` are optional (have defaults)

### 2. Deploy from GitHub

**Option A: Create New Application**
1. Go to Code Engine → Applications → Create
2. Select "Source code"
3. Repository: `https://github.com/BikumallaPrudhviRaj/Learning_academy.git`
4. Branch: `main`
5. Dockerfile path: `Dockerfile`
6. Set environment variables (see step 1)
7. Click "Create"

**Option B: Update Existing Application**
1. Go to your existing Code Engine application
2. Click "Configuration" → "Code"
3. Ensure it's pointing to the correct GitHub repo and branch
4. Click "Deploy" to trigger a new build
5. Wait for build to complete (check logs)

### 3. Verify Deployment

**Check Build Logs:**
- Should see: `npm ci --only=production` running successfully
- Should see: MongoDB driver being installed

**Check Application Logs:**
- Should see: "Connected to MongoDB successfully"
- Should NOT see: "MONGODB_URI environment variable is not set"
- Should see: "Server running on port 8080"

**Test the Application:**
1. Open the Code Engine application URL
2. You should see the login page
3. Below the password field, you should see: "Don't have an account? **Create account**"
4. Click "Create account" to test the signup form

### 4. Troubleshooting

**High Restart Rate / Crashing:**
- **Cause**: Missing `MONGODB_URI` environment variable
- **Fix**: Set the environment variable in Code Engine (see step 1)

**"Create account" button not showing:**
- **Cause**: Old code deployed or browser cache
- **Fix**: 
  1. Verify latest commit is deployed (check build logs)
  2. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
  3. Try incognito/private browsing

**MongoDB Connection Errors:**
- **Cause**: Invalid connection string or network access not configured
- **Fix**:
  1. Verify MongoDB Atlas connection string is correct
  2. In MongoDB Atlas, go to Network Access
  3. Add IP address: `0.0.0.0/0` (allow from anywhere)
  4. Ensure database user has read/write permissions

**Build Fails:**
- Check build logs for specific error
- Ensure Dockerfile is correct
- Ensure package.json has all dependencies

## Current Application Features

### User Registration
- Full name (min 2 characters)
- Email (validated)
- Mobile number (10 digits)
- Password (min 6 characters)
- Duplicate email/mobile detection
- Auto-login after registration

### User Roles
- **Student**: Regular users (default for new registrations)
- **Admin**: Can approve testimonials

### Database Collections
- `users` - User accounts
- `courses` - Course catalog
- `paidEnrollments` - Payment records
- `testimonials` - User testimonials
- `contact` - Contact information

## Support

If deployment continues to fail:
1. Check Code Engine application logs
2. Check Code Engine build logs
3. Verify all environment variables are set correctly
4. Ensure MongoDB Atlas is accessible
5. Try deleting and recreating the Code Engine application