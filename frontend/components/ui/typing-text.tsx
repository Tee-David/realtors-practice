"use client";

import { useEffect, useState } from "react";
import { motion, useAnimation, Variants } from "framer-motion";

interface TypingTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  showCursor?: boolean;
}

export function TypingText({ text, className = "", delay = 0, duration = 0.05, showCursor = true }: TypingTextProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    setDisplayedText(""); // Reset when text changes
    
    // Add small initial delay if requested
    const startTimeout = setTimeout(() => {
        const intervalId = setInterval(() => {
            setDisplayedText((prev) => {
                if (index < text.length) {
                    index++;
                    return text.slice(0, index);
                }
                clearInterval(intervalId);
                return text;
            });
        }, duration * 1000); // duration in seconds to ms

        return () => clearInterval(intervalId);
    }, delay * 1000);

    return () => clearTimeout(startTimeout);
  }, [text, delay, duration]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block w-1 h-5 ml-1 bg-amber-400 align-middle"
        />
      )}
    </span>
  );
}
