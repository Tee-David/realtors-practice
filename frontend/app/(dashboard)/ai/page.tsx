"use client";

import { Sparkles, MessageSquareText, Bot, Zap, Brain, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const upcomingFeatures = [
  {
    icon: MessageSquareText,
    title: "Property Chat Assistant",
    description: "Ask questions about properties, get investment advice, and search listings using natural language.",
    status: "Coming Soon",
  },
  {
    icon: Brain,
    title: "Smart Search",
    description: "Search properties by describing what you want — \"3 bed flat under 5M near a good school in Lekki\".",
    status: "Coming Soon",
  },
  {
    icon: Zap,
    title: "Market Intelligence",
    description: "AI-generated neighborhood profiles, price predictions, and investment hotspot detection.",
    status: "Coming Soon",
  },
  {
    icon: Bot,
    title: "Telegram Bot",
    description: "Access property search and market insights directly from Telegram — no app needed.",
    status: "Coming Soon",
  },
];

export default function AIAssistantPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-lg">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">
          AI-Powered Intelligence
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-base sm:text-lg">
          Intelligent features are being added to supercharge your property search,
          analysis, and market intelligence capabilities.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {upcomingFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="group hover:shadow-md transition-shadow border-border/50">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
                    <Icon className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                    {feature.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold font-display">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Admin link to settings */}
      <div className="text-center pt-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--secondary)] border"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <Settings className="w-4 h-4" />
          Manage AI settings
        </Link>
      </div>
    </div>
  );
}
