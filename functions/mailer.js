const nodemailer = require('nodemailer');

let transporter = null;

// Lazily built + cached: env vars may not be set until after this module is
// first required (e.g. during route registration at boot).
function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing).');
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// `fromEmail` is the individual employee's own address; the actual SMTP
// authentication always happens as SMTP_USER (the shared relay account).
// Whether the mail server accepts a From address that differs from the
// authenticated account depends on how the domain admin has configured it.
async function sendMail({ fromName, fromEmail, to, subject, html, attachments }) {
  const t = getTransporter();
  return t.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments,
  });
}

module.exports = { sendMail };
