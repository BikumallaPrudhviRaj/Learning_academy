console.log("App.js loaded successfully");

const state = {
  user: null,
  courses: [],
  testimonials: [],
  adminTestimonials: [],
  contact: null,
  selectedCourseId: null
};

let els = {};

function initElements() {
  els = {
    loginView: document.querySelector("#loginView"),
    appView: document.querySelector("#appView"),
    loginForm: document.querySelector("#loginForm"),
    loginMessage: document.querySelector("#loginMessage"),
    dbStatus: document.querySelector("#dbStatus"),
    forgotPasswordForm: document.querySelector("#forgotPasswordForm"),
    forgotPasswordMessage: document.querySelector("#forgotPasswordMessage"),
    showForgotPassword: document.querySelector("#showForgotPassword"),
    backToLogin: document.querySelector("#backToLogin"),
    userName: document.querySelector("#userName"),
    logoutButton: document.querySelector("#logoutButton"),
    courseGrid: document.querySelector("#courseGrid"),
    testimonialGrid: document.querySelector("#testimonialGrid"),
    contactBlock: document.querySelector("#contactBlock"),
    catalogView: document.querySelector("#catalogView"),
    courseDetailView: document.querySelector("#courseDetailView"),
    catalogTab: document.querySelector("#catalogTab"),
    detailTab: document.querySelector("#detailTab"),
    testimonialForm: document.querySelector("#testimonialForm"),
    testimonialMessage: document.querySelector("#testimonialMessage"),
    adminTestimonials: document.querySelector("#adminTestimonials"),
    adminTestimonialList: document.querySelector("#adminTestimonialList")
  };
  console.log("Elements initialized", els);
}

async function loadDbStatus() {
  try {
    const response = await fetch("/api/db-status");
    const data = await response.json();
    if (els.dbStatus) {
      els.dbStatus.textContent = `✓ Connected to ${data.database}`;
      els.dbStatus.style.color = "#0f62fe";
    }
  } catch (error) {
    if (els.dbStatus) {
      els.dbStatus.textContent = "⚠ Database connection status unknown";
      els.dbStatus.style.color = "#da1e28";
    }
  }
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

function showLoginForm() {
  els.loginForm.classList.remove("hidden");
  els.forgotPasswordForm.classList.add("hidden");
  els.loginMessage.textContent = "";
  els.forgotPasswordMessage.textContent = "";
}

function showForgotPasswordForm() {
  const loginEmail = els.loginForm.querySelector('input[name="email"]').value;
  els.loginForm.classList.add("hidden");
  els.forgotPasswordForm.classList.remove("hidden");
  els.forgotPasswordMessage.textContent = "";
  if (loginEmail) {
    els.forgotPasswordForm.querySelector('input[name="email"]').value = loginEmail;
  }
}

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
  showLoginForm();
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.userName.textContent = state.user.name;
  els.adminTestimonials.classList.toggle("hidden", !state.user.isAdmin);
}

function showCatalog() {
  els.catalogView.classList.remove("hidden");
  els.courseDetailView.classList.add("hidden");
  els.catalogTab.classList.add("active");
  els.detailTab.classList.remove("active");
}

function showDetailsShell() {
  els.catalogView.classList.add("hidden");
  els.courseDetailView.classList.remove("hidden");
  els.catalogTab.classList.remove("active");
  els.detailTab.classList.add("active");
  els.detailTab.disabled = false;
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
            <span class="price-block">
              ${course.hasDiscount ? `<s class="original-price">${course.originalPriceLabel}</s>` : ""}
              <strong class="final-price">${course.priceLabel}</strong>
            </span>
            ${course.paid ? '<span class="paid-badge">Paid access</span>' : ""}
          </div>
          <div class="card-actions">
            <button type="button" data-course="${course.id}">Choose course</button>
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

function renderAdminTestimonials() {
  if (!state.user?.isAdmin) return;

  els.adminTestimonialList.innerHTML = state.adminTestimonials.length
    ? state.adminTestimonials
        .map(
          (item) => `
        <article class="admin-testimonial-card" data-id="${escapeHtml(item.id)}">
          <div class="admin-testimonial-copy">
            <p>"${escapeHtml(item.quote)}"</p>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.role)}</span>
            <span class="admin-meta">${item.published ? "Visible to learners" : "Pending approval"}</span>
          </div>
          <label class="publish-toggle">
            <input type="checkbox" data-id="${escapeHtml(item.id)}" ${item.published ? "checked" : ""}>
            Show publicly
          </label>
        </article>
      `
        )
        .join("")
    : `<p class="hint">No testimonials submitted yet.</p>`;
}

async function loadAdminTestimonials() {
  if (!state.user?.isAdmin) return;
  const payload = await api("/api/admin/testimonials");
  state.adminTestimonials = payload.testimonials;
  renderAdminTestimonials();
}

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
  await loadAdminTestimonials();
}

function renderCourseDetail(course, videos) {
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

  const videoContent = course.paid
    ? `
      <section class="video-section">
        <h3>Video Lessons</h3>
        <div class="video-grid">
          ${videos
            .map(
              (video) => `
                <a class="video-link" href="${video.redirectUrl}" target="_blank" rel="noopener">
                  ${video.title}
                </a>
              `
            )
            .join("")}
        </div>
      </section>
    `
    : `
      <section class="video-section">
        <h3>Video Lessons</h3>
        <p class="payment-note">The recorded lessons appear here after payment approval.</p>
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
}

async function openCourse(courseId) {
  state.selectedCourseId = courseId;
  const payload = await api(`/api/courses/${courseId}`);
  renderCourseDetail(payload.course, payload.videos);
  showDetailsShell();
  history.pushState(null, "", `/#course/${courseId}`);
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
  
  // Load database status indicator
  loadDbStatus();
  
  // Setup event listeners
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
    } catch (error) {
      console.error("Login failed:", error);
      els.loginMessage.textContent = error.message;
      els.loginMessage.style.color = "var(--red)";
    }
  });

  els.logoutButton.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    showLogin();
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
      if (state.user?.isAdmin) await loadAdminTestimonials();
    } catch (error) {
      els.testimonialMessage.textContent = error.message;
      els.testimonialMessage.style.color = "var(--red)";
    }
  });

  els.adminTestimonialList.addEventListener("change", async (event) => {
    const input = event.target.closest('input[type="checkbox"][data-id]');
    if (!input) return;

    const testimonialId = input.dataset.id;
    const published = input.checked;

    try {
      await api(`/api/admin/testimonials/${testimonialId}`, {
        method: "PATCH",
        body: JSON.stringify({ published })
      });
      await loadCatalog();
    } catch (error) {
      input.checked = !published;
      alert(error.message);
    }
  });

  els.catalogTab.addEventListener("click", showCatalog);
  els.detailTab.addEventListener("click", () => {
    if (state.selectedCourseId) openCourse(state.selectedCourseId);
  });

  window.addEventListener("popstate", () => {
    const courseId = location.hash.replace("#course/", "");
    if (courseId) {
      openCourse(courseId);
    } else {
      showCatalog();
    }
  });

  boot();
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
