"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export const SmoothCursor = () => {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = {
    damping: 45,
    stiffness: 400,
    mass: 1,
    restDelta: 0.001,
  };

  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  const rotate = useMotionValue(0);
  const rotateSpring = useSpring(rotate, { damping: 30, stiffness: 200 });

  // Hide on touch-only devices (mobile/tablet) — no mouse means no custom cursor
  const [hasPointer, setHasPointer] = useState(false);
  useEffect(() => {
    setHasPointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  useEffect(() => {
    if (!hasPointer) return;

    let rafId: number | null = null;
    let latestX = -100;
    let latestY = -100;

    const moveCursor = (e: MouseEvent) => {
      latestX = e.clientX;
      latestY = e.clientY;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          const dx = latestX - cursorX.get();
          const dy = latestY - cursorY.get();
          
          cursorX.set(latestX);
          cursorY.set(latestY);

          if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
            const newAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            
            // Shortest path rotation logic to prevent "awkward spin"
            const currentRotate = rotate.get();
            const diff = (newAngle - (currentRotate % 360) + 540) % 360 - 180;
            rotate.set(currentRotate + diff);
          }
          rafId = null;
        });
      }
    };

    window.addEventListener("mousemove", moveCursor);
    return () => {
      window.removeEventListener("mousemove", moveCursor);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [cursorX, cursorY, rotate, hasPointer]);

  if (!hasPointer) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[2147483647]"
      style={{
        translateX: cursorXSpring,
        translateY: cursorYSpring,
        x: "-12px", 
        y: "-12px",
        rotate: rotateSpring,
      }}
    >
      <DefaultCursorSVG />
    </motion.div>
  );
};

function DefaultCursorSVG() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
    >
      <path
        d="M12 3L4.5 21.29L5.21 22L12 19L18.79 22L19.5 21.29L12 3Z"
        fill="black"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
