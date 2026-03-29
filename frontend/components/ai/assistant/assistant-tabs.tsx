"use client";

import { MessageSquare, Mic, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAIContext } from "@/contexts/ai-context";
import { ChatTab } from "./chat-tab";
import { VoiceTab } from "./voice-tab";
import { HistoryTab } from "./history-tab";

export function AssistantTabs() {
  const { activeTab, setActiveTab } = useAIContext();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "chat" | "voice" | "history")}
      className="flex flex-col h-full"
    >
      {/* Tab bar */}
      <div
        className="shrink-0 px-4 pt-3 pb-0 flex items-center gap-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h1 className="text-lg font-semibold font-display" style={{ color: "var(--foreground)" }}>
            AI Assistant
          </h1>
        </div>
        <TabsList className="ml-auto">
          <TabsTrigger value="chat" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="w-3.5 h-3.5" />
            History
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab contents fill remaining height */}
      <TabsContent value="chat" className="flex-1 min-h-0 mt-0">
        <ChatTab />
      </TabsContent>
      <TabsContent value="voice" className="flex-1 min-h-0 mt-0">
        <VoiceTab />
      </TabsContent>
      <TabsContent value="history" className="flex-1 min-h-0 mt-0">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}
