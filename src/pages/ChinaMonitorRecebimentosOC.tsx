import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, Loader2, Clock, Truck, FileDown, ExternalLink, AlertOctagon } from "lucide-react";
import { useChinaRecebimentoKpis } from "@/hooks/useChinaRecebimentoKpis";
import { useChinaProdutosRecebimentoKpis } from "@/hooks/useChinaProdutosRecebimentoKpis";
import { ProdutoVinculadoChinaCard } from "@/components/china/recebimentos/ProdutoVinculadoChinaCard";
import { OPVinculadaCard } from "@/components/china/op/OPVinculadaCard";
import { formatLocalDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { SavedFiltersMenu } from "@/components/china/recebimentos/SavedFiltersMenu";
import { AlertasResponsavelPanel } from "@/components/china/recebimentos/AlertasResponsavelPanel";
import { useSavedFiltersRecebimento } from "@/hooks/useSavedFiltersRecebimento";
import { buildOCResumoCsv, buildOPsCsv, buildDivergenciasCsv, buildProdutosCsv, downloadBlob } from "@/lib/china/csvExporters";
import { fetchOPsByOCs } from "@/hooks/useFabricaOPsByOCs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.min(100, Math.round((num / den) * 100));
}

function slaBadge(dias: number | null) {
  if (dias == null) return <Badge variant="outline">—</Badge>;
  if (dias <= 7) return <Badge className="bg-emerald-600">{dias}d</Badge>;
  if (dias <= 15) return <Badge className="bg-amber-500">{dias}d</Badge>;
  return <Badge className="bg-red-500">{dias}d</Badge>;
}

export default function ChinaMonitorRecebimentosOC() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filtroEspecial, setFiltroEspecial] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const { data: savedFilters = [] } = useSavedFiltersRecebimento();
  const { data: kpis = [], isLoading } = useChinaRecebimentoKpis();
  const { data: produtos = [], isLoading: isLoadingProdutos } = useChinaProdutosRecebimentoKpis();
  const [expandedProds, setExpandedProds] = useState<Set<string>>(new Set());

  // Aplicar filtro padrão na primeira render se não houver ?oc=
  useEffect(() => {
    if (params.get("oc")) return;
    const def = savedFilters.find((f: any) => f.is_default);
    if (def && search === "" && statusFilter === "all" && filtroEspecial === "all") {
      const p = def.payload || {};
      if (p.search) setSearch(p.search);
      if (p.statusFilter) setStatusFilter(p.statusFilter);
      if (p.filtroEspecial) setFiltroEspecial(p.filtroEspecial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFilters.length]);


  const filtered = useMemo(() => {
    return kpis.filter((k) => {
      if (statusFilter !== "all" && k.oc_status !== statusFilter) return false;
      if (filtroEspecial === "divergencia" && k.qty_avariada + k.qty_faltante === 0) return false;
      if (filtroEspecial === "atrasada") {
        if (!k.data_entrega_prevista) return false;
        const prev = new Date(k.data_entrega_prevista).getTime();
        const isLate = prev < Date.now() && (!k.data_entrega_real);
        if (!isLate) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (
          !k.numero_oc.toLowerCase().includes(s) &&
          !(k.produto_codigo || "").toLowerCase().includes(s) &&
          !(k.produto_nome || "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [kpis, search, statusFilter, filtroEspecial]);

  // Agrupa OCs filtradas por submissao_id
  const ocsByProduto = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const oc of filtered) {
      const arr = m.get(oc.submissao_id) || [];
      arr.push(oc);
      m.set(oc.submissao_id, arr);
    }
    return m;
  }, [filtered]);

  const produtosFiltrados = useMemo(() => {
    const s = search.trim().toLowerCase();
    return produtos.filter((p) => {
      const ocsDoProd = ocsByProduto.get(p.submissao_id) || [];
      const hasOcsAfterFilter = ocsDoProd.length > 0;
      // Se há filtros aplicados (status/especial), oculta produtos sem OC visível
      const hasOcFilter = statusFilter !== "all" || filtroEspecial !== "all";
      if (hasOcFilter && !hasOcsAfterFilter) return false;
      if (s) {
        const matchProduto =
          p.produto_codigo.toLowerCase().includes(s) ||
          p.produto_nome.toLowerCase().includes(s);
        const matchOc = ocsDoProd.some((oc) =>
          oc.numero_oc.toLowerCase().includes(s)
        );
        if (!matchProduto && !matchOc) return false;
      }
      return true;
    });
  }, [produtos, ocsByProduto, search, statusFilter, filtroEspecial]);

  const selectedId = params.get("oc");
  const selected = kpis.find((k) => k.ordem_compra_id === selectedId)
    || filtered[0];

  const setSelected = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("oc", id);
    setParams(next, { replace: true });
    // Auto-expande o produto da OC selecionada
    const oc = kpis.find((k) => k.ordem_compra_id === id);
    if (oc) {
      setExpandedProds((prev) => new Set(prev).add(oc.submissao_id));
    }
  };

  const toggleProduto = (submissaoId: string) => {
    setExpandedProds((prev) => {
      const next = new Set(prev);
      if (next.has(submissaoId)) next.delete(submissaoId);
      else next.add(submissaoId);
      return next;
    });
  };

  // Auto-expande produto da OC selecionada na primeira render
  useEffect(() => {
    if (selected && !expandedProds.has(selected.submissao_id)) {
      setExpandedProds((prev) => new Set(prev).add(selected.submissao_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const exportar = async (escopo: "oc" | "ops" | "divergencias") => {
    setExporting(true);
    try {
      const stamp = Date.now();
      const ocIds = filtered.map((k) => k.ordem_compra_id);
      if (escopo === "oc") {
        downloadBlob(buildOCResumoCsv(filtered), `monitor-recebimentos-oc-${stamp}.csv`);
      } else if (escopo === "ops") {
        const rows = await fetchOPsByOCs(ocIds);
        if (!rows.length) toast.info("Nenhuma OP vinculada às OCs filtradas");
        downloadBlob(buildOPsCsv(rows), `monitor-recebimentos-ops-${stamp}.csv`);
      } else {
        const { data } = await supabase
          .from("china_nao_conformidades" as any)
          .select("*, oc:china_ordens_compra(numero_oc, produto_codigo)")
          .in("ordem_compra_id", ocIds.length ? ocIds : ["00000000-0000-0000-0000-000000000000"])
          .order("created_at", { ascending: false });
        if (!data || !data.length) toast.info("Nenhuma divergência nas OCs filtradas");
        downloadBlob(buildDivergenciasCsv((data || []) as any[]), `monitor-divergencias-${stamp}.csv`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  const applySaved = (p: { search?: string; statusFilter?: string; filtroEspecial?: string }) => {
    setSearch(p.search || "");
    setStatusFilter(p.statusFilter || "all");
    setFiltroEspecial(p.filtroEspecial || "all");
  };

  return (
    <ChinaPageShell>
      <ChinaPageHeader
        icon={Truck}
        titlePt="Monitor de Recebimentos · OCs"
        titleCn="收货监控 · 采购单"
        subtitle="Acompanhe pedido, embarque, recebimento e produção vinculada por OC."
        showBack
        backTo="/dashboard/fabrica-china/recebimentos"
        backLabel="Voltar para Recebimentos"
      />

      <AlertasResponsavelPanel onSelectOC={setSelected} />

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar OC, código ou produto…"
            className="pl-7 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="aprovada">Aprovada</SelectItem>
            <SelectItem value="em_producao">Em produção</SelectItem>
            <SelectItem value="embarcada">Embarcada</SelectItem>
            <SelectItem value="recebida">Recebida</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEspecial} onValueChange={setFiltroEspecial}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="divergencia">Com divergência</SelectItem>
            <SelectItem value="atrasada">Atrasadas</SelectItem>
          </SelectContent>
        </Select>
        <SavedFiltersMenu
          current={{ search, statusFilter, filtroEspecial }}
          onApply={applySaved}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exporting}>
              <FileDown className="h-3.5 w-3.5 mr-1" />
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Escopo</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => exportar("oc")}>OCs (resumo)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportar("ops")}>OPs vinculadas</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportar("divergencias")}>Divergências</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/dashboard/fabrica-china/recebimentos/divergencias")}
        >
          <AlertOctagon className="h-3.5 w-3.5 mr-1" /> Divergências
        </Button>
      </Card>

      <div className="grid grid-cols-12 gap-3">
        {/* Lista */}
        <div className="col-span-12 lg:col-span-5 space-y-2 max-h-[calc(100vh-260px)] overflow-auto pr-1">
          {isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando OCs…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma OC encontrada com os filtros atuais.
            </Card>
          )}
          {filtered.map((k) => {
            const recPct = pct(k.qty_recebida, k.qty_pedida);
            const isSel = selected?.ordem_compra_id === k.ordem_compra_id;
            const divergencia = k.qty_avariada + k.qty_faltante > 0;
            return (
              <Card
                key={k.ordem_compra_id}
                onClick={() => setSelected(k.ordem_compra_id)}
                className={cn(
                  "p-3 cursor-pointer hover:border-primary transition-colors",
                  isSel && "border-primary ring-1 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold">{k.numero_oc}</div>
                    <div className="text-xs truncate">
                      <span className="font-mono text-muted-foreground">{k.produto_codigo}</span> — {k.produto_nome}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{k.oc_status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <div className="text-muted-foreground">Pedida</div>
                    <div className="font-medium">{k.qty_pedida.toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Embarcada</div>
                    <div className="font-medium">{k.qty_embarcada.toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Recebida</div>
                    <div className="font-medium">{k.qty_recebida.toLocaleString("pt-BR")} ({recPct}%)</div>
                  </div>
                </div>
                <Progress value={recPct} className="h-1.5 mt-1.5" />
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Saldo: {k.saldo_aberto.toLocaleString("pt-BR")}</span>
                  <div className="flex items-center gap-1.5">
                    {divergencia && (
                      <Badge className="bg-amber-500 text-white text-[10px] py-0 h-4">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> divergência
                      </Badge>
                    )}
                    {slaBadge(k.sla_porto_cd_dias)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Detalhe */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          {!selected ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Selecione uma OC à esquerda
            </Card>
          ) : (
            <>
              <Card className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">OC</div>
                    <div className="font-mono font-semibold">{selected.numero_oc}</div>
                    <div className="text-sm mt-0.5">
                      <span className="font-mono text-muted-foreground">{selected.produto_codigo}</span> — {selected.produto_nome}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/fabrica-china/ordens/${selected.ordem_compra_id}`)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir OC
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  {[
                    { l: "Pedida", v: selected.qty_pedida },
                    { l: "Embarcada", v: selected.qty_embarcada },
                    { l: "Recebida", v: selected.qty_recebida },
                    { l: "Saldo", v: selected.saldo_aberto },
                    { l: "Avariada", v: selected.qty_avariada, warn: true },
                    { l: "Faltante", v: selected.qty_faltante, warn: true },
                    { l: "Cancelada", v: selected.qty_cancelada },
                    { l: "Produzida", v: selected.qty_produzida },
                  ].map((m) => (
                    <div key={m.l} className={cn("p-2 rounded-md border border-border", m.warn && m.v > 0 && "border-amber-500/50 bg-amber-500/5")}>
                      <div className="text-[10px] text-muted-foreground uppercase">{m.l}</div>
                      <div className="font-semibold">{m.v.toLocaleString("pt-BR")}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Linha do tempo de recebimentos
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">Emissão OC</span>
                    <span>{selected.data_emissao ? formatLocalDate(selected.data_emissao) : "—"}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">Entrega prevista</span>
                    <span>{selected.data_entrega_prevista ? formatLocalDate(selected.data_entrega_prevista) : "—"}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">Chegada porto</span>
                    <span>{selected.data_chegada_porto ? formatLocalDate(selected.data_chegada_porto) : "—"}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">Desembaraço</span>
                    <span>{selected.data_desembaraco ? formatLocalDate(selected.data_desembaraco) : "—"}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">Recebimento CD</span>
                    <span>{selected.data_recebimento_cd ? formatLocalDate(selected.data_recebimento_cd) : "—"}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-32 text-muted-foreground">SLA porto→CD</span>
                    <span>{slaBadge(selected.sla_porto_cd_dias)}</span>
                  </div>
                </div>
              </Card>

              <OPVinculadaCard
                ocId={selected.ordem_compra_id}
                ocNumero={selected.numero_oc}
                produtoCodigo={selected.produto_codigo}
                produtoNome={selected.produto_nome}
                qtySugerida={selected.qty_recebida || selected.qty_pedida}
              />
            </>
          )}
        </div>
      </div>
    </ChinaPageShell>
  );
}
