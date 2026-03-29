"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MessageSquare,
  Trash2,
  Calendar,
  Loader2,
  AlertCircle,
  History,
} from "lucide-react";
import { useAIContext } from "@/contexts/ai-context";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export function HistoryTab() {
  const { setCurrentConversationId, setActiveTab } = useAIContext();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["ai-conversations"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/ai/conversations`, { withCredentials: true });
      return res.data.data ?? { conversations: [] };
    },
    retry: 1,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/ai/conversations/${id}`, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      setConfirmDelete(null);
    },
  });

  const conversations = data?.conversations ?? [];
  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.preview?.toLowerCase().includes(search.toLowerCase())
  );

  const openConversation = (id: string) => {
    setCurrentConversationId(id);
    setActiveTab("chat");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
          </div>
        ) : isError ? (
          <div
            className="flex flex-col items-center justify-center h-40 gap-3 rounded-2xl"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Failed to load conversations
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <History className="w-10 h-10" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {search ? "No matching conversations" : "No conversations yet."}
            </p>
            {!search && (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Start chatting to see your history here!
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            <AnimatePresence initial={false}>
              {filtered.map((conv) => (
                <motion.div
                  key={conv.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Confirm delete overlay */}
                  <AnimatePresence>
                    {confirmDelete === conv.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mb-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
                        style={{
                          borderColor: "rgba(220,38,38,0.3)",
                          backgroundColor: "rgba(220,38,38,0.06)",
                          color: "#dc2626",
                        }}
                      >
                        <span className="flex-1">Delete this conversation?</span>
                        <button
                          onClick={() => deleteMutation.mutate(conv.id)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1 rounded-lg text-xs font-medium border hover:bg-[var(--secondary)] transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div
                    className="flex items-start gap-3 p-4 rounded-2xl border group transition-colors hover:bg-[var(--secondary)] cursor-pointer"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                    onClick={() => openConversation(conv.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openConversation(conv.id)}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
                    >
                      <MessageSquare className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold font-display truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {conv.title || "Untitled conversation"}
                      </p>
                      {conv.preview && (
                        <p
                          className="text-xs mt-0.5 truncate"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {conv.preview}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {formatDate(conv.updatedAt)}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                          style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
                        >
                          {conv.messageCount} msgs
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(conv.id);
                      }}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                      style={{ color: "var(--muted-foreground)" }}
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
