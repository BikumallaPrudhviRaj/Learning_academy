async function sendPasswordEmail({ to, name, password }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    const error = new Error("Email service is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env");
    error.code = "RESEND_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Up 'N' Rise Learning Academy login password",
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px">
          <p>Hi ${escapeHtml(name)},</p>
          <p>You asked for your login password for Northstar Learning Academy.</p>
          <p><strong>Email:</strong> ${escapeHtml(to)}<br>
          <strong>Password:</strong> ${escapeHtml(password)}</p>
          <p>Use these details on the login page to access your courses.</p>
          <p style="color:#5d6678;font-size:14px">If you did not request this email, you can ignore it.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.message || "Failed to send email");
    error.code = "RESEND_SEND_FAILED";
    error.status = response.status;
    throw error;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = { sendPasswordEmail };
