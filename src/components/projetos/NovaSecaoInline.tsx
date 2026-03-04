import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NovaSecaoInlineProps {
  onAdd: (nome: string) => void;
}

export function NovaSecaoInline({ onAdd }: NovaSecaoInlineProps) {
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
        className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors w-full border-t border-border/30 mt-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar uma seção
      </button>
    );
  }

  return (
    <div className="px-3 py-2 border-t border-border/30 mt-2">
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={e => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") { setValue(""); setEditing(false); } }}
        placeholder="Nome da seção e pressione Enter"
        className="h-8 text-sm font-semibold"
      />
    </div>
  );
}
