import { Resend } from "resend";
import nodemailer from "nodemailer";
import { Logger } from "../utils/logger.util";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "Realtors Practice <noreply@realtorspractice.com>";

// SMTP config from env (optional — if set, used as fallback or primary)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

let resend: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  Logger.info("[Email] Resend email service initialized");
}

if (SMTP_HOST && SMTP_USER) {
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  Logger.info(`[Email] SMTP transport initialized (${SMTP_HOST}:${SMTP_PORT})`);
}

if (!resend && !smtpTransporter) {
  Logger.info("[Email] No email provider configured — email service disabled (no-op mode)");
}

/**
 * Send an email using whatever provider is configured (Resend preferred, SMTP fallback)
 */
async function sendEmail(to: string, subject: string, html: string, from?: string) {
  const sender = from || FROM_EMAIL;

  // Try Resend first
  if (resend) {
    await resend.emails.send({ from: sender, to, subject, html });
    return;
  }

  // Fallback to SMTP
  if (smtpTransporter) {
    await smtpTransporter.sendMail({ from: sender, to, subject, html });
    return;
  }

  throw new Error("No email provider configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS environment variables.");
}

export class EmailService {
  /**
   * Send a test email to verify configuration
   */
  static async sendTestEmail(to: string) {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0001FC;">Email Configuration Test</h2>
        <p>If you're reading this, your email configuration is working correctly.</p>
        <p style="color: #6b7280; font-size: 14px;">Sent from Realtors' Practice</p>
      </div>
    `;

    await sendEmail(to, "Test Email — Realtors' Practice", html);
    Logger.info(`[Email] Test email sent to ${to}`);
  }

  /**
   * Send a saved search match notification email
   */
  static async sendNewMatchEmail(
    to: string,
    savedSearchName: string,
    matchCount: number,
    matchPreview: Array<{ title: string; price: number | null; area: string | null }>
  ) {
    if (!resend && !smtpTransporter) return;

    const matchList = matchPreview
      .map(
        (m) =>
          `<li style="margin-bottom: 8px;">
            <strong>${m.title}</strong><br/>
            ${m.price ? `₦${new Intl.NumberFormat().format(m.price)}` : "Price on request"}
            ${m.area ? ` · ${m.area}` : ""}
          </li>`
      )
      .join("");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Matches Found!</h1>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px;">
            Your saved search <strong>"${savedSearchName}"</strong> found <strong>${matchCount} new ${matchCount === 1 ? "property" : "properties"}</strong>.
          </p>
          <ul style="color: #4b5563; font-size: 14px; padding-left: 20px;">
            ${matchList}
          </ul>
          ${matchCount > matchPreview.length ? `<p style="color: #6b7280; font-size: 14px;">And ${matchCount - matchPreview.length} more...</p>` : ""}
          <div style="margin-top: 24px; text-align: center;">
            <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/saved-searches"
               style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View All Matches
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
            Realtors' Practice — Nigerian Property Intelligence Platform
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail(to, `${matchCount} new ${matchCount === 1 ? "match" : "matches"} for "${savedSearchName}"`, html);
      Logger.info(`[Email] Match notification sent to ${to} for "${savedSearchName}"`);
    } catch (err: any) {
      Logger.error(`[Email] Failed to send to ${to}: ${err.message}`);
    }
  }

  /**
   * Send an invitation email to a new team member
   */
  static async sendInviteEmail(
    to: string,
    inviterName: string,
    role: string,
    inviteCode: string
  ) {
    if (!resend && !smtpTransporter) {
      Logger.warn("[Email] No email provider configured — invite email skipped");
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const roleLabel = role.charAt(0) + role.slice(1).toLowerCase().replace("_", " ");
    const registerLink = `${frontendUrl}/admin-register?code=${inviteCode}&email=${encodeURIComponent(to)}`;

    const html = `
      <div style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f7f7; padding: 32px;">
        <div style="background: linear-gradient(135deg, #0001FC 0%, #3b5bfd 100%); padding: 40px 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0 0 8px; font-size: 28px; font-family: 'Space Grotesk', sans-serif;">You're Invited!</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 16px;">Join the Realtors' Practice platform</p>
        </div>
        <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="color: #1A1A1A; font-size: 16px; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to join <strong>Realtors' Practice</strong> as a <strong>${roleLabel}</strong>.
          </p>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
            Use the invitation code below when creating your account. This code expires in <strong>24 hours</strong>.
          </p>
          <div style="margin: 28px 0; text-align: center;">
            <div style="display: inline-block; background: #f0f0ff; border: 2px dashed #0001FC; border-radius: 12px; padding: 16px 40px;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Your Invitation Code</p>
              <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0001FC; font-family: 'Space Grotesk', monospace;">${inviteCode}</p>
            </div>
          </div>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${registerLink}"
               style="background: #0001FC; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Create Your Account
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Realtors' Practice — Nigerian Property Intelligence Platform
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail(to, `${inviterName} invited you to Realtors' Practice`, html);
      Logger.info(`[Email] Invitation sent to ${to} (role: ${role})`);
    } catch (err: any) {
      Logger.error(`[Email] Failed to send invite to ${to}: ${err.message}`);
    }
  }

  /**
   * Send a generic email
   */
  static async sendGenericEmail(to: string, subject: string, html: string) {
    if (!resend && !smtpTransporter) return;

    try {
      await sendEmail(to, subject, html);
      Logger.info(`[Email] Sent "${subject}" to ${to}`);
    } catch (err: any) {
      Logger.error(`[Email] Failed to send "${subject}" to ${to}: ${err.message}`);
    }
  }
}
