"use client";

import { useRef, useEffect } from "react";

interface RippleGridProps {
  gridColor?: string;
  rippleIntensity?: number;
  gridSize?: number;
  gridThickness?: number;
  fadeDistance?: number;
  vignetteStrength?: number;
  glowIntensity?: number;
  opacity?: number;
  gridRotation?: number;
  mouseInteractionRadius?: number;
  mouseInteraction?: boolean;
}

export const RippleGrid = ({
  gridColor = "#2a1b55", // Deep indigo/purple based on the "Customize" screenshot hint
  rippleIntensity = 0.05,
  gridSize = 10,
  gridThickness = 1, // Scaled down for canvas
  fadeDistance = 1.5,
  vignetteStrength = 2,
  glowIntensity = 0.1,
  opacity = 1,
  gridRotation = 0,
  mouseInteractionRadius = 0.8,
  mouseInteraction = true,
}: RippleGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
        mouseRef.current.active = false;
    };

    window.addEventListener("resize", handleResize);
    if (mouseInteraction) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseout", handleMouseLeave);
    }

    const animate = () => {
      timeRef.current += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Background
    //   ctx.fillStyle = "#000000";
    //   ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = opacity;
      
      // Grid Drawing Logic
      // We will draw a grid and distort it based on distance from center (ripple) + mouse
      
      const spacing = gridSize * 5; // Scaling up for visibility
      const rows = Math.ceil(height / spacing) + 2;
      const cols = Math.ceil(width / spacing) + 2;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      // Simple implementation: Draw lines with offset
      // A full ripple grid shader is complex for 2D canvas, we'll approximate the "Ripple" effect
      // by distorting the grid points.

      const getDistortion = (x: number, y: number) => {
        let dx = 0;
        let dy = 0;

        // Center ripple (ambient)
        const cx = width / 2;
        const cy = height / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const ripple = Math.sin(dist * 0.05 - timeRef.current * 2) * (rippleIntensity * 100) * Math.exp(-dist / (Math.max(width,height) * fadeDistance));
        
        dx += Math.cos(Math.atan2(y - cy, x - cx)) * ripple;
        dy += Math.sin(Math.atan2(y - cy, x - cx)) * ripple;

        // Mouse interaction
        if (mouseInteraction && mouseRef.current.active) {
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;
            const mDist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
            const mRadius = mouseInteractionRadius * 500;
            
            if (mDist < mRadius) {
                const mForce = (1 - mDist / mRadius) * 20;
                dx -= (x - mx) / mDist * mForce;
                dy -= (y - my) / mDist * mForce;
            }
        }
        
        return { x: x + dx, y: y + dy };
      }

      ctx.beginPath();
      // Vertical Lines
      for (let i = -1; i < cols; i++) {
          for (let j = -1; j < rows; j++) {
              const x = i * spacing;
              const y = j * spacing;
              const nextY = (j+1) * spacing;
              
              const p1 = getDistortion(x, y);
              const p2 = getDistortion(x, nextY);
              
              if (j === -1) ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
          }
      }
      
      // Horizontal Lines
       for (let j = -1; j < rows; j++) {
          for (let i = -1; i < cols; i++) {
              const x = i * spacing;
              const y = j * spacing;
              const nextX = (i+1) * spacing;
              
              const p1 = getDistortion(x, y);
              const p2 = getDistortion(nextX, y);
              
              if (i === -1) ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
          }
      }
      ctx.stroke();

      // Vignette
      if (vignetteStrength > 0) {
        const gradient = ctx.createRadialGradient(width/2, height/2, width/3, width/2, height/2, width);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, `rgba(0,0,0, ${vignetteStrength * 0.4})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();
      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);

    return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseout", handleMouseLeave);
        cancelAnimationFrame(animId);
    };
  }, [gridColor, rippleIntensity, gridSize, fadeDistance, mouseInteraction, mouseInteractionRadius, vignetteStrength, opacity]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-950">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
