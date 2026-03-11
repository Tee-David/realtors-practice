"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface GridMotionProps {
  items?: (string | React.ReactNode)[];
  gradientColor?: string;
  className?: string;
}

/**
 * GridMotion — A 4-row auto-scrolling grid of image/text cards.
 * Each row scrolls in alternating directions. Cards pause on mouse proximity.
 * Inspired by react-bits/GridMotion.
 */
export default function GridMotion({
  items = [],
  gradientColor = "#5227FF",
  className = "",
}: GridMotionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Split items into 4 rows
  const rows = 4;
  const perRow = Math.ceil(items.length / rows);
  const rowData = Array.from({ length: rows }, (_, i) =>
    items.slice(i * perRow, (i + 1) * perRow)
  );

  // CSS custom properties for gradient color
  const gradientStyle = {
    "--grid-gradient": gradientColor,
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`grid-motion-container ${className}`}
      style={gradientStyle}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Overlay gradient from bottom for legibility */}
      <div className="grid-motion-overlay" />

      {rowData.map((rowItems, rowIndex) => {
        // Duplicate items for seamless loop
        const doubled = [...rowItems, ...rowItems, ...rowItems];
        const direction = rowIndex % 2 === 0 ? "left" : "right";
        const speed = 25 + rowIndex * 5; // slightly different speeds

        return (
          <div
            key={rowIndex}
            className="grid-motion-row"
            style={{
              animationDirection: direction === "right" ? "reverse" : "normal",
              animationDuration: `${speed}s`,
              animationPlayState: isPaused ? "paused" : "running",
            }}
          >
            {doubled.map((item, idx) => (
              <div key={idx} className="grid-motion-item">
                {typeof item === "string" ? (
                  item.startsWith("http") || item.startsWith("/") ? (
                    <img
                      src={item}
                      alt=""
                      className="grid-motion-img"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <span className="grid-motion-text">{item}</span>
                  )
                ) : (
                  item
                )}
              </div>
            ))}
          </div>
        );
      })}

      <style jsx>{`
        .grid-motion-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          transform: rotate(-15deg) scale(1.4);
          transform-origin: center center;
        }

        .grid-motion-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(
            circle at 30% 70%,
            color-mix(in srgb, var(--grid-gradient) 25%, transparent) 0%,
            transparent 70%
          );
        }

        .grid-motion-row {
          display: flex;
          gap: 12px;
          width: max-content;
          animation: grid-scroll linear infinite;
          will-change: transform;
        }

        .grid-motion-item {
          width: 260px;
          height: 165px;
          border-radius: 20px;
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.5s ease;
        }

        .grid-motion-container:hover .grid-motion-item {
          transform: scale(1.03);
        }

        .grid-motion-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .grid-motion-item:hover .grid-motion-img {
          transform: scale(1.1);
        }

        .grid-motion-text {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 12px;
          text-align: center;
        }

        @keyframes grid-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-260px * ${perRow} - 12px * ${perRow}));
          }
        }
      `}</style>
    </div>
  );
}
