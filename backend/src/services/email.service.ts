import { Resend } from "resend";
import { Logger } from "../utils/logger.util";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "Realtors Practice <noreply@realtorspractice.com>";

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  Logger.info("[Email] Resend email service initialized");
} else {
  Logger.info("[Email] No RESEND_API_KEY set — email service disabled (no-op mode)");
}

export class EmailService {
  /**
   * Send a saved search match notification email
   */
  static async sendNewMatchEmail(
    to: string,
    savedSearchName: string,
    matchCount: number,
    matchPreview: Array<{ title: string; price: number | null; area: string | null }>
  ) {
    if (!resend) return;

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
          <h1 style="color: white; margin: 0; font-size: 24px;">🏠 New Matches Found!</h1>
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
      await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `${matchCount} new ${matchCount === 1 ? "match" : "matches"} for "${savedSearchName}"`,
        html,
      });
      Logger.info(`[Email] Match notification sent to ${to} for "${savedSearchName}"`);
    } catch (err: any) {
      Logger.error(`[Email] Failed to send to ${to}: ${err.message}`);
    }
  }

  /**
   * Send a generic email
   */
  static async sendGenericEmail(to: string, subject: string, html: string) {
    if (!resend) return;

    try {
      await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      Logger.info(`[Email] Sent "${subject}" to ${to}`);
    } catch (err: any) {
      Logger.error(`[Email] Failed to send "${subject}" to ${to}: ${err.message}`);
    }
  }
}
