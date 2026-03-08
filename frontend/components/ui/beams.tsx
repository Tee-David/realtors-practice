"use client";

import { useEffect, useRef } from "react";

interface BeamsProps {
  beamWidth?: number;
  beamHeight?: number;
  beamNumber?: number;
  lightColor?: string;
  speed?: number;
  noiseIntensity?: number;
  scale?: number;
  rotation?: number;
}

export default function Beams({
  beamWidth = 2,
  beamHeight = 15,
  beamNumber = 12,
  lightColor = "#ffffff",
  speed = 2,
  noiseIntensity = 1.75,
  scale = 0.2,
  rotation = 0,
}: BeamsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale + 1, scale + 1);
      ctx.translate(-w / 2, -h / 2);

      for (let i = 0; i < beamNumber; i++) {
        const x = (w / (beamNumber + 1)) * (i + 1);
        const noise = Math.sin(time * speed * 0.5 + i * noiseIntensity) * 30;
        const beamH = (beamHeight / 100) * h;
        const yStart = (h - beamH) / 2 + noise;

        const grad = ctx.createLinearGradient(x, yStart, x, yStart + beamH);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.3, lightColor + "15");
        grad.addColorStop(0.5, lightColor + "30");
        grad.addColorStop(0.7, lightColor + "15");
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = beamWidth;
        ctx.moveTo(x + noise * 0.2, yStart);
        ctx.bezierCurveTo(
          x + noise * 0.5, yStart + beamH * 0.3,
          x - noise * 0.3, yStart + beamH * 0.7,
          x + noise * 0.1, yStart + beamH
        );
        ctx.stroke();

        // Glow
        ctx.shadowColor = lightColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x + noise * 0.3, yStart + beamH * 0.5, 2, 0, Math.PI * 2);
        ctx.fillStyle = lightColor + "40";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      time += 0.016;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [beamWidth, beamHeight, beamNumber, lightColor, speed, noiseIntensity, scale, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
