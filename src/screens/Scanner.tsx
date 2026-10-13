"use client";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Camera, CameraOff, Check, ImageUp, Loader2, RotateCcw, ScanLine, Sparkles, X, Zap, ZapOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ocr } from "@/lib/services";
import { assessImage, loadImage } from "@/lib/image-quality";
import { useApp } from "@/lib/store";
import { duration, ease, spring } from "@/lib/motion";
import type { ImageQuality } from "@/lib/types";
import { SAMPLE_STRIP, SAMPLE_STRIP_SVG } from "@/lib/sample-strip";
import { Button, cx, IconButton, Pressable, tick } from "@/components/ui/primitives";

type Phase = "intro" | "requesting" | "live" | "denied" | "unsupported" | "review" | "processing" | "error";

export function Scanner() {
  const app = useApp();
  const [ocrReady, setOcrReady] = useState<boolean | null>(null);
  useEffect(() => {
    ocr.configured().then(setOcrReady).catch(() => setOcrReady(null));
  }, []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [quality, setQuality] = useState<ImageQuality | null>(null);
  const [step, setStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      return;
    }
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!caps.torch);
      setPhase("live");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const n = (e as DOMException).name;
      setPhase(n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" ? "unsupported" : "denied");
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
      tick();
    } catch {
      setTorchSupported(false);
    }
  };

  const evaluate = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setShot({ url, blob });
    const img = await loadImage(blob);
    const q = await assessImage(img, img.naturalWidth, img.naturalHeight);
    setQuality(q);
    setPhase("review");
    tick(q.verdict === "ok" ? 14 : 30);
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    tick(18);
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    stopCamera();
    if (blob) evaluate(blob);
  };

  const useSample = async () => {
    stopCamera();
    const svgBlob = new Blob([SAMPLE_STRIP_SVG], { type: "image/svg+xml" });
    const img = await loadImage(svgBlob);
    const c = document.createElement("canvas");
    c.width = SAMPLE_STRIP.width;
    c.height = SAMPLE_STRIP.height;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (blob) evaluate(blob);
  };

  const process = async () => {
    if (!shot) return;
    setPhase("processing");
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 1200);
    try {
      const result = await ocr.read(shot.blob);
      clearTimeout(t1);
      clearTimeout(t2);
      setStep(3);
      tick(16);
      setTimeout(() => {
        app.push({ name: "ocr-review", imageUrl: shot.url, result });
      }, 380);
    } catch (e) {
      setErrorMsg((e as Error).message || "We couldn’t read this image.");
      setPhase("error");
    }
  };

  const retake = () => {
    setShot(null);
    setQuality(null);
    startCamera();
  };

  const qualityCopy: Record<ImageQuality["verdict"], { title: string; body: string }> = {
    ok: { title: "Image looks clear", body: "Text should be readable. We’ll ask you to confirm everything we read." },
    blurry: { title: "This looks blurry", body: "Hold the phone steady about 15 cm away and tap the strip to focus." },
    dark: { title: "Too dark to read", body: "Move near a window or turn on the flash." },
    bright: { title: "Too much glare", body: "Tilt the strip slightly so the foil doesn’t reflect light." },
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black text-white">
      {/* Live video / captured image */}
      {phase === "live" && <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" aria-label="Camera preview" />}
      {shot && (phase === "review" || phase === "processing" || phase === "error") && (
        <motion.img initial={{ scale: 1.04, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: duration.slow, ease: ease.emphasized }} src={shot.url} alt="Captured strip" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <IconButton label="Close scanner" onClick={() => (app.stack.length > 1 ? app.back() : app.tab("home"))} className="glass-dark">
          <X className="size-[22px]" />
        </IconButton>
        <div className="glass-dark flex h-10 items-center gap-2 rounded-full px-4 text-sub font-medium">
          <ScanLine className="size-4 text-mint" aria-hidden /> Scan strip
        </div>
        {phase === "live" ? (
          <IconButton label={torch ? "Turn flash off" : "Turn flash on"} aria-pressed={torch} disabled={!torchSupported} onClick={toggleTorch} className={cx("glass-dark", !torchSupported && "opacity-40")} title={torchSupported ? undefined : "Flash not available on this camera"}>
            {torch ? <Zap className="size-5 fill-mint text-mint" /> : <ZapOff className="size-5" />}
          </IconButton>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {/* Frame guide */}
      {(phase === "live" || phase === "processing") && <FrameGuide processing={phase === "processing"} />}

      <AnimatePresence mode="wait">
        {phase === "intro" || phase === "requesting" ? (
          <Panel key="intro">
            <h1 className="text-center text-title font-medium">Scan the back of the strip</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-center text-sub text-white/70">That’s where the salt and strength are printed. The photo stays on your phone until you confirm.</p>
            <div className="mt-6 space-y-2.5">
              <Button size="lg" variant="light" className="w-full" loading={phase === "requesting"} icon={<Camera className="size-5" />} onClick={startCamera}>
                Allow camera
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="dark" icon={<ImageUp className="size-5" />} onClick={() => fileRef.current?.click()}>
                  Upload
                </Button>
                <Button variant="dark" icon={<Sparkles className="size-5" />} onClick={useSample}>
                  Sample
                </Button>
              </div>
            </div>
          </Panel>
        ) : phase === "denied" || phase === "unsupported" ? (
          <Panel key="denied">
            <h1 className="text-center text-title font-medium">{phase === "denied" ? "Camera access is off" : "No camera found"}</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-center text-sub text-white/70">
              {phase === "denied" ? "Turn on camera access for this site in your browser settings, or upload a photo of the strip instead." : "You can upload a photo of the strip instead."}
            </p>
            <div className="mt-5 space-y-2.5">
              <Button size="lg" variant="light" className="w-full" icon={<ImageUp className="size-5" />} onClick={() => fileRef.current?.click()}>
                Upload a photo
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                {phase === "denied" ? (
                  <Button variant="dark" icon={<RotateCcw className="size-5" />} onClick={startCamera}>
                    Try again
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="dark" icon={<Sparkles className="size-5" />} onClick={useSample}>
                  Sample
                </Button>
              </div>
            </div>
          </Panel>
        ) : phase === "live" ? (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-0 bottom-0 z-10 px-6" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}>
            <p className="glass-dark mx-auto mb-6 w-fit rounded-full px-4 py-2 text-center text-sub font-medium">Fit the printed text inside the frame</p>
            <div className="flex items-center justify-between">
              <IconButton label="Upload a photo" onClick={() => fileRef.current?.click()} className="glass-dark size-14 rounded-[18px]">
                <ImageUp className="size-6" />
              </IconButton>
              <Pressable aria-label="Capture photo" onClick={capture} pressScale={0.9} className="grid size-[84px] place-items-center rounded-full ring-4 ring-white/90">
                <span className="size-[66px] rounded-full bg-white shadow-[0_0_30px_rgb(255_255_255/0.35)]" />
              </Pressable>
              <IconButton label="Use sample photo" onClick={useSample} className="glass-dark size-14 rounded-[18px]">
                <Sparkles className="size-6" />
              </IconButton>
            </div>
          </motion.div>
        ) : phase === "review" && quality ? (
          <Panel key="review">
            <div className="flex items-start gap-3">
              <span className={cx("grid size-11 shrink-0 place-items-center rounded-[14px]", quality.verdict === "ok" ? "bg-brand" : "bg-amber")}>
                {quality.verdict === "ok" ? <Check className="size-6" strokeWidth={3} /> : <AlertTriangle className="size-6 text-ink" />}
              </span>
              <div>
                <h1 className="text-title font-medium">{qualityCopy[quality.verdict].title}</h1>
                <p className="mt-1 text-sub text-white/70">{qualityCopy[quality.verdict].body}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button variant="dark" icon={<RotateCcw className="size-5" />} onClick={retake}>
                Retake
              </Button>
              <Button variant={quality.verdict === "ok" ? "light" : "dark"} onClick={process}>
                {quality.verdict === "ok" ? "Read text" : "Use anyway"}
              </Button>
            </div>
            {ocrReady === false && <p className="mt-3 text-center text-small text-white/50">Without a Gemini key the reader returns a fixed example instead of reading your photo.</p>}
          </Panel>
        ) : phase === "processing" ? (
          <Panel key="proc">
            <ol className="space-y-3" aria-live="polite">
              {["Checking image quality", "Reading printed text", "Finding salt and strength", "Ready to confirm"].map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className={cx("grid size-7 place-items-center rounded-full transition-colors duration-300", step > i ? "bg-brand" : step === i ? "bg-white/15" : "bg-white/5")}>
                    {step > i ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.snappy}>
                        <Check className="size-4" strokeWidth={3} />
                      </motion.span>
                    ) : step === i ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                  </span>
                  <span className={cx("text-sub transition-colors", step >= i ? "text-white" : "text-white/45")}>{s}</span>
                </li>
              ))}
            </ol>
          </Panel>
        ) : phase === "error" ? (
          <Panel key="err">
            <h1 className="text-title font-medium">We couldn’t read this</h1>
            <p className="mt-1 text-sub text-white/70">{errorMsg} Try again with the strip flat and well lit.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button variant="dark" onClick={retake}>
                Retake
              </Button>
              <Button variant="light" onClick={() => app.push({ name: "search" })}>
                Type the name
              </Button>
            </div>
          </Panel>
        ) : null}
      </AnimatePresence>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            stopCamera();
            evaluate(f);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: duration.quick, ease: ease.exit } }}
      transition={spring.gentle}
      className="absolute inset-x-0 bottom-0 z-10 px-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
    >
      <div className="glass-dark rounded-[24px] p-5">{children}</div>
    </motion.div>
  );
}

function FrameGuide({ processing }: { processing: boolean }) {
  const corner = "absolute size-9 border-white";
  return (
    <div className="pointer-events-none absolute inset-x-8 top-[22%] z-[5] aspect-[3/2]">
      <motion.div className="absolute inset-0" animate={{ scale: processing ? 0.97 : [1, 1.012, 1] }} transition={processing ? spring.gentle : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
        <span className={cx(corner, "left-0 top-0 rounded-tl-[22px] border-l-[3px] border-t-[3px]")} />
        <span className={cx(corner, "right-0 top-0 rounded-tr-[22px] border-r-[3px] border-t-[3px]")} />
        <span className={cx(corner, "bottom-0 left-0 rounded-bl-[22px] border-b-[3px] border-l-[3px]")} />
        <span className={cx(corner, "bottom-0 right-0 rounded-br-[22px] border-b-[3px] border-r-[3px]")} />
      </motion.div>
      <div className="absolute inset-3 overflow-hidden rounded-[16px]">
        <motion.div
          className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-mint/15 to-transparent"
          animate={{ top: ["-20%", "100%"] }}
          transition={{ duration: processing ? 1.1 : 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-mint shadow-[0_0_16px_3px_rgb(159_211_189/0.5)]" />
        </motion.div>
      </div>
    </div>
  );
}
