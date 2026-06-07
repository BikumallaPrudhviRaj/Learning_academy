# Troubleshooting Code Engine Deployment

## Current Issue: Build/Revision Failed

If Code Engine shows "revision failed" or build errors, follow these steps:

### 1. Check Build Logs

**In Code Engine Console:**
1. Go to your application
2. Click "Logging" or "Logs" tab
3. Look for build logs (not application logs)
4. Find the specific error message

**Common build errors:**
- `npm ci` fails → package.json or package-lock.json issue
- Dockerfile syntax error → Check Dockerfile format
- Out of memory → Increase build resources
- Timeout → Build taking too long

### 2. Verify Dockerfile

Current Dockerfile should look like this:
```dockerfile
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY public ./public
COPY data ./data

EXPOSE 8080

CMD ["node", "src/server.js"]
```

### 3. Check package.json

Ensure it has:
```json
{
  "dependencies": {
    "mongodb": "^6.21.0"
  },
  "scripts": {
    "start": "node src/server.js"
  }
}
```

### 4. Common Fixes

**If build fails with npm errors:**
```bash
# Locally, regenerate package-lock.json
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json"
git push origin main
```

**If Code Engine can't find files:**
- Verify all files are committed to GitHub
- Check .gitignore isn't excluding necessary files
- Ensure Dockerfile COPY paths are correct

**If build times out:**
- In Code Engine, increase build timeout
- Or simplify Dockerfile (remove unnecessary steps)

### 5. Alternative: Deploy Without MongoDB First

If MongoDB is causing issues, temporarily deploy without it:

1. Comment out MongoDB connection in `src/server.js`:
```javascript
// Comment out these lines temporarily:
// const { connect } = require("./db");
// connect()...
```

2. Deploy to verify build works
3. Check application logs
4. Once working, uncomment and redeploy

### 6. Check Environment Variables

Even though MONGODB_URI is set, verify:
- Variable name is exactly `MONGODB_URI` (case-sensitive)
- Value doesn't have extra spaces or quotes
- Value is a valid MongoDB connection string

### 7. Try Fresh Deployment

Sometimes Code Engine cache causes issues:

1. **Delete the application** completely
2. **Create new application** from scratch:
   - Name: learning-academy (or new name)
   - Source: GitHub repository
   - Branch: main
   - Dockerfile: Dockerfile
   - Set environment variables BEFORE first deploy
3. Deploy

### 8. Minimal Test Deployment

Create a minimal test to isolate the issue:

**Create test-server.js:**
```javascript
const http = require('http');
const port = process.env.PORT || 8080;

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Server is running!\n');
}).listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
});
```

**Update Dockerfile CMD temporarily:**
```dockerfile
CMD ["node", "test-server.js"]
```

If this works, the issue is in the application code, not the build process.

### 9. Check Code Engine Quotas

Verify your IBM Cloud account:
- Has available Code Engine quota
- Build resources aren't exhausted
- No billing issues

### 10. Get Specific Error

**Please share the exact error message from Code Engine logs:**
- Build logs (during image creation)
- Application logs (after deployment)
- Any error codes or stack traces

This will help identify the specific issue.

## Quick Diagnostic Checklist

- [ ] All code committed and pushed to GitHub?
- [ ] Dockerfile exists and is correct?
- [ ] package.json has mongodb dependency?
- [ ] Environment variables set in Code Engine?
- [ ] Build logs show specific error?
- [ ] Application logs show startup error?
- [ ] MongoDB Atlas accessible (Network Access = 0.0.0.0/0)?
- [ ] MongoDB connection string valid?

## Contact Information

If issue persists, provide:
1. Exact error message from Code Engine logs
2. Screenshot of build failure
3. Screenshot of environment variables (hide sensitive values)
4. MongoDB Atlas network access settings