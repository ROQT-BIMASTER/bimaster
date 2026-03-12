import { useRef, useCallback } from "react";
import { Mic, Square, Pause, Play, Upload, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingRecording } from "@/contexts/MeetingRecordingContext";

interface MeetingRecorderProps {
  meetingId: string;
  onRecordingComplete: (audioUrl: string, durationSeconds: number) => void;
  onUploadComplete?: () => void;
}

export function MeetingRecorder({ meetingId, onRecordingComplete, onUploadComplete }: MeetingRecorderProps) {
  const {
    isRecording,
    isPaused,
    isUploading,
    isUploadingFile,
    duration,
    hasRecording,
    activeMeetingId,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadRecording,
    handleFileUpload,
  } = useMeetingRecording();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Only show controls if this meeting is the active one (or no recording is active)
  const isThisMeeting = activeMeetingId === meetingId;
  const canStart = !isRecording && !hasRecording;
  const showControls = isThisMeeting || canStart;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file, meetingId, () => {
      onRecordingComplete("", 0);
      onUploadComplete?.();
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFileUpload, meetingId, onRecordingComplete, onUploadComplete]);

  if (!showControls && isRecording) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 rounded-xl border bg-card">
        <p className="text-sm text-muted-foreground">
          Gravação em andamento em outra reunião. Finalize antes de gravar aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-xl border bg-card">
      {/* Timer */}
      <div className="text-4xl font-mono font-bold text-foreground tabular-nums">
        {isThisMeeting ? formatTime(duration) : "00:00"}
      </div>

      {/* Visualizer indicator */}
      {isRecording && isThisMeeting && !isPaused && (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-destructive rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 20}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
          <span className="ml-2 text-xs text-destructive font-medium">REC</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {canStart && (
          <>
            <Button onClick={() => startRecording(meetingId)} size="lg" className="gap-2 bg-destructive hover:bg-destructive/90">
              <Mic className="h-5 w-5" />
              Iniciar Gravação
            </Button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*"
                onChange={onFileChange}
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

        {isRecording && isThisMeeting && (
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

        {hasRecording && !isRecording && isThisMeeting && (
          <div className="flex gap-3">
            <Button onClick={() => startRecording(meetingId)} variant="outline" className="gap-2">
              <Mic className="h-4 w-4" />
              Regravar
            </Button>
            <Button
              onClick={() => uploadRecording(() => {
                onRecordingComplete("", 0);
                onUploadComplete?.();
              })}
              disabled={isUploading}
              className="gap-2"
            >
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
