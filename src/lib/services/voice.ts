"use client";
/**
 * Voice layer.
 * - Speech-to-text: browser Web Speech API (hi-IN / en-IN) when available.
 * - Audio level: real microphone RMS via Web Audio AnalyserNode (drives the waveform).
 * - Text-to-speech: speechSynthesis.
 * - Production: replace `respond()` with a Vapi assistant (see README → Vapi).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { catalog, matching } from "./index";
import type { Medicine } from "../types";

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function speechSupported() {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export type MicState = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";

export function useVoiceInput(lang: "hi-IN" | "en-IN") {
  const [state, setState] = useState<MicState>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  /** Live mic RMS 0..1, kept in a ref so the 60fps waveform doesn't re-render React. */
  const levelRef = useRef(0);
  const recRef = useRef<SR | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    levelRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    cleanupAudio();
  }, [cleanupAudio]);

  const start = useCallback(async () => {
    setInterim("");
    setFinalText("");
    if (!speechSupported()) {
      setState("unsupported");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      const name = (e as DOMException)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: new () => SR }).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let inter = "";
      let fin = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else inter += r[0].transcript;
      }
      setInterim(inter);
      if (fin) setFinalText(fin);
    };
    rec.onerror = (e) => setState(e.error === "not-allowed" ? "denied" : "error");
    rec.onend = () => {
      cleanupAudio();
      setState((s) => (s === "listening" ? "idle" : s));
    };
    recRef.current = rec;
    rec.start();
    setState("listening");
  }, [lang, cleanupAudio]);

  useEffect(() => () => {
    recRef.current?.abort();
    cleanupAudio();
  }, [cleanupAudio]);

  return { state, interim, finalText, levelRef, start, stop, setState };
}

export function speak(text: string, lang: "hi-IN" | "en-IN", onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return () => {};
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.98;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return () => window.speechSynthesis.cancel();
}

/** Small rule-based intent layer over the real catalog. Never gives dosing or treatment advice. */
export async function respond(text: string, lang: "hi" | "en"): Promise<{ reply: string; medicine?: Medicine }> {
  const t = text.toLowerCase();
  if (/(dose|dosage|kitni|how many|kab le|should i take|kya lu|band kar|stop taking|खुराक|कितनी)/.test(t)) {
    return {
      reply:
        lang === "hi"
          ? "खुराक या दवा बदलने के बारे में मैं सलाह नहीं दे सकता। कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें। मैं दवा की कीमत और संरचना की तुलना कर सकता हूँ।"
          : "I can't advise on dosage or changing medicines — please ask your doctor or pharmacist. I can compare composition and prices for you.",
    };
  }
  // Strip filler words, keep medicine-ish tokens
  const q = t
    .replace(/[?.!,“”"]/g, " ")
    .replace(/\b(cheaper|cheap|option|options|for|price|of|what'?s|what|is|in|the|a|tablet|tablets|ka|ki|ke|sasta|vikalp|kya|hai|dawai|medicine)\b/g, " ")
    .replace(/(का|की|के|सस्ता|विकल्प|कीमत|में|क्या|है)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const notFound = {
    reply:
      lang === "hi"
        ? "माफ़ कीजिए, मुझे वह दवा नहीं मिली। दवा का नाम और ताक़त (जैसे 'मेटफॉर्मिन 500') बोलकर देखें।"
        : "I couldn't find that medicine. Try saying the name and strength, like “Metformin 500”.",
  };
  if (q.length < 2) return notFound;
  const { results } = await catalog.search(q, "brand").catch(() => ({ results: [] as Medicine[] }));
  const found = results[0];
  if (!found) return notFound;
  const c = await matching.compare(found.id).catch(() => null);
  const best = c?.results.find((r) => r.status === "match");
  const comp = found.ingredients.map((i) => `${i.salt} ${i.strength}`).join(" + ");
  if (!best || best.savingPct <= 0) {
    return {
      medicine: found,
      reply: lang === "hi" ? `${found.name} में ${comp} है। अभी इससे सस्ता बिल्कुल समान विकल्प नहीं मिला।` : `${found.name} contains ${comp}. I didn't find a cheaper exact match.`,
    };
  }
  const pct = Math.round(best.savingPct);
  return {
    medicine: found,
    reply:
      lang === "hi"
        ? `${found.name} में ${comp} है। इसी संरचना वाला ${best.candidate.name} लगभग ${pct}% कम MRP पर मिलता है। बदलने से पहले डॉक्टर से पूछें।`
        : `${found.name} contains ${comp}. ${best.candidate.name} has the same composition at about ${pct}% lower MRP. Check with your doctor before switching.`,
  };
}
