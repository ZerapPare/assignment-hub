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

// Built on first use rather than at import, so requiring this module never
// opens a connection on a machine that has no SMTP account.
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

// Throws when the send fails — notificationSender is what decides whether that
// means a retry or a recorded failure.
async function sendMail({ to, subject, text }) {
  if (!to) throw new Error('sendMail requires a recipient');

  if (!configured) {
    // Same stance config.js takes on missing OAuth credentials: warn, keep
    // running. This is what lets the whole reminder pipeline be exercised
    // without an SMTP account — the Notification row is marked sent, so a dev
    // database does not fill up with failures the student never caused.
    console.log(`[mailer] (not configured) would send to ${to}: ${subject}`);
    return { delivered: false, skipped: true };
  }

  const info = await getTransport().sendMail({ from: MAIL_FROM, to, subject, text });

  // A 250 from the relay is the furthest we can see: the mail is accepted for
  // delivery, not yet in anyone's inbox. Keeping the id and the accepted list is
  // what makes "it never arrived" answerable — without them there is nothing to
  // match against the provider's own logs.
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
