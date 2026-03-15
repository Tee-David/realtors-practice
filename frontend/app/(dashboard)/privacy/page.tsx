import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Realtors' Practice",
  description: "How Realtors' Practice collects, uses, and protects your data.",
};

/* ------------------------------------------------------------------ */
/*  Section helper                                                     */
/* ------------------------------------------------------------------ */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-display font-semibold text-[var(--foreground)] mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[var(--muted-foreground)] leading-relaxed text-sm">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-7 w-7 text-[var(--primary)]" />
        <h1 className="text-3xl font-display font-bold text-[var(--foreground)]">
          Privacy Policy
        </h1>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-10">
        Last updated: 15 March 2026
      </p>

      <div className="space-y-10">
        {/* Introduction */}
        <Section id="introduction" title="1. Introduction">
          <p>
            Realtors&apos; Practice (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
            operates a Nigerian property intelligence platform that aggregates, validates, and
            displays real estate listings from publicly available sources across Nigeria. This
            Privacy Policy explains how we collect, use, store, and share information when you use
            our website, APIs, and related services (collectively, the &ldquo;Platform&rdquo;).
          </p>
          <p>
            By accessing or using the Platform, you agree to the practices described in this policy.
            If you do not agree, please discontinue use of the Platform.
          </p>
        </Section>

        {/* Data Collection */}
        <Section id="data-collection" title="2. Information We Collect">
          <p className="font-medium text-[var(--foreground)]">Account information</p>
          <p>
            When you register for an account we collect your name, email address, phone number
            (optional), company name (optional), and a profile photo if you choose to upload one.
            Authentication is handled via Supabase; we do not store passwords directly.
          </p>

          <p className="font-medium text-[var(--foreground)]">Property data</p>
          <p>
            We collect publicly available property listing data from Nigerian real estate websites
            through automated scraping. This includes property titles, descriptions, prices,
            locations, images, and agent or agency contact details as published on those sites.
          </p>

          <p className="font-medium text-[var(--foreground)]">Usage data</p>
          <p>
            We automatically collect information about how you interact with the Platform, including
            search queries, saved searches, pages visited, properties viewed, and feature usage.
            This data is used to improve the service and provide relevant recommendations.
          </p>

          <p className="font-medium text-[var(--foreground)]">Device and log data</p>
          <p>
            Our servers log your IP address, browser type, operating system, referring URL, and
            timestamps. We use this information for security monitoring, analytics, and audit
            purposes.
          </p>
        </Section>

        {/* Usage */}
        <Section id="data-usage" title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide, maintain, and improve the Platform and its features.</li>
            <li>
              Aggregate and enrich property listing data from public sources to present accurate,
              de-duplicated, and quality-scored listings.
            </li>
            <li>
              Send notifications about saved search matches, price changes, and scrape completions
              (configurable in your account settings).
            </li>
            <li>Generate market intelligence reports and area analytics.</li>
            <li>
              Monitor for abuse, fraud, and duplicate or misleading listings through automated
              quality scoring and flagging.
            </li>
            <li>
              Comply with Nigerian data protection regulations, including the Nigeria Data Protection
              Regulation (NDPR) and the Nigeria Data Protection Act 2023.
            </li>
          </ul>
        </Section>

        {/* Storage */}
        <Section id="data-storage" title="4. Data Storage and Retention">
          <p>
            Your account data is stored in a CockroachDB database hosted on secure cloud
            infrastructure. Property listing data scraped from public sources is retained as long as
            it remains relevant to our service.
          </p>
          <p>
            We apply the following automatic retention policies:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Expired or sold properties</strong> are purged after 90 days.
            </li>
            <li>
              <strong>Audit logs</strong> are retained for 180 days.
            </li>
            <li>
              <strong>Scrape logs</strong> are retained for 30 days.
            </li>
            <li>
              <strong>Read notifications</strong> are cleaned up after 30 days.
            </li>
          </ul>
          <p>
            You may request deletion of your personal data at any time by contacting us (see Section
            8 below).
          </p>
        </Section>

        {/* Sharing */}
        <Section id="data-sharing" title="5. Information Sharing">
          <p>We do not sell your personal information. We may share data in these limited cases:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Service providers:</strong> We use third-party services for authentication
              (Supabase), search indexing (Meilisearch), email delivery, error monitoring (Sentry),
              and hosting (Vercel, Render). These providers only receive data necessary for their
              function.
            </li>
            <li>
              <strong>Legal requirements:</strong> We may disclose information when required by
              Nigerian law, court order, or governmental authority.
            </li>
            <li>
              <strong>Aggregate analytics:</strong> We may share anonymised, aggregated market
              statistics that cannot identify individual users.
            </li>
          </ul>
        </Section>

        {/* User Rights */}
        <Section id="user-rights" title="6. Your Rights">
          <p>
            Under the Nigeria Data Protection Act 2023 and the NDPR, you have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate or incomplete data.</li>
            <li>Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;).</li>
            <li>Object to or restrict certain processing of your data.</li>
            <li>Withdraw consent for optional data processing (e.g., email notifications).</li>
            <li>Export your data in a machine-readable format.</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us using the details in Section 8. We
            will respond within 30 days.
          </p>
        </Section>

        {/* Cookies */}
        <Section id="cookies" title="7. Cookies and Local Storage">
          <p>
            The Platform uses cookies and browser local storage for the following purposes:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Authentication:</strong> Session tokens to keep you signed in.
            </li>
            <li>
              <strong>Preferences:</strong> Theme, map provider selection, sidebar state, and recent
              search history.
            </li>
            <li>
              <strong>Analytics:</strong> Anonymous usage metrics to improve the Platform.
            </li>
          </ul>
          <p>
            We do not use third-party advertising cookies. You can clear cookies and local storage
            through your browser settings, but this may affect Platform functionality.
          </p>
        </Section>

        {/* Contact */}
        <Section id="contact" title="8. Contact Us">
          <p>
            If you have questions about this Privacy Policy, wish to exercise your data rights, or
            have concerns about how your information is handled, please contact us:
          </p>
          <ul className="list-none space-y-1">
            <li>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:privacy@realtorspractice.com"
                className="text-[var(--primary)] hover:underline"
              >
                privacy@realtorspractice.com
              </a>
            </li>
            <li>
              <strong>Platform:</strong>{" "}
              <a
                href="https://realtors-practice-new.vercel.app"
                className="text-[var(--primary)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                realtors-practice-new.vercel.app
              </a>
            </li>
          </ul>
        </Section>

        {/* Changes */}
        <Section id="changes" title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we
            will update the &ldquo;Last updated&rdquo; date at the top of this page and, where
            appropriate, notify you via email or an in-app notification.
          </p>
        </Section>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-6 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        &copy; {new Date().getFullYear()} Realtors&apos; Practice. All rights reserved.
      </div>
    </div>
  );
}
