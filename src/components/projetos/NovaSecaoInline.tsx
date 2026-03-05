import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NovaSecaoInlineProps {
  onAdd: (nome: string) => void;
  darkBg?: boolean;
}

export function NovaSecaoInline({ onAdd, darkBg = false }: NovaSecaoInlineProps) {
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
          "flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors w-full",
          darkBg
            ? "text-white/50 hover:text-white hover:bg-white/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
        )}
      >
        <Plus className="h-4 w-4" />
        Adicionar uma seção
      </button>
    );
  }

  return (
    <div className="px-3 py-2">
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={e => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") { setValue(""); setEditing(false); } }}
        placeholder="Nome da seção e pressione Enter"
        className={cn("h-8 text-sm font-semibold", darkBg && "bg-white/10 border-white/20 text-white placeholder:text-white/40")}
      />
    </div>
  );
}
