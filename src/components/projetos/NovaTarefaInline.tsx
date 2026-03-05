import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NovaTarefaInlineProps {
  onAdd: (titulo: string) => void;
  placeholder?: string;
  darkBg?: boolean;
}

export function NovaTarefaInline({ onAdd, placeholder = "Adicionar tarefa...", darkBg = false }: NovaTarefaInlineProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
    setEditing(false);
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
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={e => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") { setValue(""); setEditing(false); } }}
        placeholder="Nome da tarefa e pressione Enter"
        className={cn("h-8 text-sm", darkBg && "bg-white/10 border-white/20 text-white placeholder:text-white/40")}
      />
    </div>
  );
}
