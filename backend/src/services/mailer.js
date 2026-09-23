const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  MAIL_FROM,
} = require('../config');

const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// Built on first use, so requiring this module never opens a connection on a
// machine with no SMTP account.
let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transport;
}

// Throws on failure; notificationSender decides retry vs recorded failure.
async function sendMail({ to, subject, text }) {
  if (!to) throw new Error('sendMail requires a recipient');

  if (!configured) {
    // Same stance config.js takes on missing OAuth credentials: warn and keep
    // running, so the whole pipeline is exercisable without an SMTP account.
    // The row is marked sent, so a dev database does not fill with failures.
    console.log(`[mailer] (not configured) would send to ${to}: ${subject}`);
    return { delivered: false, skipped: true };
  }

  const info = await getTransport().sendMail({ from: MAIL_FROM, to, subject, text });

  // A 250 means accepted for delivery, not delivered. The id and accepted list
  // are what make "it never arrived" answerable against the provider's logs.
  console.log(
    `[mailer] accepted id=${info.messageId} to=${(info.accepted || []).join(',') || 'none'}`
    + `${info.rejected?.length ? ` rejected=${info.rejected.join(',')}` : ''}`
  );

  return {
    delivered: (info.accepted || []).length > 0,
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

function isMailConfigured() {
  return configured;
}

module.exports = { sendMail, isMailConfigured };
