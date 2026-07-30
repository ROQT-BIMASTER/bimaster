/**
 * DownloadAnexosLoteDialog
 * ------------------------------------------------------------------
 * Seleção múltipla de anexos das tarefas visíveis no quadro (Kanban)
 * para download em um único pacote .zip, com histórico dos downloads
 * já realizados no projeto.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, History, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTimeBR } from "@/lib/formatters";
import type { TarefaArquivosResumo } from "@/hooks/useTarefasAnexos";
import {
  useAnexosDownloadHistorico,
  useAnexosDownloadLote,
  type AnexoSelecionado,
} from "@/hooks/useAnexosDownloadLote";

interface TarefaLite {
  id: string;
  titulo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoNome?: string;
  tarefas: TarefaLite[];
  anexosMap?: Record<string, TarefaArquivosResumo>;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function DownloadAnexosLoteDialog({
  open,
  onOpenChange,
  projetoId,
  projetoNome,
  tarefas,
  anexosMap,
}: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const disponiveis = useMemo<AnexoSelecionado[]>(() => {
    const lista: AnexoSelecionado[] = [];
    for (const t of tarefas) {
      const resumo = anexosMap?.[t.id];
      if (!resumo?.arquivos?.length) continue;
      for (const a of resumo.arquivos) {
        if (!a.storage_path) continue;
        lista.push({ ...a, tarefaId: t.id, tarefaTitulo: t.titulo });
      }
    }
    return lista;
  }, [tarefas, anexosMap]);

  useEffect(() => {
    if (!open) setSelecionados(new Set());
  }, [open]);

  const chave = (a: AnexoSelecionado) => `${a.tarefaId}::${a.bucket}::${a.storage_path}`;
  const todosSelecionados = disponiveis.length > 0 && selecionados.size === disponiveis.length;

  const alternar = (k: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const { mutateAsync, isPending, progresso } = useAnexosDownloadLote(projetoId, projetoNome);
  const historico = useAnexosDownloadHistorico(projetoId, open);

  const baixar = async () => {
    const escolhidos = disponiveis.filter((a) => selecionados.has(chave(a)));
    try {
      const res = await mutateAsync(escolhidos);
      toast.success(
        res.falhas.length > 0
          ? `${res.total} arquivo(s) baixados. ${res.falhas.length} falharam.`
          : `${res.total} arquivo(s) baixados no pacote.`,
      );
      setSelecionados(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o pacote de download.");
    }
  };

  // Agrupa por tarefa para leitura mais simples.
  const grupos = useMemo(() => {
    const map = new Map<string, { titulo: string; itens: AnexoSelecionado[] }>();
    for (const a of disponiveis) {
      const g = map.get(a.tarefaId) || { titulo: a.tarefaTitulo, itens: [] };
      g.itens.push(a);
      map.set(a.tarefaId, g);
    }
    return Array.from(map.values());
  }, [disponiveis]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Download de anexos em lote
          </DialogTitle>
          <DialogDescription>
            Selecione os anexos das tarefas visíveis no quadro. Todos os downloads ficam registrados no histórico.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="selecionar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selecionar">Selecionar ({disponiveis.length})</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selecionar" className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={(v) =>
                    setSelecionados(v ? new Set(disponiveis.map(chave)) : new Set())
                  }
                  disabled={disponiveis.length === 0}
                />
                Selecionar todos
              </label>
              <span className="text-xs text-muted-foreground">
                {selecionados.size} selecionado(s)
              </span>
            </div>

            <ScrollArea className="h-[320px] rounded-md border border-border/60 p-2">
              {grupos.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum anexo disponível nas tarefas filtradas.
                </p>
              )}
              {grupos.map((g) => (
                <div key={g.titulo + g.itens[0].tarefaId} className="mb-3">
                  <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.titulo}
                  </p>
                  <div className="space-y-1">
                    {g.itens.map((a) => {
                      const k = chave(a);
                      const on = selecionados.has(k);
                      return (
                        <label
                          key={k}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition",
                            on ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-muted/50",
                          )}
                        >
                          <Checkbox checked={on} onCheckedChange={() => alternar(k)} />
                          <span className="truncate">{a.nome}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {a.familia}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="historico" className="mt-3">
            <ScrollArea className="h-[360px] rounded-md border border-border/60 p-2">
              {historico.isLoading && (
                <p className="py-10 text-center text-sm text-muted-foreground">Carregando histórico...</p>
              )}
              {!historico.isLoading && (historico.data?.length ?? 0) === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum download registrado neste projeto.
                </p>
              )}
              {historico.data?.map((h) => (
                <div key={h.id} className="mb-2 rounded-md border border-border/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{h.pacote_nome || "Pacote"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTimeBR(h.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {h.total_arquivos} arquivo(s) · {formatBytes(h.tamanho_bytes)}
                    {h.total_falhas > 0 ? ` · ${h.total_falhas} falha(s)` : ""}
                  </p>
                  {h.arquivos?.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                      {h.arquivos.map((a) => a.nome).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Fechar
          </Button>
          <Button onClick={baixar} disabled={isPending || selecionados.size === 0} className="gap-1.5">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isPending && progresso
              ? `Baixando ${progresso.atual}/${progresso.total}`
              : `Baixar ${selecionados.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
