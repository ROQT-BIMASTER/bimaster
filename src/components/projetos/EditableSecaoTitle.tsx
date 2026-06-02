import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableSecaoTitleProps {
  nome: string;
  onRename: (novoNome: string) => Promise<void> | void;
  className?: string;
  disabled?: boolean;
  darkBg?: boolean;
}

export function EditableSecaoTitle({
  nome,
  onRename,
  className,
  disabled = false,
  darkBg = false,
}: EditableSecaoTitleProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nome);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setValue(nome);
  }, [nome, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setEditing(true);
  };

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === nome) {
      setEditing(false);
      setValue(nome);
      return;
    }
    try {
      setSaving(true);
      await onRename(trimmed);
      setEditing(false);
    } catch {
      setValue(nome);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setValue(nome);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void commit()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        disabled={saving}
        className={cn(
          "bg-transparent border-b outline-none px-0.5 min-w-0 flex-1",
          darkBg ? "border-white/40 text-white" : "border-primary text-foreground",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn("group/title inline-flex items-center gap-1 min-w-0", className)}
      onClick={startEdit}
      onDoubleClick={startEdit}
      title={disabled ? undefined : "Clique para renomear"}
      role={disabled ? undefined : "button"}
    >
      <span className="truncate">{nome}</span>
      {!disabled && (
        <Pencil
          className={cn(
            "h-3 w-3 opacity-0 group-hover/title:opacity-60 transition-opacity flex-shrink-0",
            darkBg ? "text-white/70" : "text-muted-foreground",
          )}
        />
      )}
    </span>
  );
}
