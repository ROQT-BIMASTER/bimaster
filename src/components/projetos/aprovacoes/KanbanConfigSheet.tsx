import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Settings2 } from "lucide-react";
import { useKanbanPreferencias, type AgruparPor, type ModoVisao } from "@/hooks/useKanbanPreferencias";
import type { KanbanPipeline } from "@/hooks/useKanbanAprovacoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelinesDisponiveis: KanbanPipeline[];
  showModoVisao?: boolean;
}

export function KanbanConfigSheet({ open, onOpenChange, pipelinesDisponiveis, showModoVisao = true }: Props) {
  const { prefs, update } = useKanbanPreferencias();
  const [modo, setModo] = useState<ModoVisao>(prefs.modo_visao);
  const [agrupar, setAgrupar] = useState<AgruparPor>(prefs.agrupar_por);
  const [mostrarFin, setMostrarFin] = useState(prefs.mostrar_finalizados);
  const [pipes, setPipes] = useState<string[]>(prefs.pipelines_visiveis);

  useEffect(() => {
    if (open) {
      setModo(prefs.modo_visao);
      setAgrupar(prefs.agrupar_por);
      setMostrarFin(prefs.mostrar_finalizados);
      setPipes(prefs.pipelines_visiveis);
    }
  }, [open, prefs]);

  function togglePipe(id: string) {
    setPipes((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function salvar() {
    await update.mutateAsync({
      modo_visao: modo,
      agrupar_por: agrupar,
      mostrar_finalizados: mostrarFin,
      pipelines_visiveis: pipes,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" /> Configurar Kanban
          </SheetTitle>
          <SheetDescription className="text-xs">
            Suas preferências são pessoais e ficam salvas para a próxima vez.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {showModoVisao && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modo de visão</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoVisao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minhas">Minhas pendências</SelectItem>
                  <SelectItem value="equipe">Equipe (projetos onde participo)</SelectItem>
                  <SelectItem value="coordenacao">Coordenação (projetos que coordeno)</SelectItem>
                  <SelectItem value="todas">Todas (admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Agrupar por</Label>
            <Select value={agrupar} onValueChange={(v) => setAgrupar(v as AgruparPor)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">Pipeline</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
                <SelectItem value="prazo">Prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Mostrar finalizados</Label>
              <p className="text-[10px] text-muted-foreground">Inclui aprovados / rejeitados / encaminhados.</p>
            </div>
            <Switch checked={mostrarFin} onCheckedChange={setMostrarFin} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Pipelines visíveis</Label>
            <p className="text-[10px] text-muted-foreground">Vazio = todos os pipelines ativos.</p>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              <div className="space-y-1">
                {pipelinesDisponiveis.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum pipeline configurado.</p>
                )}
                {pipelinesDisponiveis.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={pipes.length === 0 ? true : pipes.includes(p.id)}
                      onCheckedChange={() => togglePipe(p.id)}
                    />
                    <span className="text-xs">{p.nome}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
