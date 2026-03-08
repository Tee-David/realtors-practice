"use client";

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface TextTypeProps {
  text: string | string[];
  typingSpeed?: number;
  pauseDuration?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  deletingSpeed?: number;
  variableSpeedEnabled?: boolean;
  variableSpeedMin?: number;
  variableSpeedMax?: number;
  cursorBlinkDuration?: number;
  className?: string;
}

export default function TextType({
  text,
  typingSpeed = 75,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = "_",
  deletingSpeed = 50,
  variableSpeedEnabled = false,
  variableSpeedMin = 60,
  variableSpeedMax = 120,
  cursorBlinkDuration = 0.5,
  className = "",
}: TextTypeProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (!textRef.current) return;
    
    // Convert single string to array for uniform handling
    const texts = Array.isArray(text) ? text : [text];
    let currentIndex = 0;
    
    // Initialize empty text
    textRef.current.innerHTML = "";
    
    // Start cursor blinking if enabled
    let cursorAnim: gsap.core.Tween | null = null;
    if (showCursor && cursorRef.current) {
      cursorAnim = gsap.to(cursorRef.current, {
        opacity: 0,
        repeat: -1,
        yoyo: true,
        duration: cursorBlinkDuration,
        ease: "steps(1)"
      });
    }

    const typeWriter = async () => {
      while (true) {
        const currentText = texts[currentIndex];
        
        // Type the text completely
        for (let i = 0; i <= currentText.length; i++) {
          if (!textRef.current) return;
          textRef.current.innerHTML = currentText.substring(0, i);
          
          let speed = typingSpeed;
          if (variableSpeedEnabled) {
            speed = Math.floor(Math.random() * (variableSpeedMax - variableSpeedMin + 1) + variableSpeedMin);
          }
          await new Promise(r => setTimeout(r, speed));
        }

        // Pause at the end
        await new Promise(r => setTimeout(r, pauseDuration));
        
        // Only delete if there's multiple texts to loop
        if (texts.length > 1) {
          // Delete
          for (let i = currentText.length; i >= 0; i--) {
            if (!textRef.current) return;
            textRef.current.innerHTML = currentText.substring(0, i);
            await new Promise(r => setTimeout(r, deletingSpeed));
          }
          // Move to next text
          currentIndex = (currentIndex + 1) % texts.length;
          // Pause before typing next
          await new Promise(r => setTimeout(r, 500));
        } else {
          // If only 1 text, stop typing loops
          break;
        }
      }
    };

    typeWriter();
    
    return () => {
      if (cursorAnim) cursorAnim.kill();
    };
  }, [text, typingSpeed, pauseDuration, showCursor, deletingSpeed, variableSpeedEnabled, variableSpeedMin, variableSpeedMax, cursorBlinkDuration]);

  return (
    <div className={`inline-block ${className}`}>
      <span ref={textRef}></span>
      {showCursor && (
        <span ref={cursorRef} className="ml-0.5">{cursorCharacter}</span>
      )}
    </div>
  );
}
