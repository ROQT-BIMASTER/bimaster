import { useState, useEffect } from "react";
import { FileText, Save, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DescricaoIndicatorProps {
  descricao: string | null | undefined;
  /** Quando informado, habilita edição rápida inline via popover. */
  onSave?: (novaDescricao: string) => void | Promise<void>;
  /** Fallback: abre o detalhe completo. Usado quando onSave não é fornecido. */
  onClick?: () => void;
  className?: string;
  /** Sempre exibir o ícone, mesmo sem descrição (para criação rápida). */
  alwaysVisible?: boolean;
}

/**
 * Indicador de "anotações" (descricao) na linha da tarefa.
 * - Sem texto: oculto (a menos que alwaysVisible).
 * - Hover: preview de até 240 chars.
 * - Clique: popover com edição rápida (se onSave) ou abre detalhe (onClick).
 */
export function DescricaoIndicator({
  descricao,
  onSave,
  onClick,
  className,
  alwaysVisible = false,
}: DescricaoIndicatorProps) {
  const text = (descricao || "").trim();
  const hasText = text.length > 0;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(descricao || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(descricao || "");
  }, [descricao]);

  if (!hasText && !alwaysVisible && !onSave) return null;

  const preview = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  const hasMore = text.length > 240;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(value);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const triggerBtn = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onSave) {
          setOpen(true);
        } else {
          onClick?.();
        }
      }}
      aria-label={hasText ? "Editar anotação da tarefa" : "Adicionar anotação"}
      title={hasText ? "Anotações da tarefa" : "Adicionar anotação"}
      className={cn(
        "inline-flex items-center justify-center h-5 w-5 rounded transition-colors flex-shrink-0",
        hasText
          ? "text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10"
          : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted",
        className
      )}
    >
      <FileText className="h-3 w-3" />
    </button>
  );

  // Sem onSave: comportamento legado (apenas clique → abre detalhe).
  if (!onSave) return triggerBtn;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerBtn}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-96 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Anotação da tarefa
            </p>
            {hasText && (
              <p className="text-[10px] text-muted-foreground" title={text}>
                {hasMore ? `${preview.length}+ chars` : `${text.length} chars`}
              </p>
            )}
          </div>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Adicione uma anotação curta sobre esta tarefa..."
            className="min-h-[120px] text-sm resize-y"
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setValue(descricao || "");
                setOpen(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={handleSave}
              disabled={saving || value === (descricao || "")}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
