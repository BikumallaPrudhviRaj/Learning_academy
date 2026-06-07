# MongoDB Atlas Setup Guide

This guide will help you set up a free MongoDB Atlas database for your Learning Academy application.

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account (no credit card required)
3. Verify your email address

## Step 2: Create a Free Cluster

1. After logging in, click **"Build a Database"**
2. Choose **"M0 FREE"** tier (512MB storage, perfect for this application)
3. Select a cloud provider and region closest to your users:
   - **AWS** / **Google Cloud** / **Azure**
   - Choose a region (e.g., `us-east-1` for US East Coast)
4. Name your cluster (e.g., `learning-academy`)
5. Click **"Create"** (takes 3-5 minutes to provision)

## Step 3: Create Database User

1. Click **"Database Access"** in the left sidebar
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Set username: `academy_user` (or your choice)
5. Click **"Autogenerate Secure Password"** and **SAVE IT**
6. Set **"Database User Privileges"** to **"Read and write to any database"**
7. Click **"Add User"**

## Step 4: Configure Network Access

1. Click **"Network Access"** in the left sidebar
2. Click **"Add IP Address"**
3. For development: Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, restrict to specific IPs
4. Click **"Confirm"**

## Step 5: Get Connection String

1. Click **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **"Node.js"** and version **"6.3 or later"**
5. Copy the connection string (looks like):
   ```
   mongodb+srv://academy_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with the password you saved earlier

## Step 6: Configure Your Application

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://academy_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Seed the database with initial data:
   ```bash
   npm run seed
   ```
   
   You should see:
   ```
   ✓ Inserted 3 users
   ✓ Inserted 1 courses
   ✓ Inserted 1 paid enrollments
   ✓ Inserted 3 testimonials
   ✓ Inserted contact information
   ✅ Database seeding completed successfully!
   ```

5. Start the server:
   ```bash
   npm start
   ```

### IBM Code Engine Deployment

1. In IBM Cloud Console, go to your Code Engine application
2. Click **"Configuration"** → **"Environment variables"**
3. Add a new environment variable:
   - **Name**: `MONGODB_URI`
   - **Value**: Your MongoDB connection string
   - Click **"Add"**
4. Click **"Deploy"** to redeploy with the new environment variable

## Step 7: Verify Database Connection

1. After starting your application, check the logs:
   ```
   Connected to MongoDB successfully
   Ed-tech portal running at http://0.0.0.0:3000
   ```

2. Try logging in with:
   - Email: `upnriseacademy@gmail.com`
   - Password: `Prudhvi@9`

## Managing Your Data

### View Data in MongoDB Atlas

1. Go to MongoDB Atlas dashboard
2. Click **"Browse Collections"** on your cluster
3. You'll see collections: `users`, `courses`, `paidEnrollments`, `testimonials`, `contact`

### Add New Users

You can add users directly in MongoDB Atlas:

1. Click **"Browse Collections"**
2. Select `learning_academy` database → `users` collection
3. Click **"Insert Document"**
4. Add user data:
   ```json
   {
     "id": "u-newuser",
     "name": "New User",
     "email": "newuser@example.com",
     "password": "password123",
     "role": "student"
   }
   ```
5. Click **"Insert"**

**No redeployment needed!** Changes are live immediately.

### Add New Courses

1. Go to `courses` collection
2. Click **"Insert Document"**
3. Add course data following the existing structure
4. Changes are live immediately

## Security Best Practices

### For Production:

1. **Restrict IP Access**:
   - In Network Access, remove "0.0.0.0/0"
   - Add only your Code Engine IP addresses

2. **Use Strong Passwords**:
   - Change default user passwords
   - Use MongoDB's password generator

3. **Enable Monitoring**:
   - Set up alerts in MongoDB Atlas
   - Monitor database performance

4. **Regular Backups**:
   - MongoDB Atlas provides automatic backups
   - Configure backup schedule in Atlas

## Troubleshooting

### Connection Timeout
- Check Network Access allows your IP
- Verify connection string is correct
- Ensure password doesn't contain special characters (URL encode if needed)

### Authentication Failed
- Double-check username and password
- Ensure user has correct permissions

### Database Not Found
- Run `npm run seed` to create collections
- Check database name in connection string

## Cost Information

- **Free Tier (M0)**: 512MB storage, shared RAM, perfect for development and small apps
- **Upgrade Options**: Available when you need more storage or performance
- **No Credit Card Required**: Free tier is truly free forever

## Support

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB University](https://university.mongodb.com/) - Free courses
- [Community Forums](https://www.mongodb.com/community/forums/)