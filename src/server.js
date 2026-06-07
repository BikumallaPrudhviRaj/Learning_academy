const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { loadEnv } = require("./env");
const { sendPasswordEmail } = require("./resend");
const { getDb } = require("./db");

const rootDir = path.join(__dirname, "..");
loadEnv(rootDir);
const publicDir = path.join(rootDir, "public");
const sessions = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function buildVideoList(courseId) {
  const db = await getDb();
  const course = await db.collection("courses").findOne({ id: courseId });
  
  if (course && Array.isArray(course.videos) && course.videos.length > 0) {
    return course.videos.map((item, index) => ({
      id: item.id || `video-${String(index + 1).padStart(3, "0")}`,
      title: item.title || `Video ${index + 1}`,
      url: item.url
    }));
  }

  // Fallback: return empty array if no videos configured
  return [];
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";").map((item) => item.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

async function getCurrentUser(req) {
  const token = getCookie(req, "session");
  const userId = sessions.get(token);
  if (!userId) return null;
  
  const db = await getDb();
  return await db.collection("users").findOne({ id: userId });
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
async function isPaid(userId, courseId) {
  const db = await getDb();
  const enrollment = await db.collection("paidEnrollments").findOne({
    userId,
    courseId,
    paid: true
  });
  return !!enrollment;
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
  const db = await getDb();

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const mobile = String(body.mobile || "").trim();
    const password = String(body.password || "").trim();

    // Validation
    if (!name || name.length < 2) {
      sendJson(res, 400, { error: "Name must be at least 2 characters" });
      return;
    }

    if (!email || !email.includes("@")) {
      sendJson(res, 400, { error: "Valid email is required" });
      return;
    }

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      sendJson(res, 400, { error: "Valid 10-digit mobile number is required" });
      return;
    }

    if (!password || password.length < 6) {
      sendJson(res, 400, { error: "Password must be at least 6 characters" });
      return;
    }

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") }
    });

    if (existingUser) {
      sendJson(res, 409, { error: "An account with this email already exists" });
      return;
    }

    // Check if mobile number already exists
    const existingMobile = await db.collection("users").findOne({ mobile });
    if (existingMobile) {
      sendJson(res, 409, { error: "An account with this mobile number already exists" });
      return;
    }

    // Create new user
    const newUser = {
      id: `u-${crypto.randomBytes(6).toString("hex")}`,
      name,
      email,
      mobile,
      password,
      role: "student",
      createdAt: new Date().toISOString()
    };

    await db.collection("users").insertOne(newUser);

    // Auto-login after registration
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, newUser.id);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
    });
    res.end(JSON.stringify({ user: userForClient(newUser) }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const credentials = await readBody(req);
    const user = await db.collection("users").findOne({
      email: { $regex: new RegExp(`^${String(credentials.email || "").trim()}$`, "i") }
    });

    if (!user || user.password !== credentials.password) {
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
      const user = await db.collection("users").findOne({
        email: { $regex: new RegExp(`^${email}$`, "i") }
      });
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

  const user = await getCurrentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Please login first" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    sendJson(res, 200, { user: userForClient(user) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/courses") {
    const courses = await db.collection("courses").find({}).toArray();
    const coursesWithPaid = await Promise.all(
      courses.map(async (course) => {
        const paid = await isPaid(user.id, course.id);
        return courseForClient(course, paid);
      })
    );
    
    const testimonials = await db.collection("testimonials")
      .find({ published: true })
      .toArray();
    
    const contact = await db.collection("contact").findOne({});
    
    sendJson(res, 200, {
      courses: coursesWithPaid,
      testimonials: publishedTestimonials(testimonials),
      contact
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

    await db.collection("testimonials").insertOne(testimonial);
    sendJson(res, 201, {
      ok: true,
      message: "Thanks! Your testimonial was submitted and will appear after admin approval.",
      testimonial
    });
    return;
  }

  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/testimonials") {
    const testimonials = await db.collection("testimonials").find({}).toArray();
    sendJson(res, 200, {
      testimonials: testimonials.map((item) => ({
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

    if (typeof body.published !== "boolean") {
      sendJson(res, 400, { error: "published must be true or false" });
      return;
    }

    const result = await db.collection("testimonials").findOneAndUpdate(
      { id: testimonialId },
      { $set: { published: body.published } },
      { returnDocument: "after" }
    );

    if (!result || !result.value) {
      sendJson(res, 404, { error: "Testimonial not found" });
      return;
    }

    const testimonial = result.value;
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
    const course = await db.collection("courses").findOne({ id: courseId });
    
    if (!course) {
      sendJson(res, 404, { error: "Course not found" });
      return;
    }

    const paid = await isPaid(user.id, courseId);
    const videos = paid ? await buildVideoList(courseId) : [];
    sendJson(res, 200, {
      course: courseForClient(course, paid),
      videos: videos.map((video) => ({
        id: video.id,
        title: video.title,
        redirectUrl: `/watch/${courseId}/${video.id}`
      }))
    });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

async function handleWatch(req, res, pathname) {
  const match = pathname.match(/^\/watch\/([^/]+)\/([^/]+)$/);
  if (!match) return false;

  const user = await getCurrentUser(req);
  if (!user) {
    sendRedirect(res, "/#login");
    return true;
  }

  const [, courseId, videoId] = match;
  const paid = await isPaid(user.id, courseId);
  
  if (!paid) {
    sendRedirect(res, `/#course/${courseId}`);
    return true;
  }

  const videos = await buildVideoList(courseId);
  const video = videos.find((item) => item.id === videoId);
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

    if (req.method === "GET" && url.pathname === "/api/db-status") {
      sendJson(res, 200, {
        database: "MongoDB Atlas",
        connected: true,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }

    if (await handleWatch(req, res, url.pathname)) return;
    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

// Start server immediately, MongoDB will connect on first request
server.listen(port, host, () => {
  console.log(`Ed-tech portal running at http://${host}:${port}`);
  
  // Try to connect to MongoDB in background
  const { connect } = require("./db");
  connect()
    .then(() => {
      console.log("MongoDB connection established");
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      console.error("Server will retry connection on first database request");
    });
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
