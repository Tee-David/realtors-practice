"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, ShieldCheck, CheckCircle } from "lucide-react";
import { ThemeSwitch } from "@/components/ui/theme-switch";

export default function AdminRegisterPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError("Password must have at least one lowercase character");
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must have at least one uppercase character");
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError("Password must have at least one number");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      setError("Password must have at least one special character");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    // Admin Security Check
    if (formData.inviteCode !== process.env.NEXT_PUBLIC_ADMIN_INVITE_CODE) {
      setError("Invalid admin invite code. Please contact the system administrator.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          invite_code: formData.inviteCode,
          role: "ADMIN",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <Image src="/logo-icon-blue.png" alt="RP" width={36} height={36} />
          <span className="font-display font-bold text-lg" style={{ color: "var(--foreground)" }}>
            Realtors&apos; Practice
          </span>
        </div>

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
          Account created
        </h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          Check your email to verify your account. Once verified, an administrator will
          review and activate your access.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 mt-6 py-3 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Go to login
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Mobile logo & Theme switch — only visible on small screens */}
      <div className="flex items-center justify-between mb-10 lg:hidden w-full -ml-4">
        <div className="relative">
          <Image 
            src="/hlogo-blue.png" 
            alt="Realtors' Practice" 
            width={180} 
            height={45} 
            style={{ objectFit: "contain" }}
            className="dark:hidden"
          />
          <Image 
            src="/hlogo-white.png" 
            alt="Realtors' Practice" 
            width={180} 
            height={45} 
            style={{ objectFit: "contain" }}
            className="hidden dark:block"
          />
        </div>
        <div className="scale-90 origin-right translate-x-2">
          <ThemeSwitch />
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 1, 252, 0.08)" }}
          >
            <ShieldCheck size={20} style={{ color: "var(--primary)" }} />
          </div>
        </div>
        <h1
          className="font-display text-2xl font-bold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          Request admin access
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
          Create an account to manage property data
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#dc2626" }} />
            {error}
          </div>
        )}

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              First name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              }}
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Last name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              }}
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Email address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
            placeholder="you@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => updateField("password", e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              }}
              placeholder="Enter a secure password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
              style={{ color: "var(--muted-foreground)" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Password Validation Checklist */}
          {formData.password && (
            <div className="p-4 rounded-xl mt-3" style={{ backgroundColor: "var(--secondary)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                Your Password must include
              </p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div className="flex items-center text-xs">
                  <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${/[a-z]/.test(formData.password) ? 'bg-green-600' : 'bg-transparent border border-muted-foreground/30'}`}>
                    {/[a-z]/.test(formData.password) && <CheckCircle size={10} className="text-white" />}
                  </span>
                  <span style={{ color: /[a-z]/.test(formData.password) ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    one lowercase character
                  </span>
                </div>
                
                <div className="flex items-center text-xs">
                  <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${/[A-Z]/.test(formData.password) ? 'bg-green-600' : 'bg-transparent border border-muted-foreground/30'}`}>
                    {/[A-Z]/.test(formData.password) && <CheckCircle size={10} className="text-white" />}
                  </span>
                  <span style={{ color: /[A-Z]/.test(formData.password) ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    one uppercase character
                  </span>
                </div>

                <div className="flex items-center text-xs">
                  <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${/[0-9]/.test(formData.password) ? 'bg-green-600' : 'bg-transparent border border-muted-foreground/30'}`}>
                    {/[0-9]/.test(formData.password) && <CheckCircle size={10} className="text-white" />}
                  </span>
                  <span style={{ color: /[0-9]/.test(formData.password) ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    one number
                  </span>
                </div>

                <div className="flex items-center text-xs">
                  <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${/[^a-zA-Z0-9]/.test(formData.password) ? 'bg-green-600' : 'bg-transparent border border-muted-foreground/30'}`}>
                    {/[^a-zA-Z0-9]/.test(formData.password) && <CheckCircle size={10} className="text-white" />}
                  </span>
                  <span style={{ color: /[^a-zA-Z0-9]/.test(formData.password) ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    one special character
                  </span>
                </div>

                <div className="flex items-center text-xs">
                  <span className={`mr-2 rounded-full w-4 h-4 flex items-center justify-center ${formData.password.length >= 8 ? 'bg-green-600' : 'bg-transparent border border-muted-foreground/30'}`}>
                    {formData.password.length >= 8 && <CheckCircle size={10} className="text-white" />}
                  </span>
                  <span style={{ color: formData.password.length >= 8 ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    8 character minimum
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Confirm password
          </label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
            placeholder="Re-enter your password"
          />
        </div>

        {/* Invite code */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
            Admin invite code
          </label>
          <input
            type="text"
            value={formData.inviteCode}
            onChange={(e) => updateField("inviteCode", e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
            placeholder="Enter your authorized admin code"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90 mt-2"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm mt-6" style={{ color: "var(--muted-foreground)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--primary)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
