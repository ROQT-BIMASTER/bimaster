import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { Loader2, Sparkles, Check, X, Edit3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Natureza {
  id: string;
  custo_tpg: number | null;
  historico_tpg: number | null;
  ccusto_nome: string | null;
  historico_nome: string | null;
  setor_erp: string | null;
  volume_12m: number | null;
  qtd_titulos: number | null;
  top_fornecedores: string | null;
  categoria_dominante: string | null;
  conta_code_v2: string | null;
  conta_name_v2: string | null;
  tipo: string | null;
  funcao_operacional: string | null;
  confidence: number | null;
  rationale: string | null;
  status: string;
  conta_final_code: string | null;
  auditor_nota: string | null;
}

interface Conta {
  code: string;
  name: string;
  tipo: string;
  funcao_operacional: string;
  analitica: boolean;
}

export default function PlanoContasAuditoria() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pendente_auditoria");
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Natureza | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editNota, setEditNota] = useState("");
  const [runningIA, setRunningIA] = useState(false);

  // Catálogo IFRS 18
  const { data: catalogo = [] } = useQuery<Conta[]>({
    queryKey: ["coa-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts_v2" as any)
        .select("code, name, tipo, funcao_operacional, analitica, ativo")
        .eq("ativo", true)
        .order("code");
      if (error) throw error;
      return (data ?? []) as any as Conta[];
    },
    staleTime: 60_000,
  });

  // Classificações IA + auditadas
  const { data: naturezas = [], isLoading, refetch } = useQuery<Natureza[]>({
    queryKey: ["nat-ia", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("natureza_erp_classificacao_ia" as any)
        .select("*")
        .order("volume_12m", { ascending: false, nullsFirst: false });
      if (statusFilter !== "todas") q = q.eq("status", statusFilter);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as any as Natureza[];
    },
  });

  // KPIs
  const { data: kpis } = useQuery({
    queryKey: ["nat-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("natureza_erp_classificacao_ia" as any)
        .select("status, volume_12m");
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const total = rows.length;
      const auditadas = rows.filter(r => r.status === "aprovada" || r.status === "editada").length;
      const volTotal = rows.reduce((s, r) => s + Number(r.volume_12m ?? 0), 0);
      const volAud = rows
        .filter(r => r.status === "aprovada" || r.status === "editada")
        .reduce((s, r) => s + Number(r.volume_12m ?? 0), 0);
      return {
        total,
        auditadas,
        pendentes: total - auditadas,
        percAud: total ? Math.round((auditadas / total) * 100) : 0,
        volTotal,
        volAud,
        percVolAud: volTotal ? Math.round((volAud / volTotal) * 100) : 0,
      };
    },
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return naturezas;
    return naturezas.filter(n =>
      (n.ccusto_nome ?? "").toLowerCase().includes(q) ||
      (n.historico_nome ?? "").toLowerCase().includes(q) ||
      (n.top_fornecedores ?? "").toLowerCase().includes(q) ||
      (n.conta_code_v2 ?? "").toLowerCase().includes(q) ||
      String(n.custo_tpg ?? "").includes(q) ||
      String(n.historico_tpg ?? "").includes(q),
    );
  }, [naturezas, busca]);

  const rodarIA = async () => {
    setRunningIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-natureza-erp", {
        body: { limit: 100, only_pending: true },
      });
      if (error) throw error;
      toast.success(
        `IA classificou ${(data as any)?.inserted_or_updated ?? 0} de ${(data as any)?.processed ?? 0} naturezas` +
        ((data as any)?.failed ? ` (${(data as any).failed} falhas)` : ""),
      );
      qc.invalidateQueries({ queryKey: ["nat-ia"] });
      qc.invalidateQueries({ queryKey: ["nat-kpis"] });
    } catch (e: any) {
      toast.error(`Falha ao rodar IA: ${e?.message ?? e}`);
    } finally {
      setRunningIA(false);
    }
  };

  const aprovar = useMutation({
    mutationFn: async (n: Natureza) => {
      const { error } = await supabase
        .from("natureza_erp_classificacao_ia" as any)
        .update({
          status: "aprovada",
          conta_final_code: n.conta_code_v2,
          auditado_em: new Date().toISOString(),
        })
        .eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aprovada");
      qc.invalidateQueries({ queryKey: ["nat-ia"] });
      qc.invalidateQueries({ queryKey: ["nat-kpis"] });
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? e}`),
  });

  const rejeitar = useMutation({
    mutationFn: async (n: Natureza) => {
      const { error } = await supabase
        .from("natureza_erp_classificacao_ia" as any)
        .update({
          status: "rejeitada",
          auditado_em: new Date().toISOString(),
        })
        .eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejeitada");
      qc.invalidateQueries({ queryKey: ["nat-ia"] });
      qc.invalidateQueries({ queryKey: ["nat-kpis"] });
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? e}`),
  });

  const salvarEdicao = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editCode || !catalogo.find(c => c.code === editCode)) {
        throw new Error("Código de conta inválido");
      }
      const { error } = await supabase
        .from("natureza_erp_classificacao_ia" as any)
        .update({
          status: "editada",
          conta_final_code: editCode,
          auditor_nota: editNota || null,
          auditado_em: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvo com edição");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["nat-ia"] });
      qc.invalidateQueries({ queryKey: ["nat-kpis"] });
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? e}`),
  });

  const openEdit = (n: Natureza) => {
    setEditing(n);
    setEditCode(n.conta_final_code ?? n.conta_code_v2 ?? "");
    setEditNota(n.auditor_nota ?? "");
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pendente_auditoria: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
      aprovada:           { label: "Aprovada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
      editada:            { label: "Editada",  cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
      rejeitada:          { label: "Rejeitada", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
    };
    const m = map[s] ?? { label: s, cls: "bg-muted" };
    return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Auditoria do Plano de Contas v2 (IFRS 18)</h1>
            <p className="text-sm text-muted-foreground">
              Revisão humana das sugestões da IA para cada combinação centro de custo × histórico do ERP.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />Recarregar
            </Button>
            <Button size="sm" onClick={rodarIA} disabled={runningIA}>
              {runningIA
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Sparkles className="mr-2 h-4 w-4" />}
              Rodar IA (próximas 100)
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total classificado</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.total ?? 0}</div>
              <div className="text-xs text-muted-foreground">naturezas com sugestão IA</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Auditadas</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.auditadas ?? 0}</div>
              <Progress value={kpis?.percAud ?? 0} className="mt-2 h-2" />
              <div className="text-xs text-muted-foreground mt-1">{kpis?.percAud ?? 0}% do total</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cobertura em valor</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.percVolAud ?? 0}%</div>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(kpis?.volAud ?? 0)} / {formatCurrency(kpis?.volTotal ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pendentes</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.pendentes ?? 0}</div>
              <div className="text-xs text-muted-foreground">aguardando revisão humana</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente_auditoria">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="editada">Editadas</SelectItem>
              <SelectItem value="rejeitada">Rejeitadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Busca (centro de custo, histórico, fornecedor, código)..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="max-w-lg"
          />
          <div className="text-sm text-muted-foreground ml-auto">
            {filtradas.length} de {naturezas.length}
          </div>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Carregando...
              </div>
            ) : filtradas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma natureza neste filtro. Rode a IA para classificar as pendentes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Natureza ERP</TableHead>
                      <TableHead>Volume 12m</TableHead>
                      <TableHead>Sugestão IA</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Top fornecedores</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map(n => (
                      <TableRow key={n.id}>
                        <TableCell className="max-w-xs">
                          <div className="font-medium text-sm">
                            {n.ccusto_nome ?? `CC ${n.custo_tpg}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {n.historico_nome ?? `H ${n.historico_tpg}`}
                          </div>
                          {n.categoria_dominante && (
                            <div className="text-[11px] text-muted-foreground italic">
                              {n.categoria_dominante}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="font-mono text-sm">{formatCurrency(n.volume_12m ?? 0)}</div>
                          <div className="text-xs text-muted-foreground">{n.qtd_titulos ?? 0} títulos</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{n.conta_code_v2 ?? "—"}</div>
                          <div className="text-sm">{n.conta_name_v2 ?? "—"}</div>
                          {n.rationale && (
                            <div className="text-[11px] text-muted-foreground italic max-w-md line-clamp-2">
                              {n.rationale}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {n.confidence != null && (
                            <Badge variant="outline" className={
                              n.confidence >= 0.85
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : n.confidence >= 0.6
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                            }>
                              {Math.round(n.confidence * 100)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {n.top_fornecedores ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(n.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => aprovar.mutate(n)}
                              disabled={n.status === "aprovada"}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(n)}>
                              <Edit3 className="h-4 w-4 text-sky-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejeitar.mutate(n)}
                              disabled={n.status === "rejeitada"}>
                              <X className="h-4 w-4 text-rose-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de edição */}
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar classificação</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="text-sm p-3 bg-muted rounded-md">
                  <div><span className="font-medium">Centro de custo:</span> [{editing.custo_tpg}] {editing.ccusto_nome ?? "—"}</div>
                  <div><span className="font-medium">Histórico:</span> [{editing.historico_tpg}] {editing.historico_nome ?? "—"}</div>
                  <div><span className="font-medium">Volume 12m:</span> {formatCurrency(editing.volume_12m ?? 0)}</div>
                  <div><span className="font-medium">Sugestão IA:</span> {editing.conta_code_v2} — {editing.conta_name_v2}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Conta contábil (v2)</label>
                  <Select value={editCode} onValueChange={setEditCode}>
                    <SelectTrigger><SelectValue placeholder="Escolha uma conta..." /></SelectTrigger>
                    <SelectContent className="max-h-96">
                      {catalogo.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="font-mono text-xs mr-2">{c.code}</span>
                          {c.name}
                          {c.analitica && <span className="ml-2 text-[10px] opacity-60">analítica</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Nota do auditor (opcional)</label>
                  <Textarea rows={2} value={editNota} onChange={e => setEditNota(e.target.value)}
                    placeholder="Motivo da edição ou observação para próxima revisão..." />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => salvarEdicao.mutate()} disabled={salvarEdicao.isPending}>
                {salvarEdicao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar edição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
