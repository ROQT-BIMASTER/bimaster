import { Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBriefingAudioRecorder } from "@/hooks/useBriefingAudioRecorder";

interface Props {
  disabled?: boolean;
  onTranscribed: (text: string) => void;
}

function fmt(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BriefingMicButton({ disabled, onTranscribed }: Props) {
  const { state, elapsedMs, start, stop, cancel } = useBriefingAudioRecorder();

  const handleStart = async () => {
    try {
      await start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível acessar o microfone.";
      toast.error(msg);
    }
  };

  const handleStop = async () => {
    try {
      const text = await stop();
      if (text) onTranscribed(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao transcrever áudio.";
      toast.error(msg);
    }
  };

  if (state === "transcribing") {
    return (
      <Button type="button" size="sm" variant="ghost" disabled className="gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Transcrevendo…
      </Button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={cancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancelar gravação</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleStop}
          className="gap-1.5 animate-pulse"
        >
          <Square className="h-3.5 w-3.5" />
          {fmt(elapsedMs)} · parar
        </Button>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          onClick={handleStart}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Gravar áudio (até 2 min)</TooltipContent>
    </Tooltip>
  );
}
