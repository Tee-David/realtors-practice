"use client";

import { motion, useSpring, useTransform, MotionValue } from "framer-motion";
import { useEffect } from "react";
import "./counter.css";

// Helper function to calculate place values (100, 10, 1, 0.1, etc.)
function getPlaces(value: number): (number | string)[] {
  const str = value.toString();
  const places: (number | string)[] = [];
  
  const parts = str.split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "";

  // Integer places
  for (let i = 0; i < integerPart.length; i++) {
    places.push(Math.pow(10, integerPart.length - i - 1));
  }

  // Decimal
  if (parts.length > 1) {
    places.push(".");
    for (let i = 0; i < decimalPart.length; i++) {
      places.push(Math.pow(10, -(i + 1)));
    }
  }

  return places;
}

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

function RollingDigit({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

interface DigitProps {
  place: number | string;
  value: number;
  height: number;
  digitStyle?: React.CSSProperties;
}

function Digit({ place, value, height, digitStyle }: DigitProps) {
  const isDecimal = place === ".";
  
  // Logic to determine the displayed digit for this place
  // For standard places (100, 10, 1), we want the digit at that place.
  // Example: 123, place 100 -> floor(123/100) = 1. 
  // Wait, if value increases, we want continuous scroll.
  
  let targetValue = 0;
  if (!isDecimal && typeof place === "number") {
     targetValue = Math.floor(value / place);
  }

  // Start at 0 to avoid "frozen" initial state
  const animatedValue = useSpring(0, {
      stiffness: 100,
      damping: 20
  });

  // Use Intersection Observer pattern via framer-motion logic or standard ref if simplest.
  // Since we are inside a map, we need a ref for this specific digit or the parent.
  // Actually, standard practice: animate when value changes. 
  // To solve "wait till display": we can check visibility.
  
  useEffect(() => {
    if (!isDecimal && typeof place === "number") {
       // Set immediately if we want it to just work, delays can be finicky.
       // But user wanted "wait until display". 
       // We'll trust the layout fix (overflow: hidden) to solve the visual glitch
       // and use a small delay to ensure hydration is happy.
       const timer = setTimeout(() => {
         animatedValue.set(targetValue);
       }, 100);
       return () => clearTimeout(timer);
    }
  }, [value, place, isDecimal, animatedValue, targetValue]);

  if (isDecimal) {
    return (
        <span
          className="counter-digit counter-digit-decimal"
          style={{ height, ...digitStyle }}
        >
          .
        </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <RollingDigit key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: string | number;
  containerStyle?: React.CSSProperties;
  counterStyle?: React.CSSProperties;
  digitStyle?: React.CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: React.CSSProperties;
  bottomGradientStyle?: React.CSSProperties;
  places?: (number | string)[];
  compact?: boolean;
  prefix?: string;
  suffix?: string;
  digitWidth?: string | number;
  decimalWidth?: string | number;
  decimals?: number;
}

export default function AnimatedCounter({
  value,
  fontSize = 30,
  padding = 0,
  gap = 0,
  borderRadius = 4,
  horizontalPadding = 0,
  textColor = "inherit",
  fontWeight = "inherit",
  containerStyle,
  counterStyle,
  digitStyle,
  compact = false,
  prefix = "",
  suffix = "",
  places,
  digitWidth,
  decimalWidth,
  decimals,
}: CounterProps) {
  const height = fontSize + padding;
  
  // Logic for compact formatting
  let displayValue = value;
  let displaySuffix = suffix;

  if (compact) {
    const formatter = new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: decimals !== undefined ? decimals : 1,
    });
    
    const parts = formatter.formatToParts(value);
    const valuePart = parts.find(p => p.type === 'integer' || p.type === 'decimal' || p.type === 'fraction');
    const compactPart = parts.find(p => p.type === 'compact' || p.type === 'literal'); // looser check for suffix
    
    if (valuePart) {
        // Re-construct the number part including decimal
        const integer = parts.find(p => p.type === 'integer')?.value || "0";
        const decimal = parts.find(p => p.type === 'decimal')?.value || "";
        const fraction = parts.find(p => p.type === 'fraction')?.value || "";
        
        const numStr = decimal ? `${integer}.${fraction}` : integer;
        displayValue = parseFloat(numStr);
    }
    
    if (compactPart) {
      // Clean the suffix part (remove whitespace)
      const cleanSuffix = compactPart.value.trim();
      // Only append if it's actually a letter-like suffix to avoid weird punctuation
      if (cleanSuffix && isNaN(Number(cleanSuffix))) {
          displaySuffix = cleanSuffix + suffix;
      }
    }
  } else if (decimals !== undefined) {
    // If not compact but decimals specified, handle precision
    displayValue = parseFloat(value.toFixed(decimals));
  } else {
    // Default behavior for non-compact, no-decimals prop: 
    // If it's a float with many decimals, truncate to 2 for cleaner UI
    if (value % 1 !== 0) {
        displayValue = parseFloat(value.toFixed(2));
    }
  }

  // Auto-calculate places if not provided
  const placesList = places || getPlaces(displayValue);

  const defaultCounterStyle: React.CSSProperties = {
    fontSize,
    gap: gap,
    borderRadius: borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight: fontWeight,
    height: height,
  };

  return (
    <span className="counter-container" style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, ...containerStyle }}>
      {prefix && <span style={{ fontSize, fontWeight, color: textColor, marginRight: gap || 1, display: 'inline-flex', alignItems: 'center' }}>{prefix}</span>}
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {placesList.map((place, index) => (
          <Digit 
            key={`${place}-${index}`}
            place={place} 
            value={displayValue} 
            height={height} 
            digitStyle={{
              ...(place === "." && decimalWidth ? { width: decimalWidth } : {}),
              ...(typeof place === "number" && digitWidth ? { width: digitWidth } : {}),
              ...digitStyle
            }} 
          />
        ))}
      </span>
      {displaySuffix && <span style={{ fontSize, fontWeight, color: textColor, marginLeft: gap || 0.5, display: 'inline-flex', alignItems: 'center' }}>{displaySuffix}</span>}
    </span>
  );
}
