"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export function AIAssistantFab() {
  const pathname = usePathname() || "";

  // Hide FAB on the assistant page itself
  if (pathname.startsWith("/assistant")) return null;

  return (
    <Link href="/assistant" aria-label="Open AI Assistant">
      <motion.div
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center print:hidden"
        style={{
          background: "linear-gradient(135deg, var(--primary), #3333ff)",
          color: "#fff",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <Sparkles className="w-6 h-6" />
      </motion.div>
    </Link>
  );
}
