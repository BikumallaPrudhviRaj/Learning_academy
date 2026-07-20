/* =========================================================
   Up 'N' Rise Learning Academy — Frontend App
   ========================================================= */

// ── Helpers ──────────────────────────────────────────────
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ── SearchSelect ──────────────────────────────────────────
// Wraps a native <select> with a searchable dropdown.
// The underlying <select> stays hidden and in sync so all
// existing .value reads and addEventListener("change") work.
class SearchSelect {
  constructor(selectEl) {
    this._sel  = selectEl;
    this._open = false;
    this._build();
  }

  _build() {
    const wrap = document.createElement("div");
    wrap.className = "ss-wrap";

    this._btn = document.createElement("button");
    this._btn.type = "button";
    this._btn.className = "ss-trigger";
    this._btn.setAttribute("aria-haspopup", "listbox");
    this._btn.setAttribute("aria-expanded", "false");

    this._drop = document.createElement("div");
    this._drop.className = "ss-dropdown hidden";
    this._drop.setAttribute("role", "listbox");

    this._search = document.createElement("input");
    this._search.type = "text";
    this._search.className = "ss-search";
    this._search.placeholder = "Search…";
    this._search.setAttribute("autocomplete", "off");

    this._list = document.createElement("ul");
    this._list.className = "ss-list";

    this._drop.appendChild(this._search);
    this._drop.appendChild(this._list);
    wrap.appendChild(this._btn);
    wrap.appendChild(this._drop);

    this._sel.style.display = "none";
    this._sel.insertAdjacentElement("afterend", wrap);
    this._wrap = wrap;

    this._btn.addEventListener("click", (e) => { e.stopPropagation(); this._toggle(); });
    this._search.addEventListener("input", () => this._render(this._search.value));
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) this._close(); });
    this._search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this._close();
    });

    this._syncLabel();
  }

  _toggle() { this._open ? this._close() : this._openDrop(); }

  _openDrop() {
    this._open = true;
    this._drop.classList.remove("hidden");
    this._btn.setAttribute("aria-expanded", "true");
    this._search.value = "";
    this._render("");
    this._search.focus();
  }

  _close() {
    this._open = false;
    this._drop.classList.add("hidden");
    this._btn.setAttribute("aria-expanded", "false");
  }

  _render(q) {
    const lower = q.toLowerCase();
    const opts  = Array.from(this._sel.options);
    const cur   = this._sel.value;
    this._list.innerHTML = "";
    opts
      .filter((o) => !o.value || o.text.toLowerCase().includes(lower))
      .forEach((o) => {
        const li = document.createElement("li");
        li.className = "ss-option" +
          (!o.value ? " ss-placeholder" : "") +
          (o.value === cur ? " ss-selected" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(o.value === cur));
        li.textContent = o.text;
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this._pick(o.value);
        });
        this._list.appendChild(li);
      });
  }

  _pick(value) {
    this._sel.value = value;
    this._sel.dispatchEvent(new Event("change", { bubbles: true }));
    this._syncLabel();
    this._close();
  }

  _syncLabel() {
    const cur = Array.from(this._sel.options).find((o) => o.value === this._sel.value);
    const placeholder = this._sel.options[0]?.text || "Select…";
    if (cur && cur.value) {
      this._btn.textContent = cur.text;
      this._btn.classList.add("ss-has-value");
    } else {
      this._btn.textContent = placeholder;
      this._btn.classList.remove("ss-has-value");
    }
  }

  // Called after options are rebuilt (e.g. after loadAdminData cascade)
  refresh() { this._syncLabel(); }
}

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    // Network failure (offline, DNS error, server unreachable)
    return { ok: false, status: 0, data: { error: "No internet connection. Please check your network and try again." } };
  }
  const data = await res.json().catch(() => ({
    error: res.ok ? "Unexpected server response." : `Server error (${res.status}).`
  }));
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
const tabSignin   = qs("#tabSignin");
const tabSignup   = qs("#tabSignup");

function switchTab(showLogin) {
  if (showLogin) {
    show(loginForm);  hide(signupForm);
    tabSignin.classList.add("auth-tab--active");    tabSignin.setAttribute("aria-selected","true");
    tabSignup.classList.remove("auth-tab--active"); tabSignup.setAttribute("aria-selected","false");
  } else {
    hide(loginForm);  show(signupForm);
    tabSignup.classList.add("auth-tab--active");    tabSignup.setAttribute("aria-selected","true");
    tabSignin.classList.remove("auth-tab--active"); tabSignin.setAttribute("aria-selected","false");
  }
}

tabSignin.addEventListener("click", () => switchTab(true));
tabSignup.addEventListener("click", () => switchTab(false));

// Real-time email domain check on signup form
const ALLOWED_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"];
const signupEmailInput = qs("#signupEmail");
const signupEmailHint  = qs("#signupEmailHint");

signupEmailInput.addEventListener("input", () => {
  const val    = signupEmailInput.value;
  const atIdx  = val.indexOf("@");

  if (atIdx === -1 || val.slice(atIdx + 1) === "") {
    // Nothing after @ yet — hide hint
    signupEmailHint.textContent = "";
    signupEmailHint.className = "email-domain-hint hidden";
    signupEmailInput.setCustomValidity("");
    return;
  }

  const domain = val.slice(atIdx + 1).toLowerCase();
  const ok = ALLOWED_DOMAINS.includes(domain);
  // Also allow partial matches while user is still typing (e.g. "gmail.c")
  const partial = !ok && ALLOWED_DOMAINS.some(d => d.startsWith(domain));

  if (ok) {
    signupEmailHint.textContent = "✓ Accepted";
    signupEmailHint.className = "email-domain-hint hint-ok";
    signupEmailInput.setCustomValidity("");
  } else if (partial) {
    signupEmailHint.textContent = "";
    signupEmailHint.className = "email-domain-hint hidden";
    signupEmailInput.setCustomValidity("");
  } else {
    signupEmailHint.textContent = `@${domain} is not accepted. Use Gmail, Outlook, Hotmail, or Yahoo.`;
    signupEmailHint.className = "email-domain-hint hint-error";
    signupEmailInput.setCustomValidity("Use a Gmail, Outlook, Hotmail, or Yahoo email address.");
  }
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
  const btn = loginForm.querySelector("button[type=submit]");
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Signing in…";
  const email    = loginForm.email.value.trim();
  const password = loginForm.password.value.trim();
  const { ok, data } = await api("POST", "/api/login", { email, password });
  btn.disabled = false;
  btn.textContent = orig;
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
  const btn = signupForm.querySelector("button[type=submit]");
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Creating account…";
  const name     = signupForm.name.value.trim();
  const email    = signupForm.email.value.trim();
  const mobile   = signupForm.mobile.value.trim();
  const password = signupForm.password.value.trim();
  const { ok, data } = await api("POST", "/api/register", { name, email, mobile, password });
  btn.disabled = false;
  btn.textContent = orig;
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
  window.location.href = "/";
});

// ── Profile modal ─────────────────────────────────────────
const profileOverlay  = qs("#profileOverlay");
const profileCloseBtn = qs("#profileCloseBtn");

function openProfileModal() {
  // Close the dropdown first
  userDropdown.classList.add("hidden");
  userMenuButton.setAttribute("aria-expanded", "false");

  // Populate fields from currentUser
  const initials = currentUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  qs("#profileInitials").textContent      = initials;
  qs("#profileName").textContent          = currentUser.name;
  qs("#profileEmail").textContent         = currentUser.email;
  qs("#profileInfoName").textContent      = currentUser.name;
  qs("#profileInfoEmail").textContent     = currentUser.email;
  qs("#profileInfoMobile").textContent    = currentUser.mobile || "—";
  qs("#profileInfoRole").textContent      = currentUser.isAdmin ? "Admin" : "Student";

  // Reset the password form
  qs("#changePasswordForm").reset();
  qs("#changePasswordMessage").textContent = "";

  show(profileOverlay);
  document.body.style.overflow = "hidden";
}

function closeProfileModal() {
  hide(profileOverlay);
  document.body.style.overflow = "";
}

qs("#viewProfileButton").addEventListener("click", openProfileModal);
profileCloseBtn.addEventListener("click", closeProfileModal);
profileOverlay.addEventListener("click", (e) => {
  if (e.target === profileOverlay) closeProfileModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !profileOverlay.classList.contains("hidden")) closeProfileModal();
});

// Reuse the show-password toggle for the profile form inputs
qs("#changePasswordForm").addEventListener("change", (e) => {
  if (!e.target.classList.contains("show-password-toggle")) return;
  const show = e.target.checked;
  ["#cpCurrent", "#cpNew", "#cpConfirm"].forEach((sel) => {
    qs(sel).type = show ? "text" : "password";
  });
});

qs("#changePasswordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = qs("#changePasswordMessage");
  const current = qs("#cpCurrent").value;
  const np      = qs("#cpNew").value;
  const confirm = qs("#cpConfirm").value;

  msgEl.style.color = "var(--red)";
  if (!current || !np || !confirm) {
    msgEl.textContent = "Please fill in all three fields.";
    return;
  }
  if (np !== confirm) {
    msgEl.textContent = "New passwords don't match.";
    return;
  }
  if (np.length < 6) {
    msgEl.textContent = "New password must be at least 6 characters.";
    return;
  }

  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const { ok, data } = await api("PATCH", "/api/me", {
    currentPassword: current,
    newPassword: np
  });

  btn.disabled = false;
  btn.textContent = "Update Password";

  if (!ok) {
    msgEl.textContent = data.error || "Could not update password.";
    return;
  }

  // Update local user object and UI
  currentUser = data.user;
  updateUserDisplay();
  qs("#changePasswordForm").reset();
  msgEl.style.color = "var(--green)";
  msgEl.textContent = "Password updated successfully.";
});

// ── Analytics ─────────────────────────────────────────────
let _sessionStart = null;

function track(type, payload = {}) {
  // Fire-and-forget; never block the UI
  api("POST", "/api/analytics/event", { type, payload }).catch(() => {});
}

// ── App entry ─────────────────────────────────────────────
function enterApp() {
  hide(loginView);
  show(appView);
  updateUserDisplay();
  loadCatalog();

  // Session start — record timestamp for duration tracking
  _sessionStart = Date.now();
  track("session_start");

  // Always reset admin UI to hidden first, then show only for admins
  const adminTab  = qs("#adminTab");
  const adminView = qs("#adminView");
  hide(adminView);
  const analyticsTab = qs("#analyticsTab");
  if (currentUser && currentUser.isAdmin) {
    show(adminTab);
    show(analyticsTab);
    loadAdminData();
  } else {
    hide(adminTab);
    hide(analyticsTab);
  }
}

// Send session_end with duration when tab/window closes
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && _sessionStart && currentUser) {
    const duration = Math.round((Date.now() - _sessionStart) / 1000);
    // Use sendBeacon for reliability on page unload
    const body = JSON.stringify({ type: "session_end", payload: { duration } });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/event", new Blob([body], { type: "application/json" }));
    } else {
      track("session_end", { duration });
    }
  }
});

// Track WA / Instagram link clicks anywhere in the document
document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a || !currentUser) return;
  if (a.href && a.href.includes("wa.me"))          track("whatsapp_click");
  if (a.href && a.href.includes("instagram") || (a.href && a.href.includes("tinywebs.site")))
    track("instagram_click");
});

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
  qs("#analyticsTab").classList.remove("active");
  hide(qs("#catalogView"));
  hide(qs("#courseDetailView"));
  hide(qs("#analyticsView"));
  show(qs("#adminView"));
  // Clear all stale success/error messages in the admin panel
  qsa(".message", qs("#adminView")).forEach((el) => { el.textContent = ""; });
});

qs("#analyticsTab").addEventListener("click", () => {
  qs("#analyticsTab").classList.add("active");
  qs("#adminTab").classList.remove("active");
  qs("#catalogTab").classList.remove("active");
  hide(qs("#catalogView"));
  hide(qs("#courseDetailView"));
  hide(qs("#adminView"));
  show(qs("#analyticsView"));
  loadAnalytics();
});

// ── Analytics dashboard ───────────────────────────────────
let _analyticsTab = "overview"; // track which sub-tab is active

async function loadAnalytics() {
  if (!currentUser?.isAdmin) return;   // never expose analytics to non-admins
  const inner = qs("#analyticsInner");
  inner.innerHTML = `<p style="padding:20px;color:var(--muted)">Loading…</p>`;

  const { ok, data } = await api("GET", "/api/admin/analytics");
  if (!ok) {
    inner.innerHTML = `<p style="padding:20px;color:var(--red)">Could not load analytics.</p>`;
    return;
  }

  const {
    users, activeUsers, recentSignups, paidStudentList, enrollByCourse,
    dailySignups, videos, events30, sessions, topKeywords,
    recentChats, dailyEvents, topCourses, qa
  } = data;

  // ── helpers ──────────────────────────────────────────────
  function fmtDur(secs) {
    if (secs == null) return "—";
    const m = Math.floor(secs / 60), s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  function fmtDate(d) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function sparkBar(items, keyVal, keyLabel, colorVar = "var(--blue)", maxLabelWidth = "100px") {
    if (!items || !items.length) return `<p class="an-empty">No data yet.</p>`;
    const max = Math.max(...items.map((i) => i[keyVal]), 1);
    return `<div class="an-bar-list">
      ${items.map((item) => `
        <div class="an-bar-row" style="grid-template-columns:${maxLabelWidth} 1fr 36px">
          <span class="an-bar-label" title="${escHtml(item[keyLabel])}">${escHtml(item[keyLabel])}</span>
          <div class="an-bar-track">
            <div class="an-bar-fill" style="width:${Math.round((item[keyVal] / max) * 100)}%;background:${colorVar}"></div>
          </div>
          <span class="an-bar-val">${item[keyVal]}</span>
        </div>
      `).join("")}
    </div>`;
  }

  // ── Sub-tab renderer ──────────────────────────────────────
  function renderOverview() {
    // Daily signups chart
    const signupsChart = dailySignups.length
      ? sparkBar(dailySignups.map((d) => ({ label: fmtDate(d.date), count: d.count })), "count", "label", "var(--blue)", "72px")
      : `<p class="an-empty">No signups in the last 30 days.</p>`;

    // Videos watched per user
    const videoChart = videos.watchByUser.length
      ? sparkBar(videos.watchByUser.map((u) => ({ label: u.name, count: u.watched })), "count", "label", "var(--green)", "110px")
      : `<p class="an-empty">No progress recorded yet.</p>`;

    // Top courses by views
    const courseChart = topCourses.length
      ? sparkBar(topCourses.map((c) => ({ label: c.title || c.courseId, count: c.views })), "count", "label", "var(--blue)", "120px")
      : `<p class="an-empty">No course views tracked yet.</p>`;

    // Daily engagement table — always shows 7 rows
    const engRows = dailyEvents.map((d) => `
      <tr>
        <td>${fmtDate(d.date)}</td>
        <td class="an-td-num">${d.login}</td>
        <td class="an-td-num">${d.video}</td>
        <td class="an-td-num">${d.courseView}</td>
        <td class="an-td-num">${d.chat}</td>
        <td class="an-td-num">${d.wa}</td>
        <td class="an-td-num">${d.insta}</td>
      </tr>
    `).join("");

    return `
      <!-- ── Top KPI cards ── -->
      <div class="an-cards">
        <div class="an-card an-card-blue">
          <p class="an-card-label">Total Users</p>
          <p class="an-card-val">${users.totalUsers}</p>
          <p class="an-card-sub">${users.adminCount} admin${users.adminCount !== 1 ? "s" : ""}</p>
        </div>
        <div class="an-card an-card-green">
          <p class="an-card-label">Paid Students</p>
          <p class="an-card-val">${users.paidUsers}</p>
          <p class="an-card-sub">enrolled &amp; active</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Free / Demo</p>
          <p class="an-card-val">${users.freeUsers}</p>
          <p class="an-card-sub">not yet enrolled</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Active (7d)</p>
          <p class="an-card-val">${activeUsers.last7}</p>
          <p class="an-card-sub">unique users visited</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Active (30d)</p>
          <p class="an-card-val">${activeUsers.last30}</p>
          <p class="an-card-sub">unique users visited</p>
        </div>
        <div class="an-card an-card-green">
          <p class="an-card-label">Videos Watched</p>
          <p class="an-card-val">${videos.totalWatched}</p>
          <p class="an-card-sub">all paid students</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Avg Session</p>
          <p class="an-card-val">${fmtDur(sessions.avgSeconds)}</p>
          <p class="an-card-sub">per visit (30d)</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Longest Session</p>
          <p class="an-card-val">${fmtDur(sessions.maxSeconds)}</p>
          <p class="an-card-sub">single visit</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Total Time</p>
          <p class="an-card-val">${sessions.totalMinutes || 0}<span style="font-size:16px;font-weight:600"> m</span></p>
          <p class="an-card-sub">across all sessions (30d)</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">WhatsApp Clicks</p>
          <p class="an-card-val">${events30.waClicks}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Instagram Clicks</p>
          <p class="an-card-val">${events30.instaClicks}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Chatbot Opens</p>
          <p class="an-card-val">${events30.chatbotOpens}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Chat Queries</p>
          <p class="an-card-val">${events30.chatQueries}</p>
          <p class="an-card-sub">questions asked</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Video Plays</p>
          <p class="an-card-val">${events30.videoPlays}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Course Views</p>
          <p class="an-card-val">${events30.courseViews}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
      </div>

      <!-- ── Charts row ── -->
      <div class="an-grid-2">
        <div class="an-section">
          <h3 class="an-section-title">Daily Signups <span class="an-section-badge">30 days</span></h3>
          ${signupsChart}
        </div>
        <div class="an-section">
          <h3 class="an-section-title">Videos Watched per Student <span class="an-section-badge">paid · top 15</span></h3>
          ${videoChart}
        </div>
      </div>

      <!-- ── Daily engagement table ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Daily Engagement <span class="an-section-badge">last 7 days</span></h3>
        <div class="an-table-wrap">
          <table class="an-table">
            <thead>
              <tr>
                <th>Date</th><th>Logins</th><th>Video Plays</th>
                <th>Course Views</th><th>Chat Queries</th>
                <th>WA Clicks</th><th>Insta Clicks</th>
              </tr>
            </thead>
            <tbody>${engRows}</tbody>
          </table>
        </div>
      </div>

      <!-- ── Top courses ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Most Viewed Courses <span class="an-section-badge">30 days</span></h3>
        ${courseChart}
      </div>
    `;
  }

  function renderUsers() {
    // Recent signups table
    const recentRows = recentSignups.length
      ? recentSignups.map((u) => `
          <tr>
            <td>${escHtml(u.name)}</td>
            <td>${escHtml(u.email)}</td>
            <td>${escHtml(u.mobile)}</td>
            <td>${u.isPaid
              ? `<span class="an-badge an-badge-green">Paid</span>`
              : `<span class="an-badge an-badge-gray">Free</span>`
            }</td>
            <td>${fmtDateTime(u.createdAt)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" style="color:var(--muted)">No new signups in the last 30 days.</td></tr>`;

    // Paid students table
    const paidRows = paidStudentList.length
      ? paidStudentList.map((u) => `
          <tr>
            <td>${escHtml(u.name)}</td>
            <td>${escHtml(u.email)}</td>
            <td>${escHtml(u.mobile)}</td>
            <td><span class="an-course-pill">${escHtml(u.courseId)}</span></td>
          </tr>
        `).join("")
      : `<tr><td colspan="4" style="color:var(--muted)">No paid enrollments yet.</td></tr>`;

    // Enrollments per course bar chart
    const enrolItems = Object.entries(enrollByCourse)
      .sort(([,a],[,b]) => b - a)
      .map(([courseId, count]) => ({ label: courseId, count }));
    const enrolChart = enrolItems.length
      ? sparkBar(enrolItems, "count", "label", "var(--green)", "140px")
      : `<p class="an-empty">No enrollments yet.</p>`;

    return `
      <!-- ── User summary cards ── -->
      <div class="an-cards">
        <div class="an-card an-card-blue">
          <p class="an-card-label">Total Registered</p>
          <p class="an-card-val">${users.totalUsers}</p>
        </div>
        <div class="an-card an-card-green">
          <p class="an-card-label">Paid Students</p>
          <p class="an-card-val">${users.paidUsers}</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Free / Demo</p>
          <p class="an-card-val">${users.freeUsers}</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">New This Month</p>
          <p class="an-card-val">${recentSignups.length}</p>
        </div>
      </div>

      <!-- ── Enrollments per course ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Enrollments per Course</h3>
        ${enrolChart}
      </div>

      <!-- ── Recent signups ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Recent Signups <span class="an-section-badge">last 30 days · newest first</span></h3>
        <div class="an-table-wrap">
          <table class="an-table">
            <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      </div>

      <!-- ── All paid students ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">All Paid Students <span class="an-section-badge">${paidStudentList.length} total</span></h3>
        <div class="an-table-wrap">
          <table class="an-table">
            <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Course</th></tr></thead>
            <tbody>${paidRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderEngagement() {
    // Top videos bar chart
    const topVideoChart = videos.topVideos && videos.topVideos.length
      ? sparkBar(videos.topVideos.map((v) => ({ label: v.title || v.videoId, count: v.count })), "count", "label", "var(--blue)", "150px")
      : `<p class="an-empty">No video play events tracked yet.</p>`;

    // Keyword cloud
    const maxKwCount = topKeywords.length ? topKeywords[0].count : 1;
    const keywordCloud = topKeywords.length
      ? `<div class="an-keyword-cloud">${topKeywords.map((kw) => {
          const sz = 11 + Math.round((kw.count / maxKwCount) * 14);
          return `<span class="an-keyword" style="font-size:${sz}px">${escHtml(kw.word)}<em>${kw.count}</em></span>`;
        }).join("")}</div>`
      : `<p class="an-empty">No chat queries yet.</p>`;

    // Recent chat queries table
    const chatRows = recentChats.length
      ? recentChats.map((c) => `
          <tr>
            <td class="an-td-query">${escHtml(c.query)}</td>
            <td>${escHtml(c.userName)}</td>
            <td style="white-space:nowrap">${fmtDateTime(c.ts)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3" style="color:var(--muted)">No queries yet.</td></tr>`;

    // Q&A top-liked table
    const qaTopLikedRows = qa?.topLiked?.length
      ? qa.topLiked.map((q) => `
          <tr>
            <td class="an-td-query">${escHtml(q.text)}</td>
            <td>${escHtml(q.userName)}</td>
            <td style="color:var(--muted);font-size:12px">${escHtml(q.videoId)}</td>
            <td><span class="an-badge an-badge-blue">♥ ${q.likeCount}</span></td>
          </tr>
        `).join("")
      : `<tr><td colspan="4" style="color:var(--muted)">No likes yet — students haven't liked any posts.</td></tr>`;

    // Q&A most-active videos bar chart
    const qaVideoChart = qa?.topQaVideos?.length
      ? sparkBar(qa.topQaVideos.map((v) => ({ label: v.videoId, count: v.count })), "count", "label", "var(--blue)", "120px")
      : `<p class="an-empty">No discussion posts yet.</p>`;

    return `
      <!-- ── Engagement KPIs ── -->
      <div class="an-cards">
        <div class="an-card">
          <p class="an-card-label">Chatbot Opens</p>
          <p class="an-card-val">${events30.chatbotOpens}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card an-card-green">
          <p class="an-card-label">Chat Queries</p>
          <p class="an-card-val">${events30.chatQueries}</p>
          <p class="an-card-sub">questions asked</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Unique Keywords</p>
          <p class="an-card-val">${topKeywords.length}</p>
          <p class="an-card-sub">distinct topics found</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">WhatsApp Clicks</p>
          <p class="an-card-val">${events30.waClicks}</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Instagram Clicks</p>
          <p class="an-card-val">${events30.instaClicks}</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">Video Plays</p>
          <p class="an-card-val">${events30.videoPlays}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
        <div class="an-card an-card-blue">
          <p class="an-card-label">Discussion Posts</p>
          <p class="an-card-val">${qa?.total ?? 0}</p>
          <p class="an-card-sub">all time</p>
        </div>
        <div class="an-card">
          <p class="an-card-label">New Posts</p>
          <p class="an-card-val">${qa?.last30 ?? 0}</p>
          <p class="an-card-sub">last 30 days</p>
        </div>
      </div>

      <!-- ── Top videos ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Most Played Videos <span class="an-section-badge">top 10 · 30 days</span></h3>
        ${topVideoChart}
      </div>

      <!-- ── Keyword cloud ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Chatbot Keywords <span class="an-section-badge">top 25 · 30 days</span></h3>
        ${keywordCloud}
      </div>

      <!-- ── Recent chat queries ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Recent Chat Queries <span class="an-section-badge">last 20</span></h3>
        <div class="an-table-wrap">
          <table class="an-table">
            <thead><tr><th>Question</th><th>User</th><th>Time</th></tr></thead>
            <tbody>${chatRows}</tbody>
          </table>
        </div>
      </div>

      <!-- ── Q&A: most discussed videos ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Most Discussed Videos <span class="an-section-badge">by post count · all time</span></h3>
        ${qaVideoChart}
      </div>

      <!-- ── Q&A: top liked questions ── -->
      <div class="an-section an-section-full">
        <h3 class="an-section-title">Top Liked Questions <span class="an-section-badge">most ♥ · all time</span></h3>
        <div class="an-table-wrap">
          <table class="an-table">
            <thead><tr><th>Question</th><th>Posted by</th><th>Video</th><th>Likes</th></tr></thead>
            <tbody>${qaTopLikedRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Shell with sub-tab nav ────────────────────────────────
  function renderShell(tabId) {
    let content = "";
    if (tabId === "overview")    content = renderOverview();
    else if (tabId === "users")  content = renderUsers();
    else if (tabId === "engage") content = renderEngagement();

    return `
      <div class="an-header">
        <div class="an-title-row">
          <div>
            <h2 class="an-title">Analytics Dashboard</h2>
            <p class="an-subtitle">Last 30 days unless noted · Admin only</p>
          </div>
          <button class="an-refresh-btn" id="anRefreshBtn" type="button">↻ Refresh</button>
        </div>
        <nav class="an-tabs" role="tablist">
          <button class="an-tab${tabId === "overview" ? " an-tab-active" : ""}" data-tab="overview" type="button" role="tab">Overview</button>
          <button class="an-tab${tabId === "users" ? " an-tab-active" : ""}" data-tab="users" type="button" role="tab">Users</button>
          <button class="an-tab${tabId === "engage" ? " an-tab-active" : ""}" data-tab="engage" type="button" role="tab">Engagement</button>
        </nav>
      </div>
      <div class="an-tab-content" id="anTabContent">
        ${content}
      </div>
    `;
  }

  inner.innerHTML = renderShell(_analyticsTab);

  // Bind sub-tab clicks (re-render only the content area)
  qsa(".an-tab", inner).forEach((btn) => {
    btn.addEventListener("click", () => {
      _analyticsTab = btn.dataset.tab;
      qsa(".an-tab", inner).forEach((b) => b.classList.remove("an-tab-active"));
      btn.classList.add("an-tab-active");
      qs("#anTabContent", inner).innerHTML =
        _analyticsTab === "overview" ? renderOverview() :
        _analyticsTab === "users"    ? renderUsers()    :
                                       renderEngagement();
    });
  });

  // Refresh button
  qs("#anRefreshBtn", inner).addEventListener("click", loadAnalytics);
}

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
  // Pre-load progress for all enrolled courses so cards show % immediately
  const enrolledCourses = allCourses.filter((c) => c.paid);
  if (enrolledCourses.length) {
    await Promise.all(enrolledCourses.map((c) => loadCourseProgress(c.id)));
    renderCourseGrid(); // re-render with progress data
  }
}

// courseProgress[courseId] = { watched: Set, lastWatched: {videoId, videoTitle, at} }
const courseProgress = {};

function renderCourseGrid() {
  const grid = qs("#courseGrid");
  grid.innerHTML = allCourses.map((c) => {
    const prog = courseProgress[c.id];
    const totalVideos = c.totalVideos || 0;
    const watchedCount = prog ? prog.watched.size : 0;
    const pct = totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0;
    const showProgress = c.paid && totalVideos > 0;

    return `
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
      ${showProgress ? `
        <div class="card-progress">
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="card-progress-label">${pct}% complete${prog && prog.lastWatched ? ` · Last: ${prog.lastWatched.videoTitle}` : ""}</span>
        </div>
      ` : ""}
      <div class="card-actions">
        <button type="button" onclick="openCourseDetail('${c.id}')">
          ${c.paid && prog && prog.lastWatched ? "Continue Learning" : "View Course"}
        </button>
      </div>
    </div>
  `;
  }).join("");
}

async function loadCourseProgress(courseId) {
  const { ok, data } = await api("GET", `/api/progress/${courseId}`);
  if (!ok) return;
  courseProgress[courseId] = {
    watched: new Set(data.watched || []),
    lastWatched: data.lastWatched || null
  };
}

async function markVideoWatched(courseId, videoId) {
  if (!courseProgress[courseId]) courseProgress[courseId] = { watched: new Set(), lastWatched: null };
  if (courseProgress[courseId].watched.has(videoId)) return; // already tracked
  await api("POST", `/api/progress/${courseId}/${videoId}`);
  // Refresh progress from server so lastWatched title is accurate
  await loadCourseProgress(courseId);
  // Re-render card grid so % updates live
  renderCourseGrid();
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
      <div class="contact-wa-row">
        <dt>WhatsApp</dt>
        <dd>
          <a class="wa-contact-btn" href="https://wa.me/message/SIRQKFLMGZSHA1" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.643 4.81 1.77 6.833L2 30l7.374-1.744A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 2c6.627 0 12 5.373 12 12s-5.373 12-12 12a11.93 11.93 0 0 1-6.07-1.656l-.434-.266-4.374 1.033.997-4.28-.29-.458A11.93 11.93 0 0 1 4 16C4 9.373 9.373 4 16 4zm-2.434 5.5c-.279 0-.73.104-1.113.52-.382.416-1.461 1.428-1.461 3.482 0 2.054 1.496 4.04 1.703 4.322.208.28 2.896 4.573 7.123 6.228 1.006.392 1.793.626 2.406.8.974.279 1.86.24 2.562.145.781-.105 2.408-.984 2.748-1.935.34-.951.34-1.766.238-1.936-.1-.169-.37-.27-.774-.47-.403-.2-2.385-1.178-2.754-1.312-.37-.134-.639-.2-.908.2-.27.4-1.046 1.312-1.282 1.581-.236.269-.472.304-.875.104-.403-.2-1.703-.628-3.245-2.003-1.2-1.07-2.01-2.39-2.245-2.79-.236-.4-.025-.617.177-.816.18-.18.403-.47.605-.706.2-.234.267-.4.4-.668.134-.268.067-.503-.034-.703-.1-.2-.907-2.188-1.242-2.994-.327-.786-.66-.679-.908-.692l-.773-.013z"/></svg>
            Message us on WhatsApp
          </a>
        </dd>
      </div>
      <div><dt>Email</dt><dd><a href="mailto:${contactInfo.email}">${contactInfo.email}</a></dd></div>
      <div class="contact-insta-row">
        <dt>Instagram</dt>
        <dd>
          <a class="insta-contact-btn" href="https://tinywebs.site/EedIBE" target="_blank" rel="noopener noreferrer">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="24" height="24" rx="6" fill="url(#ig-grad2)"/><circle cx="12" cy="12" r="4.5" stroke="#fff" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="#fff"/><defs><linearGradient id="ig-grad2" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f9ce34"/><stop offset="35%" stop-color="#ee2a7b"/><stop offset="100%" stop-color="#6228d7"/></linearGradient></defs></svg>
            Watch success stories
          </a>
        </dd>
      </div>
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
  // title will be filled in after we load the course, but fire now for timing accuracy
  track("course_view", { courseId });

  const [courseRes, _] = await Promise.all([
    api("GET", `/api/courses/${courseId}`),
    loadCourseProgress(courseId)
  ]);

  if (!courseRes.ok) {
    detailView.innerHTML = "<p style='padding:20px;color:var(--red)'>Could not load course.</p>";
    return;
  }

  const { course, chapters } = courseRes.data;
  const prog = courseProgress[courseId] || { watched: new Set(), lastWatched: null };

  // Count total accessible videos for progress calculation
  const accessibleVideos = chapters.filter((ch) => !ch.locked).flatMap((ch) => ch.videos);
  const totalVideos = accessibleVideos.length;
  const watchedCount = accessibleVideos.filter((v) => prog.watched.has(v.id)).length;
  const pct = totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0;

  const chaptersHtml = chapters.map((ch) => {
    const videosHtml = ch.locked
      ? `<p class="locked-message">🔒 Unlock by enrolling in this course.</p>`
      : `<div class="video-grid">
          ${ch.videos.map((v) => {
            const watched = course.paid && prog.watched.has(v.id);
            return `
              <button class="video-link${watched ? " video-watched" : ""}" type="button"
                 onclick="openVideoPlayer('${courseId}', '${v.id}')">
                <span class="video-watch-icon">${watched ? "✓" : "▶"}</span>
                ${v.title}
                ${ch.isFree ? '<span class="free-badge">Free</span>' : ""}
              </button>
            `;
          }).join("")}
        </div>`;

    const chapterVideos = ch.locked ? [] : ch.videos;
    const chapterWatched = chapterVideos.filter((v) => prog.watched.has(v.id)).length;
    const chapterTotal = chapterVideos.length;
    const chapterPct = chapterTotal > 0 ? Math.round((chapterWatched / chapterTotal) * 100) : 0;

    return `
      <div class="chapter-block">
        <button class="chapter-header" type="button" onclick="toggleChapter(this)">
          <span class="chapter-title">${ch.title}</span>
          <div class="chapter-header-right">
            ${!ch.locked && chapterTotal > 0 ? `<span class="chapter-count">${chapterWatched}/${chapterTotal}</span>` : ""}
            <span class="chapter-arrow">▼</span>
          </div>
        </button>
        <div class="chapter-videos${ch.isFree ? "" : " hidden"}">
          ${videosHtml}
        </div>
      </div>
    `;
  }).join("");

  // Resume banner: last-watched video that student can jump back to
  const resumeBanner = course.paid && prog.lastWatched ? `
    <div class="resume-banner">
      <div class="resume-banner-left">
        <span class="resume-icon">▶</span>
        <div>
          <p class="resume-label">Continue where you left off</p>
          <p class="resume-video">${prog.lastWatched.videoTitle}</p>
        </div>
      </div>
      <button class="resume-btn" type="button"
         onclick="openVideoPlayer('${courseId}', '${prog.lastWatched.videoId}')">
        Resume →
      </button>
    </div>
  ` : "";

  // Progress bar shown for enrolled students
  const progressSection = course.paid && totalVideos > 0 ? `
    <div class="detail-progress">
      <div class="detail-progress-header">
        <span class="detail-progress-label">Your progress</span>
        <span class="detail-progress-pct">${pct}%</span>
      </div>
      <div class="detail-progress-track">
        <div class="detail-progress-fill" style="width:${pct}%"></div>
      </div>
      <p class="detail-progress-sub">${watchedCount} of ${totalVideos} videos watched${pct === 100 ? " · 🎉 Course complete!" : ""}</p>
    </div>
  ` : "";

  detailView.innerHTML = `
    <button class="back-button" type="button" onclick="closeCourseDetail()" style="width:auto;margin-bottom:20px;padding:10px 18px">← Back to Courses</button>
    ${resumeBanner}
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
          ? `<p style="color:var(--green);font-weight:700">You have full access to all videos.</p>${progressSection}`
          : `<p class="payment-note">Pay via QR code to enroll. Your access will be activated within 24 hours after payment confirmation.</p>
             ${course.qrImage ? `<img class="qr" src="${course.qrImage}" alt="Payment QR code">` : ""}
             <p class="payment-note" style="font-size:13px">After payment, send us your screenshot via <a class="wa-inline-link" href="https://wa.me/message/SIRQKFLMGZSHA1" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;margin-right:2px"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.643 4.81 1.77 6.833L2 30l7.374-1.744A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 2c6.627 0 12 5.373 12 12s-5.373 12-12 12a11.93 11.93 0 0 1-6.07-1.656l-.434-.266-4.374 1.033.997-4.28-.29-.458A11.93 11.93 0 0 1 4 16C4 9.373 9.373 4 16 4zm-2.434 5.5c-.279 0-.73.104-1.113.52-.382.416-1.461 1.428-1.461 3.482 0 2.054 1.496 4.04 1.703 4.322.208.28 2.896 4.573 7.123 6.228 1.006.392 1.793.626 2.406.8.974.279 1.86.24 2.562.145.781-.105 2.408-.984 2.748-1.935.34-.951.34-1.766.238-1.936-.1-.169-.37-.27-.774-.47-.403-.2-2.385-1.178-2.754-1.312-.37-.134-.639-.2-.908.2-.27.4-1.046 1.312-1.282 1.581-.236.269-.472.304-.875.104-.403-.2-1.703-.628-3.245-2.003-1.2-1.07-2.01-2.39-2.245-2.79-.236-.4-.025-.617.177-.816.18-.18.403-.47.605-.706.2-.234.267-.4.4-.668.134-.268.067-.503-.034-.703-.1-.2-.907-2.188-1.242-2.994-.327-.786-.66-.679-.908-.692l-.773-.013z"/></svg>WhatsApp</a> or email us at <strong>${contactInfo.email || ""}</strong>.</p>`
        }
      </div>
    </div>
    <div class="video-section">
      <div class="chapter-search-row">
        <h3>Course Chapters</h3>
        <div class="chapter-search-wrap">
          <svg class="chapter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="chapterSearchInput" class="chapter-search-input" type="search" placeholder="Search chapters or lessons…" autocomplete="off" aria-label="Search chapters and lessons">
          <button id="chapterSearchClear" class="chapter-search-clear hidden" type="button" aria-label="Clear search">×</button>
        </div>
      </div>
      <p id="chapterSearchEmpty" class="chapter-search-empty hidden">No chapters or lessons match "<span id="chapterSearchTerm"></span>".</p>
      <div class="chapters-container">${chaptersHtml}</div>
    </div>
  `;

  // Wire up the search box now that the DOM is in place
  initChapterSearch();
}

// Chapter search — wired up after each course detail render
function initChapterSearch() {
  const input      = qs("#chapterSearchInput");
  const clearBtn   = qs("#chapterSearchClear");
  const emptyMsg   = qs("#chapterSearchEmpty");
  const termSpan   = qs("#chapterSearchTerm");
  const container  = qs(".chapters-container");
  if (!input || !container) return;

  function applyFilter(q) {
    const raw = q.trim().toLowerCase();
    termSpan.textContent = q.trim();
    clearBtn.classList.toggle("hidden", !raw);

    // Each .chapter-block contains one chapter
    const blocks = [...container.querySelectorAll(".chapter-block")];
    let anyVisible = false;

    blocks.forEach((block) => {
      const chapterTitle = block.querySelector(".chapter-title").textContent.toLowerCase();
      const videoEls     = [...block.querySelectorAll(".video-link")];
      const videosPanel  = block.querySelector(".chapter-videos");
      const arrow        = block.querySelector(".chapter-arrow");

      if (!raw) {
        // Reset: show all chapters, collapse all except isFree (which was already open)
        block.classList.remove("hidden");
        videoEls.forEach((v) => v.classList.remove("hidden"));
        // Restore default collapsed state — only chapter-1 open (has no "hidden" class originally)
        const wasOpen = !videosPanel.dataset.collapsed;
        // We track original open state via a data attr set on first filter
        if (videosPanel.dataset.defaultOpen === "true") {
          videosPanel.classList.remove("hidden");
          if (arrow) arrow.textContent = "▲";
        } else {
          videosPanel.classList.add("hidden");
          if (arrow) arrow.textContent = "▼";
        }
        anyVisible = true;
        return;
      }

      const chapterMatches = chapterTitle.includes(raw);
      // Check each video for a match
      let anyVideoMatch = false;
      videoEls.forEach((v) => {
        const videoTitle = v.textContent.trim().toLowerCase();
        const videoMatch = videoTitle.includes(raw);
        v.classList.toggle("hidden", !videoMatch && !chapterMatches);
        if (videoMatch) anyVideoMatch = true;
      });

      const show = chapterMatches || anyVideoMatch;
      block.classList.toggle("hidden", !show);

      if (show) {
        anyVisible = true;
        // Expand matched chapter so videos are visible
        videosPanel.classList.remove("hidden");
        if (arrow) arrow.textContent = "▲";
      }
    });

    emptyMsg.classList.toggle("hidden", anyVisible || !raw);
  }

  // Record each chapter's default open/closed state before any filtering
  container.querySelectorAll(".chapter-block").forEach((block) => {
    const panel = block.querySelector(".chapter-videos");
    panel.dataset.defaultOpen = panel.classList.contains("hidden") ? "false" : "true";
  });

  input.addEventListener("input", () => applyFilter(input.value));
  clearBtn.addEventListener("click", () => {
    input.value = "";
    input.focus();
    applyFilter("");
  });
}

function closeCourseDetail() {
  hide(qs("#courseDetailView"));
  show(qs("#catalogView"));
  renderCourseGrid(); // reflect any progress changes made while inside detail view
}

function toggleChapter(btn) {
  const videos = btn.nextElementSibling;
  const arrow  = btn.querySelector(".chapter-arrow");
  const open   = !videos.classList.contains("hidden");
  videos.classList.toggle("hidden", open);
  arrow.textContent = open ? "▼" : "▲";
}

// ── Video Player ──────────────────────────────────────────
// Tracks which course the player was opened from so Back returns to it
let _playerCourseId = null;

async function openVideoPlayer(courseId, videoId) {
  _playerCourseId = courseId;
  // courseTitle and videoTitle added after load; fire with what we have now
  track("video_play", { courseId, videoId });
  const playerView  = qs("#videoPlayerView");
  const detailView  = qs("#courseDetailView");
  const catalogView = qs("#catalogView");

  // Show loading state inside the player section
  playerView.innerHTML = `
    <div class="vp-loading">
      <div class="vp-spinner"></div>
      <p>Loading video…</p>
    </div>`;
  hide(detailView);
  hide(catalogView);
  show(playerView);

  const { ok, data } = await api("GET", `/api/courses/${courseId}/watch/${videoId}`);
  if (!ok) {
    playerView.innerHTML = `<p style="padding:24px;color:var(--red)">${data?.error || "Could not load video."}</p>`;
    return;
  }

  const { video, prev, next } = data;

  // Mark watched only for paid content (fire-and-forget)
  if (!video.isFree && courseId === _playerCourseId) markVideoWatched(courseId, videoId);

  // Fetch prior quiz result for badge (paid non-free only, fire-and-forget)
  let priorResult = null;
  if (!video.isFree && currentUser) {
    const qr = await api("GET", `/api/quiz/result/${courseId}/${videoId}`);
    if (qr.ok) priorResult = qr.data.result;
  }

  // Quiz badge: show best score if already attempted
  const quizBadge = priorResult
    ? `<span class="vp-quiz-badge ${priorResult.passed ? "vp-quiz-badge-pass" : "vp-quiz-badge-fail"}">
         Quiz: ${priorResult.bestScore}% ${priorResult.passed ? "✓" : ""}
       </span>`
    : "";

  // Quiz CTA — only for paid non-free videos
  const quizCta = !video.isFree
    ? `<button class="vp-quiz-btn" type="button"
         onclick="openQuiz('${courseId}','${videoId}','${video.title.replace(/'/g, "\\'")}','${video.chapterTitle.replace(/'/g, "\\'")}')">
         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
         ${priorResult ? "Retake Quiz" : "Take AI Quiz"}
       </button>`
    : "";

  const qaSectionHtml = !video.isFree ? `
    <div class="qa-section" id="qaSection">
      <div class="qa-header">
        <h3 class="qa-heading">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Discussion
        </h3>
        <span class="qa-count" id="qaCount"></span>
      </div>
      <div id="qaList" class="qa-list">
        <p class="qa-loading">Loading discussion…</p>
      </div>
      <form class="qa-form" id="qaForm" autocomplete="off">
        <textarea id="qaInput" class="qa-input" placeholder="Ask a question or share an insight about this lesson…" rows="2" maxlength="2000"></textarea>
        <div class="qa-form-footer">
          <span class="qa-char-count" id="qaCharCount">0 / 2000</span>
          <button type="submit" class="qa-submit-btn">Post</button>
        </div>
        <p id="qaFormMsg" class="qa-form-msg"></p>
      </form>
    </div>
  ` : "";

  // Next-video end-card HTML (only when there IS a next video)
  const nextCardHtml = next ? `
    <div class="vp-endcard hidden" id="vpEndCard">
      <div class="vp-endcard-inner">
        <p class="vp-endcard-label">Up next</p>
        <p class="vp-endcard-chapter">${next.chapterTitle}</p>
        <p class="vp-endcard-title">${next.title}</p>
        <div class="vp-endcard-actions">
          <button class="vp-endcard-play" type="button" id="vpEndCardPlay"
            onclick="dismissEndCard(); navigateVideo('${courseId}','${next.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play now
            <span class="vp-endcard-countdown" id="vpEndCardCountdown">(5)</span>
          </button>
          <button class="vp-endcard-cancel" type="button" onclick="dismissEndCard()">Cancel</button>
        </div>
      </div>
    </div>
  ` : "";

  playerView.innerHTML = `
    <div class="vp-wrap">
      <div class="vp-topbar">
        <button class="vp-back-btn" type="button" onclick="closeVideoPlayer()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to course
        </button>
        <p class="vp-chapter-label">${video.chapterTitle}</p>
      </div>

      <div class="vp-player-box">
        <div class="vp-iframe-wrap">
          <iframe
            class="vp-iframe"
            src="${video.embedUrl}"
            allow="autoplay"
            allowfullscreen
            loading="lazy"
            title="${video.title}"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox">
          </iframe>
          <!-- Blocks the "Watch on Google Drive" button area from being clickable -->
          <div class="vp-drive-blocker" aria-hidden="true"></div>
          ${nextCardHtml}
        </div>
      </div>

      <div class="vp-meta">
        <div class="vp-meta-row">
          <h2 class="vp-title">${video.title}${video.isFree ? ' <span class="free-badge">Free Preview</span>' : ""}</h2>
          <div class="vp-quiz-area">${quizBadge}${quizCta}</div>
        </div>
        <div class="vp-nav">
          ${prev
            ? `<button class="vp-nav-btn vp-prev-btn" type="button" onclick="navigateVideo('${courseId}', '${prev.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                <span><span class="vp-nav-hint">Previous</span><span class="vp-nav-title">${prev.title}</span></span>
               </button>`
            : `<div></div>`
          }
          ${next
            ? `<button class="vp-nav-btn vp-next-btn" type="button" onclick="navigateVideo('${courseId}', '${next.id}')">
                <span><span class="vp-nav-hint">Next</span><span class="vp-nav-title">${next.title}</span></span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
               </button>`
            : `<div></div>`
          }
        </div>
      </div>
      ${qaSectionHtml}
    </div>
  `;

  // Load Q&A if this is a paid video
  if (!video.isFree) loadQa(courseId, videoId);

  // Show end-card after the Google Drive video iframe fires a postMessage
  // indicating playback ended, OR after a fixed delay as a fallback.
  // Google Drive embeds send window.postMessage when the video ends.
  if (next) startEndCardListener(courseId, next.id);
}

// ── End-card (next video) ─────────────────────────────────
let _endCardTimer   = null;
let _endCardMsgHandler = null;

function startEndCardListener(courseId, nextVideoId) {
  // Clean up any previous listener/timer
  dismissEndCard();

  // Listen for Google Drive player postMessage "ended" signal
  _endCardMsgHandler = (e) => {
    // Google Drive sends various postMessage payloads; look for the "ended" state
    if (!e.origin.includes("drive.google.com") && !e.origin.includes("docs.google.com")) return;
    let payload;
    try { payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    const state = payload?.state ?? payload?.data?.state ?? payload?.info?.playerState;
    // state 0 = ended in YouTube-style embeds; Google Drive uses "ended"
    if (state === 0 || state === "ended" || state === "ENDED") {
      showEndCard();
    }
  };
  window.addEventListener("message", _endCardMsgHandler);

  // Fallback: show end-card after a generous fixed delay (Drive doesn't always fire the event)
  // We use a MutationObserver on the vp-player-box to detect if user is still on this video
}

function showEndCard() {
  const card = qs("#vpEndCard");
  if (!card || !card.classList.contains("hidden")) return; // already showing or gone
  card.classList.remove("hidden");
  // Start 5-second countdown, then auto-navigate
  let secs = 5;
  const countEl = qs("#vpEndCardCountdown");
  _endCardTimer = setInterval(() => {
    secs--;
    if (countEl) countEl.textContent = `(${secs})`;
    if (secs <= 0) {
      clearInterval(_endCardTimer);
      _endCardTimer = null;
      const playBtn = qs("#vpEndCardPlay");
      if (playBtn) playBtn.click();
    }
  }, 1000);
}

function dismissEndCard() {
  if (_endCardTimer) { clearInterval(_endCardTimer); _endCardTimer = null; }
  if (_endCardMsgHandler) { window.removeEventListener("message", _endCardMsgHandler); _endCardMsgHandler = null; }
  const card = qs("#vpEndCard");
  if (card) card.classList.add("hidden");
}

function closeVideoPlayer() {
  dismissEndCard();
  const playerView  = qs("#videoPlayerView");
  const detailView  = qs("#courseDetailView");
  hide(playerView);
  // If we came from a course detail page, return to it
  if (_playerCourseId && detailView.innerHTML.trim()) {
    show(detailView);
  } else if (_playerCourseId) {
    openCourseDetail(_playerCourseId);
  } else {
    show(qs("#catalogView"));
  }
}

async function navigateVideo(courseId, videoId) {
  dismissEndCard();
  // Scroll to top of player smoothly before swapping content
  qs("#videoPlayerView").scrollIntoView({ behavior: "smooth", block: "start" });
  await openVideoPlayer(courseId, videoId);
}

// ── AI Quiz ───────────────────────────────────────────────
// State kept outside so retake can reuse the same questions
let _quizState = null; // { courseId, videoId, videoTitle, chapterTitle, questions, answers }

const quizOverlay   = qs("#quizOverlay");
const quizBody      = qs("#quizBody");
const quizTitleEl   = qs("#quizTitle");
const quizCloseBtn  = qs("#quizCloseBtn");

quizCloseBtn.addEventListener("click", closeQuiz);
quizOverlay.addEventListener("click", (e) => { if (e.target === quizOverlay) closeQuiz(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !quizOverlay.classList.contains("hidden")) closeQuiz(); });

function openQuiz(courseId, videoId, videoTitle, chapterTitle) {
  _quizState = { courseId, videoId, videoTitle, chapterTitle, questions: null, answers: [] };
  quizTitleEl.textContent = videoTitle;
  show(quizOverlay);
  document.body.style.overflow = "hidden";
  renderQuizLoading();
  generateQuiz();
}

function closeQuiz() {
  hide(quizOverlay);
  document.body.style.overflow = "";
  _quizState = null;
}

function renderQuizLoading() {
  quizBody.innerHTML = `
    <div class="quiz-generating">
      <div class="quiz-spinner"></div>
      <p class="quiz-generating-text">AI is generating your quiz…</p>
      <p class="quiz-generating-sub">5 questions tailored to this lesson</p>
    </div>`;
}

async function generateQuiz() {
  const { courseId, videoId, videoTitle, chapterTitle } = _quizState;
  const { ok, data } = await api("POST", "/api/quiz/generate", { courseId, videoId, videoTitle, chapterTitle });
  if (!ok) {
    quizBody.innerHTML = `
      <div class="quiz-error">
        <p>${data?.error || "Could not generate quiz. Please try again."}</p>
        <button class="quiz-retry-btn" type="button" onclick="generateQuiz()">Try again</button>
      </div>`;
    return;
  }
  _quizState.questions = data.questions;
  _quizState.answers   = new Array(data.questions.length).fill(null);
  renderQuizQuestions();
}

function renderQuizQuestions() {
  const { questions, answers } = _quizState;
  const labels = ["A", "B", "C", "D"];

  quizBody.innerHTML = `
    <div class="quiz-progress-bar">
      <div class="quiz-progress-fill" id="quizProgressFill" style="width:0%"></div>
    </div>
    <div class="quiz-questions" id="quizQuestions">
      ${questions.map((q, qi) => `
        <div class="quiz-q-block" id="quizQ${qi}">
          <p class="quiz-q-num">Question ${qi + 1} of ${questions.length}</p>
          <p class="quiz-q-text">${q.q}</p>
          <div class="quiz-options">
            ${q.options.map((opt, oi) => `
              <button class="quiz-option${answers[qi] === oi ? " quiz-option-selected" : ""}"
                type="button"
                data-qi="${qi}" data-oi="${oi}"
                onclick="selectQuizOption(${qi}, ${oi})">
                <span class="quiz-option-label">${labels[oi]}</span>
                <span class="quiz-option-text">${opt}</span>
              </button>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    <div class="quiz-footer">
      <span class="quiz-answered-count" id="quizAnsweredCount">0 / ${questions.length} answered</span>
      <button class="quiz-submit-btn" id="quizSubmitBtn" type="button" onclick="submitQuiz()" disabled>
        Submit Quiz
      </button>
    </div>
  `;
  updateQuizProgress();
}

function selectQuizOption(qi, oi) {
  if (!_quizState) return;
  _quizState.answers[qi] = oi;

  // Update button styles for this question
  qsa(`[data-qi="${qi}"]`).forEach((btn) => {
    btn.classList.toggle("quiz-option-selected", parseInt(btn.dataset.oi) === oi);
  });

  updateQuizProgress();
}

function updateQuizProgress() {
  const { questions, answers } = _quizState;
  const answered = answers.filter((a) => a !== null).length;
  const pct = Math.round((answered / questions.length) * 100);
  const fill = qs("#quizProgressFill");
  const count = qs("#quizAnsweredCount");
  const submitBtn = qs("#quizSubmitBtn");
  if (fill)  fill.style.width = `${pct}%`;
  if (count) count.textContent = `${answered} / ${questions.length} answered`;
  if (submitBtn) submitBtn.disabled = answered < questions.length;
}

async function submitQuiz() {
  const { courseId, videoId, videoTitle, questions, answers } = _quizState;
  const submitBtn = qs("#quizSubmitBtn");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting…"; }

  const { ok, data } = await api("POST", "/api/quiz/submit", {
    courseId, videoId, videoTitle,
    questions: questions.map((q) => ({ q: q.q, options: q.options, answer: q.answer })),
    answers
  });

  if (!ok) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Quiz"; }
    const footer = qs(".quiz-footer");
    if (footer) {
      const err = document.createElement("p");
      err.style.cssText = "color:var(--red);font-size:13px;margin-top:8px";
      err.textContent = data?.error || "Submission failed. Please try again.";
      footer.appendChild(err);
    }
    return;
  }

  renderQuizResult(data);
}

function renderQuizResult(result) {
  const { score, correct, total, passed, detail } = result;
  const labels = ["A", "B", "C", "D"];
  const scoreClass = passed ? "quiz-score-pass" : "quiz-score-fail";
  const scoreMsg   = score === 100 ? "Perfect score! 🎉" :
                     passed        ? "Well done! You passed." :
                     score >= 40   ? "Almost there. Review and retake." :
                                     "Keep studying and try again.";

  const reviewRows = detail.map((item, i) => `
    <div class="quiz-review-item ${item.correct ? "quiz-review-correct" : "quiz-review-wrong"}">
      <p class="quiz-review-q"><strong>Q${i + 1}.</strong> ${item.q}</p>
      <div class="quiz-review-options">
        ${item.options.map((opt, oi) => {
          const isCorrect = oi === item.correctIndex;
          const isChosen  = oi === item.chosenIndex;
          let cls = "quiz-review-opt";
          if (isCorrect) cls += " quiz-review-opt-correct";
          if (isChosen && !isCorrect) cls += " quiz-review-opt-wrong";
          return `<div class="${cls}">
            <span class="quiz-option-label">${labels[oi]}</span>
            <span>${opt}</span>
            ${isCorrect ? '<span class="quiz-review-tick">✓</span>' : ""}
            ${isChosen && !isCorrect ? '<span class="quiz-review-cross">✗</span>' : ""}
          </div>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  quizBody.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-score-ring ${scoreClass}">
        <span class="quiz-score-num">${score}<span style="font-size:18px">%</span></span>
        <span class="quiz-score-label">${correct}/${total} correct</span>
      </div>
      <p class="quiz-score-msg">${scoreMsg}</p>

      <div class="quiz-result-actions">
        <button class="quiz-retake-btn" type="button" onclick="retakeQuiz()">Retake Quiz</button>
        <button class="quiz-done-btn" type="button" onclick="closeQuiz()">Close</button>
      </div>

      <details class="quiz-review-details">
        <summary class="quiz-review-summary">Review all answers</summary>
        <div class="quiz-review-list">${reviewRows}</div>
      </details>
    </div>
  `;
}

function retakeQuiz() {
  // Keep same questions, reset answers
  _quizState.answers = new Array(_quizState.questions.length).fill(null);
  renderQuizQuestions();
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
// SearchSelect instances — keyed by native select id so we can call .refresh()
const _ss = {};

function ssGet(id) {
  if (!_ss[id]) _ss[id] = new SearchSelect(qs(`#${id}`));
  return _ss[id];
}

async function loadAdminData() {
  const { ok, data } = await api("GET", "/api/admin/courses");
  if (!ok) return;
  const courses = data.courses || [];

  // Populate all course dropdowns and attach SearchSelect
  const courseSelIds = [
    "adminEnrollCourse",
    "adminRevokeCourse",
    "adminChapterCourse",
    "adminEditChapterCourse",
    "adminReorderCourse",
    "adminReorderLessonCourse",
    "adminVideoCourse",
    "adminEditVideoCourse"
  ];
  courseSelIds.forEach((id) => {
    const el = qs(`#${id}`);
    el.innerHTML = '<option value="">Select course…</option>' +
      courses.map((c) => `<option value="${c.id}">${c.title}</option>`).join("");
    ssGet(id).refresh();
  });

  // Enroll: load non-enrolled users when course changes, clear stale message
  qs("#adminEnrollCourse").addEventListener("change", async function () {
    qs("#adminEnrollMessage").textContent = "";
    const courseId = this.value;
    const userSel  = qs("#adminEnrollUser");
    if (!courseId) {
      userSel.innerHTML = '<option value="">Select course first…</option>';
      ssGet("adminEnrollUser").refresh();
      return;
    }
    const { ok, data } = await api("GET", `/api/admin/users?excludeEnrolled=${courseId}`);
    if (!ok) return;
    userSel.innerHTML = '<option value="">Select user…</option>' +
      (data.users || []).map((u) => `<option value="${u.id}">${u.name} (${u.email})</option>`).join("");
    ssGet("adminEnrollUser").refresh();
  });
  qs("#adminEnrollUser").addEventListener("change", () => {
    qs("#adminEnrollMessage").textContent = "";
  });
  ssGet("adminEnrollUser");   // init early so it wraps the empty placeholder

  // Revoke: load enrolled users when course changes, clear stale message
  qs("#adminRevokeCourse").addEventListener("change", async function () {
    qs("#adminRevokeMessage").textContent = "";
    const courseId = this.value;
    const userSel  = qs("#adminRevokeUser");
    if (!courseId) {
      userSel.innerHTML = '<option value="">Select course first…</option>';
      ssGet("adminRevokeUser").refresh();
      return;
    }
    const { ok, data } = await api("GET", `/api/admin/enrollments?courseId=${courseId}`);
    if (!ok) return;
    userSel.innerHTML = '<option value="">Select enrolled user…</option>' +
      (data.enrollments || []).map((u) => `<option value="${u.userId}">${u.name} (${u.email})</option>`).join("");
    ssGet("adminRevokeUser").refresh();
  });
  qs("#adminRevokeUser").addEventListener("change", () => {
    qs("#adminRevokeMessage").textContent = "";
  });
  ssGet("adminRevokeUser");   // init early

  // Delete user: load all users
  const deleteUserSel = qs("#adminDeleteUser");
  const { ok: usersOk, data: usersData } = await api("GET", "/api/admin/users");
  if (usersOk) {
    deleteUserSel.innerHTML = '<option value="">Select user…</option>' +
      (usersData.users || []).map((u) => `<option value="${u.id}">${u.name} (${u.email})</option>`).join("");
  }
  ssGet("adminDeleteUser");
  deleteUserSel.addEventListener("change", () => {
    qs("#adminDeleteUserMessage").textContent = "";
  });

  // Chapter selectors for video actions
  function bindChapterSelect(courseSelId, chapterSelId) {
    qs(`#${courseSelId}`).addEventListener("change", function () {
      const course = courses.find((c) => c.id === this.value);
      const chSel  = qs(`#${chapterSelId}`);
      chSel.innerHTML = '<option value="">Select chapter…</option>' +
        (course ? course.chapters : []).map((ch) => `<option value="${ch.id}">${ch.title}</option>`).join("");
      ssGet(chapterSelId).refresh();
    });
    ssGet(chapterSelId);  // init early
  }
  bindChapterSelect("adminVideoCourse",       "adminVideoChapter");
  bindChapterSelect("adminEditChapterCourse", "adminEditChapterSelect");
  bindChapterSelect("adminEditVideoCourse",   "adminEditVideoChapter");

  // Video select when chapter changes
  qs("#adminEditVideoChapter").addEventListener("change", function () {
    const courseId  = qs("#adminEditVideoCourse").value;
    const course    = courses.find((c) => c.id === courseId);
    const chapterId = this.value;
    const chapter   = (course?.chapters || []).find((ch) => ch.id === chapterId);
    const vidSel    = qs("#adminEditVideoSelect");
    vidSel.innerHTML = '<option value="">Select video…</option>' +
      (chapter?.videos || []).map((v) => `<option value="${v.id}">${v.title}</option>`).join("");
    ssGet("adminEditVideoSelect").refresh();
  });
  ssGet("adminEditVideoSelect");  // init early

  // ── Reorder chapters ────────────────────────────────────
  const reorderList    = qs("#adminReorderList");
  const saveOrderBtn   = qs("#adminSaveOrderBtn");
  const reorderMsg     = qs("#adminReorderMessage");
  let   reorderDragSrc = null;

  function renderReorderList() {
    const items = [...reorderList.querySelectorAll(".reorder-item")];
    // Build from scratch using data already in the DOM list's dataset
    reorderList.innerHTML = "";
    items.forEach((item, i) => {
      item.querySelector(".reorder-num").textContent = i + 1;
      reorderList.appendChild(item);
    });
  }

  function buildReorderList(chapters) {
    reorderList.innerHTML = "";
    chapters.forEach((ch, i) => {
      const row = document.createElement("div");
      row.className = "reorder-item";
      row.setAttribute("draggable", "true");
      row.dataset.chapterId = ch.id;
      row.innerHTML = `
        <span class="reorder-handle" aria-hidden="true">⠿</span>
        <span class="reorder-num">${i + 1}</span>
        <span class="reorder-title">${ch.title}</span>
        <div class="reorder-btns">
          <button class="reorder-btn reorder-up" type="button" aria-label="Move up">↑</button>
          <button class="reorder-btn reorder-down" type="button" aria-label="Move down">↓</button>
        </div>
      `;

      // ↑ ↓ buttons
      row.querySelector(".reorder-up").addEventListener("click", () => {
        const prev = row.previousElementSibling;
        if (prev) { reorderList.insertBefore(row, prev); renumberRows(); }
      });
      row.querySelector(".reorder-down").addEventListener("click", () => {
        const next = row.nextElementSibling;
        if (next) { reorderList.insertBefore(next, row); renumberRows(); }
      });

      // Drag-and-drop
      row.addEventListener("dragstart", (e) => {
        reorderDragSrc = row;
        row.classList.add("reorder-dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("reorder-dragging");
        reorderList.querySelectorAll(".reorder-item").forEach((r) => r.classList.remove("reorder-over"));
        renumberRows();
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (row !== reorderDragSrc) {
          reorderList.querySelectorAll(".reorder-item").forEach((r) => r.classList.remove("reorder-over"));
          row.classList.add("reorder-over");
        }
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        if (reorderDragSrc && reorderDragSrc !== row) {
          const allItems = [...reorderList.querySelectorAll(".reorder-item")];
          const srcIdx = allItems.indexOf(reorderDragSrc);
          const tgtIdx = allItems.indexOf(row);
          if (srcIdx < tgtIdx) reorderList.insertBefore(reorderDragSrc, row.nextSibling);
          else                 reorderList.insertBefore(reorderDragSrc, row);
        }
        row.classList.remove("reorder-over");
      });

      reorderList.appendChild(row);
    });
    show(saveOrderBtn);
    reorderMsg.textContent = "";
  }

  function renumberRows() {
    reorderList.querySelectorAll(".reorder-item").forEach((row, i) => {
      row.querySelector(".reorder-num").textContent = i + 1;
    });
  }

  qs("#adminReorderCourse").addEventListener("change", function () {
    reorderMsg.textContent = "";
    hide(saveOrderBtn);
    reorderList.innerHTML = "";
    const course = courses.find((c) => c.id === this.value);
    if (!course || !course.chapters.length) return;
    buildReorderList(course.chapters);
  });

  // ── Reorder lessons ─────────────────────────────────────
  const lessonReorderList  = qs("#adminReorderLessonList");
  const saveLessonOrderBtn = qs("#adminSaveLessonOrderBtn");
  const lessonReorderMsg   = qs("#adminReorderLessonMessage");
  let   lessonDragSrc      = null;

  function buildLessonReorderList(videos) {
    lessonReorderList.innerHTML = "";
    videos.forEach((v, i) => {
      const row = document.createElement("div");
      row.className = "reorder-item";
      row.setAttribute("draggable", "true");
      row.dataset.videoId = v.id;
      row.innerHTML = `
        <span class="reorder-handle" aria-hidden="true">⠿</span>
        <span class="reorder-num">${i + 1}</span>
        <span class="reorder-title">${v.title}</span>
        <div class="reorder-btns">
          <button class="reorder-btn reorder-up" type="button" aria-label="Move up">↑</button>
          <button class="reorder-btn reorder-down" type="button" aria-label="Move down">↓</button>
        </div>
      `;

      row.querySelector(".reorder-up").addEventListener("click", () => {
        const prev = row.previousElementSibling;
        if (prev) { lessonReorderList.insertBefore(row, prev); renumberLessonRows(); }
      });
      row.querySelector(".reorder-down").addEventListener("click", () => {
        const next = row.nextElementSibling;
        if (next) { lessonReorderList.insertBefore(next, row); renumberLessonRows(); }
      });

      row.addEventListener("dragstart", (e) => {
        lessonDragSrc = row;
        row.classList.add("reorder-dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("reorder-dragging");
        lessonReorderList.querySelectorAll(".reorder-item").forEach((r) => r.classList.remove("reorder-over"));
        renumberLessonRows();
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (row !== lessonDragSrc) {
          lessonReorderList.querySelectorAll(".reorder-item").forEach((r) => r.classList.remove("reorder-over"));
          row.classList.add("reorder-over");
        }
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        if (lessonDragSrc && lessonDragSrc !== row) {
          const allItems = [...lessonReorderList.querySelectorAll(".reorder-item")];
          const srcIdx = allItems.indexOf(lessonDragSrc);
          const tgtIdx = allItems.indexOf(row);
          if (srcIdx < tgtIdx) lessonReorderList.insertBefore(lessonDragSrc, row.nextSibling);
          else                 lessonReorderList.insertBefore(lessonDragSrc, row);
        }
        row.classList.remove("reorder-over");
      });

      lessonReorderList.appendChild(row);
    });
    show(saveLessonOrderBtn);
    lessonReorderMsg.textContent = "";
  }

  function renumberLessonRows() {
    lessonReorderList.querySelectorAll(".reorder-item").forEach((row, i) => {
      row.querySelector(".reorder-num").textContent = i + 1;
    });
  }

  // When course changes: populate chapter dropdown, clear lesson list
  qs("#adminReorderLessonCourse").addEventListener("change", function () {
    lessonReorderMsg.textContent = "";
    hide(saveLessonOrderBtn);
    lessonReorderList.innerHTML = "";
    const course = courses.find((c) => c.id === this.value);
    const chSel = qs("#adminReorderLessonChapter");
    chSel.innerHTML = '<option value="">Select chapter…</option>' +
      (course ? course.chapters : []).map((ch) => `<option value="${ch.id}">${ch.title}</option>`).join("");
    ssGet("adminReorderLessonChapter").refresh();
  });
  ssGet("adminReorderLessonChapter"); // init early

  // When chapter changes: build lesson list
  qs("#adminReorderLessonChapter").addEventListener("change", function () {
    lessonReorderMsg.textContent = "";
    hide(saveLessonOrderBtn);
    lessonReorderList.innerHTML = "";
    const courseId = qs("#adminReorderLessonCourse").value;
    const course   = courses.find((c) => c.id === courseId);
    const chapter  = (course?.chapters || []).find((ch) => ch.id === this.value);
    if (!chapter || !chapter.videos.length) return;
    buildLessonReorderList(chapter.videos);
  });
}

// Admin: Enroll
qs("#adminEnrollBtn").addEventListener("click", async () => {
  const msg      = qs("#adminEnrollMessage");
  const courseId = qs("#adminEnrollCourse").value;
  const userId   = qs("#adminEnrollUser").value;
  if (!courseId || !userId) { msg.textContent = "Select both course and user."; return; }
  showConfirm("Enroll this user as paid for the selected course?", async () => {
    const { ok, data } = await api("POST", "/api/admin/enrollments", { courseId, userId });
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = data.message || data.error || "";
    if (ok) {
      await loadCatalog();
      await loadAdminData();
    }
  });
});

// Admin: Save chapter order
qs("#adminSaveOrderBtn").addEventListener("click", async () => {
  const msg      = qs("#adminReorderMessage");
  const courseId = qs("#adminReorderCourse").value;
  if (!courseId) { msg.style.color = "var(--red)"; msg.textContent = "Select a course first."; return; }
  const order = [...qs("#adminReorderList").querySelectorAll(".reorder-item")]
    .map((row) => row.dataset.chapterId);
  if (order.length === 0) { msg.style.color = "var(--red)"; msg.textContent = "No chapters to reorder."; return; }
  const { ok, data } = await api("PATCH", `/api/admin/courses/${courseId}/chapters/reorder`, { order });
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Chapter order saved." : (data.error || "Could not save order.");
  if (ok) {
    // Reload admin data so all other chapter dropdowns reflect the new order
    await loadAdminData();
  }
});

// Admin: Save lesson order
qs("#adminSaveLessonOrderBtn").addEventListener("click", async () => {
  const msg       = qs("#adminReorderLessonMessage");
  const courseId  = qs("#adminReorderLessonCourse").value;
  const chapterId = qs("#adminReorderLessonChapter").value;
  if (!courseId || !chapterId) {
    msg.style.color = "var(--red)";
    msg.textContent = "Select both course and chapter first.";
    return;
  }
  const order = [...qs("#adminReorderLessonList").querySelectorAll(".reorder-item")]
    .map((row) => row.dataset.videoId);
  if (order.length === 0) {
    msg.style.color = "var(--red)";
    msg.textContent = "No lessons to reorder.";
    return;
  }
  const { ok, data } = await api(
    "PATCH",
    `/api/admin/courses/${courseId}/chapters/${chapterId}/videos/reorder`,
    { order }
  );
  msg.style.color = ok ? "var(--green)" : "var(--red)";
  msg.textContent = ok ? "Lesson order saved." : (data.error || "Could not save order.");
  if (ok) await loadAdminData();
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

// Admin: Delete user
qs("#adminDeleteUserBtn").addEventListener("click", () => {
  const userId = qs("#adminDeleteUser").value;
  const msg = qs("#adminDeleteUserMessage");
  if (!userId) {
    msg.textContent = "Select a user.";
    return;
  }
  showConfirm("Delete this user and all of their paid enrollments?", async () => {
    const { ok, data } = await api("DELETE", `/api/admin/users/${userId}`);
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = data.message || data.error || "";
    if (ok) {
      qs("#adminDeleteUser").value = "";
      ssGet("adminDeleteUser").refresh();
      await loadCatalog();
      await loadAdminData();
    }
  });
});

// Admin: Add chapter
qs("#adminAddChapterBtn").addEventListener("click", async () => {
  const msg      = qs("#adminChapterMessage");
  const courseId = qs("#adminChapterCourse").value;
  const title    = qs("#adminChapterTitle").value.trim();
  if (!courseId || !title) { msg.textContent = "Select course and enter title."; return; }
  showConfirm("Add this chapter to the selected course?", async () => {
    const { ok, data } = await api("POST", `/api/admin/courses/${courseId}/chapters`, { title });
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Chapter added." : (data.error || "Error");
    if (ok) { qs("#adminChapterTitle").value = ""; await loadAdminData(); }
  });
});

// Admin: Rename chapter
qs("#adminRenameChapterBtn").addEventListener("click", async () => {
  const msg       = qs("#adminEditChapterMessage");
  const courseId  = qs("#adminEditChapterCourse").value;
  const chapterId = qs("#adminEditChapterSelect").value;
  const title     = qs("#adminEditChapterTitle").value.trim();
  if (!courseId || !chapterId || !title) { msg.textContent = "Select course, chapter, and enter new title."; return; }
  showConfirm("Rename this chapter?", async () => {
    const { ok, data } = await api("PATCH", `/api/admin/courses/${courseId}/chapters/${chapterId}`, { title });
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Chapter renamed." : (data.error || "Error");
    if (ok) {
      qs("#adminEditChapterTitle").value = "";
      await loadAdminData();
    }
  });
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
  showConfirm("Add this video to the selected chapter?", async () => {
    const { ok, data } = await api("POST", `/api/admin/courses/${courseId}/chapters/${chapterId}/videos`, { title, url });
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Video added." : (data.error || "Error");
    if (ok) { qs("#adminVideoTitle").value = ""; qs("#adminVideoUrl").value = ""; await loadAdminData(); }
  });
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
  showConfirm("Save changes to this video?", async () => {
    const { ok, data } = await api("PATCH", `/api/admin/courses/${courseId}/chapters/${chapterId}/videos/${videoId}`, body);
    msg.style.color = ok ? "var(--green)" : "var(--red)";
    msg.textContent = ok ? "Video updated." : (data.error || "Error");
    if (ok) { qs("#adminEditVideoTitle").value = ""; qs("#adminEditVideoUrl").value = ""; await loadAdminData(); }
  });
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

// Admin: Q&A moderation — load and render recent posts
qs("#adminQaLoadBtn").addEventListener("click", async () => {
  const msg      = qs("#adminQaMessage");
  const wrap     = qs("#adminQaTableWrap");
  const tbody    = qs("#adminQaTableBody");
  msg.textContent = "Loading…";
  msg.style.color = "var(--muted)";

  const { ok, data } = await api("GET", "/api/admin/qa?limit=100");
  if (!ok) {
    msg.style.color = "var(--red)";
    msg.textContent = data?.error || "Could not load posts.";
    return;
  }

  const posts = data.questions || [];
  msg.textContent = posts.length === 0 ? "No posts yet." : `${posts.length} post${posts.length !== 1 ? "s" : ""} loaded.`;
  msg.style.color = "var(--muted)";

  if (posts.length === 0) { wrap.style.display = "none"; return; }

  function escA(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function fmtA(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  tbody.innerHTML = posts.map((p) => `
    <tr id="adminQaRow-${p.id}">
      <td>${escA(p.userName)}</td>
      <td style="color:var(--muted);font-size:12px">${escA(p.videoId)}${p.parentId ? " ↳ reply" : ""}</td>
      <td style="max-width:320px;word-break:break-word">${escA(p.text.slice(0, 200))}${p.text.length > 200 ? "…" : ""}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--muted)">${fmtA(p.createdAt)}</td>
      <td>
        <button class="qa-admin-del" type="button" onclick="adminDeleteQaPost('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join("");

  wrap.style.display = "block";
});

async function adminDeleteQaPost(questionId) {
  showConfirm("Delete this post and all its replies?", async () => {
    const msg = qs("#adminQaMessage");
    const { ok, data } = await api("DELETE", `/api/admin/qa/${questionId}`);
    if (!ok) {
      msg.style.color = "var(--red)";
      msg.textContent = data?.error || "Could not delete.";
      return;
    }
    // Remove row from table
    const row = qs(`#adminQaRow-${questionId}`);
    if (row) row.remove();
    msg.style.color = "var(--green)";
    msg.textContent = "Post deleted.";
  });
}

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
    if (currentUser) track("chatbot_open");
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

  // Track the query
  if (currentUser) track("chat_query", { query: text });

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

// ── Q&A / Discussion ─────────────────────────────────────
// State for the currently-open Q&A panel
let _qaState = null; // { courseId, videoId, questions: [] }

function fmtQaDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function escQa(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderQaList() {
  const listEl   = qs("#qaList");
  const countEl  = qs("#qaCount");
  if (!listEl || !_qaState) return;

  const { questions, courseId, videoId } = _qaState;
  const roots   = questions.filter((q) => !q.parentId);
  const replies  = questions.filter((q) => q.parentId);
  const replyMap = {};
  replies.forEach((r) => {
    (replyMap[r.parentId] = replyMap[r.parentId] || []).push(r);
  });

  if (countEl) countEl.textContent = questions.length > 0 ? `${questions.length}` : "";

  if (roots.length === 0) {
    listEl.innerHTML = `<p class="qa-empty">No discussion yet — be the first to ask a question!</p>`;
    return;
  }

  listEl.innerHTML = roots.map((q) => {
    const threadReplies = (replyMap[q.id] || []);
    const repliesHtml = threadReplies.map((r) => `
      <div class="qa-reply" data-id="${r.id}">
        <div class="qa-bubble">
          <div class="qa-bubble-header">
            <span class="qa-author">${escQa(r.userName)}</span>
            <span class="qa-date">${fmtQaDate(r.createdAt)}</span>
            ${r.canDelete ? `<button class="qa-delete-btn" type="button" data-id="${r.id}" data-parent="${q.id}" onclick="deleteQaPost('${courseId}','${videoId}','${r.id}')" aria-label="Delete reply">×</button>` : ""}
          </div>
          <p class="qa-text">${escQa(r.text)}</p>
          <div class="qa-actions">
            <button class="qa-like-btn${r.likedByMe ? " qa-liked" : ""}" type="button"
              onclick="likeQaPost('${courseId}','${videoId}','${r.id}',this)"
              aria-label="${r.likedByMe ? "Unlike" : "Like"}">
              <svg class="qa-like-icon" width="13" height="13" viewBox="0 0 24 24" fill="${r.likedByMe ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span class="qa-like-count">${r.likeCount || 0}</span>
            </button>
          </div>
        </div>
      </div>
    `).join("");

    return `
      <div class="qa-thread" data-id="${q.id}">
        <div class="qa-bubble qa-bubble-root">
          <div class="qa-bubble-header">
            <span class="qa-author">${escQa(q.userName)}</span>
            <span class="qa-date">${fmtQaDate(q.createdAt)}</span>
            ${q.canDelete ? `<button class="qa-delete-btn" type="button" onclick="deleteQaPost('${courseId}','${videoId}','${q.id}')" aria-label="Delete post">×</button>` : ""}
          </div>
          <p class="qa-text">${escQa(q.text)}</p>
          <div class="qa-actions">
            <button class="qa-like-btn${q.likedByMe ? " qa-liked" : ""}" type="button"
              onclick="likeQaPost('${courseId}','${videoId}','${q.id}',this)"
              aria-label="${q.likedByMe ? "Unlike" : "Like"}">
              <svg class="qa-like-icon" width="13" height="13" viewBox="0 0 24 24" fill="${q.likedByMe ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span class="qa-like-count">${q.likeCount || 0}</span>
            </button>
            <button class="qa-reply-toggle" type="button" onclick="toggleQaReply('${q.id}')">
              Reply${threadReplies.length > 0 ? ` · ${threadReplies.length}` : ""}
            </button>
          </div>
        </div>
        ${repliesHtml}
        <div class="qa-reply-form hidden" id="qaReplyForm-${q.id}">
          <textarea class="qa-input qa-reply-input" placeholder="Write a reply…" rows="2" maxlength="2000"></textarea>
          <div class="qa-form-footer">
            <span></span>
            <button class="qa-submit-btn qa-reply-post-btn" type="button"
              onclick="postQaReply('${courseId}','${videoId}','${q.id}')">Post reply</button>
          </div>
          <p class="qa-reply-msg"></p>
        </div>
      </div>
    `;
  }).join("");
}

async function loadQa(courseId, videoId) {
  _qaState = { courseId, videoId, questions: [] };
  const { ok, data } = await api("GET", `/api/qa/${courseId}/${videoId}`);
  const listEl = qs("#qaList");
  if (!listEl) return;
  if (!ok) {
    listEl.innerHTML = `<p class="qa-error">${data?.error || "Could not load discussion."}</p>`;
    return;
  }
  _qaState.questions = data.questions || [];
  renderQaList();

  // Wire up the post form
  const form = qs("#qaForm");
  const input = qs("#qaInput");
  const charCount = qs("#qaCharCount");
  if (!form || !input) return;

  input.addEventListener("input", () => {
    const len = input.value.length;
    if (charCount) charCount.textContent = `${len} / 2000`;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const msg  = qs("#qaFormMsg");
    if (!text) return;

    const btn = form.querySelector(".qa-submit-btn");
    btn.disabled = true;
    btn.textContent = "Posting…";

    const { ok: postOk, data: postData } = await api(
      "POST", `/api/qa/${courseId}/${videoId}`, { text }
    );

    btn.disabled = false;
    btn.textContent = "Post";

    if (!postOk) {
      if (msg) { msg.style.color = "var(--red)"; msg.textContent = postData?.error || "Could not post."; }
      return;
    }

    _qaState.questions.push(postData.question);
    input.value = "";
    if (charCount) charCount.textContent = "0 / 2000";
    if (msg) msg.textContent = "";
    renderQaList();
  });
}

function toggleQaReply(parentId) {
  const form = qs(`#qaReplyForm-${parentId}`);
  if (!form) return;
  const isHidden = form.classList.contains("hidden");
  // Close all open reply forms first
  qsa(".qa-reply-form").forEach((f) => f.classList.add("hidden"));
  if (isHidden) {
    form.classList.remove("hidden");
    form.querySelector("textarea")?.focus();
  }
}

async function postQaReply(courseId, videoId, parentId) {
  const form    = qs(`#qaReplyForm-${parentId}`);
  if (!form) return;
  const input   = form.querySelector("textarea");
  const msg     = form.querySelector(".qa-reply-msg");
  const btn     = form.querySelector(".qa-reply-post-btn");
  const text    = input?.value.trim() || "";
  if (!text) return;

  if (btn) { btn.disabled = true; btn.textContent = "Posting…"; }

  const { ok, data } = await api(
    "POST", `/api/qa/${courseId}/${videoId}`, { text, parentId }
  );

  if (btn) { btn.disabled = false; btn.textContent = "Post reply"; }

  if (!ok) {
    if (msg) { msg.style.color = "var(--red)"; msg.textContent = data?.error || "Could not post reply."; }
    return;
  }

  _qaState.questions.push(data.question);
  if (input) input.value = "";
  if (msg) msg.textContent = "";
  renderQaList();
}

async function likeQaPost(courseId, videoId, questionId, btnEl) {
  // Optimistic UI — flip state immediately, revert on error
  const countEl = btnEl.querySelector(".qa-like-count");
  const iconEl  = btnEl.querySelector(".qa-like-icon");
  const wasLiked = btnEl.classList.contains("qa-liked");
  const prevCount = parseInt(countEl?.textContent || "0", 10);

  btnEl.classList.toggle("qa-liked", !wasLiked);
  if (iconEl) iconEl.setAttribute("fill", wasLiked ? "none" : "currentColor");
  if (countEl) countEl.textContent = wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
  btnEl.disabled = true;

  const { ok, data } = await api("POST", `/api/qa/${courseId}/${videoId}/${questionId}/like`);
  btnEl.disabled = false;

  if (!ok) {
    // Revert
    btnEl.classList.toggle("qa-liked", wasLiked);
    if (iconEl) iconEl.setAttribute("fill", wasLiked ? "currentColor" : "none");
    if (countEl) countEl.textContent = prevCount;
    return;
  }

  // Sync local state so re-renders are consistent
  const q = _qaState?.questions.find((q) => q.id === questionId);
  if (q) { q.likeCount = data.likeCount; q.likedByMe = data.likedByMe; }
  if (countEl) countEl.textContent = data.likeCount;
  btnEl.classList.toggle("qa-liked", data.likedByMe);
  if (iconEl) iconEl.setAttribute("fill", data.likedByMe ? "currentColor" : "none");
}

async function deleteQaPost(courseId, videoId, questionId) {
  showConfirm("Delete this post and all its replies?", async () => {
    const { ok, data } = await api("DELETE", `/api/qa/${courseId}/${videoId}/${questionId}`);
    if (!ok) {
      // Re-render to show error inline — just alert for simplicity
      alert(data?.error || "Could not delete.");
      return;
    }
    // Remove the question and all its replies from local state
    _qaState.questions = _qaState.questions.filter(
      (q) => q.id !== questionId && q.parentId !== questionId
    );
    renderQaList();
  });
}

// ── Landing page: scroll-to-form buttons ─────────────────
function scrollToAuthForm() {
  const authCol = document.getElementById("authCol");
  if (authCol) authCol.scrollIntoView({ behavior: "smooth", block: "center" });
}
const navEnrollBtn = document.getElementById("navEnrollBtn");
if (navEnrollBtn) navEnrollBtn.addEventListener("click", scrollToAuthForm);
const pricingEnrollBtn = document.getElementById("pricingEnrollBtn");
if (pricingEnrollBtn) pricingEnrollBtn.addEventListener("click", () => {
  switchTab(true);
  scrollToAuthForm();
});

// ── Boot: check session ───────────────────────────────────
(async () => {
  const { ok, data } = await api("GET", "/api/me");
  if (ok && data.user) {
    currentUser = data.user;
    enterApp();
  }
})();
