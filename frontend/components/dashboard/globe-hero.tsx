"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardKPIs, useDashboardCharts } from "@/hooks/use-analytics";
import { TrendingUp, Users, Clock, CheckCircle2, DollarSign, Activity, FileText, Share2, BarChart2, Calendar } from "lucide-react";
import TextType from "@/components/ui/TextType";

// Dynamically import react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import("react-globe.gl").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
      <div className="w-32 h-32 rounded-full border-[2px] border-[#5227FF] border-t-transparent animate-spin ring-8 ring-[#5227FF]/10 mb-6" />
      <span className="text-xs text-[#5227FF] tracking-widest uppercase font-bold animate-pulse">Initializing Tilted Engine...</span>
    </div>
  ),
});

// --- Mini Charts Components --- //

function TinyBarChart() {
  const bars = [35, 60, 20, 85, 45, 75, 50, 90, 65, 40, 80, 55];
  return (
    <div className="flex items-end gap-[3px] h-10 w-full px-2 opacity-80 pt-2">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ duration: 0.8, delay: i * 0.05 + 1.2, ease: "easeOut" }}
          className="flex-1 rounded-sm bg-gradient-to-t from-[#5227FF]/20 to-[#5227FF]"
        />
      ))}
    </div>
  );
}

function TinyLineChart() {
  const points = "0,35 10,25 20,40 30,20 40,45 50,30 60,55 70,35 80,60 90,45 100,20";
  return (
    <div className="w-full h-12 relative overflow-hidden mt-2 border-l border-b border-[#5227FF]/30 pt-2">
      <svg viewBox="0 0 100 60" className="w-full h-full preserve-3d overflow-visible">
        {/* Grid lines */}
        {[15, 30, 45].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#ffffff10" strokeWidth="0.5" strokeDasharray="2,2" />
        ))}
        {/* Fill Area */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          points={`0,60 ${points} 100,60`}
          fill="url(#fade)"
        />
        {/* Line stroke */}
        <motion.polyline
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
          fill="none"
          stroke="#4ade80"
          strokeWidth="1.5"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="40" r="1.5" fill="#fff" stroke="#4ade80" strokeWidth="1" />
        <circle cx="80" cy="60" r="1.5" fill="#fff" stroke="#4ade80" strokeWidth="1" />
      </svg>
    </div>
  );
}

function RadialProgress({ percent, label, value, color }: { percent: number, label: string, value: string, color: string }) {
  const circ = 2 * Math.PI * 38; // r=38
  const offset = circ - (percent / 100) * circ;
  
  return (
    <div className="relative flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full rotate-[-90deg]">
          <circle cx="48" cy="48" r="38" fill="none" stroke="#ffffff10" strokeWidth="6" />
          <motion.circle
            cx="48" cy="48" r="38" fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xl font-bold text-white">{percent}<span className="text-xs text-white/50">%</span></span>
        </div>
      </div>
      <div>
        <p className="text-[#5227FF] text-[10px] font-bold tracking-widest uppercase mb-1">{label}</p>
        <p className="text-sm text-white/70">{value}</p>
      </div>
    </div>
  );
}

// --- Main Hero Component --- //

export function GlobeHero() {
  const globeRef = useRef<any>(null);
  const [hexData, setHexData] = useState<any>(null);
  const { data: kpis } = useDashboardKPIs();
  const [typingDone, setTypingDone] = useState(false);
  
  // Greeter logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const formattedDate = new Date().toLocaleDateString("en-US", dateOptions);
  
  // Format numbers visually
  const totalStr = (kpis?.totalProperties || 18650).toLocaleString();
  const newStr = (kpis?.newPropertiesToday || 120).toLocaleString();
  const qualityScore = kpis?.averageQualityScore || 85;
  const sources = kpis?.activeDataSources || 4;

  useEffect(() => {
    // Fetch geojson footprint for the glowing hex globe
    fetch("https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
      .then(res => res.json())
      .then(data => setHexData(data));
      
    const initGlobe = setInterval(() => {
      if (globeRef.current) {
        try {
          globeRef.current.controls().autoRotate = true;
          globeRef.current.controls().autoRotateSpeed = 0.8;
          globeRef.current.controls().enableZoom = false;
          globeRef.current.pointOfView({ lat: 15, lng: 10, altitude: 2 });
          clearInterval(initGlobe);
        } catch (e) {
          // Ignore if controls not ready yet
        }
      }
    }, 500);

    return () => clearInterval(initGlobe);
  }, []);

  // Framer Motion variants for sleek staggered entry
  const containerVars: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 } 
    }
  };
  
  const cardVars: any = {
    hidden: { opacity: 0, x: 20, y: 10 },
    visible: { 
      opacity: 1, 
      x: 0, 
      y: 0,
      transition: { type: "spring", stiffness: 200, damping: 20 }
    }
  };

  return (
    <div className="w-full bg-[#03010b] rounded-[1.5rem] p-5 my-6 overflow-hidden relative shadow-2xl border border-[#5227FF]/10 drop-shadow-[0_0_30px_rgba(82,39,255,0.08)]">
      
      {/* Top Meta Bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] tracking-widest font-bold text-white/50 uppercase">Global Intelligence Engine / </span>
          <span className="text-[10px] tracking-widest font-bold text-green-500 shadow-green-500 uppercase drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">Real-Time Sync</span>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-white/40 block">Network Traffic</span>
            <span className="text-xs font-mono text-white/80">{(1200 + Math.random() * 50).toFixed(0)} req/s</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-white/40 block">Engine Latency</span>
            <span className="text-xs font-mono text-[#4ade80]">32ms</span>
          </div>
        </div>
      </div>

      {/* Greeter Section inside Hero */}
      <div className="absolute top-16 left-6 z-10 flex flex-col gap-1.5 pointer-events-none">
        <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight min-h-[36px] sm:min-h-[42px] text-white">
          <TextType
            text={[`${greeting}, David`]}
            typingSpeed={75}
            pauseDuration={1500}
            showCursor={false}
            cursorCharacter="|"
            deletingSpeed={50}
            variableSpeedEnabled={true}
            variableSpeedMin={50}
            variableSpeedMax={100}
            cursorBlinkDuration={0.8}
            loop={false}
            initialDelay={500}
            onComplete={() => setTypingDone(true)}
          />
        </h1>
        <motion.div
           className="flex items-center gap-1.5 text-sm text-white/60"
           initial={{ opacity: 0, y: 10 }}
           animate={typingDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
           transition={{ duration: 0.5, ease: "easeOut" }}
         >
           <Calendar size={15} />
           <p className="font-medium">{formattedDate}</p>
         </motion.div>
       </div>
       
       {/* Absolute Bottom Left Globe (covers ~50% of container) */}
       <motion.div 
         initial={{ opacity: 0, x: -50 }}
         animate={{ opacity: 1, x: 0 }}
         transition={{ duration: 2, ease: "easeOut" }}
         className="absolute -bottom-[35%] -left-[45%] w-[60%] h-[120%] pointer-events-auto z-0"
         style={{ mixBlendMode: 'screen' }}
       >
         {/* Premium scanner sliding line across globe */}
         <motion.div 
           initial={{ left: "-30%", opacity: 0 }}
           animate={{ left: "130%", opacity: [0, 0.8, 0.8, 0] }}
           transition={{ duration: 3.5, ease: "linear", delay: 1.5 }}
           className="absolute top-[-25%] w-1.5 h-[150%] bg-[#5227FF] rotate-[30deg] z-10 drop-shadow-[0_0_20px_rgba(82,39,255,1)]"
           style={{ mixBlendMode: 'screen' }}
         />
         
         <Globe
            ref={globeRef}
            backgroundColor="rgba(0,0,0,0)"
            hexPolygonsData={hexData ? hexData.features : []}
            hexPolygonResolution={3}
            hexPolygonMargin={0.5}
            hexPolygonColor={() => `rgba(82,39,255, ${Math.random() * 0.5 + 0.1})`}
            showGlobe={true}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-water.png"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            atmosphereColor="#5227FF"
            atmosphereAltitude={0.25}
          />
       </motion.div>

       <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
         <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" />
         <span className="text-[10px] text-white/80 uppercase tracking-widest font-mono font-semibold">Sensors Active</span>
       </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px] relative z-10">
        
        {/* Left space where the globe sits underneath */}
        <div className="lg:col-span-3 hidden lg:block" />

        {/* Right: Stats Grid */}
        <motion.div 
          className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 mb-4"
          variants={containerVars}
          initial="hidden"
          animate="visible"
        >
          {/* Card 1: Data Acquisition Base */}
          <motion.div variants={cardVars} className="bg-[#0b0818] border border-[#5227FF]/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#5227FF] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-[#5227FF]" />
              <h3 className="text-white/80 text-[11px] font-bold tracking-widest uppercase">Data Acquisition</h3>
              <div className="ml-auto flex gap-1">
                <span className="w-1 h-3 bg-[#5227FF]/40 block skew-x-[-20deg]" />
                <span className="w-1 h-3 bg-[#5227FF]/60 block skew-x-[-20deg]" />
                <span className="w-1 h-3 bg-[#5227FF] block skew-x-[-20deg]" />
              </div>
            </div>
            <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-2">
              <div>
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-1">Index Volume</span>
                <span className="text-2xl font-bold text-white leading-none">{totalStr}</span>
              </div>
              <div className="text-right">
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-1">Cost / Scrape</span>
                <span className="text-sm font-mono text-white leading-none">₦8.50</span>
              </div>
              <div className="text-right">
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-1">Error Rate</span>
                <span className="text-sm font-mono text-[#4ade80] leading-none">0.4%</span>
              </div>
            </div>
            
            <div className="w-full bg-white/5 rounded-lg h-24 flex items-center justify-center p-3 relative overflow-hidden border border-white/5">
              <RadialProgress percent={qualityScore} label="Engine Health" value={`${sources} Providers active`} color="#5227FF" />
            </div>
          </motion.div>

          {/* Card 2: Property Velocity */}
          <motion.div variants={cardVars} className="bg-[#0b0818] border border-[#5227FF]/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white/80 text-[11px] font-bold tracking-widest uppercase">Property Velocity</h3>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-full border-[6px] border-[#0b0818] ring-2 ring-cyan-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)_inset]">
                <span className="text-lg font-bold text-white text-center leading-tight">
                  {newStr} <span className="text-[8px] block text-cyan-400 uppercase tracking-widest">New</span>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[9px] text-white/40 mb-1 uppercase tracking-wider">
                  <span>Avg ingest time</span>
                  <span className="text-white/80">32 mins</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3">
                  <motion.div initial={{ width: 0 }} animate={{ width: "32%" }} transition={{ delay: 1, duration: 1 }} className="h-full bg-cyan-400" />
                </div>
                <div className="flex justify-between text-[9px] text-white/40 mb-1 uppercase tracking-wider">
                  <span>Target ingest time</span>
                  <span className="text-white/80">45 mins</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "45%" }} transition={{ delay: 1.2, duration: 1 }} className="h-full bg-white/30" />
                </div>
              </div>
            </div>
            
            {/* Tiny stat lines */}
            <div className="mt-3 bg-white/5 rounded pl-1 py-1 border border-white/5">
              {[
                { label: "PropertyPro", pct: "75%" },
                { label: "NP Centre", pct: "40%" },
                { label: "Jiji.ng", pct: "60%" }
              ].map((r, i) => (
                <div key={r.label} className="flex items-center text-[8px] mb-1">
                  <span className="w-16 text-white/50">{r.label}</span>
                  <div className="flex-1 h-1.5 bg-white/10 mr-2 rounded-r overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: r.pct }} transition={{ delay: 1.5 + i*0.1 }} className="h-full bg-[#c084fc]" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 3: Discovery Timeline */}
          <motion.div variants={cardVars} className="bg-[#0b0818] border border-[#5227FF]/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#4ade80] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#4ade80]" />
              <h3 className="text-white/80 text-[11px] font-bold tracking-widest uppercase">Discovery Timeline</h3>
              <div className="ml-auto flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              </div>
            </div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider">Fulfillment duration (days)</p>
            <TinyLineChart />
          </motion.div>

          {/* Card 4: Value Tracking */}
          <motion.div variants={cardVars} className="bg-[#0b0818] border border-[#5227FF]/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
             <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#5227FF] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#5227FF]" />
                <h3 className="text-white/80 text-[11px] font-bold tracking-widest uppercase">Value Tracking</h3>
              </div>
              <div className="text-right">
                <span className="text-white/40 text-[9px] uppercase tracking-wider block mb-0.5">Indexed Value</span>
                <span className="text-sm font-bold text-white">₦2.4B <span className="text-[10px] text-[#4ade80]">▲ 12%</span></span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-white/50 mb-1 border-b border-white/5 pb-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#5227FF]" /> Initiated Scrapes</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/20" /> Projected</span>
            </div>
            
            <TinyBarChart />
          </motion.div>

        </motion.div>
      </div>
      
      {/* Bottom Footer Border effect */}
      <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#5227FF]/30 to-transparent" />
      <div className="absolute bottom-1 right-6 text-[8px] text-white/30 uppercase tracking-widest font-mono">
        System Operational • v2.0.4 • {(new Date()).getFullYear()}
      </div>
    </div>
  );
}
