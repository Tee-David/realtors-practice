"use client";

import { useRef, useEffect } from "react";

export const FluidGlass = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const blobs: Blob[] = [];
    const blobCount = 6;
    
    // warm/orange colors for the "fire/energy" theme
    const colors = ["#fbbf24", "#f59e0b", "#d97706", "#b45309", "#78350f"];

    class Blob {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = Math.random() * 100 + 150; // Large blobs
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < -this.radius) this.x = width + this.radius;
        if (this.x > width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = height + this.radius;
        if (this.y > height + this.radius) this.y = -this.radius;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
      }
    }

    // Initialize blobs
    for (let i = 0; i < blobCount; i++) {
        blobs.push(new Blob());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background
      // ctx.fillStyle = "#18181b"; // Dark zinc bg
      // ctx.fillRect(0, 0, width, height);

      // Draw blobs
      // Use filter for metaball/gooey effect? 
      // Canvas filter support is decent now, but blur is expensive.
      // We will rely on CSS blur for the glass effect on top.
      
      blobs.forEach(blob => {
        blob.update();
        blob.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);

  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-950">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 blur-[100px]" />
        {/* Glass overlay pattern/noise could go here */}
        <div className="absolute inset-0 bg-transparent" style={{backdropFilter: "blur(40px)"}}></div> 
    </div>
  );
};
