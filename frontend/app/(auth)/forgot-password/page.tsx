"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/login` }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Mobile logo */}
      <div className="flex items-center gap-3 mb-10 lg:hidden">
        <Image src="/logo-icon-blue.png" alt="RP" width={36} height={36} />
        <span className="font-display font-bold text-lg" style={{ color: "var(--foreground)" }}>
          Realtors&apos; Practice
        </span>
      </div>

      {/* Back link */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 hover:underline"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={14} />
        Back to login
      </Link>

      {sent ? (
        /* Success state */
        <div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: "#f0fdf4" }}
          >
            <CheckCircle2 size={28} style={{ color: "var(--success)" }} />
          </div>
          <h1
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Check your email
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            We&apos;ve sent a password reset link to{" "}
            <span className="font-medium" style={{ color: "var(--foreground)" }}>{email}</span>.
            Click the link in the email to reset your password.
          </p>

          <div
            className="flex items-center gap-3 p-4 rounded-xl mt-6"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <Mail size={18} style={{ color: "var(--primary)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="font-medium hover:underline"
                style={{ color: "var(--primary)" }}
              >
                try again
              </button>
            </p>
          </div>
        </div>
      ) : (
        /* Reset form */
        <div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: "rgba(0, 1, 252, 0.08)" }}
          >
            <Mail size={28} style={{ color: "var(--primary)" }} />
          </div>
          <h1
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Reset your password
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
            Enter your email and we&apos;ll send you a reset link
          </p>

          <form onSubmit={handleReset} className="mt-8 space-y-5">
            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl text-sm"
                style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#dc2626" }} />
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  // focus ring handled by Tailwind focus:ring-2
                }}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send reset link
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
