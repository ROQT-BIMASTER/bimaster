import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, RefreshCw, Plus } from "lucide-react";
import { useProjetoIA } from "@/hooks/useProjetoIA";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AISubtarefasSuggestionsProps {
  tarefaTitulo: string;
  tarefaDescricao: string | null;
  estagio: string | null;
  projetoNome: string | null;
  onAdd: (titulos: string[]) => void;
  accentColor?: string;
  disabled?: boolean;
}

interface Suggestion {
  titulo: string;
  descricao?: string;
  ordem: number;
  selected: boolean;
}

export function AISubtarefasSuggestions({
  tarefaTitulo,
  tarefaDescricao,
  estagio,
  projetoNome,
  onAdd,
  accentColor,
  disabled,
}: AISubtarefasSuggestionsProps) {
  const { generateSubtasks, loading } = useProjetoIA();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const isLoading = loading === "generate_subtasks";

  const handleGenerate = async () => {
    try {
      const res = await generateSubtasks(tarefaTitulo, tarefaDescricao, estagio, projetoNome, 6);
      setSuggestions((res.subtarefas || []).map(s => ({ ...s, selected: true })));
    } catch {
      // toast já mostrado pelo hook
    }
  };

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o && suggestions.length === 0) handleGenerate();
  };

  const toggle = (i: number) => {
    setSuggestions(prev => prev.map((s, idx) => (idx === i ? { ...s, selected: !s.selected } : s)));
  };

  const handleConfirm = () => {
    const selecionadas = suggestions.filter(s => s.selected).map(s => s.titulo);
    if (selecionadas.length === 0) {
      toast.error("Selecione ao menos uma subtarefa.");
      return;
    }
    onAdd(selecionadas);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={disabled}
          style={accentColor ? { borderColor: `${accentColor}55`, color: accentColor } : undefined}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sugerir com IA
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" style={accentColor ? { color: accentColor } : undefined} />
            Subtarefas sugeridas
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerar
          </Button>
        </div>

        {isLoading && suggestions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Gerando sugestões...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma sugestão. Clique em Regenerar.
          </p>
        ) : (
          <ScrollArea className="max-h-[260px]">
            <div className="space-y-1.5 pr-2">
              {suggestions.map((s, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                    s.selected ? "bg-muted/50 border-border" : "border-transparent hover:bg-muted/30"
                  )}
                >
                  <Checkbox checked={s.selected} onCheckedChange={() => toggle(i)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug">{s.titulo}</p>
                    {s.descricao && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.descricao}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        {suggestions.length > 0 && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleConfirm}
              style={accentColor ? { backgroundColor: accentColor, color: "#fff" } : undefined}
            >
              <Plus className="h-3 w-3" />
              Adicionar selecionadas ({suggestions.filter(s => s.selected).length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
