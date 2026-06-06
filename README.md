# Learning Academy

An ed-tech course portal with login, course listings, QR payment instructions, database-backed paid access, and protected Google Drive lesson redirects.

## Project Structure

```text
.
├── data/                  # Demo database and course video links
├── deploy/                # Code Engine deployment notes
├── public/                # Browser assets and QR images
├── src/                   # Node.js backend server
├── Dockerfile             # Code Engine container build
├── package.json
└── README.md
```

## Local Run

```bash
npm run check
npm run dev
```

Open `http://localhost:3000`.

Demo login:

- `demo@example.com` / `demo123`
- `prudhvi@example.com` / `learn123` has paid access to `full-stack-web`

## GitHub Repository

This project is prepared for:

```text
https://github.com/BikumallaPrudhviRaj/Learning_academy.git
```

To push:

```bash
git init
git branch -M main
git remote add origin https://github.com/BikumallaPrudhviRaj/Learning_academy.git
git add .
git commit -m "Initial learning academy portal"
git push -u origin main
```

## IBM Cloud Code Engine

See [deploy/code-engine.md](deploy/code-engine.md).

Quick source deployment:

```bash
ibmcloud ce app create \
  --name learning-academy \
  --build-source https://github.com/BikumallaPrudhviRaj/Learning_academy.git \
  --strategy dockerfile \
  --port 8080
```

The app reads Code Engine's `PORT` environment variable and listens on `0.0.0.0`, which is required inside the container.

## Mark A User As Paid

Edit `data/db.json` and add or update a record in `paidEnrollments`. Only `userId`, `courseId`, and `paid` are required:

```json
{
  "userId": "u-demo",
  "courseId": "data-analytics",
  "paid": true
}
```

You can optionally add `transactionId` and `paidAt` for your own payment records. They are not used for access checks.

Refresh the course page after the update. Paid users will see the 100 protected lesson redirects.

## Add Real Video Links

Edit `data/video-links.json`:

```json
{
  "full-stack-web": [
    {
      "id": "lesson-001",
      "title": "Lesson 1",
      "url": "https://drive.google.com/file/d/REAL_FILE_ID/view"
    }
  ]
}
```

Each course can contain up to 100 links. If links are not provided, the app generates sample Google Drive-style URLs.

## Replace QR Codes

Put real QR images in `public/payment-qr`, then update each course `qrImage` value in `data/db.json` if the filename changes.

## Production Note

The JSON files are fine for a deployable prototype. For real production use, switch to a managed database, hash passwords, and move sensitive configuration into Code Engine secrets.
