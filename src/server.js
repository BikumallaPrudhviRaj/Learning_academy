const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const dbPath = path.join(rootDir, "data", "db.json");
const videosPath = path.join(rootDir, "data", "video-links.json");
const sessions = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readDb() {
  return readJson(dbPath);
}

function readVideoOverrides() {
  try {
    return readJson(videosPath);
  } catch {
    return {};
  }
}

function buildVideoList(courseId) {
  const overrides = readVideoOverrides()[courseId];
  if (Array.isArray(overrides) && overrides.length) {
    return overrides.slice(0, 100).map((item, index) => ({
      id: item.id || `lesson-${String(index + 1).padStart(3, "0")}`,
      title: item.title || `Lesson ${index + 1}`,
      url: item.url
    }));
  }

  return Array.from({ length: 100 }, (_, index) => {
    const lesson = String(index + 1).padStart(3, "0");
    return {
      id: `lesson-${lesson}`,
      title: `Lesson ${index + 1}`,
      url: `https://drive.google.com/file/d/${courseId}-${lesson}/view`
    };
  });
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";").map((item) => item.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function getCurrentUser(req) {
  const token = getCookie(req, "session");
  const userId = sessions.get(token);
  if (!userId) return null;
  return readDb().users.find((user) => user.id === userId) || null;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendRedirect(res, target) {
  res.writeHead(302, { Location: target });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isPaid(db, userId, courseId) {
  return db.paidEnrollments.some(
    (item) => item.userId === userId && item.courseId === courseId && item.paid === true
  );
}

function formatPrice(amount) {
  return `Rs. ${Number(amount).toLocaleString("en-IN")}`;
}

function courseForClient(course, paid) {
  const finalPrice = course.price;
  const originalPrice = course.originalPrice ?? course.price;

  return {
    ...course,
    paid,
    originalPriceLabel: formatPrice(originalPrice),
    priceLabel: `${formatPrice(finalPrice)} Incl GST`,
    hasDiscount: originalPrice > finalPrice
  };
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg"
    };

    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res, pathname) {
  const db = readDb();

  if (req.method === "POST" && pathname === "/api/login") {
    const credentials = await readBody(req);
    const user = db.users.find(
      (item) =>
        item.email.toLowerCase() === String(credentials.email || "").toLowerCase() &&
        item.password === credentials.password
    );

    if (!user) {
      sendJson(res, 401, { error: "Invalid email or password" });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, user.id);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
    });
    res.end(JSON.stringify({ user: { id: user.id, name: user.name, email: user.email } }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    sessions.delete(getCookie(req, "session"));
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; Max-Age=0; SameSite=Lax"
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Please login first" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    sendJson(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  if (req.method === "GET" && pathname === "/api/courses") {
    sendJson(res, 200, {
      courses: db.courses.map((course) => courseForClient(course, isPaid(db, user.id, course.id))),
      testimonials: db.testimonials,
      contact: db.contact
    });
    return;
  }

  const courseMatch = pathname.match(/^\/api\/courses\/([^/]+)$/);
  if (req.method === "GET" && courseMatch) {
    const courseId = courseMatch[1];
    const course = db.courses.find((item) => item.id === courseId);
    if (!course) {
      sendJson(res, 404, { error: "Course not found" });
      return;
    }

    const paid = isPaid(db, user.id, courseId);
    sendJson(res, 200, {
      course: courseForClient(course, paid),
      videos: paid
        ? buildVideoList(courseId).map((video) => ({
            id: video.id,
            title: video.title,
            redirectUrl: `/watch/${courseId}/${video.id}`
          }))
        : []
    });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function handleWatch(req, res, pathname) {
  const match = pathname.match(/^\/watch\/([^/]+)\/([^/]+)$/);
  if (!match) return false;

  const user = getCurrentUser(req);
  if (!user) {
    sendRedirect(res, "/#login");
    return true;
  }

  const [, courseId, videoId] = match;
  const db = readDb();
  if (!isPaid(db, user.id, courseId)) {
    sendRedirect(res, `/#course/${courseId}`);
    return true;
  }

  const video = buildVideoList(courseId).find((item) => item.id === videoId);
  sendRedirect(res, video ? video.url : `/#course/${courseId}`);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }

    if (handleWatch(req, res, url.pathname)) return;
    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () => {
  console.log(`Ed-tech portal running at http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
