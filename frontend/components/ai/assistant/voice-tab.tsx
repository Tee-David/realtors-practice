"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useAIContext } from "@/contexts/ai-context";

type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

const STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: "Tap to speak",
  connecting: "Connecting...",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  error: "Error",
};

const STATUS_COLORS: Record<VoiceStatus, string> = {
  idle: "#FF6600",
  connecting: "#f59e0b",
  listening: "#0001FC",
  thinking: "#8b5cf6",
  speaking: "#16a34a",
  error: "#dc2626",
};

// Animated waveform bars
function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end gap-1 h-12 justify-center">
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            active
              ? {
                  height: ["8px", `${16 + Math.random() * 28}px`, "8px"],
                }
              : { height: "8px" }
          }
          transition={{
            duration: 0.5 + i * 0.08,
            repeat: active ? Infinity : 0,
            ease: "easeInOut",
            delay: i * 0.06,
          }}
        />
      ))}
    </div>
  );
}

// Pulse ring around the button
function PulseRing({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: color }}
          animate={{ scale: [1, 1.8 + i * 0.3], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

export function VoiceTab() {
  const { setActiveTab } = useAIContext();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [muted, setMuted] = useState(false);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [wsError, setWsError] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Check mic permission on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => setMicPermission(result.state as any))
      .catch(() => setMicPermission("unknown"));
  }, []);

  const stopSession = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setStatus("idle");
    setTranscript("");
  }, []);

  const startSession = useCallback(async () => {
    if (status !== "idle") {
      stopSession();
      return;
    }

    setStatus("connecting");

    // Request mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermission("granted");
    } catch (err) {
      setMicPermission("denied");
      setStatus("error");
      return;
    }

    // Connect WebSocket
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000").replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/ws/voice`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("listening");
      setWsError(false);

      // Set up audio streaming
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !muted) {
          const pcm = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(pcm.length);
          for (let i = 0; i < pcm.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32767));
          }
          ws.send(int16.buffer);
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
          setTranscript((prev) => prev + data.text);
          setStatus("thinking");
        } else if (data.type === "audio") {
          setStatus("speaking");
          // Play back audio chunk
          const bytes = new Uint8Array(data.audio);
          audioCtxRef.current?.decodeAudioData(bytes.buffer).then((buffer) => {
            const src = audioCtxRef.current!.createBufferSource();
            src.buffer = buffer;
            src.connect(audioCtxRef.current!.destination);
            src.start();
            src.onended = () => setStatus("listening");
          });
        } else if (data.type === "error") {
          setStatus("error");
        }
      } catch {
        // Binary audio data — play it directly
      }
    };

    ws.onerror = () => {
      setWsError(true);
      setStatus("error");
      stopSession();
    };

    ws.onclose = () => {
      if (status !== "idle") {
        stopSession();
      }
    };
  }, [status, muted, stopSession]);

  // Listen for tab switch events from chat tab
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab === "voice") setActiveTab("voice");
    };
    document.addEventListener("ai-switch-tab", handler);
    return () => document.removeEventListener("ai-switch-tab", handler);
  }, [setActiveTab]);

  const isActive = status === "listening" || status === "thinking" || status === "speaking";
  const color = STATUS_COLORS[status];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4 py-8">
      {/* Error states */}
      <AnimatePresence>
        {micPermission === "denied" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border max-w-sm text-sm"
            style={{ borderColor: "rgba(220,38,38,0.3)", backgroundColor: "rgba(220,38,38,0.08)", color: "#dc2626" }}
          >
            <MicOff className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Microphone access required. Please allow access in your browser settings.</p>
          </motion.div>
        )}
        {wsError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border max-w-sm text-sm"
            style={{ borderColor: "rgba(217,119,6,0.3)", backgroundColor: "rgba(217,119,6,0.08)", color: "#d97706" }}
          >
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Voice assistant is currently unavailable. Please use text chat.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status label */}
      <div className="flex flex-col items-center gap-2">
        <motion.p
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold font-display"
          style={{ color: "var(--foreground)" }}
        >
          {STATUS_LABELS[status]}
        </motion.p>
        {isActive && (
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {status === "thinking" ? "Processing..." : status === "speaking" ? "AI response" : "Speak now"}
            </span>
          </div>
        )}
      </div>

      {/* Waveform */}
      <WaveformBars active={isActive} color={color} />

      {/* Main button */}
      <div className="relative flex items-center justify-center">
        <PulseRing active={status === "listening"} color={color} />
        <motion.button
          onClick={startSession}
          className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl focus:outline-none"
          style={{ backgroundColor: color }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isActive ? "Stop session" : "Start voice session"}
        >
          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.div key="stop" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                <Mic className="w-10 h-10 text-white" />
              </motion.div>
            ) : (
              <motion.div key="start" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                <Mic className="w-10 h-10 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Transcript */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--secondary)",
            color: "var(--foreground)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>
            Transcript
          </p>
          {transcript}
        </motion.div>
      )}

      {/* Controls */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          {/* Mute button */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {muted ? "Unmute" : "Mute"}
          </button>

          {/* End session */}
          <button
            onClick={stopSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: "#dc2626", color: "#fff" }}
          >
            <PhoneOff className="w-4 h-4" />
            End conversation
          </button>
        </motion.div>
      )}

      {/* Hint */}
      {status === "idle" && (
        <p className="text-sm text-center max-w-xs" style={{ color: "var(--muted-foreground)" }}>
          Tap the button and speak naturally. Ask about properties, prices, or market trends.
        </p>
      )}
    </div>
  );
}
