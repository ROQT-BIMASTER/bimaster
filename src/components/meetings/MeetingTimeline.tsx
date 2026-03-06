import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle, CheckCircle2, Lightbulb, ListTodo, Info, Zap,
  Play, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Highlight {
  label: string;
  timestamp_seconds: number;
  type: "decisao" | "problema" | "tarefa" | "oportunidade" | "informacao" | "conflito" | "risco";
  speaker?: string;
}

interface MeetingTimelineProps {
  audioUrl: string | null;
  durationSeconds: number;
  highlights: Highlight[];
  searchResults?: { timestamp_seconds: number; text: string }[];
  onTimeUpdate?: (time: number) => void;
}

const TYPE_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  decisao: { color: "bg-primary", icon: CheckCircle2, label: "Decisão" },
  problema: { color: "bg-destructive", icon: AlertTriangle, label: "Problema" },
  tarefa: { color: "bg-warning", icon: ListTodo, label: "Tarefa" },
  oportunidade: { color: "bg-success", icon: Lightbulb, label: "Oportunidade" },
  informacao: { color: "bg-blue-500", icon: Info, label: "Informação" },
  conflito: { color: "bg-orange-500", icon: Zap, label: "Conflito" },
  risco: { color: "bg-orange-500", icon: AlertTriangle, label: "Risco" },
};

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export function MeetingTimeline({ audioUrl, durationSeconds, highlights, searchResults = [], onTimeUpdate }: MeetingTimelineProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isVideo = audioUrl && (audioUrl.includes(".mp4") || audioUrl.includes(".mov") || audioUrl.includes(".avi") || audioUrl.includes(".mkv") || audioUrl.includes("video/"));
  const mediaRef = isVideo ? videoRef : audioRef;

  // Fallback duration: use durationSeconds, or estimate from last highlight
  const duration = useMemo(() => {
    if (durationSeconds > 0) return durationSeconds;
    if (highlights.length > 0) {
      const maxTs = Math.max(...highlights.map(h => h.timestamp_seconds));
      return maxTs > 0 ? Math.ceil(maxTs * 1.1) : 1; // 10% margin
    }
    return 1;
  }, [durationSeconds, highlights]);

  const sorted = useMemo(() => [...highlights].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds), [highlights]);
  const displayedHighlights = showAll ? sorted : sorted.slice(0, 8);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (el) {
      setCurrentTime(el.currentTime);
      onTimeUpdate?.(el.currentTime);
    }
  }, [mediaRef, onTimeUpdate]);

  const seekTo = useCallback((seconds: number) => {
    const el = mediaRef.current;
    if (el) {
      el.currentTime = seconds;
      el.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [mediaRef]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [mediaRef, handleTimeUpdate]);

  if (!audioUrl) return null;

  return (
    <div className="space-y-4">
      {/* Media Player */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {isVideo ? (
            <video ref={videoRef} controls className="w-full rounded-lg max-h-[360px]" src={audioUrl} />
          ) : (
            <audio ref={audioRef as any} controls className="w-full" src={audioUrl} />
          )}

          {/* Timeline bar */}
          <div className="relative">
            <div className="relative h-14 bg-muted rounded-lg overflow-hidden cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                seekTo(pct * duration);
              }}
            >
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/15 transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />

              {/* Current position indicator with time label */}
              <div
                className="absolute top-0 bottom-0 z-10 flex flex-col items-center"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="w-0.5 h-full bg-primary" />
                <div className="absolute -top-5 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                  {formatTime(currentTime)}
                </div>
              </div>

              {/* Highlight markers */}
              {sorted.map((h, i) => {
                const pct = (h.timestamp_seconds / duration) * 100;
                const cfg = TYPE_CONFIG[h.type] || TYPE_CONFIG.informacao;
                return (
                  <div
                    key={`h-${i}`}
                    className="absolute top-1.5 bottom-1.5 group/marker"
                    style={{ left: `${pct}%` }}
                    title={`${formatTime(h.timestamp_seconds)} - ${h.label}`}
                    onClick={(e) => { e.stopPropagation(); seekTo(h.timestamp_seconds); }}
                  >
                    <div className={`w-3 h-full rounded ${cfg.color} opacity-75 hover:opacity-100 transition-all cursor-pointer hover:scale-x-150 hover:shadow-md`} />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-xs px-2.5 py-1.5 rounded-md shadow-lg border opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none z-20 max-w-[220px] truncate">
                      <span className="font-mono text-muted-foreground">{formatTime(h.timestamp_seconds)}</span> — {h.label}
                    </div>
                  </div>
                );
              })}

              {/* Search result markers */}
              {searchResults.map((sr, i) => {
                const pct = (sr.timestamp_seconds / duration) * 100;
                return (
                  <div
                    key={`sr-${i}`}
                    className="absolute top-0 bottom-0 group/search"
                    style={{ left: `${pct}%` }}
                    onClick={(e) => { e.stopPropagation(); seekTo(sr.timestamp_seconds); }}
                  >
                    <div className="w-3.5 h-full bg-yellow-400/80 hover:bg-yellow-400 rounded cursor-pointer border border-yellow-500/50" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 max-w-[220px] bg-popover text-popover-foreground text-xs px-2.5 py-1.5 rounded-md shadow-lg border opacity-0 group-hover/search:opacity-100 transition-opacity pointer-events-none z-20 line-clamp-2">
                      🔍 {sr.text}
                    </div>
                  </div>
                );
              })}

              {/* Time labels at bottom */}
              <div className="absolute bottom-1 left-2 text-[10px] text-muted-foreground font-mono">
                {formatTime(0)}
              </div>
              <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono">
                {formatTime(duration)}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const count = sorted.filter((h) => h.type === key).length;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={`w-3 h-3 rounded ${cfg.color}`} />
                    <span className="font-medium">{cfg.label}</span>
                    <span className="text-muted-foreground/60">({count})</span>
                  </div>
                );
              })}
              {searchResults.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-yellow-400 border border-yellow-500/50" />
                  <span className="font-medium">Busca</span>
                  <span className="text-muted-foreground/60">({searchResults.length})</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highlights List */}
      {sorted.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Momentos Importantes ({sorted.length})</h3>
            <div className="space-y-2">
              {displayedHighlights.map((h, i) => {
                const cfg = TYPE_CONFIG[h.type] || TYPE_CONFIG.informacao;
                const Icon = cfg.icon;
                const isActive = Math.abs(currentTime - h.timestamp_seconds) < 5;
                return (
                  <button
                    key={i}
                    onClick={() => seekTo(h.timestamp_seconds)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all hover:bg-accent/50 ${isActive ? "bg-accent border-primary/30 shadow-sm" : "bg-card"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${cfg.color}/15 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${cfg.color.replace("bg-", "text-")}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{formatTime(h.timestamp_seconds)}</span>
                        {h.speaker && <span className="text-xs text-muted-foreground">• {h.speaker}</span>}
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
            {sorted.length > 8 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 gap-1" onClick={() => setShowAll(!showAll)}>
                {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAll ? "Mostrar menos" : `Ver todos (${sorted.length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
