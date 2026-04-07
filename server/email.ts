/**
 * Email service abstraction.
 *
 * Configure by setting env vars. Supported providers:
 *
 *   SMTP (nodemailer — works with SES SMTP, Gmail, etc.)
 *     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 *   AWS SES via SDK (uncomment section below + npm install @aws-sdk/client-ses)
 *     AWS_SES_REGION, AWS_SES_FROM
 *
 *   SendGrid (uncomment section below + npm install @sendgrid/mail)
 *     SENDGRID_API_KEY, EMAIL_FROM
 *
 *   Resend (uncomment section below + npm install resend)
 *     RESEND_API_KEY, EMAIL_FROM
 *
 * If no provider is configured, emails are logged to console only.
 */

import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  // ── SMTP / nodemailer (default — also works with AWS SES SMTP endpoint) ──
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    });
    return;
  }

  // ── AWS SES SDK ───────────────────────────────────────────────────────────
  // npm install @aws-sdk/client-ses
  // .env: AWS_SES_REGION=eu-west-1  AWS_SES_FROM=noreply@yourdomain.com
  //
  // if (process.env.AWS_SES_FROM) {
  //   const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
  //   const ses = new SESClient({ region: process.env.AWS_SES_REGION });
  //   await ses.send(new SendEmailCommand({
  //     Source: process.env.AWS_SES_FROM,
  //     Destination: { ToAddresses: [msg.to] },
  //     Message: {
  //       Subject: { Data: msg.subject },
  //       Body: {
  //         Text: { Data: msg.text },
  //         ...(msg.html ? { Html: { Data: msg.html } } : {}),
  //       },
  //     },
  //   }));
  //   return;
  // }

  // ── SENDGRID ──────────────────────────────────────────────────────────────
  // npm install @sendgrid/mail
  // .env: SENDGRID_API_KEY=SG.xxx  EMAIL_FROM=noreply@yourdomain.com
  //
  // if (process.env.SENDGRID_API_KEY) {
  //   const sgMail = (await import("@sendgrid/mail")).default;
  //   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  //   await sgMail.send({
  //     to: msg.to, from: process.env.EMAIL_FROM!,
  //     subject: msg.subject, text: msg.text,
  //     ...(msg.html ? { html: msg.html } : {}),
  //   });
  //   return;
  // }

  // ── RESEND ────────────────────────────────────────────────────────────────
  // npm install resend
  // .env: RESEND_API_KEY=re_xxx  EMAIL_FROM=noreply@resend.dev
  //
  // if (process.env.RESEND_API_KEY) {
  //   const { Resend } = await import("resend");
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({
  //     from: process.env.EMAIL_FROM!, to: msg.to,
  //     subject: msg.subject, text: msg.text,
  //     ...(msg.html ? { html: msg.html } : {}),
  //   });
  //   return;
  // }

  // ── CONSOLE FALLBACK (no provider configured) ─────────────────────────────
  console.log(`[email] No provider configured — logging only`);
  console.log(`[email] To: ${msg.to} | Subject: ${msg.subject}`);
  console.log(`[email] ${msg.text}`);
}

/** Returns true if a real email provider is configured. */
export function emailEnabled(): boolean {
  return !!(
    process.env.SMTP_HOST ||
    process.env.AWS_SES_FROM ||
    process.env.SENDGRID_API_KEY ||
    process.env.RESEND_API_KEY
  );
}
