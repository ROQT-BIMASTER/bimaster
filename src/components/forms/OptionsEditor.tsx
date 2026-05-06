import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical } from "lucide-react";

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  fieldType: "select" | "checkbox";
}

export function OptionsEditor({ options, onChange, fieldType }: OptionsEditorProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (options.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...options, v]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  function update(idx: number, val: string) {
    const next = [...options];
    next[idx] = val;
    onChange(next);
  }

  function bulkPaste(text: string) {
    const items = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length <= 1) return false;
    const merged = [...options];
    for (const it of items) if (!merged.includes(it)) merged.push(it);
    onChange(merged);
    setDraft("");
    return true;
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Opções da {fieldType === "select" ? "lista" : "caixa de seleção"}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {options.length} {options.length === 1 ? "opção" : "opções"}
        </Badge>
      </div>

      {options.length > 0 && (
        <div className="space-y-1.5">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5 group">
              <button
                type="button"
                onClick={() => move(idx, idx - 1)}
                disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Mover para cima"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <Input
                value={opt}
                onChange={(e) => update(idx, e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => remove(idx)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (bulkPaste(text)) e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Digite uma opção e pressione Enter"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          className="h-8 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Dica: cole várias opções separadas por vírgula, ponto-e-vírgula ou quebra de linha para adicionar de uma vez.
      </p>
    </div>
  );
}
