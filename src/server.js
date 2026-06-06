const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { loadEnv } = require("./env");
const { sendPasswordEmail } = require("./resend");

const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);
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

function writeDb(db) {
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function isAdmin(user) {
  return user?.role === "admin";
}

function userForClient(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: isAdmin(user)
  };
}

function publishedTestimonials(testimonials) {
  return testimonials
    .filter((item) => item.published === true)
    .map((item) => ({
      name: item.name,
      role: item.role,
      quote: item.quote
    }));
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

// Only userId, courseId, and paid are required. transactionId and paidAt are optional metadata.
function isPaid(db, userId, courseId) {
  return (db.paidEnrollments || []).some(
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
    res.end(JSON.stringify({ user: userForClient(user) }));
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

  if (req.method === "POST" && pathname === "/api/forgot-password") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      sendJson(res, 400, { error: "Email is required." });
      return;
    }

    const successMessage =
      "If an account exists with that email, we sent your login password.";

    try {
      const user = db.users.find((item) => item.email.toLowerCase() === email);
      if (user) {
        await sendPasswordEmail({
          to: user.email,
          name: user.name,
          password: user.password
        });
      }
      sendJson(res, 200, { ok: true, message: successMessage });
    } catch (error) {
      if (error.code === "RESEND_NOT_CONFIGURED") {
        sendJson(res, 503, { error: error.message });
        return;
      }

      console.error("Forgot password email failed:", error.message);
      const isDev = process.env.NODE_ENV !== "production";
      sendJson(res, 500, {
        error: isDev
          ? error.message
          : "Could not send email right now. Please try again later."
      });
    }
    return;
  }

  const user = getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Please login first" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    sendJson(res, 200, { user: userForClient(user) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/courses") {
    sendJson(res, 200, {
      courses: db.courses.map((course) => courseForClient(course, isPaid(db, user.id, course.id))),
      testimonials: publishedTestimonials(db.testimonials || []),
      contact: db.contact
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/testimonials") {
    const body = await readBody(req);
    const role = String(body.role || "").trim();
    const quote = String(body.quote || "").trim();

    if (role.length < 2 || role.length > 100) {
      sendJson(res, 400, { error: "Role must be between 2 and 100 characters." });
      return;
    }

    if (quote.length < 10 || quote.length > 500) {
      sendJson(res, 400, { error: "Testimonial must be between 10 and 500 characters." });
      return;
    }

    const testimonial = {
      id: `t-${crypto.randomBytes(6).toString("hex")}`,
      userId: user.id,
      name: user.name,
      role,
      quote,
      published: false,
      createdAt: new Date().toISOString()
    };

    db.testimonials = db.testimonials || [];
    db.testimonials.push(testimonial);
    writeDb(db);
    sendJson(res, 201, {
      ok: true,
      message: "Thanks! Your testimonial was submitted and will appear after admin approval.",
      testimonial
    });
    return;
  }

  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/testimonials") {
    sendJson(res, 200, {
      testimonials: (db.testimonials || []).map((item) => ({
        id: item.id,
        userId: item.userId,
        name: item.name,
        role: item.role,
        quote: item.quote,
        published: item.published === true,
        createdAt: item.createdAt
      }))
    });
    return;
  }

  const adminTestimonialMatch = pathname.match(/^\/api\/admin\/testimonials\/([^/]+)$/);
  if (isAdmin(user) && req.method === "PATCH" && adminTestimonialMatch) {
    const testimonialId = adminTestimonialMatch[1];
    const body = await readBody(req);
    const testimonial = (db.testimonials || []).find((item) => item.id === testimonialId);

    if (!testimonial) {
      sendJson(res, 404, { error: "Testimonial not found" });
      return;
    }

    if (typeof body.published !== "boolean") {
      sendJson(res, 400, { error: "published must be true or false" });
      return;
    }

    testimonial.published = body.published;
    writeDb(db);
    sendJson(res, 200, {
      ok: true,
      testimonial: {
        id: testimonial.id,
        userId: testimonial.userId,
        name: testimonial.name,
        role: testimonial.role,
        quote: testimonial.quote,
        published: testimonial.published,
        createdAt: testimonial.createdAt
      }
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
