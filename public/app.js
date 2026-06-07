console.log("App.js loaded successfully - v3-testimonial-fix");

const state = {
  user: null,
  courses: [],
  testimonials: [],
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
    signupForm: document.querySelector("#signupForm"),
    signupMessage: document.querySelector("#signupMessage"),
    showSignup: document.querySelector("#showSignup"),
    showLogin: document.querySelector("#showLogin"),
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
    testimonialMessage: document.querySelector("#testimonialMessage")
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
  els.loginForm.reset();
  els.signupForm.reset();
  showLoginForm();
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.userName.textContent = state.user.name;
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
    } catch (error) {
      console.error("Registration failed:", error);
      els.signupMessage.textContent = error.message;
      els.signupMessage.style.color = "var(--red)";
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
    } catch (error) {
      els.testimonialMessage.textContent = error.message;
      els.testimonialMessage.style.color = "var(--red)";
    }
  });

  // Admin testimonial toggle removed - manage in MongoDB Atlas

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

  // Password toggle functionality
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const passwordField = button.closest(".password-field");
      const input = passwordField.querySelector("input");
      const isPassword = input.type === "password";
      
      input.type = isPassword ? "text" : "password";
      button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      
      // Toggle eye icon (add slash for hidden state)
      const svg = button.querySelector("svg");
      if (isPassword) {
        // Add slash line to indicate "hide"
        if (!svg.querySelector(".eye-slash")) {
          const slash = document.createElementNS("http://www.w3.org/2000/svg", "line");
          slash.setAttribute("class", "eye-slash");
          slash.setAttribute("x1", "1");
          slash.setAttribute("y1", "1");
          slash.setAttribute("x2", "23");
          slash.setAttribute("y2", "23");
          slash.setAttribute("stroke", "currentColor");
          slash.setAttribute("stroke-width", "2");
          svg.appendChild(slash);
        }
      } else {
        // Remove slash line
        const slash = svg.querySelector(".eye-slash");
        if (slash) slash.remove();
      }
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
