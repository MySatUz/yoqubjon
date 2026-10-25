/**
 * Transactional email through Brevo's HTTP API (free plan: 300 emails a day),
 * with no SDK - one `fetch`.
 *
 * Configured by environment variables:
 *   BREVO_API_KEY   the API key ("xkeysib-…"), from Brevo → SMTP & API
 *   EMAIL_FROM      a sender on a domain authenticated in Brevo, e.g. no-reply@slope.uz
 *   EMAIL_FROM_NAME optional, defaults to "MYSATuz"
 *   EMAIL_DEV_LOG=1 local only: print emails to the server log instead of sending
 *
 * The mode also switches the whole email-code feature on (src/lib/emailCodes.ts):
 * with neither a key nor EMAIL_DEV_LOG the app signs people up exactly as before
 * and never touches the PendingEmailVerification, EmailCode or AuthAttempt
 * tables. So the migration that creates them has to be applied to a database
 * before BREVO_API_KEY is set for the deployment that uses it.
 */

export type EmailMode = 'brevo' | 'log' | 'off';

export function getEmailMode(): EmailMode {
  if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM) return 'brevo';
  if (process.env.EMAIL_DEV_LOG === '1' && process.env.NODE_ENV !== 'production') return 'log';
  // `next start` runs with NODE_ENV=production, so a local production build
  // can opt in explicitly. Never set this on Vercel.
  if (process.env.EMAIL_DEV_LOG === 'force') return 'log';
  return 'off';
}

export function isEmailEnabled() {
  return getEmailMode() !== 'off';
}

type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const mode = getEmailMode();

  if (mode === 'off') return false;

  if (mode === 'log') {
    console.info(`[email] to ${email.to} — ${email.subject}\n${email.text}`);
    return true;
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY ?? '',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: process.env.EMAIL_FROM_NAME || 'MYSATuz', email: process.env.EMAIL_FROM },
        to: [{ email: email.to }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
      // A stuck provider must not hold a sign-up open for a minute.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Never log the key; the body says what Brevo refused (an unauthorised
      // IP, an unverified sender, the daily limit).
      console.error('Brevo send failed:', response.status, await response.text().catch(() => ''));
      return false;
    }

    return true;
  } catch (error) {
    console.error('Brevo send failed:', error);
    return false;
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/**
 * The one email layout: the brand line, a sentence, the code set large, and a
 * line saying what to do if the email was not expected. Plain inline styles,
 * since mail clients ignore stylesheets.
 */
export function codeEmail({ intro, code, minutes }: { intro: string; code: string; minutes: number }) {
  const text = `${intro}\n\n${code}\n\nThe code works for ${minutes} minutes. If you did not ask for it, you can ignore this email.\n\nMYSATuz · Digital SAT Math practice`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f3f3;font-family:Fira Sans,Segoe UI,Arial,sans-serif;color:#161b1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e3e7e8;border-radius:16px;padding:28px">
<tr><td style="font-size:16px;font-weight:600;padding-bottom:20px"><span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:#0d6657;vertical-align:middle;margin-right:8px"></span>MYSATuz</td></tr>
<tr><td style="font-size:14px;line-height:22px;color:#394447">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:20px 0;font-size:32px;font-weight:600;letter-spacing:8px;font-variant-numeric:tabular-nums">${escapeHtml(code)}</td></tr>
<tr><td style="font-size:12px;line-height:18px;color:#67787c">The code works for ${minutes} minutes. If you did not ask for it, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
