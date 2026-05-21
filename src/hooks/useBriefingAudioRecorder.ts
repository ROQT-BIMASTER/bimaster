import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RecorderState = "idle" | "recording" | "transcribing";

const MAX_MS = 120_000; // 2 minutos
const MIN_MS = 500;

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

export function useBriefingAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((blob: Blob) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setElapsedMs(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Seu navegador não suporta gravação de áudio.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    const mime = pickMimeType();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      stopResolverRef.current?.(blob);
      stopResolverRef.current = null;
    };
    rec.start();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState("recording");
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    autoStopRef.current = window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_MS);
  }, [state]);

  const cancel = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      stopResolverRef.current = null;
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    cleanup();
    setState("idle");
  }, [cleanup]);

  const stop = useCallback(async (): Promise<string> => {
    if (state !== "recording" || !recorderRef.current) {
      cleanup();
      setState("idle");
      return "";
    }
    const duration = Date.now() - startedAtRef.current;
    const blob: Blob = await new Promise((resolve) => {
      stopResolverRef.current = resolve;
      try { recorderRef.current!.stop(); } catch { resolve(new Blob()); }
    });
    cleanup();

    if (duration < MIN_MS || blob.size === 0) {
      setState("idle");
      throw new Error("Gravação muito curta. Segure o microfone por mais tempo.");
    }

    setState("transcribing");
    try {
      const form = new FormData();
      const ext = (blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm");
      form.append("audio", blob, `briefing-${Date.now()}.${ext}`);
      const { data, error } = await supabase.functions.invoke<{ text: string; error?: string }>(
        "briefing-audio-transcribe",
        { body: form },
      );
      if (error) {
        const ctx = (error as { context?: { error?: string } }).context?.error;
        throw new Error(ctx || error.message || "Falha ao transcrever áudio.");
      }
      if (!data?.text) throw new Error(data?.error || "Não conseguimos identificar fala no áudio.");
      return data.text;
    } finally {
      setState("idle");
    }
  }, [cleanup, state]);

  return { state, elapsedMs, start, stop, cancel } as const;
}
