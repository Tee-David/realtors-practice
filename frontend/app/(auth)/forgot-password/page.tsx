"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

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
    <div className="w-full max-w-md mx-auto p-8">
      <div className="rounded-2xl p-8 shadow-sm" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Realtors' Practice"
            width={48}
            height={48}
            className="mb-4"
          />
          <h1 className="text-2xl font-display font-bold" style={{ color: "var(--foreground)" }}>
            Reset password
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            We&apos;ll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: "#f0fdf4", color: "#166534" }}>
              Check your email for a password reset link.
            </div>
            <Link href="/login" className="text-sm hover:underline" style={{ color: "var(--primary)" }}>
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm hover:underline" style={{ color: "var(--primary)" }}>
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
