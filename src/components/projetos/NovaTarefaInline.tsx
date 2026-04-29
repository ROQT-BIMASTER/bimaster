import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NovaTarefaInlineProps {
  onAdd: (titulo: string) => void;
  placeholder?: string;
  darkBg?: boolean;
  /** Quando true, abre o input automaticamente. */
  autoOpen?: boolean;
}

export interface NovaTarefaInlineHandle {
  open: () => void;
}

export const NovaTarefaInline = forwardRef<NovaTarefaInlineHandle, NovaTarefaInlineProps>(function NovaTarefaInline(
  { onAdd, placeholder = "Adicionar tarefa...", darkBg = false, autoOpen = false },
  ref,
) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const justSubmittedRef = useRef(false);

  useImperativeHandle(ref, () => ({ open: () => setEditing(true) }), []);

  useEffect(() => {
    if (autoOpen) setEditing(true);
  }, [autoOpen]);

  const submit = (keepOpen: boolean) => {
    const trimmed = value.trim();
    if (trimmed) {
      justSubmittedRef.current = true;
      onAdd(trimmed);
      setValue("");
    }
    if (!keepOpen) setEditing(false);
    else inputRef.current?.focus();
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-colors w-full",
          darkBg
            ? "text-white/50 hover:text-white hover:bg-white/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        <Plus className="h-4 w-4" />
        {placeholder}
      </button>
    );
  }

  return (
    <div className="px-3 py-1.5">
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => {
          // Evita fechar quando perdeu foco logo após submit com Shift+Enter
          if (justSubmittedRef.current) {
            justSubmittedRef.current = false;
            return;
          }
          submit(false);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit(e.shiftKey);
          } else if (e.key === "Escape") {
            setValue("");
            setEditing(false);
          }
        }}
        placeholder="Enter para salvar · Shift+Enter para criar várias · Esc cancela"
        className={cn("h-8 text-sm", darkBg && "bg-white/10 border-white/20 text-white placeholder:text-white/40")}
      />
    </div>
  );
});

