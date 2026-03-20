"use client";

import { Sparkles, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AIPlaceholderCardProps {
  icon?: React.ComponentType<any>;
  title: string;
  description: string;
  features?: string[];
  compact?: boolean;
  className?: string;
}

export function AIPlaceholderCard({
  icon: Icon = Sparkles,
  title,
  description,
  features,
  compact = false,
  className = "",
}: AIPlaceholderCardProps) {
  return (
    <div
      className={`relative rounded-2xl border border-dashed overflow-hidden group ${className}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Gradient shimmer top border */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)",
          opacity: 0.5,
        }}
      />

      <div className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="text-sm font-semibold font-display truncate"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{
                  backgroundColor: "rgba(0,1,252,0.08)",
                  color: "var(--primary)",
                }}
              >
                AI · Soon
              </span>
            </div>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {description}
            </p>
            {features && features.length > 0 && !compact && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {features.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AIPlaceholderBannerProps {
  title: string;
  description: string;
  icon?: React.ComponentType<any>;
  ctaLabel?: string;
  ctaHref?: string;
}

export function AIPlaceholderBanner({
  title,
  description,
  icon: Icon = Sparkles,
  ctaLabel = "Learn more",
  ctaHref = "/ai",
}: AIPlaceholderBannerProps) {
  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(var(--primary) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(0,1,252,0.12), rgba(255,102,0,0.08))",
          }}
        >
          <Icon className="w-6 h-6" style={{ color: "var(--primary)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold font-display" style={{ color: "var(--foreground)" }}>
              {title}
            </h3>
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: "linear-gradient(135deg, rgba(0,1,252,0.1), rgba(255,102,0,0.1))",
                color: "var(--primary)",
              }}
            >
              Coming Soon
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {description}
          </p>
        </div>

        <Link
          href={ctaHref}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-90 shrink-0"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

interface AIInsightPlaceholderProps {
  label: string;
  icon?: React.ComponentType<any>;
  className?: string;
}

export function AIInsightPlaceholder({
  label,
  icon: Icon = Sparkles,
  className = "",
}: AIInsightPlaceholderProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed ${className}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)", opacity: 0.6 }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span
        className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
        style={{ backgroundColor: "rgba(0,1,252,0.06)", color: "var(--primary)" }}
      >
        AI
      </span>
    </div>
  );
}
