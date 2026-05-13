import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Gavel, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTemplatesAlcadas, useLoteEtapas, useLoteEventos, useAvancarEtapa } from "@/hooks/useLoteAprovacao";
import { useLotesDaSubmissao, useCriarLoteAprovacaoSubmissao } from "@/hooks/useLoteAprovacaoSubmissao";

interface Props {
  submissaoId: string;
  produtoNome: string;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
    pendente: { label: "Em andamento", cls: "bg-primary/15 text-primary border-primary/30", icon: Loader2 },
    aprovado: { label: "Aprovado", cls: "bg-success/15 text-success border-success/30", icon: ShieldCheck },
    rejeitado: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: X },
    cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border", icon: X },
  };
  return map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border", icon: Clock };
}

export function VincularAprovacaoTab({ submissaoId, produtoNome }: Props) {
  const { data: lotes = [], isLoading } = useLotesDaSubmissao(submissaoId);
  const { data: templates = [] } = useTemplatesAlcadas();
  const criar = useCriarLoteAprovacaoSubmissao();
  const avancar = useAvancarEtapa();

  const [showNovo, setShowNovo] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [loteNome, setLoteNome] = useState<string>("");
  const [comentario, setComentario] = useState<string>("");

  const loteAtivo = useMemo(() => lotes.find((l) => l.status === "pendente") || null, [lotes]);
  const loteSelecionado = loteAtivo || lotes[0] || null;

  const { data: etapas = [] } = useLoteEtapas(loteSelecionado?.config_id);
  const { data: eventos = [] } = useLoteEventos(loteSelecionado?.id);

  const handleCriar = async () => {
    if (!templateId) return;
    const nome = loteNome.trim() || `Aprovação — ${produtoNome}`;
    await criar.mutateAsync({ submissaoId, configId: templateId, loteNome: nome });
    setShowNovo(false);
    setTemplateId("");
    setLoteNome("");
  };

  const handleDecidir = async (decisao: "aprovado" | "rejeitado") => {
    if (!loteSelecionado) return;
    await avancar.mutateAsync({ instanciaId: loteSelecionado.id, decisao, comentario: comentario.trim() || undefined });
    setComentario("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sem lotes ainda — CTA inicial
  if (lotes.length === 0 && !showNovo) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
        <Gavel className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Nenhum fluxo de aprovação em curso</p>
          <p className="text-xs text-muted-foreground">
            Inicie um lote usando um dos templates configurados em Templates de Alçadas.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNovo(true)} disabled={templates.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Iniciar fluxo de aprovação
        </Button>
        {templates.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Cadastre um template em /admin/templates-alcadas antes de iniciar.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-4">
          {/* Painel de criação */}
          {showNovo && (
            <div className="rounded-md border border-border bg-card/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Novo lote de aprovação</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNovo(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Template</label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome do lote (opcional)</label>
                <Input
                  value={loteNome}
                  onChange={(e) => setLoteNome(e.target.value)}
                  placeholder={`Aprovação — ${produtoNome}`}
                  className="h-8 text-xs"
                />
              </div>
              <Button size="sm" className="w-full" onClick={handleCriar} disabled={!templateId || criar.isPending}>
                {criar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Iniciar
              </Button>
            </div>
          )}

          {/* Lista de lotes */}
          {lotes.map((lote) => {
            const sb = statusBadge(lote.status);
            const SbIcon = sb.icon;
            const isSelected = loteSelecionado?.id === lote.id;
            return (
              <div
                key={lote.id}
                className={cn(
                  "rounded-md border p-3 space-y-2",
                  isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{lote.lote_nome || lote.titulo || "Lote"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Criado em {format(new Date(lote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {lote.prazo_lote && ` · Prazo ${format(new Date(lote.prazo_lote), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[9.5px] gap-0.5 h-4 px-1.5", sb.cls)}>
                    <SbIcon className={cn("h-2.5 w-2.5", lote.status === "pendente" && "animate-spin")} />
                    {sb.label}
                  </Badge>
                </div>

                {isSelected && etapas.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Etapas</p>
                      <ol className="space-y-1">
                        {etapas.map((etapa) => {
                          const completed = etapa.ordem < lote.etapa_atual_ordem;
                          const current = etapa.ordem === lote.etapa_atual_ordem && lote.status === "pendente";
                          return (
                            <li
                              key={etapa.id}
                              className={cn(
                                "flex items-center gap-2 rounded px-2 py-1 text-[11px]",
                                current && "bg-primary/10 text-primary border border-primary/30",
                                completed && "text-success",
                                !current && !completed && "text-muted-foreground",
                              )}
                            >
                              {completed ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : current ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              <span className="flex-1 truncate">{etapa.nome}</span>
                              {etapa.prazo_dias && (
                                <span className="text-[9.5px] text-muted-foreground">{etapa.prazo_dias}d</span>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {lote.status === "pendente" && (
                      <>
                        <Separator className="my-1" />
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Decisão da etapa atual
                          </label>
                          <Textarea
                            value={comentario}
                            onChange={(e) => setComentario(e.target.value)}
                            placeholder="Comentário (opcional)"
                            className="text-xs min-h-[60px]"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleDecidir("aprovado")}
                              disabled={avancar.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleDecidir("rejeitado")}
                              disabled={avancar.isPending}
                            >
                              <X className="h-3 w-3 mr-1" /> Rejeitar
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {eventos.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Histórico</p>
                          <ul className="space-y-1">
                            {eventos.slice().reverse().map((ev) => (
                              <li key={ev.id} className="text-[11px] text-muted-foreground">
                                <span className="text-foreground">
                                  Etapa {ev.etapa_ordem + 1} — {ev.etapa_nome}
                                </span>
                                {ev.decisao && (
                                  <span
                                    className={cn(
                                      "ml-1 font-medium",
                                      ev.decisao === "aprovado" && "text-success",
                                      ev.decisao === "rejeitado" && "text-destructive",
                                    )}
                                  >
                                    · {ev.decisao}
                                  </span>
                                )}
                                {ev.comentario && <span className="ml-1">— {ev.comentario}</span>}
                                <span className="block text-[9.5px] text-muted-foreground/70">
                                  {format(new Date(ev.entrou_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {!showNovo && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowNovo(true)}
              disabled={!!loteAtivo || templates.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {loteAtivo ? "Já existe um lote em andamento" : "Iniciar novo lote"}
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
