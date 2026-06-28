console.log("App.js loaded successfully - v5-searchable-select");

// ─── SearchSelect component ──────────────────────────────────────────────────
// Wraps a native <select> with a searchable dropdown UI.
// Usage: const ss = new SearchSelect(selectEl); ss.setOptions([{value, label}]);
// The underlying <select> is kept in sync so existing .value reads work.
class SearchSelect {
  constructor(selectEl) {
    this.select = selectEl;
    this.value = selectEl.value || "";
    this._build();
  }

  _build() {
    const wrap = document.createElement("div");
    wrap.className = "ss-wrap";

    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className = "ss-trigger";
    this.trigger.textContent = this._labelFor(this.value) || this._placeholder();

    this.dropdown = document.createElement("div");
    this.dropdown.className = "ss-dropdown hidden";

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.className = "ss-search";
    this.searchInput.placeholder = "Search…";

    this.listEl = document.createElement("ul");
    this.listEl.className = "ss-list";

    this.dropdown.appendChild(this.searchInput);
    this.dropdown.appendChild(this.listEl);
    wrap.appendChild(this.trigger);
    wrap.appendChild(this.dropdown);

    // Insert after the native select, hide native select
    this.select.style.display = "none";
    this.select.insertAdjacentElement("afterend", wrap);
    this.wrap = wrap;

    // Events
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggle();
    });
    this.searchInput.addEventListener("input", () => this._filter(this.searchInput.value));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) this._close();
    });
  }

  _placeholder() {
    const first = this.select.options[0];
    return first ? first.text : "Select…";
  }

  _labelFor(value) {
    const opt = Array.from(this.select.options).find((o) => o.value === value);
    return opt ? opt.text : "";
  }

  _toggle() {
    const isOpen = !this.dropdown.classList.contains("hidden");
    if (isOpen) { this._close(); return; }
    this.dropdown.classList.remove("hidden");
    this.searchInput.value = "";
    this._renderList(this._getOptions());
    this.searchInput.focus();
  }

  _close() {
    this.dropdown.classList.add("hidden");
  }

  _getOptions() {
    return Array.from(this.select.options).map((o) => ({ value: o.value, label: o.text }));
  }

  _filter(q) {
    const lower = q.toLowerCase();
    const filtered = this._getOptions().filter((o) =>
      !o.value ? true : o.label.toLowerCase().includes(lower)
    );
    this._renderList(filtered);
  }

  _renderList(options) {
    this.listEl.innerHTML = "";
    options.forEach((opt) => {
      const li = document.createElement("li");
      li.className = "ss-option" + (opt.value === this.value ? " ss-selected" : "") + (!opt.value ? " ss-placeholder" : "");
      li.textContent = opt.label;
      li.dataset.value = opt.value;
      li.addEventListener("click", () => {
        this._select(opt.value, opt.label);
      });
      this.listEl.appendChild(li);
    });
  }

  _select(value, label) {
    this.value = value;
    this.select.value = value;
    this.trigger.textContent = label;
    this.trigger.classList.toggle("ss-has-value", !!value);
    this._close();
    // Dispatch change so existing event listeners fire
    this.select.dispatchEvent(new Event("change"));
  }

  // Called externally when options change (e.g. after loadAdminData)
  setOptions(options) {
    // Rebuild native select options
    this.select.innerHTML = "";
    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      this.select.appendChild(opt);
    });
    // If current value still exists keep it, else reset
    const stillValid = options.some((o) => o.value === this.value);
    if (!stillValid) {
      this.value = "";
      this.trigger.textContent = this._placeholder();
      this.trigger.classList.remove("ss-has-value");
    } else {
      this.trigger.textContent = this._labelFor(this.value);
    }
  }

  // Programmatically set the value (used by loadAdminData restore)
  setValue(value) {
    const label = this._labelFor(value);
    if (label) {
      this._select(value, label);
    } else {
      this.value = "";
      this.trigger.textContent = this._placeholder();
      this.trigger.classList.remove("ss-has-value");
    }
  }
}

const state = {
  user: null,
  courses: [],
  testimonials: [],
  contact: null,
  selectedCourseId: null,
  adminCourses: [],
  adminUsers: []
};

let els = {};
let ss = {};   // SearchSelect instances keyed by name

function initElements() {
  els = {
    loginView: document.querySelector("#loginView"),
    appView: document.querySelector("#appView"),
    loginForm: document.querySelector("#loginForm"),
    loginMessage: document.querySelector("#loginMessage"),
    signupForm: document.querySelector("#signupForm"),
    signupMessage: document.querySelector("#signupMessage"),
    showSignup: document.querySelector("#showSignup"),
    showLogin: document.querySelector("#showLogin"),
    forgotPasswordForm: document.querySelector("#forgotPasswordForm"),
    forgotPasswordMessage: document.querySelector("#forgotPasswordMessage"),
    showForgotPassword: document.querySelector("#showForgotPassword"),
    backToLogin: document.querySelector("#backToLogin"),
    logoutButton: document.querySelector("#logoutButton"),
    courseGrid: document.querySelector("#courseGrid"),
    testimonialGrid: document.querySelector("#testimonialGrid"),
    contactBlock: document.querySelector("#contactBlock"),
    catalogView: document.querySelector("#catalogView"),
    courseDetailView: document.querySelector("#courseDetailView"),
    catalogTab: document.querySelector("#catalogTab"),
    testimonialForm: document.querySelector("#testimonialForm"),
    testimonialMessage: document.querySelector("#testimonialMessage"),
    // User profile
    userMenuButton: document.querySelector("#userMenuButton"),
    userInitials: document.querySelector("#userInitials"),
    userDropdown: document.querySelector("#userDropdown"),
    dropdownName: document.querySelector("#dropdownName"),
    dropdownEmail: document.querySelector("#dropdownEmail"),
    dropdownMobile: document.querySelector("#dropdownMobile"),
    // Admin
    adminTab: document.querySelector("#adminTab"),
    adminView: document.querySelector("#adminView"),
    adminEnrollCourse: document.querySelector("#adminEnrollCourse"),
    adminEnrollUser: document.querySelector("#adminEnrollUser"),
    adminEnrollBtn: document.querySelector("#adminEnrollBtn"),
    adminEnrollMessage: document.querySelector("#adminEnrollMessage"),
    adminChapterCourse: document.querySelector("#adminChapterCourse"),
    adminChapterTitle: document.querySelector("#adminChapterTitle"),
    adminAddChapterBtn: document.querySelector("#adminAddChapterBtn"),
    adminChapterMessage: document.querySelector("#adminChapterMessage"),
    adminVideoCourse: document.querySelector("#adminVideoCourse"),
    adminVideoChapter: document.querySelector("#adminVideoChapter"),
    adminVideoTitle: document.querySelector("#adminVideoTitle"),
    adminVideoUrl: document.querySelector("#adminVideoUrl"),
    adminAddVideoBtn: document.querySelector("#adminAddVideoBtn"),
    adminVideoMessage: document.querySelector("#adminVideoMessage"),
    // Edit chapter
    adminEditChapterCourse: document.querySelector("#adminEditChapterCourse"),
    adminEditChapterSelect: document.querySelector("#adminEditChapterSelect"),
    adminEditChapterTitle: document.querySelector("#adminEditChapterTitle"),
    adminRenameChapterBtn: document.querySelector("#adminRenameChapterBtn"),
    adminDeleteChapterBtn: document.querySelector("#adminDeleteChapterBtn"),
    adminEditChapterMessage: document.querySelector("#adminEditChapterMessage"),
    // Edit video
    adminEditVideoCourse: document.querySelector("#adminEditVideoCourse"),
    adminEditVideoChapter: document.querySelector("#adminEditVideoChapter"),
    adminEditVideoSelect: document.querySelector("#adminEditVideoSelect"),
    adminEditVideoTitle: document.querySelector("#adminEditVideoTitle"),
    adminEditVideoUrl: document.querySelector("#adminEditVideoUrl"),
    adminRenameVideoBtn: document.querySelector("#adminRenameVideoBtn"),
    adminDeleteVideoBtn: document.querySelector("#adminDeleteVideoBtn"),
    adminEditVideoMessage: document.querySelector("#adminEditVideoMessage"),
    // Revoke access
    adminRevokeCourse: document.querySelector("#adminRevokeCourse"),
    adminRevokeUser: document.querySelector("#adminRevokeUser"),
    adminRevokeBtn: document.querySelector("#adminRevokeBtn"),
    adminRevokeMessage: document.querySelector("#adminRevokeMessage")
  };

  // Initialise SearchSelect on all chapter/video/user dropdowns
  ss = {
    enrollUser:       new SearchSelect(els.adminEnrollUser),
    videoChapter:     new SearchSelect(els.adminVideoChapter),
    editChapterSel:   new SearchSelect(els.adminEditChapterSelect),
    editVideoChapter: new SearchSelect(els.adminEditVideoChapter),
    editVideoSel:     new SearchSelect(els.adminEditVideoSelect),
    revokeUser:       new SearchSelect(els.adminRevokeUser)
  };

  console.log("Elements initialized", els);
}

function showLoginForm() {
  els.loginForm.classList.remove("hidden");
  els.signupForm.classList.add("hidden");
  els.loginMessage.textContent = "";
  els.signupMessage.textContent = "";
  els.loginForm.reset();
}

function showSignupForm() {
  els.loginForm.classList.add("hidden");
  els.signupForm.classList.remove("hidden");
  els.loginMessage.textContent = "";
  els.signupMessage.textContent = "";
  els.signupForm.reset();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Something went wrong");
  return payload;
}


function resetState() {
  state.user = null;
  state.courses = [];
  state.testimonials = [];
  state.contact = null;
  state.selectedCourseId = null;
  state.adminCourses = [];
  state.adminUsers = [];
}

function showLogin() {
  resetState();
  // Clear the URL so the next login doesn't auto-navigate to the previous course
  history.replaceState(null, "", "/");
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  // Clear rendered content so stale DOM isn't reused on next login
  els.courseDetailView.innerHTML = "";
  els.courseGrid.innerHTML = "";
  els.loginForm.reset();
  els.signupForm.reset();
  showLoginForm();
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  // Populate user profile icon
  const initials = state.user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  els.userInitials.textContent = initials;
  els.dropdownName.textContent = state.user.name;
  els.dropdownEmail.textContent = state.user.email;
  if (state.user.mobile) {
    els.dropdownMobile.textContent = state.user.mobile;
    els.dropdownMobile.classList.remove("hidden");
  } else {
    els.dropdownMobile.classList.add("hidden");
  }
  // Show admin tab only for admins — always reset first to handle re-login
  if (state.user.isAdmin) {
    els.adminTab.classList.remove("hidden");
  } else {
    els.adminTab.classList.add("hidden");
  }
}

function showCatalog() {
  els.catalogView.classList.remove("hidden");
  els.courseDetailView.classList.add("hidden");
  els.adminView.classList.add("hidden");
  els.catalogTab.classList.add("active");
  els.adminTab.classList.remove("active");
}

function showAdmin() {
  els.catalogView.classList.add("hidden");
  els.courseDetailView.classList.add("hidden");
  els.adminView.classList.remove("hidden");
  els.catalogTab.classList.remove("active");
  els.adminTab.classList.add("active");
}

function showDetailsShell() {
  els.catalogView.classList.add("hidden");
  els.courseDetailView.classList.remove("hidden");
  els.catalogTab.classList.remove("active");
  els.adminTab.classList.remove("active");
}

function renderCourses() {
  els.courseGrid.innerHTML = state.courses
    .map(
      (course) => `
        <article class="course-card">
          <span class="course-chip" style="background:${course.accent}">${course.level}</span>
          <h3>${course.title}</h3>
          <p>${course.summary}</p>
          <div class="meta-row">
            <span>${course.duration}</span>
            ${!course.paid ? `
              <span class="price-block">
                ${course.hasDiscount ? `<s class="original-price">${course.originalPriceLabel}</s>` : ""}
                <strong class="final-price">${course.priceLabel}</strong>
              </span>
            ` : '<span class="paid-badge">Paid access</span>'}
          </div>
          <div class="card-actions">
            <button type="button" data-course="${course.id}">${course.paid ? 'View course' : 'Choose course'}</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTestimonials() {
  els.testimonialGrid.innerHTML = state.testimonials.length
    ? state.testimonials
        .map(
          (item) => `
        <article class="testimonial-card">
          <p>"${escapeHtml(item.quote)}"</p>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.role)}</span>
        </article>
      `
        )
        .join("")
    : `<p class="hint">Approved testimonials will appear here.</p>`;
}

// Admin testimonial management removed - manage directly in MongoDB Atlas

function renderContact() {
  const contact = state.contact;
  els.contactBlock.innerHTML = `
    <div class="section-heading compact">
      <p class="eyebrow">Coordinates</p>
      <h2>Reach the academy team for admission and payment confirmation.</h2>
    </div>
    <dl class="contact-list">
      <div>
        <dt>Academy</dt>
        <dd>${contact.academy}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>${contact.address}</dd>
      </div>
      <div>
        <dt>Mobile</dt>
        <dd>${contact.mobile}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>${contact.email}</dd>
      </div>
    </dl>
  `;
}

async function loadCatalog() {
  const payload = await api("/api/courses");
  state.courses = payload.courses;
  state.testimonials = payload.testimonials;
  state.contact = payload.contact;
  renderCourses();
  renderTestimonials();
  renderContact();
}

function renderCourseDetail(course, chapters) {
  const paymentContent = course.paid
    ? `
      <h3>Access unlocked</h3>
      <p class="payment-note">Payment is marked as approved in the database for your account. Your lesson links are available below.</p>
    `
    : `
      <h3>Complete payment</h3>
      <img class="qr" src="${course.qrImage}" alt="QR code for ${course.title} payment">
      <p class="payment-note">Pay <strong>${course.priceLabel}</strong>${course.hasDiscount ? ` (was <s>${course.originalPriceLabel}</s>)` : ""} using this QR code. After the database payment record is updated for your user and this course, refresh this page to unlock the video links.</p>
    `;

  const videoContent = `
    <section class="video-section">
      <h3>Video Lessons</h3>
      <div class="chapters-container">
        ${chapters
          .map(
            (chapter) => `
              <div class="chapter-block">
                <button class="chapter-header" type="button" data-chapter-id="${escapeHtml(chapter.id)}">
                  <span class="chapter-title">
                    ${escapeHtml(chapter.title)}
                    ${chapter.isFree && !course.paid ? `<span class="free-badge">Free Preview</span>` : ""}
                  </span>
                  <span class="chapter-arrow">▼</span>
                </button>
                <div class="chapter-videos hidden" data-chapter-id="${escapeHtml(chapter.id)}">
                  ${chapter.locked
                    ? `<p class="locked-message">🔒 Complete payment to unlock this chapter.</p>`
                    : chapter.videos
                        .map(
                          (video) => `
                            <a class="video-link" href="${video.redirectUrl}" target="_blank" rel="noopener">
                              ${escapeHtml(video.title)}
                            </a>
                          `
                        )
                        .join("")
                  }
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  els.courseDetailView.innerHTML = `
    <button class="back-button" type="button" id="backToCourses">Back to courses</button>
    <div class="detail-hero" style="margin-top:16px">
      <article class="detail-main">
        <p class="eyebrow">${course.level} • ${course.duration}</p>
        <h2>${course.title}</h2>
        <p class="detail-copy">${course.why}</p>
        <div class="detail-grid">
          <div>
            <h3>Who is eligible</h3>
            <ul>${course.eligible.map((item) => `<li>${item}</li>`).join("")}</ul>
          </div>
          <div>
            <h3>What you will build</h3>
            <ul>${course.outcomes.map((item) => `<li>${item}</li>`).join("")}</ul>
          </div>
        </div>
      </article>
      <aside class="payment-panel">${paymentContent}</aside>
    </div>
    ${videoContent}
  `;

  document.querySelector("#backToCourses").addEventListener("click", () => {
    history.pushState(null, "", "/");
    showCatalog();
  });

  // Add chapter toggle functionality
  document.querySelectorAll(".chapter-header").forEach((header) => {
    header.addEventListener("click", () => {
      const chapterId = header.dataset.chapterId;
      const videosDiv = document.querySelector(`.chapter-videos[data-chapter-id="${chapterId}"]`);
      const arrow = header.querySelector(".chapter-arrow");
      
      videosDiv.classList.toggle("hidden");
      arrow.textContent = videosDiv.classList.contains("hidden") ? "▼" : "▲";
    });
  });
}

async function openCourse(courseId) {
  state.selectedCourseId = courseId;
  const payload = await api(`/api/courses/${courseId}`);
  renderCourseDetail(payload.course, payload.chapters || []);
  showDetailsShell();
  history.pushState(null, "", `/#course/${courseId}`);
}


// ─── Admin helpers ───────────────────────────────────────────────────────────

async function loadAdminData() {
  // Snapshot all currently selected values before refresh
  const snap = {
    enrollCourse:      els.adminEnrollCourse.value,
    chapterCourse:     els.adminChapterCourse.value,
    videoCourse:       els.adminVideoCourse.value,
    videoChapter:      els.adminVideoChapter.value,
    editChapterCourse: els.adminEditChapterCourse.value,
    editChapter:       els.adminEditChapterSelect.value,
    editVideoCourse:   els.adminEditVideoCourse.value,
    editVideoChapter:  els.adminEditVideoChapter.value,
    editVideo:         els.adminEditVideoSelect.value,
    revokeCourse:      els.adminRevokeCourse.value
  };

  const coursesPayload = await api("/api/admin/courses");
  state.adminCourses = coursesPayload.courses;
  populateCourseSelects();

  // Restore course selects
  const restoreCourse = (el, val) => { if (val) el.value = val; };
  restoreCourse(els.adminEnrollCourse, snap.enrollCourse);
  restoreCourse(els.adminChapterCourse, snap.chapterCourse);
  restoreCourse(els.adminVideoCourse, snap.videoCourse);
  restoreCourse(els.adminEditChapterCourse, snap.editChapterCourse);
  restoreCourse(els.adminEditVideoCourse, snap.editVideoCourse);
  restoreCourse(els.adminRevokeCourse, snap.revokeCourse);

  // Re-cascade dependent dropdowns
  if (snap.enrollCourse) await refreshEnrollUsers(snap.enrollCourse);

  if (snap.videoCourse) {
    ss.videoChapter.setOptions(chapterOptionsList(snap.videoCourse));
    if (snap.videoChapter) ss.videoChapter.setValue(snap.videoChapter);
  }

  if (snap.editChapterCourse) {
    ss.editChapterSel.setOptions(chapterOptionsList(snap.editChapterCourse));
    if (snap.editChapter) ss.editChapterSel.setValue(snap.editChapter);
  }

  if (snap.editVideoCourse) {
    ss.editVideoChapter.setOptions(chapterOptionsList(snap.editVideoCourse));
    if (snap.editVideoChapter) {
      ss.editVideoChapter.setValue(snap.editVideoChapter);
      ss.editVideoSel.setOptions(videoOptionsList(snap.editVideoCourse, snap.editVideoChapter));
      if (snap.editVideo) ss.editVideoSel.setValue(snap.editVideo);
    }
  }

  if (snap.revokeCourse) {
    const payload = await api(`/api/admin/enrollments?courseId=${encodeURIComponent(snap.revokeCourse)}`);
    if (payload.enrollments.length === 0) {
      ss.revokeUser.setOptions([{ value: "", label: "No enrolled users" }]);
    } else {
      ss.revokeUser.setOptions(
        [{ value: "", label: "Select user…" }].concat(
          payload.enrollments.map((e) => ({ value: e.userId, label: `${e.name} — ${e.email}` }))
        )
      );
    }
  }
}

async function refreshEnrollUsers(courseId) {
  if (!courseId) {
    ss.enrollUser.setOptions([{ value: "", label: "Select course first…" }]);
    return;
  }
  const usersPayload = await api(`/api/admin/users?excludeEnrolled=${encodeURIComponent(courseId)}`);
  state.adminUsers = usersPayload.users;
  if (usersPayload.users.length === 0) {
    ss.enrollUser.setOptions([{ value: "", label: "All users already enrolled" }]);
  } else {
    ss.enrollUser.setOptions(
      [{ value: "", label: "Select user…" }].concat(
        usersPayload.users.map((u) => ({ value: u.id, label: `${u.name} — ${u.email}` }))
      )
    );
  }
}

function courseOptionsList() {
  return [{ value: "", label: "Select course…" }].concat(
    state.adminCourses.map((c) => ({ value: c.id, label: c.title }))
  );
}

function chapterOptionsList(courseId) {
  const course = state.adminCourses.find((c) => c.id === courseId);
  if (!course) return [{ value: "", label: "Select chapter…" }];
  return [{ value: "", label: "Select chapter…" }].concat(
    course.chapters.map((ch) => ({ value: ch.id, label: ch.title }))
  );
}

function videoOptionsList(courseId, chapterId) {
  const course = state.adminCourses.find((c) => c.id === courseId);
  if (!course) return [{ value: "", label: "Select video…" }];
  const chapter = course.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) return [{ value: "", label: "Select video…" }];
  return [{ value: "", label: "Select video…" }].concat(
    (chapter.videos || []).map((v) => ({ value: v.id, label: v.title }))
  );
}

function populateCourseSelects() {
  const courses = courseOptionsList();
  const setPlain = (el, opts) => {
    el.innerHTML = opts.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  };
  setPlain(els.adminEnrollCourse, courses);
  setPlain(els.adminChapterCourse, courses);
  setPlain(els.adminVideoCourse, courses);
  setPlain(els.adminEditChapterCourse, courses);
  setPlain(els.adminEditVideoCourse, courses);
  setPlain(els.adminRevokeCourse, courses);

  ss.enrollUser.setOptions([{ value: "", label: "Select course first…" }]);
  ss.videoChapter.setOptions([{ value: "", label: "Select chapter…" }]);
  ss.editChapterSel.setOptions([{ value: "", label: "Select chapter…" }]);
  ss.editVideoChapter.setOptions([{ value: "", label: "Select chapter…" }]);
  ss.editVideoSel.setOptions([{ value: "", label: "Select video…" }]);
  ss.revokeUser.setOptions([{ value: "", label: "Select course first…" }]);
}

function updateChapterSelect(courseId) {
  ss.videoChapter.setOptions(chapterOptionsList(courseId));
}

function setAdminMessage(el, text, isError) {
  el.textContent = text;
  el.style.color = isError ? "var(--red)" : "var(--green)";
  if (!isError && text) {
    clearTimeout(el._clearTimer);
    el._clearTimer = setTimeout(() => { el.textContent = ""; }, 4000);
  }
}

function adminConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.querySelector("#adminConfirmOverlay");
    const text = document.querySelector("#adminConfirmText");
    const okBtn = document.querySelector("#adminConfirmOk");
    const cancelBtn = document.querySelector("#adminConfirmCancel");
    text.textContent = message;
    overlay.classList.remove("hidden");
    const cleanup = (result) => {
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

async function boot() {
  console.log("Boot function called");
  try {
    const payload = await api("/api/me");
    state.user = payload.user;
    await loadCatalog();
    showApp();
    const courseId = location.hash.replace("#course/", "");
    if (courseId) await openCourse(courseId);
  } catch (error) {
    console.log("Boot failed, showing login:", error);
    showLogin();
  }
}

function init() {
  console.log("Initializing app");
  initElements();
  
  if (!els.loginForm) {
    console.error("Login form not found!");
    return;
  }
  
  // Setup event listeners for form toggling
  if (els.showSignup) {
    els.showSignup.addEventListener("click", showSignupForm);
  }
  if (els.showLogin) {
    els.showLogin.addEventListener("click", showLoginForm);
  }
  if (els.showForgotPassword) {
    els.showForgotPassword.addEventListener("click", showForgotPasswordForm);
  }
  if (els.backToLogin) {
    els.backToLogin.addEventListener("click", showLoginForm);
  }

  if (els.forgotPasswordForm) {
    els.forgotPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      els.forgotPasswordMessage.textContent = "";
      els.forgotPasswordMessage.style.color = "";
      const formData = new FormData(els.forgotPasswordForm);

      try {
        const payload = await api("/api/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: formData.get("email") })
        });
        els.forgotPasswordMessage.textContent = payload.message;
        els.forgotPasswordMessage.style.color = "var(--green)";
        els.forgotPasswordForm.reset();
      } catch (error) {
        els.forgotPasswordMessage.textContent = error.message;
        els.forgotPasswordMessage.style.color = "var(--red)";
      }
    });
  }

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    console.log("Login form submitted");
    els.loginMessage.textContent = "";
    els.loginMessage.style.color = "";
    const formData = new FormData(els.loginForm);

    try {
      const payload = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      console.log("Login successful", payload);
      state.user = payload.user;
      await loadCatalog();
      showApp();
      showCatalog(); // always land on catalog, never re-enter a stale course
    } catch (error) {
      console.error("Login failed:", error);
      els.loginMessage.textContent = error.message;
      els.loginMessage.style.color = "var(--red)";
    }
  });

  els.signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    console.log("Signup form submitted");
    els.signupMessage.textContent = "";
    els.signupMessage.style.color = "";
    const formData = new FormData(els.signupForm);

    try {
      const payload = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          mobile: formData.get("mobile"),
          password: formData.get("password")
        })
      });
      console.log("Registration successful", payload);
      state.user = payload.user;
      await loadCatalog();
      showApp();
      showCatalog(); // always land on catalog, never re-enter a stale course
    } catch (error) {
      console.error("Registration failed:", error);
      els.signupMessage.textContent = error.message;
      els.signupMessage.style.color = "var(--red)";
    }
  });

  // User profile dropdown toggle
  els.userMenuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !els.userDropdown.classList.contains("hidden");
    els.userDropdown.classList.toggle("hidden", isOpen);
    els.userMenuButton.setAttribute("aria-expanded", String(!isOpen));
  });
  document.addEventListener("click", () => {
    els.userDropdown.classList.add("hidden");
    els.userMenuButton.setAttribute("aria-expanded", "false");
  });

  els.logoutButton.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    showLogin(); // resetState() is called inside showLogin
  });

  els.courseGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-course]");
    if (button) openCourse(button.dataset.course);
  });

  els.testimonialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.testimonialMessage.textContent = "";
    const formData = new FormData(els.testimonialForm);

    try {
      const payload = await api("/api/testimonials", {
        method: "POST",
        body: JSON.stringify({
          role: formData.get("role"),
          quote: formData.get("quote")
        })
      });
      els.testimonialMessage.textContent = payload.message;
      els.testimonialMessage.style.color = "var(--green)";
      els.testimonialForm.reset();
    } catch (error) {
      els.testimonialMessage.textContent = error.message;
      els.testimonialMessage.style.color = "var(--red)";
    }
  });

  // Admin testimonial toggle removed - manage in MongoDB Atlas

  els.catalogTab.addEventListener("click", showCatalog);
  els.adminTab.addEventListener("click", async () => {
    showAdmin();
    await loadAdminData();
  });

  // Admin: when enroll course changes, reload non-enrolled users
  els.adminEnrollCourse.addEventListener("change", () => {
    refreshEnrollUsers(els.adminEnrollCourse.value);
  });

  // Admin: course select changes chapter list for video form
  els.adminVideoCourse.addEventListener("change", () => {
    updateChapterSelect(els.adminVideoCourse.value);
  });

  // Admin: enroll user
  els.adminEnrollBtn.addEventListener("click", async () => {
    const courseId = els.adminEnrollCourse.value;
    const userId = els.adminEnrollUser.value;
    const courseName = els.adminEnrollCourse.options[els.adminEnrollCourse.selectedIndex]?.text || "";
    const userName = els.adminEnrollUser.options[els.adminEnrollUser.selectedIndex]?.text || "";
    els.adminEnrollMessage.textContent = "";
    if (!courseId || !userId) {
      setAdminMessage(els.adminEnrollMessage, "Please select both a course and a user.", true);
      return;
    }
    const ok = await adminConfirm(`Enroll "${userName}" in "${courseName}"?\n\nThis will give them full paid access to the course.`);
    if (!ok) return;
    try {
      const payload = await api("/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({ userId, courseId })
      });
      setAdminMessage(els.adminEnrollMessage, payload.message, false);
      await refreshEnrollUsers(courseId);
    } catch (err) {
      setAdminMessage(els.adminEnrollMessage, err.message, true);
    }
  });

  // Admin: add chapter
  els.adminAddChapterBtn.addEventListener("click", async () => {
    const courseId = els.adminChapterCourse.value;
    const title = els.adminChapterTitle.value.trim();
    els.adminChapterMessage.textContent = "";
    if (!courseId || !title) {
      setAdminMessage(els.adminChapterMessage, "Please select a course and enter a chapter title.", true);
      return;
    }
    try {
      const payload = await api(`/api/admin/courses/${courseId}/chapters`, {
        method: "POST",
        body: JSON.stringify({ title })
      });
      setAdminMessage(els.adminChapterMessage, `Chapter "${payload.chapter.title}" added successfully.`, false);
      els.adminChapterTitle.value = "";
      await loadAdminData(); // Refresh so chapter appears in video form
    } catch (err) {
      setAdminMessage(els.adminChapterMessage, err.message, true);
    }
  });

  // Admin: add video
  els.adminAddVideoBtn.addEventListener("click", async () => {
    const courseId = els.adminVideoCourse.value;
    const chapterId = els.adminVideoChapter.value;
    const title = els.adminVideoTitle.value.trim();
    const url = els.adminVideoUrl.value.trim();
    els.adminVideoMessage.textContent = "";
    if (!courseId || !chapterId || !title || !url) {
      setAdminMessage(els.adminVideoMessage, "Please fill in all fields.", true);
      return;
    }
    try {
      const payload = await api(`/api/admin/courses/${courseId}/chapters/${chapterId}/videos`, {
        method: "POST",
        body: JSON.stringify({ title, url })
      });
      setAdminMessage(els.adminVideoMessage, `Video "${payload.video.title}" added with ID ${payload.video.id}.`, false);
      els.adminVideoTitle.value = "";
      els.adminVideoUrl.value = "";
      await loadAdminData();
    } catch (err) {
      setAdminMessage(els.adminVideoMessage, err.message, true);
    }
  });

  // Admin: edit chapter — cascade selects
  els.adminEditChapterCourse.addEventListener("change", () => {
    ss.editChapterSel.setOptions(chapterOptionsList(els.adminEditChapterCourse.value));
  });

  // Admin: rename chapter
  els.adminRenameChapterBtn.addEventListener("click", async () => {
    const courseId = els.adminEditChapterCourse.value;
    const chapterId = els.adminEditChapterSelect.value;
    const title = els.adminEditChapterTitle.value.trim();
    els.adminEditChapterMessage.textContent = "";
    if (!courseId || !chapterId || !title) {
      setAdminMessage(els.adminEditChapterMessage, "Select a course, chapter, and enter new title.", true);
      return;
    }
    try {
      await api(`/api/admin/courses/${courseId}/chapters/${chapterId}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setAdminMessage(els.adminEditChapterMessage, "Chapter renamed successfully.", false);
      els.adminEditChapterTitle.value = "";
      await loadAdminData();
    } catch (err) { setAdminMessage(els.adminEditChapterMessage, err.message, true); }
  });

  // Admin: delete chapter
  els.adminDeleteChapterBtn.addEventListener("click", async () => {
    const courseId = els.adminEditChapterCourse.value;
    const chapterId = els.adminEditChapterSelect.value;
    const chapterTitle = ss.editChapterSel.trigger?.textContent || "";
    els.adminEditChapterMessage.textContent = "";
    if (!courseId || !chapterId) {
      setAdminMessage(els.adminEditChapterMessage, "Select a course and chapter.", true);
      return;
    }
    const ok = await adminConfirm(`Delete chapter "${chapterTitle}"?\n\nThis will permanently delete the chapter and all its videos. This cannot be undone.`);
    if (!ok) return;
    try {
      await api(`/api/admin/courses/${courseId}/chapters/${chapterId}`, { method: "DELETE" });
      setAdminMessage(els.adminEditChapterMessage, "Chapter deleted.", false);
      await loadAdminData();
    } catch (err) { setAdminMessage(els.adminEditChapterMessage, err.message, true); }
  });

  // Admin: edit video — cascade selects
  els.adminEditVideoCourse.addEventListener("change", () => {
    ss.editVideoChapter.setOptions(chapterOptionsList(els.adminEditVideoCourse.value));
    ss.editVideoSel.setOptions([{ value: "", label: "Select video…" }]);
  });
  els.adminEditVideoChapter.addEventListener("change", () => {
    ss.editVideoSel.setOptions(videoOptionsList(els.adminEditVideoCourse.value, els.adminEditVideoChapter.value));
  });

  // Admin: save video (rename / re-link)
  els.adminRenameVideoBtn.addEventListener("click", async () => {
    const courseId = els.adminEditVideoCourse.value;
    const chapterId = els.adminEditVideoChapter.value;
    const videoId = els.adminEditVideoSelect.value;
    const title = els.adminEditVideoTitle.value.trim();
    const url = els.adminEditVideoUrl.value.trim();
    els.adminEditVideoMessage.textContent = "";
    if (!courseId || !chapterId || !videoId || (!title && !url)) {
      setAdminMessage(els.adminEditVideoMessage, "Select a video and enter a new title or URL.", true);
      return;
    }
    try {
      await api(`/api/admin/courses/${courseId}/chapters/${chapterId}/videos/${videoId}`, { method: "PATCH", body: JSON.stringify({ title, url }) });
      setAdminMessage(els.adminEditVideoMessage, "Video updated successfully.", false);
      els.adminEditVideoTitle.value = "";
      els.adminEditVideoUrl.value = "";
      await loadAdminData();
    } catch (err) { setAdminMessage(els.adminEditVideoMessage, err.message, true); }
  });

  // Admin: delete video
  els.adminDeleteVideoBtn.addEventListener("click", async () => {
    const courseId = els.adminEditVideoCourse.value;
    const chapterId = els.adminEditVideoChapter.value;
    const videoId = els.adminEditVideoSelect.value;
    const videoTitle = ss.editVideoSel.trigger?.textContent || "";
    els.adminEditVideoMessage.textContent = "";
    if (!courseId || !chapterId || !videoId) {
      setAdminMessage(els.adminEditVideoMessage, "Select a course, chapter, and video.", true);
      return;
    }
    const ok = await adminConfirm(`Delete video "${videoTitle}"?\n\nThis will permanently remove the video from the chapter. This cannot be undone.`);
    if (!ok) return;
    try {
      await api(`/api/admin/courses/${courseId}/chapters/${chapterId}/videos/${videoId}`, { method: "DELETE" });
      setAdminMessage(els.adminEditVideoMessage, "Video deleted.", false);
      await loadAdminData();
    } catch (err) { setAdminMessage(els.adminEditVideoMessage, err.message, true); }
  });

  // Admin: revoke — load enrolled users when course changes
  els.adminRevokeCourse.addEventListener("change", async () => {
    const courseId = els.adminRevokeCourse.value;
    if (!courseId) { ss.revokeUser.setOptions([{ value: "", label: "Select course first…" }]); return; }
    try {
      const payload = await api(`/api/admin/enrollments?courseId=${encodeURIComponent(courseId)}`);
      if (payload.enrollments.length === 0) {
        ss.revokeUser.setOptions([{ value: "", label: "No enrolled users" }]);
      } else {
        ss.revokeUser.setOptions(
          [{ value: "", label: "Select user…" }].concat(
            payload.enrollments.map((e) => ({ value: e.userId, label: `${e.name} — ${e.email}` }))
          )
        );
      }
    } catch (err) { setAdminMessage(els.adminRevokeMessage, err.message, true); }
  });

  // Admin: revoke paid access
  els.adminRevokeBtn.addEventListener("click", async () => {
    const courseId = els.adminRevokeCourse.value;
    const userId = els.adminRevokeUser.value;
    const userName = ss.revokeUser.trigger?.textContent || "";
    els.adminRevokeMessage.textContent = "";
    if (!courseId || !userId) {
      setAdminMessage(els.adminRevokeMessage, "Select a course and user.", true);
      return;
    }
    const courseName = els.adminRevokeCourse.options[els.adminRevokeCourse.selectedIndex]?.text || "";
    const ok = await adminConfirm(`Revoke paid access for "${userName}"?\n\nThey will lose access to "${courseName}" immediately.`);
    if (!ok) return;
    try {
      const payload = await api(`/api/admin/enrollments/${courseId}/${userId}`, { method: "DELETE" });
      setAdminMessage(els.adminRevokeMessage, payload.message, false);
      els.adminRevokeCourse.dispatchEvent(new Event("change"));
    } catch (err) { setAdminMessage(els.adminRevokeMessage, err.message, true); }
  });

  window.addEventListener("popstate", () => {
    const courseId = location.hash.replace("#course/", "");
    if (courseId) {
      openCourse(courseId);
    } else {
      showCatalog();
    }
  });

  // Password toggle functionality with checkbox
  document.querySelectorAll(".show-password-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const form = e.target.closest("form");
      const passwordInput = form.querySelector('input[name="password"]');
      passwordInput.type = e.target.checked ? "text" : "password";
    });
  });

  boot();
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
