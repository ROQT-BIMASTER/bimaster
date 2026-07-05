// Fila de alertas forenses da Torre (Fase 2).
// Detecção é determinística (motor SQL); aqui o humano TRIA: analisa, encerra com
// decisão assinada (justificativa obrigatória → trilha imutável) ou cria uma
// revisão operacional. Toda transição passa por fn_despesas_alerta_transicao.
// RLS restringe esta lista a admin/supervisor — usuário comum não vê alertas.
import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { AlertTriangle, RefreshCw, Search, Ban, ClipboardCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import {
  useTorreAlertas, useTorreAlertasContagem, useAlertaTransicao, useReprocessarDeteccao,
} from "@/hooks/financeiro/useTorreAlertas";
import type { AlertaAba, AlertaSeveridade, DespesaAlerta } from "@/types/financeiro/torre-alertas";

const REGRA_LABEL: Record<string, string> = {
  R01: "Variação anômala", R02: "Fornecedor novo", R03: "Duplicidade", R04: "Fracionamento",
  R06: "Concentração", R07: "Dia não útil", R08: "Benford", R09: "Provisão inflada",
  R11: "Juros crônicos", R12: "Portador atípico", R13: "Cobrança intragrupo",
  R14: "Higiene", R15: "Fornecedor duplicado",
};
const regraLabel = (cod: string) => REGRA_LABEL[cod.slice(0, 3)] ?? cod;

const sevCls: Record<AlertaSeveridade, string> = {
  critica: "bg-destructive text-destructive-foreground",
  alta: "bg-destructive/15 text-destructive border border-destructive/30",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
  baixa: "bg-muted text-muted-foreground",
};
const sevLabel: Record<AlertaSeveridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

const money = (v: number | null) => (v == null ? "—" : formatCurrency(v));
const fmtData = (v: string | null) => (v ? format(parseISO(v), "dd/MM/yyyy") : "—");

function AlertaCard({
  alerta, onAnalisar, onEncerrar, onRevisar, pendingId,
}: {
  alerta: DespesaAlerta;
  onAnalisar: (a: DespesaAlerta) => void;
  onEncerrar: (a: DespesaAlerta) => void;
  onRevisar: (a: DespesaAlerta) => void;
  pendingId: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const encerrado = alerta.status === "resolvido" || alerta.status === "descartado";
  const busy = pendingId === alerta.id;
  const evid = Object.entries(alerta.evidencia ?? {}).slice(0, 8);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", sevCls[alerta.severidade])}>
              {sevLabel[alerta.severidade]}
            </span>
            <Badge variant="outline" className="text-[10px] font-medium">{regraLabel(alerta.regra_codigo)}</Badge>
            {alerta.ocorrencias > 1 && (
              <span className="text-[10px] text-muted-foreground">{alerta.ocorrencias}× detectado</span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground mt-1.5 leading-snug">{alerta.titulo}</p>
          {alerta.descricao && <p className="text-xs text-muted-foreground mt-0.5">{alerta.descricao}</p>}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {alerta.fornecedor_nome && <span className="truncate max-w-[240px]">🏢 {alerta.fornecedor_nome}</span>}
            {alerta.competencia && <span>📅 {fmtData(alerta.competencia)}</span>}
            {alerta.conta_ids && alerta.conta_ids.length > 0 && <span>{alerta.conta_ids.length} título(s)</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Em risco</div>
          <div className="text-lg font-bold text-foreground tabular-nums font-mono">{money(alerta.valor_impacto)}</div>
        </div>
      </div>

      {evid.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setAberto((v) => !v)}
            className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ChevronDown className={cn("h-3 w-3 transition-transform", aberto && "rotate-180")} /> Evidência
          </button>
          {aberto && (
            <div className="mt-1 rounded-lg bg-muted/40 p-2 text-[11px] font-mono text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 overflow-x-auto">
              {evid.map(([k, v]) => (
                <div key={k} className="truncate"><span className="text-foreground/70">{k}:</span> {String(v)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {encerrado ? (
        <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
          {alerta.status === "descartado" ? "Encerrado" : "Resolvido"}
          {alerta.resolucao_nota ? ` — "${alerta.resolucao_nota}"` : ""}
          {alerta.resolvido_em ? ` · ${fmtData(alerta.resolvido_em)}` : ""}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
          {alerta.status === "novo" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy} onClick={() => onAnalisar(alerta)}>
              <Search className="h-3.5 w-3.5" /> Analisar
            </Button>
          )}
          {alerta.status === "em_analise" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy} onClick={() => onRevisar(alerta)}>
              <ClipboardCheck className="h-3.5 w-3.5" /> Marcar p/ revisão
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive"
            disabled={busy} onClick={() => onEncerrar(alerta)}>
            <Ban className="h-3.5 w-3.5" /> Encerrar
          </Button>
        </div>
      )}
    </div>
  );
}

export function TorreAlertas() {
  const [aba, setAba] = useState<AlertaAba>("novo");
  const { data: alertas = [], isLoading } = useTorreAlertas(aba);
  const { data: contagem } = useTorreAlertasContagem();
  const transicao = useAlertaTransicao();
  const reprocessar = useReprocessarDeteccao();

  const [encerrarAlvo, setEncerrarAlvo] = useState<DespesaAlerta | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [revisarAlvo, setRevisarAlvo] = useState<DespesaAlerta | null>(null);
  const [revisaoAberta, setRevisaoAberta] = useState(false);

  const analisar = (a: DespesaAlerta) =>
    transicao.mutate(
      { alertaId: a.id, novoStatus: "em_analise" },
      { onSuccess: () => toast.success("Alerta em análise"), onError: (e) => toast.error(e.message ?? "Falha") },
    );

  const confirmarEncerrar = () => {
    if (!encerrarAlvo) return;
    const texto = justificativa.trim();
    if (!texto) { toast.error("A justificativa é obrigatória — ela fica registrada na trilha."); return; }
    transicao.mutate(
      { alertaId: encerrarAlvo.id, novoStatus: "descartado", justificativa: texto },
      {
        onSuccess: () => { toast.success("Alerta encerrado — decisão registrada na trilha"); setEncerrarAlvo(null); setJustificativa(""); },
        onError: (e) => toast.error(e.message ?? "Falha ao encerrar"),
      },
    );
  };

  const abrirRevisao = (a: DespesaAlerta) => { setRevisarAlvo(a); setRevisaoAberta(true); };

  const doReprocessar = () =>
    reprocessar.mutate(undefined, {
      onSuccess: (res) => {
        const ins = res.reduce((s, r) => s + (r.inseridos ?? 0), 0);
        const upd = res.reduce((s, r) => s + (r.atualizados ?? 0), 0);
        toast.success(`Detecção concluída: ${ins} novo(s), ${upd} atualizado(s)`);
      },
      onError: (e) => toast.error(e.message ?? "Falha ao reprocessar"),
    });

  const c = contagem ?? { novo: 0, em_analise: 0, acionado: 0, encerrado: 0 };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-bold text-foreground">Alertas de risco</h2>
          <span className="text-xs text-muted-foreground">detecção automática · toda decisão fica na trilha</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={reprocessar.isPending} onClick={doReprocessar}>
          <RefreshCw className={cn("h-3.5 w-3.5", reprocessar.isPending && "animate-spin")} />
          {reprocessar.isPending ? "Reprocessando… (pode levar 1-2 min)" : "Reprocessar"}
        </Button>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as AlertaAba)}>
        <TabsList>
          <TabsTrigger value="novo">Novos {c.novo > 0 && <span className="ml-1.5 text-[10px] font-bold text-destructive">{c.novo}</span>}</TabsTrigger>
          <TabsTrigger value="em_analise">Em análise {c.em_analise > 0 && <span className="ml-1.5 text-[10px] font-bold">{c.em_analise}</span>}</TabsTrigger>
          <TabsTrigger value="encerrado">Encerrados {c.encerrado > 0 && <span className="ml-1.5 text-[10px] text-muted-foreground">{c.encerrado}</span>}</TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="mt-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : alertas.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {aba === "novo" ? "Nenhum alerta novo. Rode a detecção (Reprocessar) ou aguarde o ciclo diário." : "Nada aqui."}
            </div>
          ) : (
            alertas.map((a) => (
              <AlertaCard key={a.id} alerta={a} pendingId={transicao.isPending ? transicao.variables?.alertaId ?? null : null}
                onAnalisar={analisar} onEncerrar={setEncerrarAlvo} onRevisar={abrirRevisao} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Encerrar com decisão assinada (→ descartado, justificativa obrigatória) */}
      <Dialog open={!!encerrarAlvo} onOpenChange={(o) => { if (!o) { setEncerrarAlvo(null); setJustificativa(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar alerta</DialogTitle>
            <DialogDescription>
              A justificativa fica registrada na trilha de auditoria imutável (quem, quando, por quê). Descreva a decisão: falso positivo, aceito como legítimo, ou providência tomada.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2">{encerrarAlvo?.titulo}</div>
          <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={4}
            placeholder="Ex.: Recorrência legítima do contrato X; ou enviado à auditoria; ou negociado redução com o fornecedor." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEncerrarAlvo(null); setJustificativa(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={transicao.isPending} onClick={confirmarEncerrar}>Encerrar e registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar revisão operacional a partir do alerta (fila contas_pagar_revisao) */}
      {revisarAlvo && (
        <MarcarRevisaoDialog
          open={revisaoAberta}
          onOpenChange={(o) => { setRevisaoAberta(o); if (!o) setRevisarAlvo(null); }}
          contaId={revisarAlvo.conta_ids?.[0]}
          planoContasId={revisarAlvo.plano_contas_id ?? undefined}
          departamentoId={revisarAlvo.departamento_id ?? undefined}
          valorAtual={revisarAlvo.valor_impacto ?? 0}
          nomeItem={revisarAlvo.titulo}
          fornecedorNome={revisarAlvo.fornecedor_nome ?? undefined}
          fornecedorCodigo={revisarAlvo.fornecedor_codigo ?? undefined}
          onSuccess={() => toast.success("Revisão criada na fila operacional")}
        />
      )}
    </div>
  );
}
