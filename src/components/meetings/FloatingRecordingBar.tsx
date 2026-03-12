import { useNavigate } from "react-router-dom";
import { Mic, Square, Pause, Play, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingRecording } from "@/contexts/MeetingRecordingContext";

export function FloatingRecordingBar() {
  const navigate = useNavigate();
  const {
    isRecording,
    isPaused,
    duration,
    activeMeetingId,
    hasRecording,
    isUploading,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadRecording,
  } = useMeetingRecording();

  if (!isRecording && !hasRecording) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-destructive/50 shadow-lg rounded-full px-4 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      {/* Pulse indicator */}
      {isRecording && !isPaused && (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
        </span>
      )}

      {/* Timer */}
      <button
        onClick={() => activeMeetingId && navigate(`/dashboard/reunioes/${activeMeetingId}`)}
        className="font-mono text-sm font-bold text-foreground hover:underline cursor-pointer tabular-nums"
      >
        {formatTime(duration)}
      </button>

      {isRecording && (
        <span className="text-xs text-destructive font-medium">REC</span>
      )}

      {/* Controls */}
      {isRecording && (
        <>
          {isPaused ? (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={resumeRecording}>
              <Play className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={pauseRecording}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="destructive" className="h-8 w-8" onClick={stopRecording}>
            <Square className="h-4 w-4" />
          </Button>
        </>
      )}

      {hasRecording && !isRecording && (
        <>
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => activeMeetingId && navigate(`/dashboard/reunioes/${activeMeetingId}`)}>
            <Mic className="h-3 w-3" />
            Ver reunião
          </Button>
          <Button size="sm" className="h-8 gap-1 text-xs" disabled={isUploading} onClick={() => uploadRecording()}>
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Salvar
          </Button>
        </>
      )}
    </div>
  );
}
