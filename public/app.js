const state = {
  user: null,
  courses: [],
  testimonials: [],
  contact: null,
  selectedCourseId: null
};

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
  userName: document.querySelector("#userName"),
  logoutButton: document.querySelector("#logoutButton"),
  courseGrid: document.querySelector("#courseGrid"),
  testimonialGrid: document.querySelector("#testimonialGrid"),
  contactBlock: document.querySelector("#contactBlock"),
  catalogView: document.querySelector("#catalogView"),
  courseDetailView: document.querySelector("#courseDetailView"),
  catalogTab: document.querySelector("#catalogTab"),
  detailTab: document.querySelector("#detailTab")
};

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

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
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
  els.testimonialGrid.innerHTML = state.testimonials
    .map(
      (item) => `
        <article class="testimonial-card">
          <p>"${item.quote}"</p>
          <strong>${item.name}</strong>
          <span>${item.role}</span>
        </article>
      `
    )
    .join("");
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
        <p class="payment-note">The 100 direct Google Drive lesson redirects appear here after payment approval.</p>
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

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginMessage.textContent = "";
  const formData = new FormData(els.loginForm);

  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    state.user = payload.user;
    await loadCatalog();
    showApp();
  } catch (error) {
    els.loginMessage.textContent = error.message;
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

async function boot() {
  try {
    const payload = await api("/api/me");
    state.user = payload.user;
    await loadCatalog();
    showApp();
    const courseId = location.hash.replace("#course/", "");
    if (courseId) await openCourse(courseId);
  } catch {
    showLogin();
  }
}

boot();
