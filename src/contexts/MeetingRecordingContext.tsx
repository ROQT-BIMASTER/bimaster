import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MeetingRecordingContextType {
  isRecording: boolean;
  isPaused: boolean;
  isUploading: boolean;
  duration: number;
  activeMeetingId: string | null;
  hasRecording: boolean;
  startRecording: (meetingId: string) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  uploadRecording: (onComplete?: () => void) => Promise<void>;
  handleFileUpload: (file: File, meetingId: string, onComplete?: () => void) => Promise<void>;
  isUploadingFile: boolean;
}

const MeetingRecordingContext = createContext<MeetingRecordingContextType | null>(null);

export function useMeetingRecording() {
  const ctx = useContext(MeetingRecordingContext);
  if (!ctx) throw new Error("useMeetingRecording must be used within MeetingRecordingProvider");
  return ctx;
}

export function MeetingRecordingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);

  // Keep durationRef in sync
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // beforeunload warning
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Gravação em andamento. Deseja realmente sair?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (meetingId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        setHasRecording(true);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setActiveMeetingId(meetingId);
      setHasRecording(false);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      await supabase.from("meetings").update({ status: "recording" }).eq("id", meetingId);
    } catch (err: any) {
      toast.error("Erro ao acessar microfone: " + (err.message || "Permissão negada"));
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearTimer();
    }
  }, [clearTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearTimer();
      stopStream();
    }
  }, [clearTimer, stopStream]);

  const uploadRecording = useCallback(async (onComplete?: () => void) => {
    if (chunksRef.current.length === 0 || !activeMeetingId || !session) {
      toast.error("Nenhum áudio gravado para salvar");
      return;
    }
    setIsUploading(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size < 100) {
        toast.error("Gravação muito curta. Tente novamente.");
        return;
      }

      const fileName = `${session.user.id}/${activeMeetingId}_${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(fileName, blob, { contentType: "audio/webm", upsert: true, cacheControl: "3600" });
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: urlData, error: urlError } = await supabase.storage
        .from("meeting-recordings")
        .createSignedUrl(fileName, 31536000);
      if (urlError) throw new Error("Erro ao gerar URL do áudio");

      const audioUrl = urlData?.signedUrl || "";
      await supabase.from("meetings").update({
        audio_url: audioUrl,
        duration_seconds: durationRef.current,
        status: "draft",
        updated_at: new Date().toISOString(),
      }).eq("id", activeMeetingId);

      toast.success("Áudio salvo com sucesso!");
      setHasRecording(false);
      chunksRef.current = [];
      onComplete?.();
    } catch (err: any) {
      toast.error("Erro ao salvar áudio: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  }, [activeMeetingId, session]);

  const handleFileUpload = useCallback(async (file: File, meetingId: string, onComplete?: () => void) => {
    if (!session) return;
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    if (!isVideo && !isAudio) {
      toast.error("Formato não suportado. Envie um arquivo de vídeo ou áudio.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 100MB.");
      return;
    }

    setIsUploadingFile(true);
    try {
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "webm");
      const fileName = `${session.user.id}/${meetingId}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(fileName, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: urlData, error: urlError } = await supabase.storage
        .from("meeting-recordings")
        .createSignedUrl(fileName, 31536000);
      if (urlError) throw new Error("Erro ao gerar URL");

      const mediaUrl = urlData?.signedUrl || "";
      await supabase.from("meetings").update({
        audio_url: mediaUrl,
        status: "draft",
        updated_at: new Date().toISOString(),
      }).eq("id", meetingId);

      toast.success(`${isVideo ? "Vídeo" : "Áudio"} enviado com sucesso!`);
      onComplete?.();
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploadingFile(false);
    }
  }, [session]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <MeetingRecordingContext.Provider
      value={{
        isRecording,
        isPaused,
        isUploading,
        duration,
        activeMeetingId,
        hasRecording,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        uploadRecording,
        handleFileUpload,
        isUploadingFile,
      }}
    >
      {children}
    </MeetingRecordingContext.Provider>
  );
}
