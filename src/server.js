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
    mobile: user.mobile || null,
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

async function buildChapterList(courseId) {
  const db = await getDb();
  const course = await db.collection("courses").findOne({ id: courseId });
  
  // Support new chapter-based structure
  if (course && Array.isArray(course.chapters) && course.chapters.length > 0) {
    return course.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      videos: Array.isArray(chapter.videos)
        ? chapter.videos.map((video) => ({
            id: video.id,
            title: video.title,
            url: video.url
          }))
        : []
    }));
  }
  
  // Fallback: support old flat videos array structure
  if (course && Array.isArray(course.videos) && course.videos.length > 0) {
    return [{
      id: "default-chapter",
      title: "Course Videos",
      videos: course.videos.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url
      }))
    }];
  }

  // Fallback: return empty array if no chapters configured
  return [];
}

async function findVideoUrl(courseId, videoId) {
  const chapters = await buildChapterList(courseId);
  for (const chapter of chapters) {
    const video = chapter.videos.find(v => v.id === videoId);
    if (video) return video.url;
  }
  return null;
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";").map((item) => item.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

async function getCurrentUser(req) {
  const token = getCookie(req, "session");
  if (!token) {
    console.log("getCurrentUser: No session token in cookie");
    return null;
  }
  
  // Check memory cache first
  let userId = sessions.get(token);
  
  // If not in memory, check database
  if (!userId) {
    const db = await getDb();
    const session = await db.collection("sessions").findOne({
      token,
      expiresAt: { $gt: new Date() }
    });
    
    if (session) {
      // Restore to memory cache
      sessions.set(token, session.userId);
      userId = session.userId;
      console.log("getCurrentUser: Session restored from database for userId:", userId);
    } else {
      console.log("getCurrentUser: No valid session found in database");
      return null;
    }
  }
  
  const db = await getDb();
  const user = await db.collection("users").findOne({ id: userId });
  if (!user) {
    console.log("getCurrentUser: User not found for userId:", userId);
  }
  return user;
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
  const originalPrice = course.originalPrice;
  const totalVideos = (course.chapters || []).reduce((sum, ch) => sum + (ch.videos || []).length, 0);

  return {
    ...course,
    paid,
    totalVideos,
    originalPriceLabel: originalPrice ? formatPrice(originalPrice) : null,
    priceLabel: `${formatPrice(finalPrice)} Incl GST`,
    hasDiscount: originalPrice && originalPrice > finalPrice
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

    const allowedDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"];
    const emailDomain = email.split("@")[1];
    if (!allowedDomains.includes(emailDomain)) {
      sendJson(res, 400, { error: "Please register with a Gmail, Outlook, Hotmail, or Yahoo email address" });
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Store session in both memory and database
    sessions.set(token, newUser.id);
    await db.collection("sessions").insertOne({
      token,
      userId: newUser.id,
      expiresAt,
      createdAt: new Date()
    });
    
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Store session in both memory and database
    sessions.set(token, user.id);
    await db.collection("sessions").insertOne({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date()
    });
    
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    });
    res.end(JSON.stringify({ user: userForClient(user) }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getCookie(req, "session");
    sessions.delete(token);
    
    // Also delete from database
    await db.collection("sessions").deleteOne({ token });
    
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

  if (req.method === "POST" && pathname === "/api/chat") {
    const body = await readBody(req);
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      sendJson(res, 400, { error: "Message is required" });
      return;
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      sendJson(res, 503, { error: "Chatbot is not configured yet." });
      return;
    }

    // Determine who is asking — guest/free users get academy-only mode
    const chatUser = await getCurrentUser(req);
    let isPaidUser = false;
    if (chatUser) {
      const paidEnrolments = await db.collection("paidEnrollments").find({ userId: chatUser.id, paid: true }).toArray();
      isPaidUser = paidEnrolments.length > 0 || isAdmin(chatUser);
    }

    // Fetch live academy data (needed for both prompt variants)
    const courses = await db.collection("courses").find({}).toArray();
    const contact = await db.collection("contact").findOne({});

    // Compact course list — title, price, duration, chapter count only
    const courseLines = courses.map((c) =>
      `• ${c.title} | ${c.level} | ${c.duration} | Rs. ${c.price} Incl GST | ${(c.chapters || []).length} chapters`
    ).join("\n");

    const academy = contact?.academy || "Up 'N' Rise Learning Academy";
    const mobile  = contact?.mobile  || "+91 7893146211";
    const email   = contact?.email   || "upnriseacademy@gmail.com";
    const address = contact?.address || "Hyderabad, Telangana";

    // ── GUEST / FREE USER prompt — academy info only (~200 tokens) ──
    const guestPrompt = `You are the AI assistant for ${academy}, an Oracle HCM training institute in ${address}.

ACADEMY INFO:
Mobile: ${mobile} | Email: ${email}

COURSES:
${courseLines}

ENROLLMENT: Contact us on WhatsApp (${mobile}) or email (${email}) to enroll in any course.

SUPPORT FOR ENROLLED STUDENTS: job support, resume review, mock interviews, 1:1 sessions.

RULES:
- Be friendly and concise (2–4 sentences).
- For pricing say "Rs. X (Incl GST)".
- Only answer questions about ${academy} and our courses. For anything else say: "I can only help with questions about Up 'N' Rise Academy and our courses. Please contact us on WhatsApp or email for other queries."
- Never reveal passwords, internal data, or session information.`;

    // ── PAID / ENROLLED USER prompt — full HCM expert + academy (~350 tokens) ──
    const paidPrompt = `You are the AI assistant for ${academy} — an Oracle Fusion HCM training institute in ${address}.
Mobile: ${mobile} | Email: ${email}

COURSES OFFERED:
${courseLines}

ENROLLMENT: Contact us on WhatsApp (${mobile}) or email (${email}) to enroll. Support included: job help, resume review, mock interviews, 1:1 sessions.

ORACLE FUSION HCM EXPERTISE — answer questions on:
Core HR: enterprise structures, person model, assignments, HDL, HCM Extracts, Fast Formulas, OTBI/BIP.
Payroll: elements, costing, payroll runs, calculation cards, balance dimensions, India localisation (TDS/PF/ESI/PT).
Absence: absence types, plans, accruals, payroll integration.
Talent: goals, performance, talent review, succession, learning.
Time & Labor: time cards, work schedules, overtime.
Recruiting (ORC): requisitions, offers, candidate experience.
Compensation: salary basis, grades, compensation plans, worksheets.
Security: roles, duty roles, HCM security profiles, data security.
Integrations: REST/SOAP APIs, OIC, Page Composer, DFF/EFF, lookups, value sets, ESS, HCM Experience Design Studio.

RULES:
- Be friendly, professional, concise. 2–5 sentences for simple questions; structured detail for complex ones.
- Use correct Oracle terminology. For pricing say "Rs. X (Incl GST)".
- Outside Oracle HCM and academy topics: "I'm specialised in Oracle Fusion HCM and Up 'N' Rise Academy topics. Contact our team for other queries."
- Never reveal passwords, internal data, or session information.`;

    const systemPrompt = isPaidUser ? paidPrompt : guestPrompt;

    const messages = [
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 512,
          temperature: 0.7
        })
      });

      if (!groqRes.ok) {
        const errBody = await groqRes.json().catch(() => ({}));
        const groqMsg = errBody?.error?.message || "unknown error";
        console.error(`Groq API error ${groqRes.status}:`, groqMsg);
        if (groqRes.status === 401) {
          sendJson(res, 502, { error: "Chatbot API key is invalid. Please check GROQ_API_KEY." });
        } else if (groqRes.status === 429) {
          sendJson(res, 502, { error: "Too many requests — please wait a moment and try again." });
        } else {
          sendJson(res, 502, { error: `AI service error: ${groqMsg}` });
        }
        return;
      }

      const data = await groqRes.json();
      const reply = data.choices?.[0]?.message?.content || "Sorry, I could not generate a response.";
      sendJson(res, 200, { reply });
    } catch (err) {
      console.error("Chat error:", err.message);
      sendJson(res, 500, { error: "Could not reach AI service. Please try again." });
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

  // Analytics: ingest a client-side event (fire-and-forget from frontend)
  if (req.method === "POST" && pathname === "/api/analytics/event") {
    const body = await readBody(req);
    const type = String(body.type || "").trim();
    if (!type) { sendJson(res, 400, { error: "type is required" }); return; }
    const allowed = new Set([
      "session_start", "session_end",
      "whatsapp_click", "instagram_click",
      "chatbot_open", "chat_query",
      "video_play", "course_view"
    ]);
    if (!allowed.has(type)) { sendJson(res, 400, { error: "unknown event type" }); return; }
    await db.collection("analytics").insertOne({
      type,
      userId:    user.id,
      userName:  user.name,
      userRole:  user.role || "student",
      payload:   body.payload || {},
      ts:        new Date()
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PATCH" && pathname === "/api/me") {
    const body = await readBody(req);
    const updates = {};
    const errors = [];

    // Name change
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) errors.push("Name must be at least 2 characters");
      else updates.name = name;
    }

    // Mobile change
    if (body.mobile !== undefined) {
      const mobile = String(body.mobile).trim();
      if (!/^[0-9]{10}$/.test(mobile)) {
        errors.push("Mobile must be a 10-digit number");
      } else {
        const taken = await db.collection("users").findOne({ mobile, id: { $ne: user.id } });
        if (taken) errors.push("This mobile number is already registered to another account");
        else updates.mobile = mobile;
      }
    }

    // Password change
    if (body.newPassword !== undefined) {
      const current = String(body.currentPassword || "");
      if (user.password !== current) {
        errors.push("Current password is incorrect");
      } else {
        const np = String(body.newPassword).trim();
        if (np.length < 6) errors.push("New password must be at least 6 characters");
        else updates.password = np;
      }
    }

    if (errors.length) {
      sendJson(res, 400, { error: errors.join(". ") });
      return;
    }

    if (Object.keys(updates).length === 0) {
      sendJson(res, 400, { error: "Nothing to update" });
      return;
    }

    await db.collection("users").updateOne({ id: user.id }, { $set: updates });
    const updated = await db.collection("users").findOne({ id: user.id });
    sendJson(res, 200, { ok: true, user: userForClient(updated) });
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

  // Admin: list all users
  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/users") {
    const courseId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("excludeEnrolled");
    const users = await db.collection("users").find({}).toArray();

    let enrolledUserIds = new Set();
    if (courseId) {
      const enrollments = await db.collection("paidEnrollments").find({ courseId, paid: true }).toArray();
      enrolledUserIds = new Set(enrollments.map((e) => e.userId));
    }

    sendJson(res, 200, {
      users: users
        .filter((u) => !enrolledUserIds.has(u.id))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          mobile: u.mobile || null,
          role: u.role || "student"
        }))
    });
    return;
  }

  // Admin: delete a user and all paid enrollments
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (isAdmin(user) && req.method === "DELETE" && adminUserMatch) {
    const [, userId] = adminUserMatch;
    const targetUser = await db.collection("users").findOne({ id: userId });
    if (!targetUser) {
      sendJson(res, 404, { error: "User not found" });
      return;
    }
    await db.collection("paidEnrollments").deleteMany({ userId });
    await db.collection("users").deleteOne({ id: userId });
    sendJson(res, 200, { ok: true, message: `${targetUser.name} deleted successfully` });
    return;
  }

  // Admin: get all courses with chapters and videos (for admin panel)
  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/courses") {
    const courses = await db.collection("courses").find({}).toArray();
    sendJson(res, 200, {
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        chapters: (c.chapters || []).map((ch) => ({
          id: ch.id,
          title: ch.title,
          videoCount: (ch.videos || []).length,
          videos: (ch.videos || []).map((v) => ({ id: v.id, title: v.title }))
        }))
      }))
    });
    return;
  }

  // Admin: analytics dashboard data
  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/analytics") {
    const now   = new Date();
    const day7  = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // ── User counts ──────────────────────────────────────
    const allUsers       = await db.collection("users").find({}).toArray();
    const paidEnrols     = await db.collection("paidEnrollments").find({ paid: true }).toArray();
    const paidUserIds    = new Set(paidEnrols.map((e) => e.userId));
    const totalUsers     = allUsers.length;
    const paidUsersCount = allUsers.filter((u) => paidUserIds.has(u.id)).length;
    const freeUsers      = totalUsers - paidUsersCount;

    // Admin users (excluded from student counts)
    const adminUsers = allUsers.filter((u) => u.role === "admin");

    // ── Recent signups list (last 30 days) ───────────────
    const recentUsers = allUsers
      .filter((u) => u.createdAt && new Date(u.createdAt) >= day30)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map((u) => ({
        name: u.name,
        email: u.email,
        mobile: u.mobile || "",
        role: u.role || "student",
        isPaid: paidUserIds.has(u.id),
        createdAt: u.createdAt
      }));

    // ── Daily signups (last 30 days) ─────────────────────
    const signupByDay = {};
    allUsers
      .filter((u) => u.createdAt && new Date(u.createdAt) >= day30)
      .forEach((u) => {
        const d = u.createdAt.slice(0, 10);
        signupByDay[d] = (signupByDay[d] || 0) + 1;
      });
    const dailySignups = Object.entries(signupByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // ── All paid students table ───────────────────────────
    const paidStudentList = paidEnrols.map((e) => {
      const u = allUsers.find((u) => u.id === e.userId);
      return {
        name: u?.name || e.name || e.userId,
        email: u?.email || e.email || "",
        mobile: u?.mobile || e.mobile || "",
        courseId: e.courseId,
        enrolledAt: e.enrolledAt || null
      };
    });

    // ── Enrollments per course ────────────────────────────
    const enrollByCourse = {};
    paidEnrols.forEach((e) => {
      enrollByCourse[e.courseId] = (enrollByCourse[e.courseId] || 0) + 1;
    });

    // ── Progress / videos watched ─────────────────────────
    const progressDocs  = await db.collection("progress").find({}).toArray();
    const totalWatched  = progressDocs.reduce((s, d) => s + (d.watched?.length || 0), 0);

    // Videos watched per paid student (top 15)
    const watchByUser = progressDocs
      .filter((d) => paidUserIds.has(d.userId))
      .map((d) => {
        const u = allUsers.find((u) => u.id === d.userId);
        return {
          name: u?.name || d.userId,
          watched: d.watched?.length || 0,
          courseId: d.courseId,
          lastAt: d.lastWatched?.at || null
        };
      })
      .sort((a, b) => b.watched - a.watched)
      .slice(0, 15);

    // ── Analytics events ─────────────────────────────────
    const events30 = await db.collection("analytics").find({ ts: { $gte: day30 } }).toArray();
    const events7  = await db.collection("analytics").find({ ts: { $gte: day7  } }).toArray();

    const countType = (evts, type) => evts.filter((e) => e.type === type).length;

    const waClicks       = countType(events30, "whatsapp_click");
    const instaClicks    = countType(events30, "instagram_click");
    const chatbotOpens   = countType(events30, "chatbot_open");
    const chatQueries    = countType(events30, "chat_query");
    const videoPlays     = countType(events30, "video_play");
    const courseViews    = countType(events30, "course_view");
    const sessionStarts  = countType(events30, "session_start");

    // Unique active users in last 30 days (users who had session_start)
    const activeUserIds30 = new Set(
      events30.filter((e) => e.type === "session_start").map((e) => e.userId)
    );
    const activeUsers30 = activeUserIds30.size;

    // Unique active users in last 7 days
    const activeUserIds7 = new Set(
      events7.filter((e) => e.type === "session_start").map((e) => e.userId)
    );
    const activeUsers7 = activeUserIds7.size;

    // Avg session duration (seconds) from session_end events
    const sessionEnds = events30.filter((e) => e.type === "session_end" && e.payload?.duration);
    const avgSession  = sessionEnds.length
      ? Math.round(sessionEnds.reduce((s, e) => s + (e.payload.duration || 0), 0) / sessionEnds.length)
      : null;
    const maxSession  = sessionEnds.length
      ? Math.max(...sessionEnds.map((e) => e.payload.duration || 0))
      : null;

    // Total time spent across all sessions (minutes)
    const totalTimeMinutes = sessionEnds.length
      ? Math.round(sessionEnds.reduce((s, e) => s + (e.payload.duration || 0), 0) / 60)
      : 0;

    // Per-video play counts (last 30 days, top 10)
    const videoPlayCounts = {};
    events30
      .filter((e) => e.type === "video_play" && e.payload?.videoId)
      .forEach((e) => {
        const key = `${e.payload.courseId || ""}|${e.payload.videoId}`;
        if (!videoPlayCounts[key]) {
          videoPlayCounts[key] = { videoId: e.payload.videoId, title: e.payload.videoTitle || e.payload.videoId, courseId: e.payload.courseId || "", count: 0 };
        }
        videoPlayCounts[key].count++;
      });
    const topVideos = Object.values(videoPlayCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Most viewed courses (last 30 days)
    const courseViewCounts = {};
    events30.filter((e) => e.type === "course_view" && e.payload?.courseId).forEach((e) => {
      const id = e.payload.courseId;
      if (!courseViewCounts[id]) courseViewCounts[id] = { courseId: id, title: e.payload.courseTitle || id, views: 0 };
      courseViewCounts[id].views++;
    });
    const topCourses = Object.values(courseViewCounts)
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    // Chat keyword frequency (last 30 days)
    const stopWords = new Set(["a","an","the","is","it","in","on","to","of","and","or","for","how","what","can","i","my","me","we","be","do","does","did","was","are","has","have","with","this","that","from","at","by","as","so","if","but","not","no","yes","hi","hello","please","tell","give","explain","about","get","use","which","why","who","where","when","its","just","want","need","like","know","also","any","all","some","more","than","then"]);
    const wordFreq = {};
    events30
      .filter((e) => e.type === "chat_query" && e.payload?.query)
      .forEach((e) => {
        String(e.payload.query).toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !stopWords.has(w))
          .forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      });
    const topKeywords = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 25)
      .map(([word, count]) => ({ word, count }));

    // Recent chat queries (last 20, most recent first)
    const recentChats = events30
      .filter((e) => e.type === "chat_query" && e.payload?.query)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 20)
      .map((e) => ({
        query: e.payload.query,
        userName: e.userName || "Unknown",
        ts: e.ts
      }));

    // Daily event breakdown (last 7 days) — fill all 7 days even with zero data
    const eventsByDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      eventsByDay[d] = { date: d, wa: 0, insta: 0, chat: 0, video: 0, login: 0, courseView: 0 };
    }
    events7.forEach((e) => {
      const d = e.ts.toISOString().slice(0, 10);
      if (!eventsByDay[d]) return;
      if (e.type === "whatsapp_click")  eventsByDay[d].wa++;
      if (e.type === "instagram_click") eventsByDay[d].insta++;
      if (e.type === "chat_query")      eventsByDay[d].chat++;
      if (e.type === "video_play")      eventsByDay[d].video++;
      if (e.type === "session_start")   eventsByDay[d].login++;
      if (e.type === "course_view")     eventsByDay[d].courseView++;
    });
    const dailyEvents = Object.values(eventsByDay).sort((a, b) => a.date.localeCompare(b.date));

    // ── Q&A stats ─────────────────────────────────────────
    const allQuestions = await db.collection("questions").find({}).toArray();
    const qaTotal      = allQuestions.length;
    const qaLast30     = allQuestions.filter((q) => q.createdAt && new Date(q.createdAt) >= day30).length;
    // Top 10 most-liked root questions (exclude replies)
    const topLiked = allQuestions
      .filter((q) => !q.parentId)
      .map((q) => ({
        text:      q.text.slice(0, 120) + (q.text.length > 120 ? "…" : ""),
        videoId:   q.videoId,
        userName:  q.userName,
        likeCount: (q.likedBy || []).length,
        createdAt: q.createdAt
      }))
      .filter((q) => q.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 10);
    // Most active videos by post count
    const postsByVideo = {};
    allQuestions.forEach((q) => {
      postsByVideo[q.videoId] = (postsByVideo[q.videoId] || 0) + 1;
    });
    const topQaVideos = Object.entries(postsByVideo)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([videoId, count]) => ({ videoId, count }));

    sendJson(res, 200, {
      users: { totalUsers, paidUsers: paidUsersCount, freeUsers, adminCount: adminUsers.length },
      activeUsers: { last7: activeUsers7, last30: activeUsers30 },
      recentSignups: recentUsers,
      paidStudentList,
      enrollByCourse,
      dailySignups,
      videos: { totalWatched, watchByUser, topVideos },
      events30: { waClicks, instaClicks, chatbotOpens, chatQueries, videoPlays, courseViews, sessionStarts },
      sessions: { avgSeconds: avgSession, maxSeconds: maxSession, totalMinutes: totalTimeMinutes },
      topKeywords,
      recentChats,
      dailyEvents,
      topCourses,
      qa: { total: qaTotal, last30: qaLast30, topLiked, topQaVideos }
    });
    return;
  }

  // Admin: reorder chapters
  const adminChapterReorderMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters\/reorder$/);
  if (isAdmin(user) && req.method === "PATCH" && adminChapterReorderMatch) {
    const courseId = adminChapterReorderMatch[1];
    const body = await readBody(req);
    const order = body.order; // expected: array of chapter IDs in desired order
    if (!Array.isArray(order) || order.length === 0) {
      sendJson(res, 400, { error: "order must be a non-empty array of chapter IDs" });
      return;
    }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) { sendJson(res, 404, { error: "Course not found" }); return; }
    const existing = course.chapters || [];
    // Build a map for O(1) lookup, then reorder
    const chapterMap = new Map(existing.map((ch) => [ch.id, ch]));
    const reordered = order.map((id) => chapterMap.get(id)).filter(Boolean);
    // Preserve any chapters not in the order array at the end (safety net)
    const included = new Set(order);
    for (const ch of existing) {
      if (!included.has(ch.id)) reordered.push(ch);
    }
    await db.collection("courses").updateOne(
      { id: courseId },
      { $set: { chapters: reordered } }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: rename a chapter (explicitly exclude /reorder to avoid ambiguity)
  const adminChapterEditMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters\/(?!reorder$)([^/]+)$/);
  if (isAdmin(user) && req.method === "PATCH" && adminChapterEditMatch) {
    const [, courseId, chapterId] = adminChapterEditMatch;
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    if (!title) { sendJson(res, 400, { error: "Title is required" }); return; }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) { sendJson(res, 404, { error: "Course not found" }); return; }
    const chapterIndex = (course.chapters || []).findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) { sendJson(res, 404, { error: "Chapter not found" }); return; }
    await db.collection("courses").updateOne(
      { id: courseId },
      { $set: { [`chapters.${chapterIndex}.title`]: title } }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: delete a chapter
  if (isAdmin(user) && req.method === "DELETE" && adminChapterEditMatch) {
    const [, courseId, chapterId] = adminChapterEditMatch;
    await db.collection("courses").updateOne(
      { id: courseId },
      { $pull: { chapters: { id: chapterId } } }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: reorder videos within a chapter
  const adminVideoReorderMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters\/([^/]+)\/videos\/reorder$/);
  if (isAdmin(user) && req.method === "PATCH" && adminVideoReorderMatch) {
    const [, courseId, chapterId] = adminVideoReorderMatch;
    const body = await readBody(req);
    const order = body.order;
    if (!Array.isArray(order) || order.length === 0) {
      sendJson(res, 400, { error: "order must be a non-empty array of video IDs" });
      return;
    }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) { sendJson(res, 404, { error: "Course not found" }); return; }
    const chapterIndex = (course.chapters || []).findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) { sendJson(res, 404, { error: "Chapter not found" }); return; }
    const existing = course.chapters[chapterIndex].videos || [];
    const videoMap = new Map(existing.map((v) => [v.id, v]));
    const reordered = order.map((id) => videoMap.get(id)).filter(Boolean);
    // Preserve any videos not in the order array at the end
    const included = new Set(order);
    for (const v of existing) {
      if (!included.has(v.id)) reordered.push(v);
    }
    await db.collection("courses").updateOne(
      { id: courseId },
      { $set: { [`chapters.${chapterIndex}.videos`]: reordered } }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: rename a video (exclude /reorder from videoId capture)
  const adminVideoEditMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters\/([^/]+)\/videos\/(?!reorder$)([^/]+)$/);
  if (isAdmin(user) && req.method === "PATCH" && adminVideoEditMatch) {
    const [, courseId, chapterId, videoId] = adminVideoEditMatch;
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    if (!title && !url) { sendJson(res, 400, { error: "Title or URL is required" }); return; }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) { sendJson(res, 404, { error: "Course not found" }); return; }
    const chapterIndex = (course.chapters || []).findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) { sendJson(res, 404, { error: "Chapter not found" }); return; }
    const videoIndex = (course.chapters[chapterIndex].videos || []).findIndex((v) => v.id === videoId);
    if (videoIndex === -1) { sendJson(res, 404, { error: "Video not found" }); return; }
    const updates = {};
    if (title) updates[`chapters.${chapterIndex}.videos.${videoIndex}.title`] = title;
    if (url) updates[`chapters.${chapterIndex}.videos.${videoIndex}.url`] = url;
    await db.collection("courses").updateOne({ id: courseId }, { $set: updates });
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: delete a video
  if (isAdmin(user) && req.method === "DELETE" && adminVideoEditMatch) {
    const [, courseId, chapterId, videoId] = adminVideoEditMatch;
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) { sendJson(res, 404, { error: "Course not found" }); return; }
    const chapterIndex = (course.chapters || []).findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) { sendJson(res, 404, { error: "Chapter not found" }); return; }
    await db.collection("courses").updateOne(
      { id: courseId },
      { $pull: { [`chapters.${chapterIndex}.videos`]: { id: videoId } } }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // Admin: revoke paid enrollment
  const adminRevokeMatch = pathname.match(/^\/api\/admin\/enrollments\/([^/]+)\/([^/]+)$/);
  if (isAdmin(user) && req.method === "DELETE" && adminRevokeMatch) {
    const [, courseId, userId] = adminRevokeMatch;
    await db.collection("paidEnrollments").deleteOne({ userId, courseId });
    sendJson(res, 200, { ok: true, message: "Access revoked" });
    return;
  }

  // Admin: list enrolled users for a course
  if (isAdmin(user) && req.method === "GET" && pathname.startsWith("/api/admin/enrollments")) {
    const courseId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("courseId");
    if (!courseId) { sendJson(res, 400, { error: "courseId is required" }); return; }
    const enrollments = await db.collection("paidEnrollments").find({ courseId, paid: true }).toArray();
    sendJson(res, 200, {
      enrollments: enrollments.map((e) => ({
        userId: e.userId,
        name: e.name || e.userId,
        email: e.email || "",
        mobile: e.mobile || ""
      }))
    });
    return;
  }

  // Admin: add new chapter to a course
  const adminChapterMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters$/);
  if (isAdmin(user) && req.method === "POST" && adminChapterMatch) {
    const courseId = adminChapterMatch[1];
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    if (!title) {
      sendJson(res, 400, { error: "Chapter title is required" });
      return;
    }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) {
      sendJson(res, 404, { error: "Course not found" });
      return;
    }
    const existingChapters = course.chapters || [];
    const chapterNum = existingChapters.length + 1;
    const newChapter = { id: `chapter-${chapterNum}`, title, videos: [] };
    await db.collection("courses").updateOne(
      { id: courseId },
      { $push: { chapters: newChapter } }
    );
    sendJson(res, 201, { ok: true, chapter: newChapter });
    return;
  }

  // Admin: add video to a chapter (auto-increment video ID)
  const adminVideoMatch = pathname.match(/^\/api\/admin\/courses\/([^/]+)\/chapters\/([^/]+)\/videos$/);
  if (isAdmin(user) && req.method === "POST" && adminVideoMatch) {
    const [, courseId, chapterId] = adminVideoMatch;
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    if (!title || !url) {
      sendJson(res, 400, { error: "Title and URL are required" });
      return;
    }
    const course = await db.collection("courses").findOne({ id: courseId });
    if (!course) {
      sendJson(res, 404, { error: "Course not found" });
      return;
    }
    const chapterIndex = (course.chapters || []).findIndex((ch) => ch.id === chapterId);
    if (chapterIndex === -1) {
      sendJson(res, 404, { error: "Chapter not found" });
      return;
    }
    // Auto-increment: find the highest video number across all chapters
    let maxNum = 0;
    for (const ch of course.chapters || []) {
      for (const v of ch.videos || []) {
        const match = String(v.id).match(/^video-(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    }
    const newId = `video-${String(maxNum + 1).padStart(3, "0")}`;
    const newVideo = { id: newId, title, url };
    await db.collection("courses").updateOne(
      { id: courseId },
      { $push: { [`chapters.${chapterIndex}.videos`]: newVideo } }
    );
    sendJson(res, 201, { ok: true, video: newVideo });
    return;
  }

  // Admin: enroll a user as paid
  if (isAdmin(user) && req.method === "POST" && pathname === "/api/admin/enrollments") {
    const body = await readBody(req);
    const userId = String(body.userId || "").trim();
    const courseId = String(body.courseId || "").trim();
    if (!userId || !courseId) {
      sendJson(res, 400, { error: "userId and courseId are required" });
      return;
    }
    const targetUser = await db.collection("users").findOne({ id: userId });
    if (!targetUser) {
      sendJson(res, 404, { error: "User not found" });
      return;
    }
    const existing = await db.collection("paidEnrollments").findOne({ userId, courseId });
    if (existing) {
      sendJson(res, 409, { error: "User is already enrolled in this course" });
      return;
    }
    await db.collection("paidEnrollments").insertOne({
      userId,
      courseId,
      paid: true,
      name: targetUser.name,
      email: targetUser.email,
      mobile: targetUser.mobile || null
    });
    sendJson(res, 201, { ok: true, message: `${targetUser.name} enrolled successfully` });
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
    const allChapters = await buildChapterList(courseId);

    // Chapter 1 is always free preview; rest requires paid access
    const chapters = allChapters.map((chapter, index) => {
      const isFree = index === 0;
      const isAccessible = isFree || paid;
      return {
        id: chapter.id,
        title: chapter.title,
        isFree,
        locked: !isAccessible,
        videos: isAccessible
          ? chapter.videos.map((video) => ({
              id: video.id,
              title: video.title,
              redirectUrl: `/watch/${courseId}/${video.id}`
            }))
          : []
      };
    });

    sendJson(res, 200, {
      course: courseForClient(course, paid),
      chapters
    });
    return;
  }

  // Watch: GET embed URL + prev/next for in-portal video player
  const watchMatch = pathname.match(/^\/api\/courses\/([^/]+)\/watch\/([^/]+)$/);
  if (req.method === "GET" && watchMatch) {
    const [, courseId, videoId] = watchMatch;
    const allChapters = await buildChapterList(courseId);

    // Flatten all videos with chapter context
    const flat = allChapters.flatMap((ch, ci) =>
      ch.videos.map((v, vi) => ({ ...v, chapterId: ch.id, chapterTitle: ch.title, chapterIndex: ci, videoIndex: vi }))
    );

    const idx = flat.findIndex((v) => v.id === videoId);
    if (idx === -1) { sendJson(res, 404, { error: "Video not found" }); return; }

    const entry = flat[idx];
    const isFree = entry.chapterIndex === 0;

    if (!isFree && !await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Enroll to watch this video" });
      return;
    }

    // Convert Drive view URL → embed URL
    const driveMatch = entry.url && entry.url.match(/\/file\/d\/([^/]+)/);
    const embedUrl = driveMatch
      ? `https://drive.google.com/file/d/${driveMatch[1]}/preview`
      : entry.url;

    const prev = flat[idx - 1] || null;
    const next = flat[idx + 1] || null;

    sendJson(res, 200, {
      video: {
        id: entry.id,
        title: entry.title,
        embedUrl,
        chapterTitle: entry.chapterTitle,
        isFree
      },
      prev: prev ? { id: prev.id, title: prev.title, chapterTitle: prev.chapterTitle } : null,
      next: next ? { id: next.id, title: next.title, chapterTitle: next.chapterTitle } : null,
      courseId
    });
    return;
  }

  // Progress: GET — paid users only
  const progressGetMatch = pathname.match(/^\/api\/progress\/([^/]+)$/);
  if (req.method === "GET" && progressGetMatch) {
    const courseId = progressGetMatch[1];
    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 200, { watched: [], lastWatched: null });
      return;
    }
    const progress = await db.collection("progress").findOne({ userId: user.id, courseId });
    sendJson(res, 200, {
      watched: progress ? (progress.watched || []) : [],
      lastWatched: progress ? (progress.lastWatched || null) : null
    });
    return;
  }

  // Progress: POST mark a video as watched — paid users only
  const progressPostMatch = pathname.match(/^\/api\/progress\/([^/]+)\/([^/]+)$/);
  if (req.method === "POST" && progressPostMatch) {
    const [, courseId, videoId] = progressPostMatch;

    // Must be paid — no progress tracking for free-preview viewers
    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Progress tracking is only available after enrollment" });
      return;
    }

    // Verify video actually exists in this course
    const allChapters = await buildChapterList(courseId);
    let videoTitle = null;
    for (const ch of allChapters) {
      const v = ch.videos.find((v) => v.id === videoId);
      if (v) { videoTitle = v.title; break; }
    }
    if (!videoTitle) {
      sendJson(res, 404, { error: "Video not found" });
      return;
    }

    await db.collection("progress").updateOne(
      { userId: user.id, courseId },
      {
        $addToSet: { watched: videoId },
        $set: { lastWatched: { videoId, videoTitle, at: new Date().toISOString() } }
      },
      { upsert: true }
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── Quiz: generate 5 MCQs for a video using Groq AI ─────
  const quizGenMatch = pathname.match(/^\/api\/quiz\/generate$/);
  if (req.method === "POST" && quizGenMatch) {
    const body = await readBody(req);
    const courseId   = String(body.courseId   || "").trim();
    const videoId    = String(body.videoId    || "").trim();
    const videoTitle = String(body.videoTitle || "").trim();
    const chapterTitle = String(body.chapterTitle || "").trim();

    if (!videoTitle) {
      sendJson(res, 400, { error: "videoTitle is required" });
      return;
    }

    // Only paid users on non-free videos (free chapter is chapter index 0)
    if (videoId) {
      const allChapters = await buildChapterList(courseId);
      const chIdx = allChapters.findIndex((ch) => ch.videos.some((v) => v.id === videoId));
      const isFreeVid = chIdx === 0;
      if (!isFreeVid && !await isPaid(user.id, courseId)) {
        sendJson(res, 403, { error: "Enroll to take quizzes" });
        return;
      }
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      sendJson(res, 503, { error: "AI quiz generation is not configured." });
      return;
    }

    const prompt = `You are an Oracle Fusion HCM instructor. Generate exactly 5 multiple-choice quiz questions based on the Oracle HCM lesson described below.

Lesson: "${videoTitle}"${chapterTitle ? `\nChapter: "${chapterTitle}"` : ""}

Rules:
- Questions must test understanding of Oracle Fusion HCM concepts covered in this lesson
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one option is correct
- Avoid trivial or definition-only questions — test application and understanding
- Do NOT add any explanation text or preamble

Respond ONLY with a valid JSON array. No markdown, no code fences, no extra text. Example format:
[
  {
    "q": "Question text here?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": 0
  }
]

Where "answer" is the 0-based index of the correct option.`;

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200,
          temperature: 0.4
        })
      });

      if (!groqRes.ok) {
        const errBody = await groqRes.json().catch(() => ({}));
        const groqMsg = errBody?.error?.message || "unknown error";
        if (groqRes.status === 401) sendJson(res, 502, { error: "AI key invalid." });
        else if (groqRes.status === 429) sendJson(res, 429, { error: "AI rate limit — try again in a moment." });
        else sendJson(res, 502, { error: `AI error: ${groqMsg}` });
        return;
      }

      const groqData = await groqRes.json();
      const raw = groqData.choices?.[0]?.message?.content || "";

      // Strip markdown code fences if the model wrapped the JSON
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

      let questions;
      try {
        questions = JSON.parse(cleaned);
      } catch {
        console.error("Quiz JSON parse failed. Raw:", raw.slice(0, 300));
        sendJson(res, 502, { error: "AI returned invalid format. Please try again." });
        return;
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        sendJson(res, 502, { error: "AI returned no questions. Please try again." });
        return;
      }

      // Sanitise — ensure each question has q, options[4], answer
      const sanitised = questions.slice(0, 5).map((q) => ({
        q:       String(q.q || q.question || "").trim(),
        options: (Array.isArray(q.options) ? q.options : []).slice(0, 4).map(String),
        answer:  typeof q.answer === "number" ? q.answer : 0
      })).filter((q) => q.q && q.options.length === 4);

      if (sanitised.length === 0) {
        sendJson(res, 502, { error: "AI returned unparseable questions. Please try again." });
        return;
      }

      sendJson(res, 200, { questions: sanitised });
    } catch (err) {
      console.error("Quiz generate error:", err.message);
      sendJson(res, 500, { error: "Could not reach AI service. Please try again." });
    }
    return;
  }

  // ── Quiz: submit answers, score, save result ──────────────
  if (req.method === "POST" && pathname === "/api/quiz/submit") {
    const body      = await readBody(req);
    const courseId  = String(body.courseId  || "").trim();
    const videoId   = String(body.videoId   || "").trim();
    const videoTitle = String(body.videoTitle || "").trim();
    const questions = body.questions;   // [{q, options, answer}]
    const answers   = body.answers;     // [number] — student's chosen index per question

    if (!courseId || !videoId || !Array.isArray(questions) || !Array.isArray(answers)) {
      sendJson(res, 400, { error: "courseId, videoId, questions and answers are required" });
      return;
    }

    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Enroll to submit quizzes" });
      return;
    }

    // Score
    const total   = questions.length;
    let correct = 0;
    const detail  = questions.map((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      return {
        q:            q.q,
        options:      q.options,
        correctIndex: q.answer,
        chosenIndex:  answers[i] ?? -1,
        correct:      isCorrect
      };
    });

    const score    = Math.round((correct / total) * 100);
    const passed   = score >= 60;
    const attempt  = {
      userId:     user.id,
      userName:   user.name,
      courseId,
      videoId,
      videoTitle,
      score,
      correct,
      total,
      passed,
      answers,
      detail,
      attemptedAt: new Date()
    };

    // Keep best score per user+video
    await db.collection("quizResults").updateOne(
      { userId: user.id, videoId },
      { $max: { bestScore: score }, $set: { ...attempt }, $inc: { attempts: 1 } },
      { upsert: true }
    );

    sendJson(res, 200, { ok: true, score, correct, total, passed, detail });
    return;
  }

  // ── Quiz: get best result for this user on a video ────────
  const quizResultMatch = pathname.match(/^\/api\/quiz\/result\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && quizResultMatch) {
    const [, courseId, videoId] = quizResultMatch;
    const result = await db.collection("quizResults").findOne(
      { userId: user.id, videoId },
      { projection: { bestScore: 1, correct: 1, total: 1, passed: 1, attempts: 1, attemptedAt: 1 } }
    );
    sendJson(res, 200, { result: result || null });
    return;
  }

  // ── Q&A: GET questions for a video ────────────────────────
  const qaGetMatch = pathname.match(/^\/api\/qa\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && qaGetMatch) {
    const [, courseId, videoId] = qaGetMatch;
    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Enroll to view Q&A" });
      return;
    }
    const questions = await db.collection("questions")
      .find({ courseId, videoId })
      .sort({ createdAt: 1 })
      .toArray();
    sendJson(res, 200, {
      questions: questions.map((q) => ({
        id:         q.id,
        text:       q.text,
        userId:     q.userId,
        userName:   q.userName,
        parentId:   q.parentId || null,
        createdAt:  q.createdAt,
        isOwn:      q.userId === user.id,
        canDelete:  q.userId === user.id || isAdmin(user),
        likeCount:  (q.likedBy || []).length,
        likedByMe:  (q.likedBy || []).includes(user.id)
      }))
    });
    return;
  }

  // ── Q&A: PATCH like/unlike a question ────────────────────
  const qaLikeMatch = pathname.match(/^\/api\/qa\/([^/]+)\/([^/]+)\/([^/]+)\/like$/);
  if (req.method === "POST" && qaLikeMatch) {
    const [, courseId, videoId, questionId] = qaLikeMatch;
    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Enroll to like posts" });
      return;
    }
    const doc = await db.collection("questions").findOne({ id: questionId, courseId, videoId });
    if (!doc) {
      sendJson(res, 404, { error: "Question not found" });
      return;
    }
    const liked = (doc.likedBy || []).includes(user.id);
    if (liked) {
      await db.collection("questions").updateOne({ id: questionId }, { $pull: { likedBy: user.id } });
    } else {
      await db.collection("questions").updateOne({ id: questionId }, { $addToSet: { likedBy: user.id } });
    }
    const updated = await db.collection("questions").findOne({ id: questionId });
    sendJson(res, 200, {
      likeCount: (updated.likedBy || []).length,
      likedByMe: !liked
    });
    return;
  }

  // ── Q&A: POST a new question or reply ─────────────────────
  const qaPostMatch = pathname.match(/^\/api\/qa\/([^/]+)\/([^/]+)$/);
  if (req.method === "POST" && qaPostMatch) {
    const [, courseId, videoId] = qaPostMatch;
    if (!await isPaid(user.id, courseId)) {
      sendJson(res, 403, { error: "Enroll to post questions" });
      return;
    }
    const body = await readBody(req);
    const text     = String(body.text     || "").trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;
    if (!text || text.length < 3) {
      sendJson(res, 400, { error: "Question must be at least 3 characters" });
      return;
    }
    if (text.length > 2000) {
      sendJson(res, 400, { error: "Question must be 2000 characters or less" });
      return;
    }
    // If replying, verify the parent exists in the same video
    if (parentId) {
      const parent = await db.collection("questions").findOne({ id: parentId, courseId, videoId });
      if (!parent) {
        sendJson(res, 404, { error: "Parent question not found" });
        return;
      }
    }
    const doc = {
      id:        crypto.randomBytes(8).toString("hex"),
      courseId,
      videoId,
      userId:    user.id,
      userName:  user.name,
      text,
      parentId:  parentId || null,
      createdAt: new Date()
    };
    await db.collection("questions").insertOne(doc);
    sendJson(res, 201, {
      question: {
        id:        doc.id,
        text:      doc.text,
        userId:    doc.userId,
        userName:  doc.userName,
        parentId:  doc.parentId,
        createdAt: doc.createdAt,
        isOwn:     true,
        canDelete: true,
        likeCount: 0,
        likedByMe: false
      }
    });
    return;
  }

  // ── Q&A: DELETE a question (own or admin) ─────────────────
  const qaDeleteMatch = pathname.match(/^\/api\/qa\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (req.method === "DELETE" && qaDeleteMatch) {
    const [, courseId, videoId, questionId] = qaDeleteMatch;
    const doc = await db.collection("questions").findOne({ id: questionId, courseId, videoId });
    if (!doc) {
      sendJson(res, 404, { error: "Question not found" });
      return;
    }
    if (doc.userId !== user.id && !isAdmin(user)) {
      sendJson(res, 403, { error: "Not allowed" });
      return;
    }
    // Also delete all replies to this question
    await db.collection("questions").deleteMany({ parentId: questionId });
    await db.collection("questions").deleteOne({ id: questionId });
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── Q&A Admin: GET recent questions across all videos ─────
  if (isAdmin(user) && req.method === "GET" && pathname === "/api/admin/qa") {
    const url2 = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.min(parseInt(url2.searchParams.get("limit") || "50", 10), 200);
    const questions = await db.collection("questions")
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    sendJson(res, 200, {
      questions: questions.map((q) => ({
        id:        q.id,
        courseId:  q.courseId,
        videoId:   q.videoId,
        text:      q.text,
        userId:    q.userId,
        userName:  q.userName,
        parentId:  q.parentId || null,
        createdAt: q.createdAt
      }))
    });
    return;
  }

  // ── Q&A Admin: DELETE any question ────────────────────────
  const adminQaDeleteMatch = pathname.match(/^\/api\/admin\/qa\/([^/]+)$/);
  if (isAdmin(user) && req.method === "DELETE" && adminQaDeleteMatch) {
    const questionId = adminQaDeleteMatch[1];
    await db.collection("questions").deleteMany({ parentId: questionId });
    await db.collection("questions").deleteOne({ id: questionId });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

async function handleWatch(req, res, pathname) {
  const match = pathname.match(/^\/watch\/([^/]+)\/([^/]+)$/);
  if (!match) return false;

  const user = await getCurrentUser(req);
  if (!user) {
    console.log("Watch endpoint: No user session found, redirecting to login");
    sendRedirect(res, "/#login");
    return true;
  }

  const [, courseId, videoId] = match;

  // Check if video belongs to chapter 1 (free preview)
  const allChapters = await buildChapterList(courseId);
  const chapterIndex = allChapters.findIndex((ch) =>
    ch.videos.some((v) => v.id === videoId)
  );
  const isFreeVideo = chapterIndex === 0;

  if (!isFreeVideo) {
    const paid = await isPaid(user.id, courseId);
    if (!paid) {
      console.log(`Watch endpoint: User ${user.id} not paid for course ${courseId}`);
      sendRedirect(res, `/#course/${courseId}`);
      return true;
    }
  }

  const videoUrl = await findVideoUrl(courseId, videoId);
  console.log(`Watch endpoint: Redirecting to video URL: ${videoUrl}`);
  sendRedirect(res, videoUrl || `/#course/${courseId}`);
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
