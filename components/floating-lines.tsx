"use client";

import { useEffect, useRef } from "react";

interface FloatingLinesProps {
  colors?: string[];
  backgroundColor?: string;
  lineCount?: number;
  amplitude?: number;
  frequency?: number;
  speed?: number;
}

export function FloatingLines({
  colors = ["#fbbf24", "#d97706", "#f59e0b"], // Amber/Gold tones
  backgroundColor = "transparent",
  lineCount = 12,
  amplitude = 50,
  frequency = 0.01,
  speed = 0.002,
}: FloatingLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);
    resize();

    const draw = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      colors.forEach((color, i) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2; // Thicker lines for visibility
        ctx.globalAlpha = 0.6; // Slight transparency

        for (let x = 0; x < canvas.width; x++) {
          const y =
            canvas.height / 2 +
            Math.sin(x * frequency + time + i) * amplitude * Math.sin(time * 0.5 + i) +
            (i - lineCount / 2) * 20; // Spread lines vertically

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      });

      time += speed;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [colors, backgroundColor, lineCount, amplitude, frequency, speed]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}
