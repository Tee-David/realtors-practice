"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import GlassCard from "@/components/ui/glass-card";
import TextType from "@/components/ui/TextType";

import "@fontsource/space-grotesk";

const Squares = dynamic(() => import("@/components/ui/squares"), { ssr: false });

const REAL_ESTATE_QUOTES = [
  { text: "Landlords grow rich in their sleep.", author: "John Stuart Mill" },
  { text: "Buy land, they're not making it anymore.", author: "Mark Twain" },
  { text: "Real estate cannot be lost or stolen, nor can it be carried away.", author: "Franklin D. Roosevelt" },
  { text: "The best investment on earth is earth.", author: "Louis Glickman" },
  { text: "Ninety percent of all millionaires become so through owning real estate.", author: "Andrew Carnegie" }
];

interface AuthVisualPanelProps {
  backgroundContent?: React.ReactNode;
}

export function AuthVisualPanel({
  backgroundContent,
}: AuthVisualPanelProps) {
  const [quotes, setQuotes] = useState<{text: string; author: string}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    // Select 5 random quotes on mount
    const shuffled = [...REAL_ESTATE_QUOTES].sort(() => 0.5 - Math.random());
    setQuotes(shuffled.slice(0, 5));
  }, []);

  useEffect(() => {
    if (quotes.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % quotes.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [quotes.length, currentIndex]); // Reset interval when currentIndex changes

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    if (quotes.length === 0) return;
    let nextIndex = currentIndex + newDirection;
    if (nextIndex < 0) nextIndex = quotes.length - 1;
    else if (nextIndex >= quotes.length) nextIndex = 0;
    setCurrentIndex(nextIndex);
  };

  return (
    <div className="relative hidden lg:flex overflow-hidden rounded-3xl m-4 bg-zinc-950 flex-col flex-1 min-h-[calc(100vh-32px)]">
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {backgroundContent ? (
          backgroundContent
        ) : (
          <Squares
            speed={0.5}
            squareSize={80}
            direction="diagonal"
            borderColor="#222"
            hoverFillColor="#000"
          />
        )}
      </div>

      {/* Subtle overlay gradients for legibility */}
      <div className="absolute inset-0 z-0 bg-black/40 pointer-events-none" />

      {/* Main Content Flow Container (to handle zoom and prevent overlap) */}
      <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10 pointer-events-none min-h-full">
        
        {/* Top Bar: Logo, Theme Switch, and Title */}
        <div className="flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="-ml-3 mt-[-4px]"> {/* Slight shift left and up if needed */}
              <Image
                src="/hlogo-white.png"
                alt="Realtors' Practice Logo"
                width={180}
                height={45}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <div className="scale-90 origin-right flex-shrink-0">
              <ThemeSwitch />
            </div>
          </div>
          
          <h2 className="font-display text-4xl lg:text-5xl xl:text-6xl tracking-tight font-extrabold text-white mt-8 drop-shadow-lg leading-tight max-w-[95%] text-left">
            Nigerian Property Intelligence Platform.
          </h2>
        </div>

        {/* Flexible spacer in middle */}
        <div className="flex-1 min-h-[40px]"></div>

        {/* Bottom Area: Slider, Attribution */}
        <div className="flex flex-col pointer-events-none gap-6 mt-8">
          
          {/* Draggable Quotes Slider */}
          <GlassCard className="w-full relative pointer-events-auto overflow-hidden group items-start text-left shrink-0">
            <div className="min-h-[160px] flex flex-col justify-center w-full items-start">
              <AnimatePresence mode="wait">
                {quotes.length > 0 && (
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    className="w-full pb-2 text-left cursor-grab active:cursor-grabbing"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(e, { offset, velocity }) => {
                      const swipe = swipePower(offset.x, velocity.x);
                      if (swipe < -swipeConfidenceThreshold) {
                        paginate(1);
                      } else if (swipe > swipeConfidenceThreshold) {
                        paginate(-1);
                      }
                    }}
                  >
                    <TextType
                      text={`"${quotes[currentIndex].text}"`}
                      typingSpeed={35}
                      showCursor={false}
                      loop={false}
                      className="text-3xl xl:text-4xl text-white leading-tight font-medium"
                    />
                    <p className="text-zinc-400 font-medium mt-4 text-sm tracking-wide uppercase">— {quotes[currentIndex].author}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dot Indicators */}
            <div className="flex items-center justify-start gap-2 mt-6 h-4 pointer-events-auto z-20 w-full shrink-0">
              {quotes.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{ zIndex: 30 }}
                  className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-zinc-200' : 'w-2 bg-zinc-500/50 hover:bg-zinc-400'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </GlassCard>

          {/* Attribution */}
          <div className="pointer-events-auto shrink-0 pb-2">
            <p className="text-xs font-medium text-zinc-500">
              &copy; {new Date().getFullYear()} Realtor&apos;s Practice | powered by{" "}
              <a 
                href="https://wedigcreativity.com.ng" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition-colors font-semibold"
              >
                WDC Solutions
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
