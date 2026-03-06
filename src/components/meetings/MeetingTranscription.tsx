import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MeetingTranscriptionProps {
  transcription: string | null;
  audioUrl?: string | null;
}

const SPEAKER_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-500" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-500" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-500" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", badge: "bg-amber-500" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", badge: "bg-rose-500" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", badge: "bg-cyan-500" },
];

interface ParsedLine {
  speaker: string | null;
  text: string;
}

function parseTranscription(text: string): ParsedLine[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    // Match patterns like "João:", "Falante 1:", "[Speaker 1]:", "**Maria**:"
    const speakerMatch = line.match(/^(?:\*\*)?([A-ZÀ-Ú][a-zà-ú\s]*(?:\d*)?|Falante\s*\d+|Speaker\s*\d+)(?:\*\*)?:\s*(.*)/i);
    if (speakerMatch) {
      parsed.push({ speaker: speakerMatch[1].trim(), text: speakerMatch[2].trim() });
    } else {
      parsed.push({ speaker: null, text: line.trim() });
    }
  }
  return parsed;
}

export function MeetingTranscription({ transcription, audioUrl }: MeetingTranscriptionProps) {
  const isVideo = audioUrl && (audioUrl.includes(".mp4") || audioUrl.includes(".mov") || audioUrl.includes(".avi") || audioUrl.includes(".mkv") || audioUrl.includes("video/"));
  
  const parsed = useMemo(() => {
    if (!transcription) return [];
    return parseTranscription(transcription);
  }, [transcription]);

  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const line of parsed) {
      if (line.speaker && !map.has(line.speaker)) {
        map.set(line.speaker, idx++);
      }
    }
    return map;
  }, [parsed]);

  const hasSpeakers = speakerMap.size > 0;

  return (
    <div className="space-y-4">
      {/* Media Player */}
      {audioUrl && (
        <Card>
          <CardContent className="pt-4">
            {isVideo ? (
              <video controls className="w-full rounded-lg max-h-[400px]" src={audioUrl}>
                Seu navegador não suporta o player de vídeo.
              </video>
            ) : (
              <audio controls className="w-full" src={audioUrl}>
                Seu navegador não suporta o player de áudio.
              </audio>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcription */}
      <Card>
        <CardContent className="pt-6">
          {!transcription ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transcrição disponível.</p>
          ) : hasSpeakers ? (
            <div className="space-y-2">
              {parsed.map((line, i) => {
                if (!line.speaker) {
                  return (
                    <p key={i} className="text-sm text-muted-foreground italic px-3 py-1">
                      {line.text}
                    </p>
                  );
                }
                const colorIdx = speakerMap.get(line.speaker) || 0;
                const colors = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length];
                return (
                  <div key={i} className={`flex gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-8 h-8 rounded-full ${colors.badge} flex items-center justify-center text-white text-xs font-bold`}>
                        {line.speaker.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground">{line.speaker}</span>
                      <p className="text-sm text-foreground mt-0.5">{line.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="text-sm whitespace-pre-wrap text-foreground font-sans">{transcription}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
