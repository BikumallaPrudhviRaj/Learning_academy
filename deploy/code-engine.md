# IBM Cloud Code Engine Deployment

This project is deployable as a containerized Code Engine application.

## Local check

```bash
npm run check
HOST=127.0.0.1 PORT=3000 npm start
```

Open `http://localhost:3000`.

## Deploy from local source

From the repository root:

```bash
ibmcloud ce project select --name YOUR_CODE_ENGINE_PROJECT
ibmcloud ce app create \
  --name learning-academy \
  --build-source . \
  --strategy dockerfile \
  --port 8080
```

For updates:

```bash
ibmcloud ce app update \
  --name learning-academy \
  --build-source . \
  --strategy dockerfile \
  --port 8080
```

## Deploy from GitHub

After pushing this repo to GitHub:

```bash
ibmcloud ce app create \
  --name learning-academy \
  --build-source https://github.com/BikumallaPrudhviRaj/Learning_academy.git \
  --strategy dockerfile \
  --port 8080
```

Code Engine injects the runtime port through `PORT`. The app listens on `0.0.0.0` by default, which is required inside the container.

## Payment and video data

- Update paid users in `data/db.json`.
- Add real Google Drive links in `data/video-links.json`.
- Put real QR images in `public/payment-qr` and update each course `qrImage` value in `data/db.json`.

For production, replace the seeded JSON data with a managed database and hashed passwords. The current JSON database is suitable for a demo, prototype, or manually maintained small deployment.
