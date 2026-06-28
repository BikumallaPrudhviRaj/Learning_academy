/* =========================================================
   Up 'N' Rise Learning Academy — Frontend App
   ========================================================= */

// ── Helpers ──────────────────────────────────────────────
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function formatPrice(n) {
  return "Rs. " + Number(n).toLocaleString("en-IN");
}

// ── State ─────────────────────────────────────────────────
let currentUser = null;
let allCourses = [];
let allTestimonials = [];
let contactInfo = {};

// ── Auth ──────────────────────────────────────────────────
const loginView   = qs("#loginView");
const appView     = qs("#appView");
const loginForm   = qs("#loginForm");
const signupForm  = qs("#signupForm");
const loginMsg    = qs("#loginMessage");
const signupMsg   = qs("#signupMessage");

qs("#showSignup").addEventListener("click", () => {
  hide(loginForm);
  show(signupForm);
});
qs("#showLogin").addEventListener("click", () => {
  hide(signupForm);
  show(loginForm);
});

// Show password toggles
qsa(".show-password-toggle").forEach((chk) => {
  chk.addEventListener("change", () => {
    const form = chk.closest("form");
    const pwInput = form.querySelector("input[type='password'], input[type='text'][name='password']");
    const allPw = form.querySelectorAll("input[name='password']");
    allPw.forEach((inp) => {
      inp.type = chk.checked ? "text" : "password";
    });
    // Also handle any visible password inputs
    form.querySelectorAll("input[type='password']").forEach((inp) => {
      inp.type = chk.checked ? "text" : "password";
    });
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  const email    = loginForm.email.value.trim();
  const password = loginForm.password.value.trim();
  const { ok, data } = await api("POST", "/api/login", { email, password });
  if (ok) {
    currentUser = data.user;
    enterApp();
  } else {
    loginMsg.textContent = data.error || "Login failed.";
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupMsg.textContent = "";
  const name     = signupForm.name.value.trim();
  const email    = signupForm.email.value.trim();
  const mobile   = signupForm.mobile.value.trim();
  const password = signupForm.password.value.trim();
  const { ok, data } = await api("POST", "/api/register", { name, email, mobile, password });
  if (ok) {
    currentUser = data.user;
    enterApp();
  } else {
    signupMsg.textContent = data.error || "Registration failed.";
  }
});

// ── User dropdown ─────────────────────────────────────────
const userMenuButton = qs("#userMenuButton");
const userDropdown   = qs("#userDropdown");

userMenuButton.addEventListener("click", () => {
  const expanded = userMenuButton.getAttribute("aria-expanded") === "true";
  userMenuButton.setAttribute("aria-expanded", String(!expanded));
  userDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!qs(".user-menu-wrap").contains(e.target)) {
    userDropdown.classList.add("hidden");
    userMenuButton.setAttribute("aria-expanded", "false");
  }
});

qs("#logoutButton").addEventListener("click", async () => {
  await api("POST", "/api/logout");
  currentUser = null;
  allCourses = [];
  hide(appView);
  show(loginView);
  loginForm.reset();
  signupForm.reset();
  hide(signupForm);
  show(loginForm);
  loginMsg.textContent = "";
  qs("#courseGrid").innerHTML = "";
  qs("#testimonialGrid").innerHTML = "";
  qs("#courseDetailView").innerHTML = "";
  hide(qs("#courseDetailView"));
  show(qs("#catalogView"));
  chatHistory = [];
});

// ── App entry ─────────────────────────────────────────────
function enterApp() {
  hide(loginView);
  show(appView);
  updateUserDisplay();
  loadCatalog();

  // Always reset admin UI to hidden first, then show only for admins
  const adminTab  = qs("#adminTab");
  const adminView = qs("#adminView");
  hide(adminView);
  if (currentUser && currentUser.isAdmin) {
    show(adminTab);
    loadAdminData();
  } else {
    hide(adminTab);
  }
}

function updateUserDisplay() {
  if (!currentUser) return;
  const initials = currentUser.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  qs("#userInitials").textContent = initials;
  qs("#dropdownName").textContent = currentUser.name;
  qs("#dropdownEmail").textContent = currentUser.email;
  const mobileEl = qs("#dropdownMobile");
  if (currentUser.mobile) {
    mobileEl.textContent = currentUser.mobile;
    show(mobileEl);
  } else {
    hide(mobileEl);
  }
}

// ── Tabs ──────────────────────────────────────────────────
qs("#catalogTab").addEventListener("click", () => {
  qs("#catalogTab").classList.add("active");
  qs("#adminTab").classList.remove("active");
  show(qs("#catalogView"));
  hide(qs("#adminView"));
  hide(qs("#courseDetailView"));
});

qs("#adminTab").addEventListener("click", () => {
  qs("#adminTab").classList.add("active");
  qs("#catalogTab").classList.remove("active");
  hide(qs("#catalogView"));
  hide(qs("#courseDetailView"));
  show(qs("#adminView"));
  // Clear all stale success/error messages in the admin panel
  qsa(".message", qs("#adminView")).forEach((el) => { el.textContent = ""; });
});

// ── Catalog ───────────────────────────────────────────────
async function loadCatalog() {
  const { ok, data } = await api("GET", "/api/courses");
  if (!ok) return;
  allCourses       = data.courses || [];
  allTestimonials  = data.testimonials || [];
  contactInfo      = data.contact || {};
  renderCourseGrid();
  renderTestimonials();
  renderContact();
}

function renderCourseGrid() {
  const grid = qs("#courseGrid");
  grid.innerHTML = allCourses.map((c) => `
    <div class="course-card">
      <span class="course-chip" style="background:${c.accent || "#2563eb"}">${c.level || "All levels"}</span>
      <h3>${c.title}</h3>
      <p>${c.summary || ""}</p>
      <div class="meta-row">
        <span>${c.duration}</span>
        ${c.paid
          ? '<span class="paid-badge">✓ Enrolled</span>'
          : `<span class="price-block"><span class="final-price">${formatPrice(c.price)} <small style="font-weight:600;font-size:11px">Incl GST</small></span></span>`
        }
      </div>
      <div class="card-actions">
        <button type="button" onclick="openCourseDetail('${c.id}')">View Course</button>
      </div>
    </div>
  `).join("");
}

function renderTestimonials() {
  const grid = qs("#testimonialGrid");
  if (!allTestimonials.length) {
    grid.innerHTML = "<p style='color:var(--muted)'>No testimonials yet.</p>";
    return;
  }
  grid.innerHTML = allTestimonials.map((t) => `
    <div class="testimonial-card">
      <p>"${t.quote}"</p>
      <strong>${t.name}</strong>
      <span>${t.role}</span>
    </div>
  `).join("");
}

function renderContact() {
  const block = qs("#contactBlock");
  if (!contactInfo.academy) return;
  block.innerHTML = `
    <div class="section-heading compact">
      <p class="eyebrow">Contact Us</p>
      <h2>Get in touch with Up 'N' Rise Academy.</h2>
    </div>
    <dl class="contact-list">
      <div><dt>Academy</dt><dd>${contactInfo.academy}</dd></div>
      <div><dt>Location</dt><dd>${contactInfo.address || ""}</dd></div>
      <div><dt>Mobile</dt><dd><a href="tel:${contactInfo.mobile}">${contactInfo.mobile}</a></dd></div>
      <div><dt>Email</dt><dd><a href="mailto:${contactInfo.email}">${contactInfo.email}</a></dd></div>
    </dl>
  `;
}

// ── Course Detail ─────────────────────────────────────────
async function openCourseDetail(courseId) {
  const detailView  = qs("#courseDetailView");
  const catalogView = qs("#catalogView");
  detailView.innerHTML = "<p style='padding:20px;color:var(--muted)'>Loading…</p>";
  show(detailView);
  hide(catalogView);

  const { ok, data } = await api("GET", `/api/courses/${courseId}`);
  if (!ok) {
    detailView.innerHTML = "<p style='padding:20px;color:var(--red)'>Could not load course.</p>";
    return;
  }

  const { course, chapters } = data;
  const chaptersHtml = chapters.map((ch) => {
    const videosHtml = ch.locked
      ? `<p class="locked-message">🔒 Unlock by enrolling in this course.</p>`
      : `<div class="video-grid">
          ${ch.videos.map((v) => `
            <a class="video-link" href="${v.redirectUrl}" target="_blank" rel="noopener noreferrer">
              ${v.title}
              ${ch.isFree ? '<span class="free-badge">Free</span>' : ""}
            </a>
          `).join("")}
        </div>`;

    return `
      <div class="chapter-block">
        <button class="chapter-header" type="button" onclick="toggleChapter(this)">
          <span class="chapter-title">${ch.title}</span>
          <span class="chapter-arrow">▼</span>
        </button>
        <div class="chapter-videos${ch.isFree ? "" : " hidden"}">
          ${videosHtml}
        </div>
      </div>
    `;
  }).join("");

  detailView.innerHTML = `
    <button class="back-button" type="button" onclick="closeCourseDetail()" style="width:auto;margin-bottom:20px;padding:10px 18px">← Back to Courses</button>
    <div class="detail-hero">
      <div class="detail-main">
        <span class="eyebrow" style="color:var(--muted)">${course.level}</span>
        <h2>${course.title}</h2>
        <p class="detail-copy">${course.why || course.summary || ""}</p>
        <div class="detail-grid">
          <div>
            <h3>Who should enroll</h3>
            <ul>${(course.eligible || []).map((e) => `<li>${e}</li>`).join("")}</ul>
          </div>
          <div>
            <h3>What you'll get</h3>
            <ul>${(course.outcomes || []).map((o) => `<li>${o}</li>`).join("")}</ul>
          </div>
        </div>
      </div>
      <div class="payment-panel">
        <h3>${course.paid ? "You're Enrolled" : "Enroll Now"}</h3>
        <div class="meta-row" style="margin-bottom:14px">
          <span>${course.duration}</span>
          ${course.paid
            ? '<span class="paid-badge">✓ Enrolled</span>'
            : `<span class="final-price">${formatPrice(course.price)} <small style="font-weight:600;font-size:11px">Incl GST</small></span>`
          }
        </div>
        ${course.paid
          ? `<p style="color:var(--green);font-weight:700">You have full access to all videos.</p>`
          : `<p class="payment-note">Pay via QR code to enroll. Your access will be activated within 24 hours after payment confirmation.</p>
             ${course.qrImage ? `<img class="qr" src="${course.qrImage}" alt="Payment QR code">` : ""}
             <p class="payment-note" style="font-size:13px">After payment, contact us at <strong>${contactInfo.mobile || ""}</strong> or <strong>${contactInfo.email || ""}</strong> with your payment screenshot.</p>`
        }
      </div>
    </div>
    <div class="video-section">
      <h3>Course Chapters</h3>
      <div class="chapters-container">${chaptersHtml}</div>
    </div>
  `;
}

function closeCourseDetail() {
  hide(qs("#courseDetailView"));
  show(qs("#catalogView"));
}

function toggleChapter(btn) {
  const videos = btn.nextElementSibling;
  const arrow  = btn.querySelector(".chapter-arrow");
  const open   = !videos.classList.contains("hidden");
  videos.classList.toggle("hidden", open);
  arrow.textContent = open ? "▼" : "▲";
}

// ── Testimonial form ──────────────────────────────────────
qs("#testimonialForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg  = qs("#testimonialMessage");
  const role  = qs("#testimonialForm [name=role]").value.trim();
  const quote = qs("#testimonialForm [name=quote]").value.trim();
  msg.textContent = "";
  const { ok, data } = await api("POST", "/api/testimonials", { role, quote });
  if (ok) {
    msg.style.color = "var(--green)";
    msg.textContent = data.message || "Submitted! Awaiting approval.";
    qs("#testimonialForm").reset();
  } else {
    msg.style.color = "var(--red)";
    msg.textContent = data.error || "Submission failed.";
  }
});

// ── Admin panel ───────────────────────────────────────────
async function loadAdminData() {
  const { ok, data } = await api("GET", "/api/admin/courses");
  if (!ok) return;
  const courses = data.courses || [];

  // Populate all course dropdowns
  const selectors = [
    "#adminEnrollCourse",
    "#adminRevokeCourse",
    "#adminChapterCourse",
    "#adminEditChapterCourse",
    "#adminVideoCourse",
    "#adminEditVideoCourse"
  ];
  selectors.forEach((sel) => {
    const el = qs(sel);
    el.innerHTML = '<option value="">Select course…</option>' +
      courses.map((c) => `<option value="${c.id}">${c.title}</option>`).join("");
  });

  // Enroll: load non-enrolled users when course changes, clear stale message
  qs("#adminEnrollCourse").addEventListener("change", async function () {
    qs("#adminEnrollMessage").textContent = "";
    const courseId = this.value;
    const userSel  = qs("#adminEnrollUser");
    if (!courseId) { userSel.innerHTML = '<option value="">Select course first…</option>'; return; }
    const { ok, data } = await api("GET", `/api/admin/users?excludeEnrolled=${courseId}`);
    if (!ok) return;
    userSel.innerHTML = '<option value="">Select user…</option>' +
      (data.users || []).map((u) => `<option value="${u.id}">${u.name} (${u.email})</option>`).join("");
  });
  qs("#adminEnrollUser").addEventListener("change", () => {
    qs("#adminEnrollMessage").textContent = "";
  });

  // Revoke: load enrolled users when course changes, clear stale message
  qs("#adminRevokeCourse").addEventListener("change", async function () {
    qs("#adminRevokeMessage").textContent = "";
    const courseId = this.value;
    const userSel  = qs("#adminRevokeUser");
    if (!courseId) { userSel.innerHTML = '<option value="">Select course first…</option>'; return; }
    const { ok, data } = await api("GET", `/api/admin/enrollments?courseId=${courseId}`);
    if (!ok) return;
    userSel.innerHTML = '<option value="">Select enrolled user…</option>' +
      (data.enrollments || []).map((u) => `<option value="${u.userId}">${u.name} (${u.email})</option>`).join("");
  });
  qs("#adminRevokeUser").addEventListener("change", () => {
    qs("#adminRevokeMessage").textContent = "";
  });

  // Chapter selectors for video actions
  function bindChapterSelect(courseSelId, chapterSelId) {
    qs(courseSelId).addEventListener("change", function () {
      const course = courses.find((c) => c.id === this.value);
      const chSel  = qs(chapterSelId);
      chSel.innerHTML = '<option value="">Select chapter…</option>' +
        (course ? course.chapters : []).map((ch) => `<option value="${ch.id}">${ch.title}</option>`).join("");
    });
  }
  bindChapterSelect("#adminVideoCourse",      "#adminVideoChapter");
  bindChapterSelect("#adminEditChapterCourse","#adminEditChapterSelect");
  bindChapterSelect("#adminEditVideoCourse",  "#adminEditVideoChapter");

  // Video select when chapter changes
  qs("#adminEditVideoChapter").addEventListener("change", function () {
    const courseId   = qs("#adminEditVideoCourse").value;
    const course     = courses.find((c) => c.id === courseId);
    const chapterId  = this.value;
    const chapter    = (course?.chapters || []).find((ch) => ch.id === chapterId);
    const vidSel     = qs("#adminEditVideoSelect");
    vidSel.innerHTML = '<option value="">Select video…</option>' +
      (chapter?.videos || []).map((v) => `<option value="${v.id}">${v.title}</option>`).join("");
  });
}

// Admin: Enroll
qs("#adminEnrollBtn").addEventListener("click", async () => {
  const msg      = qs("#adminEnrollMessage");
  const courseId = qs("#adminEnrollCourse").value;
  const userId   = qs("#adminEnrollUser").value;
  if (!courseId || !userId) { msg.textContent = "Select both course and user."; return; }
  const { ok, data } = await api("POST", "/api/admin/enrollments", { courseId, userId });
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = data.message || data.error || "";
  if (ok) loadCatalog();
});

// Admin: Revoke
qs("#adminRevokeBtn").addEventListener("click", () => {
  const courseId = qs("#adminRevokeCourse").value;
  const userId   = qs("#adminRevokeUser").value;
  if (!courseId || !userId) {
    qs("#adminRevokeMessage").textContent = "Select both course and user.";
    return;
  }
  showConfirm("Revoke this user's paid access?", async () => {
    const { ok, data } = await api("DELETE", `/api/admin/enrollments/${courseId}/${userId}`);
    const msg = qs("#adminRevokeMessage");
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = data.message || data.error || "";
    if (ok) loadCatalog();
  });
});

// Admin: Add chapter
qs("#adminAddChapterBtn").addEventListener("click", async () => {
  const msg      = qs("#adminChapterMessage");
  const courseId = qs("#adminChapterCourse").value;
  const title    = qs("#adminChapterTitle").value.trim();
  if (!courseId || !title) { msg.textContent = "Select course and enter title."; return; }
  const { ok, data } = await api("POST", `/api/admin/courses/${courseId}/chapters`, { title });
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Chapter added." : (data.error || "Error");
  if (ok) { qs("#adminChapterTitle").value = ""; loadAdminData(); }
});

// Admin: Rename chapter
qs("#adminRenameChapterBtn").addEventListener("click", async () => {
  const msg       = qs("#adminEditChapterMessage");
  const courseId  = qs("#adminEditChapterCourse").value;
  const chapterId = qs("#adminEditChapterSelect").value;
  const title     = qs("#adminEditChapterTitle").value.trim();
  if (!courseId || !chapterId || !title) { msg.textContent = "Select course, chapter, and enter new title."; return; }
  const { ok, data } = await api("PATCH", `/api/admin/courses/${courseId}/chapters/${chapterId}`, { title });
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Chapter renamed." : (data.error || "Error");
  if (ok) loadAdminData();
});

// Admin: Delete chapter
qs("#adminDeleteChapterBtn").addEventListener("click", () => {
  const courseId  = qs("#adminEditChapterCourse").value;
  const chapterId = qs("#adminEditChapterSelect").value;
  if (!courseId || !chapterId) { qs("#adminEditChapterMessage").textContent = "Select course and chapter."; return; }
  showConfirm("Delete this chapter and all its videos?", async () => {
    const { ok, data } = await api("DELETE", `/api/admin/courses/${courseId}/chapters/${chapterId}`);
    const msg = qs("#adminEditChapterMessage");
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Chapter deleted." : (data.error || "Error");
    if (ok) loadAdminData();
  });
});

// Admin: Add video
qs("#adminAddVideoBtn").addEventListener("click", async () => {
  const msg       = qs("#adminVideoMessage");
  const courseId  = qs("#adminVideoCourse").value;
  const chapterId = qs("#adminVideoChapter").value;
  const title     = qs("#adminVideoTitle").value.trim();
  const url       = qs("#adminVideoUrl").value.trim();
  if (!courseId || !chapterId || !title || !url) { msg.textContent = "All fields are required."; return; }
  const { ok, data } = await api("POST", `/api/admin/courses/${courseId}/chapters/${chapterId}/videos`, { title, url });
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Video added." : (data.error || "Error");
  if (ok) { qs("#adminVideoTitle").value = ""; qs("#adminVideoUrl").value = ""; loadAdminData(); }
});

// Admin: Save video changes
qs("#adminRenameVideoBtn").addEventListener("click", async () => {
  const msg       = qs("#adminEditVideoMessage");
  const courseId  = qs("#adminEditVideoCourse").value;
  const chapterId = qs("#adminEditVideoChapter").value;
  const videoId   = qs("#adminEditVideoSelect").value;
  const title     = qs("#adminEditVideoTitle").value.trim();
  const url       = qs("#adminEditVideoUrl").value.trim();
  if (!courseId || !chapterId || !videoId) { msg.textContent = "Select course, chapter, and video."; return; }
  if (!title && !url) { msg.textContent = "Enter a new title or URL."; return; }
  const body = {};
  if (title) body.title = title;
  if (url)   body.url   = url;
  const { ok, data } = await api("PATCH", `/api/admin/courses/${courseId}/chapters/${chapterId}/videos/${videoId}`, body);
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Video updated." : (data.error || "Error");
  if (ok) { qs("#adminEditVideoTitle").value = ""; qs("#adminEditVideoUrl").value = ""; loadAdminData(); }
});

// Admin: Delete video
qs("#adminDeleteVideoBtn").addEventListener("click", () => {
  const courseId  = qs("#adminEditVideoCourse").value;
  const chapterId = qs("#adminEditVideoChapter").value;
  const videoId   = qs("#adminEditVideoSelect").value;
  if (!courseId || !chapterId || !videoId) { qs("#adminEditVideoMessage").textContent = "Select course, chapter, and video."; return; }
  showConfirm("Delete this video?", async () => {
    const { ok, data } = await api("DELETE", `/api/admin/courses/${courseId}/chapters/${chapterId}/videos/${videoId}`);
    const msg = qs("#adminEditVideoMessage");
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Video deleted." : (data.error || "Error");
    if (ok) loadAdminData();
  });
});

// ── Confirm dialog ────────────────────────────────────────
let confirmCallback = null;
const confirmOverlay = qs("#adminConfirmOverlay");
const confirmOk      = qs("#adminConfirmOk");
const confirmCancel  = qs("#adminConfirmCancel");

function showConfirm(text, cb) {
  qs("#adminConfirmText").textContent = text;
  confirmCallback = cb;
  show(confirmOverlay);
}

confirmOk.addEventListener("click", () => {
  hide(confirmOverlay);
  if (typeof confirmCallback === "function") confirmCallback();
  confirmCallback = null;
});

confirmCancel.addEventListener("click", () => {
  hide(confirmOverlay);
  confirmCallback = null;
});

// ── Chatbot ───────────────────────────────────────────────
const chatToggleBtn  = qs("#chatToggleBtn");
const chatWindow     = qs("#chatWindow");
const chatMessages   = qs("#chatMessages");
const chatInput      = qs("#chatInput");
const chatSendBtn    = qs("#chatSendBtn");
const chatIconOpen   = qs(".chat-icon-open");
const chatIconClose  = qs(".chat-icon-close");
const chatTeaser     = qs("#chatTeaser");
const chatTeaserClose = qs("#chatTeaserClose");

let chatHistory = [];       // [{role, content}]
let chatOpen    = false;

// Show teaser bubble after 2.5 s (only once per session)
let teaserTimer = setTimeout(() => {
  if (!chatOpen) show(chatTeaser);
}, 2500);

// Dismiss teaser with × button
chatTeaserClose.addEventListener("click", (e) => {
  e.stopPropagation();
  hide(chatTeaser);
  clearTimeout(teaserTimer);
});

chatToggleBtn.addEventListener("click", () => {
  chatOpen = !chatOpen;
  // Always hide the teaser when chat is toggled
  hide(chatTeaser);
  clearTimeout(teaserTimer);
  chatWindow.classList.toggle("hidden", !chatOpen);
  chatIconOpen.classList.toggle("hidden", chatOpen);
  chatIconClose.classList.toggle("hidden", !chatOpen);
  chatToggleBtn.setAttribute("aria-label", chatOpen ? "Close chat assistant" : "Open chat assistant");
  if (chatOpen) {
    chatInput.focus();
    scrollChatToBottom();
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

chatSendBtn.addEventListener("click", sendChat);

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg-${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);
  chatMessages.appendChild(div);
  scrollChatToBottom();
  return div;
}

function appendTypingIndicator() {
  const div = document.createElement("div");
  div.className = "chat-msg chat-msg-bot chat-msg-typing";
  div.id = "chatTyping";
  const p = document.createElement("p");
  p.textContent = "Typing…";
  div.appendChild(p);
  chatMessages.appendChild(div);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const el = qs("#chatTyping");
  if (el) el.remove();
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  chatSendBtn.disabled = true;
  chatInput.disabled   = true;

  // Append user message
  appendChatMsg("user", text);
  chatHistory.push({ role: "user", content: text });

  // Typing indicator
  appendTypingIndicator();

  try {
    const { ok, data } = await api("POST", "/api/chat", {
      message: text,
      history: chatHistory.slice(-10)   // send last 10 messages for context
    });

    removeTypingIndicator();

    if (ok && data.reply) {
      appendChatMsg("bot", data.reply);
      chatHistory.push({ role: "assistant", content: data.reply });
    } else {
      const errDiv = document.createElement("div");
      errDiv.className = "chat-msg chat-msg-bot chat-msg-error";
      const p = document.createElement("p");
      p.textContent = data.error || "Sorry, I could not get a response. Please try again.";
      errDiv.appendChild(p);
      chatMessages.appendChild(errDiv);
      scrollChatToBottom();
    }
  } catch {
    removeTypingIndicator();
    const errDiv = document.createElement("div");
    errDiv.className = "chat-msg chat-msg-bot chat-msg-error";
    const p = document.createElement("p");
    p.textContent = "Network error. Please check your connection and try again.";
    errDiv.appendChild(p);
    chatMessages.appendChild(errDiv);
    scrollChatToBottom();
  }

  chatSendBtn.disabled = false;
  chatInput.disabled   = false;
  chatInput.focus();
}

// ── Quick question chips ───────────────────────────────────
// Add helpful quick-start chips to the chat window after the greeting
function renderQuickChips() {
  if (qs("#chatQuickChips")) return;   // already rendered
  const chips = [
    "What courses do you offer?",
    "What is the course price?",
    "How do I enroll?",
    "What is Oracle Fusion HCM?",
    "What are the HCM modules?",
    "How do I set up Core HR?"
  ];
  const container = document.createElement("div");
  container.id = "chatQuickChips";
  container.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px;";
  chips.forEach((chip) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = chip;
    btn.style.cssText = `
      background: #eef4ff;
      color: #1f3f70;
      border: 1px solid #c7d9f9;
      border-radius: 999px;
      padding: 5px 11px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    `;
    btn.addEventListener("click", () => {
      chatInput.value = chip;
      sendChat();
      container.remove();   // remove chips after first use
    });
    container.appendChild(btn);
  });
  // Insert before the input row
  const inputRow = qs(".chat-input-row");
  chatMessages.parentElement.insertBefore(container, inputRow);
}

// Render chips on first open
chatToggleBtn.addEventListener("click", () => {
  if (chatOpen) renderQuickChips();
});

// ── Boot: check session ───────────────────────────────────
(async () => {
  const { ok, data } = await api("GET", "/api/me");
  if (ok && data.user) {
    currentUser = data.user;
    enterApp();
  }
})();
