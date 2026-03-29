"use client";

import { Suspense } from "react";
import { AIProvider } from "@/contexts/ai-context";
import { AssistantTabs } from "@/components/ai/assistant/assistant-tabs";

export default function AssistantPage() {
  return (
    <AIProvider>
      <div
        className="flex flex-col"
        style={{ height: "calc(100vh - 56px - 48px)", minHeight: 0 }}
      >
        <Suspense fallback={null}>
          <AssistantTabs />
        </Suspense>
      </div>
    </AIProvider>
  );
}
