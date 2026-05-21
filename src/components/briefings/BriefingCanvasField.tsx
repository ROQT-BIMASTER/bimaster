import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Circle, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateSection } from "@/hooks/useBriefingChat";

interface Props {
  section: TemplateSection;
  value: string;
  readOnly?: boolean;
  onChange: (v: string) => void;
  onBlurSave: (v: string) => Promise<void> | void;
  onAskAgent: (label: string) => void;
  commentsSlot?: ReactNode;
  hasOpenComments?: boolean;
  /** id html para deep-link/scrollIntoView vindo do Chat. */
  anchorId?: string;
}

export function BriefingCanvasField({
  section,
  value,
  readOnly,
  onChange,
  onBlurSave,
  onAskAgent,
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

  return (
    <div
      id={anchorId}
      className={cn(
        "group space-y-1.5 rounded-md transition-colors scroll-mt-20",
        hasOpenComments && "border-l-2 border-amber-500/70 pl-2 -ml-2",
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm">
          {filled ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <Circle className="h-3 w-3 text-muted-foreground/50" />
          )}
          <span>{section.label}</span>
          {section.required && <span className="text-red-500">*</span>}
        </Label>
        <div className="flex items-center gap-1">
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
          readOnly && "opacity-70 cursor-not-allowed",
        )}
      />
    </div>
  );
}
