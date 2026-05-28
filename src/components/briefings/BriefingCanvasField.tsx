import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Circle, Sparkles, PencilLine, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TemplateSection } from "@/hooks/useBriefingChat";
import type { CampoOrigem } from "@/hooks/useBriefingChat";

interface Props {
  section: TemplateSection;
  value: string;
  readOnly?: boolean;
  origem?: CampoOrigem | null;
  onChange: (v: string) => void;
  onBlurSave: (v: string) => Promise<void> | void;
  onAskAgent: (label: string) => void;
  onChangeOrigem?: (origem: CampoOrigem) => void | Promise<void>;
  commentsSlot?: ReactNode;
  hasOpenComments?: boolean;
  /** id html para deep-link/scrollIntoView vindo do Chat. */
  anchorId?: string;
}

export function BriefingCanvasField({
  section,
  value,
  readOnly,
  origem,
  onChange,
  onBlurSave,
  onAskAgent,
  onChangeOrigem,
  commentsSlot,
  hasOpenComments,
  anchorId,
}: Props) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const initialRef = useRef(value);
  const filled = (value ?? "").trim().length > 0;

  useEffect(() => { initialRef.current = value; }, [value]);

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  const handleBlur = async (v: string) => {
    if (v === initialRef.current) return;
    setSaving(true);
    await onBlurSave(v);
    initialRef.current = v;
    setSaving(false);
    setSavedAt(Date.now());
  };

  const isManual = origem === "manual";
  const isIA = origem === "ia";

  const chip = filled ? (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={readOnly}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                isManual
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
                readOnly && "opacity-60 cursor-not-allowed",
              )}
            >
              {isManual ? (
                <PencilLine className="h-2.5 w-2.5" />
              ) : (
                <Sparkles className="h-2.5 w-2.5" />
              )}
              <span>{isManual ? "Preenchimento manual" : "Preenchimento IA"}</span>
              {!readOnly && <ChevronDown className="h-2.5 w-2.5 opacity-70" />}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[240px]">
          {isManual
            ? "O agente não vai alterar este campo. Clique para mudar."
            : "Preenchido pelo agente. Clique para travar como manual."}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          disabled={isManual}
          onSelect={() => onChangeOrigem?.("manual")}
          className="gap-2"
        >
          <PencilLine className="h-3.5 w-3.5 text-amber-600" />
          <div className="flex flex-col">
            <span className="text-xs font-medium">Marcar como manual</span>
            <span className="text-[10px] text-muted-foreground">
              Protege o campo contra o agente.
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isIA}
          onSelect={() => onChangeOrigem?.("ia")}
          className="gap-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-medium">Liberar para a IA</span>
            <span className="text-[10px] text-muted-foreground">
              Permite que o agente reescreva.
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div
      id={anchorId}
      className={cn(
        "group space-y-1.5 rounded-md transition-colors scroll-mt-20",
        hasOpenComments && "border-l-2 border-amber-500/70 pl-2 -ml-2",
        isManual && !hasOpenComments && "border-l-2 border-amber-500/50 pl-2 -ml-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-sm min-w-0">
          {filled ? (
            <Check className="h-3 w-3 text-emerald-600 shrink-0" />
          ) : (
            <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          )}
          <span className="truncate">{section.label}</span>
          {section.required && <span className="text-red-500">*</span>}
          {chip}
        </Label>
        <div className="flex items-center gap-1 shrink-0">
          {saving && <span className="text-[10px] text-muted-foreground">salvando…</span>}
          {!saving && savedAt && (
            <span className="text-[10px] text-emerald-600">salvo</span>
          )}
          {commentsSlot}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onAskAgent(section.label)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Pedir ao agente
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
        placeholder={section.placeholder ?? "Preencha ou peça ajuda ao agente"}
        rows={3}
        className={cn(
          "resize-y bg-background border-muted focus-visible:ring-1 focus-visible:ring-primary/30",
          isManual && "border-amber-500/40 focus-visible:ring-amber-500/30",
          readOnly && "opacity-70 cursor-not-allowed",
        )}
      />
    </div>
  );
}
