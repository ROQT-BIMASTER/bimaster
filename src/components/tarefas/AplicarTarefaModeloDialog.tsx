import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTarefaModelos, useAplicarTarefaModelo, type TarefaModelo } from "@/hooks/useTarefaModelos";
import { Search, FileText, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  secaoId: string;
  parentTarefaId?: string | null;
}

function countNodes(node: any): number {
  if (!node) return 0;
  return 1 + ((node.children || []) as any[]).reduce((s, c) => s + countNodes(c), 0);
}

function escopoBadge(escopo: TarefaModelo["escopo"]) {
  const map: Record<TarefaModelo["escopo"], { label: string; className: string }> = {
    pessoal: { label: "Pessoal", className: "bg-muted text-muted-foreground" },
    departamento: { label: "Departamento", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    organizacao: { label: "Organização", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  };
  const e = map[escopo];
  return <Badge variant="outline" className={cn("text-[10px] h-5", e.className)}>{e.label}</Badge>;
}

export function AplicarTarefaModeloDialog({ open, onOpenChange, projetoId, secaoId, parentTarefaId = null }: Props) {
  const { data: modelos = [], isLoading } = useTarefaModelos();
  const aplicar = useAplicarTarefaModelo();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return modelos;
    return modelos.filter((m) => m.nome.toLowerCase().includes(term) || (m.descricao_curta || "").toLowerCase().includes(term));
  }, [modelos, q]);

  const selected = filtered.find((m) => m.id === selectedId) || null;

  const handleApply = async () => {
    if (!selected) return;
    await aplicar.mutateAsync({ modeloId: selected.id, projetoId, secaoId, parentTarefaId });
    onOpenChange(false);
    setSelectedId(null);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar modelo</DialogTitle>
          <DialogDescription>
            Cria a tarefa (e subtarefas) na seção atual com base em um modelo salvo.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome ou descrição..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[280px]">
          <ScrollArea className="border rounded-md h-[320px]">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando modelos...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {modelos.length === 0
                  ? "Nenhum modelo salvo ainda. Use \"Salvar como modelo\" no menu de uma tarefa."
                  : "Nenhum modelo encontrado."}
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors",
                        selectedId === m.id && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{m.nome}</span>
                        {escopoBadge(m.escopo)}
                      </div>
                      {m.descricao_curta && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.descricao_curta}</p>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                        <Layers className="h-3 w-3" />
                        {countNodes((m.payload as any)?.root)} item(ns)
                        {m.uso_count > 0 && <span>• {m.uso_count} uso(s)</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <div className="border rounded-md p-3 text-sm min-h-[320px]">
            {selected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selected.payload?.root?.titulo || selected.nome}</span>
                </div>
                {selected.descricao_curta && (
                  <p className="text-xs text-muted-foreground">{selected.descricao_curta}</p>
                )}
                <PreviewTree node={selected.payload?.root} />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Selecione um modelo para ver a estrutura.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!selected || aplicar.isPending}>
            {aplicar.isPending ? "Aplicando..." : "Aplicar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTree({ node, depth = 0 }: { node: any; depth?: number }) {
  if (!node) return null;
  return (
    <div className="text-xs">
      <div className="flex items-start gap-1.5" style={{ paddingLeft: depth * 12 }}>
        <span className="text-muted-foreground">•</span>
        <span className="truncate">{node.titulo}</span>
        {typeof node.prazo_dias === "number" && (
          <span className="text-[10px] text-muted-foreground">(+{node.prazo_dias}d)</span>
        )}
      </div>
      {(node.children || []).map((c: any, i: number) => (
        <PreviewTree key={i} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
