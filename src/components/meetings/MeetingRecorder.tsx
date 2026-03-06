import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Pause, Play, Upload, Loader2, Video, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MeetingRecorderProps {
  meetingId: string;
  onRecordingComplete: (audioUrl: string, durationSeconds: number) => void;
  onUploadComplete?: () => void;
}

export function MeetingRecorder({ meetingId, onRecordingComplete, onUploadComplete }: MeetingRecorderProps) {
  const { session } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = useCallback(async () => {
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

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      await supabase.from("meetings").update({ status: "recording" }).eq("id", meetingId);
    } catch (err: any) {
      toast.error("Erro ao acessar microfone: " + (err.message || "Permissão negada"));
    }
  }, [meetingId]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

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
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
  }, []);

  const uploadRecording = useCallback(async () => {
    if (chunksRef.current.length === 0) {
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

      const fileName = `${session!.user.id}/${meetingId}_${Date.now()}.webm`;
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
        duration_seconds: duration,
        status: "draft",
        updated_at: new Date().toISOString(),
      }).eq("id", meetingId);

      onRecordingComplete(audioUrl, duration);
      onUploadComplete?.();
      toast.success("Áudio salvo com sucesso!");
      setHasRecording(false);
    } catch (err: any) {
      toast.error("Erro ao salvar áudio: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  }, [meetingId, session, duration, onRecordingComplete, onUploadComplete]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const fileName = `${session!.user.id}/${meetingId}_${Date.now()}.${ext}`;

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

      onRecordingComplete(mediaUrl, 0);
      onUploadComplete?.();
      toast.success(`${isVideo ? "Vídeo" : "Áudio"} enviado com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [meetingId, session, onRecordingComplete, onUploadComplete]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-xl border bg-card">
      {/* Timer */}
      <div className="text-4xl font-mono font-bold text-foreground tabular-nums">
        {formatTime(duration)}
      </div>

      {/* Visualizer indicator */}
      {isRecording && !isPaused && (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-500 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 20}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
          <span className="ml-2 text-xs text-red-500 font-medium">REC</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {!isRecording && !hasRecording && (
          <>
            <Button onClick={startRecording} size="lg" className="gap-2 bg-red-500 hover:bg-red-600">
              <Mic className="h-5 w-5" />
              Iniciar Gravação
            </Button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload-input"
              />
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
              >
                {isUploadingFile ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileUp className="h-5 w-5" />
                )}
                Enviar Gravação
              </Button>
            </div>
          </>
        )}

        {isRecording && (
          <>
            {isPaused ? (
              <Button onClick={resumeRecording} size="lg" variant="outline" className="gap-2">
                <Play className="h-5 w-5" />
                Retomar
              </Button>
            ) : (
              <Button onClick={pauseRecording} size="lg" variant="outline" className="gap-2">
                <Pause className="h-5 w-5" />
                Pausar
              </Button>
            )}
            <Button onClick={stopRecording} size="lg" variant="destructive" className="gap-2">
              <Square className="h-5 w-5" />
              Parar
            </Button>
          </>
        )}

        {hasRecording && !isRecording && (
          <div className="flex gap-3">
            <Button onClick={startRecording} variant="outline" className="gap-2">
              <Mic className="h-4 w-4" />
              Regravar
            </Button>
            <Button onClick={uploadRecording} disabled={isUploading} className="gap-2">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Salvar Áudio
            </Button>
          </div>
        )}
      </div>

      {isUploadingFile && (
        <p className="text-sm text-muted-foreground animate-pulse">Enviando arquivo...</p>
      )}
    </div>
  );
}
