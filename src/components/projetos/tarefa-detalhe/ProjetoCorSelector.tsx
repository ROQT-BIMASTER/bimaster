import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Palette, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hexToRgba } from "@/hooks/useProjetoCor";

const PRESET_COLORS = [
  "#E91E78", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#EF4444", "#6366F1", "#0EA5E9",
];

interface ProjetoCorSelectorProps {
  projetoId: string;
  cor: string;
  canEdit: boolean;
}

export function ProjetoCorSelector({ projetoId, cor, canEdit }: ProjetoCorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(cor);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSelect = async (novaCor: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(novaCor)) {
      toast.error("Cor hex inválida (use formato #RRGGBB)");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projetos")
        .update({ cor: novaCor, bg_cor: hexToRgba(novaCor, 0.12) } as any)
        .eq("id", projetoId);
      if (error) throw error;
      toast.success("Cor do projeto atualizada");
      queryClient.invalidateQueries({ queryKey: ["projeto-cor", projetoId] });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar a cor");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div
        className="h-6 w-6 rounded-full border border-border/50"
        style={{ backgroundColor: cor }}
        title={`Cor do projeto: ${cor}`}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setHexInput(cor); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-6 w-6 rounded-full border border-border/50 flex items-center justify-center hover:scale-110 transition-transform"
          style={{ backgroundColor: cor }}
          title="Alterar cor do projeto"
        >
          <Palette className="h-3 w-3 text-white drop-shadow-sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-3">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Cor do projeto
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-md cursor-pointer transition-transform hover:scale-110 flex items-center justify-center",
                    cor === c && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => handleSelect(c)}
                  disabled={saving}
                >
                  {cor === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t pt-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Cor personalizada (hex)
            </p>
            <div className="flex items-center gap-1.5">
              <Input
                value={hexInput}
                onChange={(e) => {
                  let v = e.target.value;
                  if (v && !v.startsWith("#")) v = "#" + v;
                  setHexInput(v);
                }}
                placeholder="#FF5733"
                className="h-7 text-[11px] font-mono flex-1 px-2"
                maxLength={7}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(hexInput)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2"
                onClick={() => handleSelect(hexInput)}
                disabled={saving || !/^#[0-9A-Fa-f]{6}$/.test(hexInput)}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            A cor será aplicada em todas as tarefas e telas do projeto.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
