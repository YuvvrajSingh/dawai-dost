"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Keyboard, Mic, MicOff, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { respond, speak, useVoiceInput } from "@/lib/services/voice";
import { useApp } from "@/lib/store";
import { duration, ease, spring } from "@/lib/motion";
import type { Medicine } from "@/lib/types";
import { cx, IconButton, Pressable, tick } from "@/components/ui/primitives";

type Msg = { id: number; who: "user" | "bot"; text: string; med?: Medicine };
type Phase = "idle" | "listening" | "thinking" | "speaking";

export function Voice() {
  const app = useApp();
  const [lang, setLang] = useState<"hi" | "en">(app.prefs.lang);
  const v = useVoiceInput(lang === "hi" ? "hi-IN" : "en-IN");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const handled = useRef("");

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), who: "user", text: t.trim() }]);
    setPhase("thinking");
    respond(t, lang).then((r) => {
      setMsgs((m) => [...m, { id: Date.now() + 1, who: "bot", text: r.reply, med: r.medicine }]);
      tick(10);
      if (muted) {
        setPhase("idle");
        return;
      }
      setPhase("speaking");
      speak(r.reply, lang === "hi" ? "hi-IN" : "en-IN", () => setPhase("idle"));
    });
  };

  useEffect(() => {
    if (v.state === "listening") setPhase("listening");
  }, [v.state]);
  useEffect(() => {
    if (v.finalText && v.finalText !== handled.current) {
      handled.current = v.finalText;
      send(v.finalText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.finalText]);
  useEffect(() => {
    if (v.state !== "listening" && phase === "listening" && !v.finalText) setPhase("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.state]);
  useEffect(() => {
    if (v.state === "unsupported" || v.state === "denied") setTyping(true);
  }, [v.state]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, v.interim]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const toggleMic = () => {
    tick(14);
    if (phase === "speaking") {
      window.speechSynthesis?.cancel();
      setPhase("idle");
      return;
    }
    if (phase === "listening") v.stop();
    else v.start();
  };

  const status =
    v.state === "requesting" ? "Allow the microphone to start" :
    phase === "listening" ? (lang === "hi" ? "सुन रहा हूँ…" : "Listening…") :
    phase === "thinking" ? (lang === "hi" ? "देख रहा हूँ…" : "Looking it up…") :
    phase === "speaking" ? (lang === "hi" ? "बोल रहा हूँ" : "Speaking") :
    v.state === "denied" ? "Microphone access is off. Type below instead." :
    v.state === "unsupported" ? "Voice input isn’t supported in this browser. Type below instead." :
    v.state === "error" ? "Didn’t catch that. Tap the mic and try again." :
    lang === "hi" ? "दवा का नाम और ताक़त बोलें" : "Say a medicine name and strength";

  const prompts = lang === "hi" ? ["Telma 40 का सस्ता विकल्प", "Dolo 650 की कीमत", "Thyronorm 50 में क्या है?"] : ["Cheaper option for Telma 40", "Price of Dolo 650", "What’s in Thyronorm 50?"];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-bg text-ink">
      

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-3" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <IconButton label="Close voice assistant" onClick={() => (app.stack.length > 1 ? app.back() : app.tab("home"))} className="border border-line">
          <X className="size-[22px]" />
        </IconButton>
        <div role="radiogroup" aria-label="Speaking language" className="flex h-10 items-center rounded-full bg-soft p-1">
          {(["hi", "en"] as const).map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={cx("relative h-8 rounded-full px-3.5 text-small font-bold", lang === l ? "text-white" : "text-ink-2")}>
              {lang === l && <motion.span layoutId="voice-lang" className="absolute inset-0 rounded-full bg-brand" transition={spring.snappy} />}
              <span className="relative">{l === "hi" ? "हिंदी" : "English"}</span>
            </button>
          ))}
        </div>
        <IconButton label={muted ? "Turn spoken replies on" : "Mute spoken replies"} aria-pressed={muted} onClick={() => setMuted((m) => !m)} className="border border-line">
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </IconButton>
      </div>

      {/* Orb */}
      <div className={cx("relative z-0 flex flex-col items-center transition-[height] duration-500", msgs.length ? "h-[230px]" : "h-[52%]")}>
        <div className="flex flex-1 items-center justify-center">
          <Orb phase={phase} levelRef={v.levelRef} small={msgs.length > 0} />
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: duration.quick }} className="px-8 pb-2 text-center text-headline font-medium text-ink" aria-live="polite">
            {status}
          </motion.p>
        </AnimatePresence>
        {v.interim && <p className="px-8 text-center text-sub italic text-ink-2">“{v.interim}”</p>}
      </div>

      {/* Transcript */}
      <div ref={listRef} className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-3 no-scrollbar [mask-image:linear-gradient(to_bottom,transparent,black_20px)]" aria-label="Conversation" role="log">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-sub text-ink-2">Try saying</p>
            {prompts.map((p) => (
              <Pressable key={p} onClick={() => send(p)} pressScale={0.96} className="h-11 rounded-full border border-line px-4 text-sub font-medium hover:bg-soft">
                “{p}”
              </Pressable>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.gentle} className={cx("flex", m.who === "user" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-[20px] px-4 py-3 text-sub leading-relaxed", m.who === "user" ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-soft text-ink")} lang={/[ऀ-ॿ]/.test(m.text) ? "hi" : undefined}>
                {m.text}
                {m.med && (
                  <button onClick={() => app.push({ name: "compare", id: m.med!.id })} className="mt-2.5 flex h-11 w-full items-center justify-between rounded-full bg-white px-4 text-sub font-medium text-brand">
                    Open comparison <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {phase === "thinking" && (
          <div className="flex w-fit gap-1.5 bg-soft rounded-[20px] rounded-bl-md px-4 py-3.5" aria-label="Assistant is thinking">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-2 rounded-full bg-ink-3" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 px-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}>
        <AnimatePresence initial={false} mode="wait">
          {typing ? (
            <motion.form
              key="type"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: duration.base, ease: ease.emphasized }}
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
                setText("");
              }}
              className="flex h-14 items-center gap-2 rounded-full bg-soft pl-5 pr-1.5"
            >
              <label htmlFor="voice-text" className="sr-only">
                Type your question
              </label>
              <input id="voice-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === "hi" ? "दवा का नाम लिखें" : "Type a medicine name"} className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-2" />
              <IconButton label="Send" type="submit" className="size-11 bg-brand text-white" disabled={!text.trim()}>
                <Send className="size-5" />
              </IconButton>
              {v.state !== "unsupported" && (
                <IconButton label="Use microphone" onClick={() => setTyping(false)} className="size-11">
                  <Mic className="size-5" />
                </IconButton>
              )}
            </motion.form>
          ) : (
            <motion.div key="mic" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: duration.base, ease: ease.emphasized }} className="flex items-center justify-between px-6">
              <IconButton label="Type instead" onClick={() => setTyping(true)} className="size-14 rounded-full border border-line">
                <Keyboard className="size-6" />
              </IconButton>
              <Pressable
                aria-label={phase === "listening" ? "Stop listening" : phase === "speaking" ? "Stop speaking" : "Start listening"}
                aria-pressed={phase === "listening"}
                onClick={toggleMic}
                pressScale={0.9}
                className={cx("relative grid size-[84px] place-items-center rounded-full transition-colors duration-300", phase === "listening" ? "bg-red text-white" : "bg-brand text-white")}
              >
                {phase === "listening" && <motion.span className="absolute inset-0 rounded-full ring-2 ring-red" animate={{ scale: [1, 1.35], opacity: [0.7, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={phase === "listening" || phase === "speaking" ? "stop" : v.state === "denied" ? "off" : "mic"} initial={{ scale: 0.5, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={spring.snappy}>
                    {phase === "listening" || phase === "speaking" ? <Square className="size-7 fill-current" /> : v.state === "denied" ? <MicOff className="size-8" /> : <Mic className="size-8" />}
                  </motion.span>
                </AnimatePresence>
              </Pressable>
              <span className="size-14" />
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-3 text-center text-small text-ink-2">Speech runs in your browser · No dosing advice</p>
      </div>
    </div>
  );
}

/** Calm orb. Listening: radial bars driven by real mic RMS. Speaking / thinking: slow breathing (no fake audio). */
function Orb({ phase, levelRef, small }: { phase: Phase; levelRef: RefObject<number>; small: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const size = small ? 150 : 240;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    let raf = 0;
    let smooth = 0;
    const N = 56;
    const draw = (t: number) => {
      const lvl = phase === "listening" ? levelRef.current ?? 0 : 0;
      smooth += (lvl - smooth) * 0.18;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const r0 = size * 0.3;
      const breathe = reduce ? 0 : phase === "speaking" ? Math.sin(t / 380) * 0.5 + 0.5 : phase === "thinking" ? Math.sin(t / 240) * 0.5 + 0.5 : Math.sin(t / 1400) * 0.5 + 0.5;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const wobble = reduce ? 0.5 : Math.sin(t / 220 + i * 0.9) * 0.5 + 0.5;
        const len = 4 + (phase === "listening" ? smooth * (size * 0.16) * (0.45 + wobble * 0.55) : breathe * size * 0.025 + 2);
        ctx.strokeStyle = phase === "listening" ? `rgba(10,122,82,${0.55 + smooth * 0.45})` : "rgba(10,122,82,0.22)";
        ctx.lineWidth = size > 200 ? 3 : 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r0 + 6), cx + Math.sin(a) * (r0 + 6));
        ctx.lineTo(cx + Math.cos(a) * (r0 + 6 + len), cx + Math.sin(a) * (r0 + 6 + len));
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase, size, levelRef, reduce]);

  return (
    <motion.div layout transition={spring.gentle} className="relative grid place-items-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="absolute inset-0" aria-hidden />
      <motion.div
        aria-hidden
        className="rounded-full bg-brand-tint"
        style={{ width: size * 0.56, height: size * 0.56 }}
        animate={phase === "thinking" ? { rotate: 360 } : { scale: phase === "speaking" ? [1, 1.04, 1] : [1, 1.015, 1] }}
        transition={phase === "thinking" ? { duration: 2.4, repeat: Infinity, ease: "linear" } : { duration: phase === "speaking" ? 0.9 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
