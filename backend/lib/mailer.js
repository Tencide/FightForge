/**
 * Pluggable email sender.
 *
 * If SMTP env vars are configured, mail is sent via nodemailer. Otherwise the
 * message is logged to the server console so flows like password reset remain
 * fully testable in development without an email provider.
 *
 * Configure for production (any SMTP provider — Gmail, Resend, SendGrid, etc.):
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       e.g. 587 (STARTTLS) or 465 (implicit TLS)
 *   SMTP_USER       SMTP username
 *   SMTP_PASS       SMTP password / app password / API key
 *   SMTP_SECURE     "true" to force implicit TLS (defaults to true for port 465)
 *   MAIL_FROM       e.g. "FightForge <no-reply@fightforge.app>"
 */

let transporterPromise = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getTransporter() {
  if (!smtpConfigured()) return null;
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    // Lazy require so the dependency is only loaded when email is configured.
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure =
      process.env.SMTP_SECURE === 'true' ||
      (process.env.SMTP_SECURE !== 'false' && port === 465);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  })();

  return transporterPromise;
}

function defaultFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || 'FightForge <no-reply@fightforge.app>';
}

/**
 * Send an email. Returns { delivered: boolean }.
 * - delivered=true  → handed off to an SMTP server.
 * - delivered=false → no SMTP configured; the content was logged instead.
 * Never throws for missing configuration; only a real SMTP failure rejects.
 */
async function sendMail({ to, subject, text, html }) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(
      `[mailer] SMTP not configured — email not sent.\n` +
        `         To: ${to}\n         Subject: ${subject}\n         ${text || ''}`
    );
    return { delivered: false };
  }
  await transporter.sendMail({ from: defaultFrom(), to, subject, text, html });
  return { delivered: true };
}

module.exports = { sendMail, smtpConfigured };
