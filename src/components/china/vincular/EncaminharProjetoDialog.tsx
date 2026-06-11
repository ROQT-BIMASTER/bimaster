import { useState, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, Folder, ListChecks, Send, ArrowLeft, Sparkles, FolderPlus } from "lucide-react";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";
import { useEncaminharProjetoTarefa } from "@/hooks/useEncaminharProjetoTarefa";
import { useEncaminhamentoSmartDefaults } from "@/hooks/useEncaminhamentoSmartDefaults";
import { ConfigurarProjetoEspelhoDialog } from "./ConfigurarProjetoEspelhoDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
  produtoCodigo?: string;
  produtoNome?: string;
}

export function EncaminharProjetoDialog({
  open, onOpenChange, submissaoId, produtoCodigo, produtoNome,
}: Props) {
  const [search, setSearch] = useState("");
  const [projeto, setProjeto] = useState<{ id: string; nome: string; cor?: string } | null>(null);
  const [tarefa, setTarefa] = useState<{ id: string; titulo: string; secao_id: string | null } | null>(null);
  const [obs, setObs] = useState("");
  const [configurarOpen, setConfigurarOpen] = useState(false);

  const { data: projetos = [], isLoading: loadingProjetos } = useProjetosParaVinculo();
  const { data: secoesData, isLoading: loadingTarefas } = useSecoesETarefas(projeto?.id ?? null);
  const { data: smart } = useEncaminhamentoSmartDefaults(open ? submissaoId : null);
  const enviar = useEncaminharProjetoTarefa();

  // Pre-seleciona projeto recomendado ao abrir o diálogo (sem sobrescrever escolha manual)
  useEffect(() => {
    if (open && smart?.projeto && !projeto) {
      setProjeto({ id: smart.projeto.id, nome: smart.projeto.nome, cor: smart.projeto.cor ?? undefined });
    }
  }, [open, smart?.projeto, projeto]);

  const tarefas = (secoesData?.tarefas ?? []) as Array<{ id: string; titulo: string; secao_id: string | null; codigo?: string | null }>;
  const recomendadasIds = useMemo(
    () => new Set((smart?.tarefas ?? []).map((t) => t.id)),
    [smart?.tarefas],
  );
  const motivosById = useMemo(() => {
    const m = new Map<string, string[]>();
    (smart?.tarefas ?? []).forEach((t) => m.set(t.id, t.motivos));
    return m;
  }, [smart?.tarefas]);

  const filteredProjetos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projetos;
    return (projetos as any[]).filter((p) => (p.nome ?? "").toLowerCase().includes(q));
  }, [projetos, search]);

  const filteredTarefas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? tarefas.filter((t) => `${t.titulo ?? ""} ${t.codigo ?? ""}`.toLowerCase().includes(q))
      : tarefas;
    // Recomendadas primeiro, mantendo ordem do score (smart.tarefas já vem ordenado)
    const smartOrder = (smart?.tarefas ?? []).map((t) => t.id);
    return [...list].sort((a, b) => {
      const ai = smartOrder.indexOf(a.id);
      const bi = smartOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [tarefas, search, smart?.tarefas]);

  const reset = () => {
    setProjeto(null); setTarefa(null); setObs(""); setSearch("");
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!submissaoId || !projeto) return;
    await enviar.mutateAsync({
      submissao_id: submissaoId,
      projeto_id: projeto.id,
      projeto_nome: projeto.nome,
      tarefa_id: tarefa?.id ?? null,
      tarefa_titulo: tarefa?.titulo ?? null,
      secao_id: tarefa?.secao_id ?? null,
      observacao: obs.trim(),
      produto_codigo: produtoCodigo,
      produto_nome: produtoNome,
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {projeto ? "Escolher tarefa (opcional)" : "Encaminhar a um projeto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!projeto && smart?.projeto && (
            <button
              type="button"
              onClick={() => setProjeto({ id: smart.projeto!.id, nome: smart.projeto!.nome, cor: smart.projeto!.cor ?? undefined })}
              className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-left transition-colors hover:bg-primary/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Projeto recomendado</p>
                <p className="truncate text-xs font-medium text-foreground">{smart.projeto.nome}</p>
              </div>
              <Badge variant="outline" className="h-5 border-primary/40 text-[10px] text-primary">Usar</Badge>
            </button>
          )}
          {projeto && (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: projeto.cor || "hsl(var(--primary))" }}
                />
                <span className="truncate text-xs font-medium">{projeto.nome}</span>
              </div>
              <Button
                variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]"
                onClick={() => { setProjeto(null); setTarefa(null); setSearch(""); }}
              >
                <ArrowLeft className="h-3 w-3" /> Trocar
              </Button>
            </div>
          )}

          <div>
            <Label className="text-xs">{projeto ? "Tarefa" : "Projeto"}</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={projeto ? "Buscar tarefa" : "Buscar projeto"}
                className="h-8 pl-7 text-xs"
              />
            </div>
            <ScrollArea className="mt-2 h-56 rounded-md border border-border">
              {!projeto ? (
                loadingProjetos ? (
                  <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
                ) : filteredProjetos.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Nenhum projeto encontrado</div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {(filteredProjetos as any[]).map((p) => (
                      <li
                        key={p.id}
                        onClick={() => { setProjeto({ id: p.id, nome: p.nome, cor: p.cor }); setSearch(""); }}
                        className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50"
                      >
                        <Folder className="h-4 w-4 shrink-0" style={{ color: p.cor || undefined }} />
                        <span className="truncate flex-1 font-medium text-foreground">{p.nome}</span>
                        {p.status && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">{p.status}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : loadingTarefas ? (
                <div className="p-3 text-xs text-muted-foreground">Carregando tarefas...</div>
              ) : filteredTarefas.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  Nenhuma tarefa. Você pode encaminhar somente ao projeto.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  <li
                    onClick={() => setTarefa(null)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50",
                      !tarefa && "bg-primary/10"
                    )}
                  >
                    <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 italic text-muted-foreground">Apenas o projeto (sem tarefa)</span>
                  </li>
                  {filteredTarefas.map((t) => {
                    const active = tarefa?.id === t.id;
                    const isSmart = recomendadasIds.has(t.id);
                    const motivos = motivosById.get(t.id) ?? [];
                    return (
                      <li
                        key={t.id}
                        onClick={() => setTarefa({ id: t.id, titulo: t.titulo, secao_id: t.secao_id })}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/50",
                          active && "bg-primary/10",
                          isSmart && !active && "bg-primary/[0.04]"
                        )}
                        title={motivos.length ? `Recomendada: ${motivos.join(" • ")}` : undefined}
                      >
                        <ListChecks className={cn("h-4 w-4 shrink-0", isSmart ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate flex-1 font-medium text-foreground">{t.titulo}</span>
                        {isSmart && (
                          <Badge variant="outline" className="h-4 gap-0.5 border-primary/40 px-1 text-[9px] text-primary">
                            <Sparkles className="h-2.5 w-2.5" />
                            Recomendada
                          </Badge>
                        )}
                        {t.codigo && (
                          <span className="text-[10px] text-muted-foreground">{t.codigo}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Contexto, urgência ou instruções"
              className="mt-1 min-h-[64px] text-xs"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!projeto || enviar.isPending}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {enviar.isPending ? "Encaminhando..." : "Encaminhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
