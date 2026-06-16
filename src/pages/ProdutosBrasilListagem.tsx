import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, Search, ArrowLeft, Loader2, Plus, AlertTriangle, Clock, FileText, Shield, CheckCircle2, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { PRODUCT_STATUS_LABELS } from "@/hooks/useProdutoBrasil";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { NovoProdutoImportadoDialog } from "@/components/produto-brasil/NovoProdutoImportadoDialog";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os Status" },
  { value: "produto_importado", label: "Produto Importado" },
  { value: "aguardando_precadastro", label: "Aguardando Pré-cadastro" },
  { value: "precadastro_em_andamento", label: "Pré-cadastro em Andamento" },
  { value: "aguardando_regulatorio", label: "Aguardando Regulatório" },
  { value: "aprovado_cadastro", label: "Aprovado" },
  { value: "produto_ativo", label: "Ativo" },
];

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function fmtNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: n % 1 === 0 ? 0 : 1 });
}

interface ProdutoRow {
  id: string;
  codigo_brasil: string | null;
  china_codigo: string | null;
  nome_brasil: string | null;
  china_nome: string | null;
  marca: string | null;
  ncm: string | null;
  status: string;
  tipo_produto: string | null;
  foto_url: string | null;
  projeto_id: string | null;
  submissao_china_id: string | null;
  qty_per_display: number | null;
  itens_display: number | null;
  ean_caixa_master: string | null;
  ean_display: string | null;
  submissao?: {
    qty_total: number | null;
    qty_per_display: number | null;
    dados_excel: any;
  } | null;
}

function computeCxBxUn(p: ProdutoRow): { un: number | null; bx: number | null; cx: number | null } {
  const sub = p.submissao ?? null;
  const dx = sub?.dados_excel ?? {};
  const un = (sub?.qty_total ?? null) ?? (dx?.qty_total != null ? Number(dx.qty_total) : null);
  const bx = (sub?.qty_per_display ?? null)
    ?? (p.qty_per_display ?? null)
    ?? (dx?.qty_per_display != null ? Number(dx.qty_per_display) : null);
  const ctnTotal = dx?.ctn_total != null ? Number(dx.ctn_total) : null;
  const cartonsPerGroup = dx?.cartons_per_group != null ? Number(dx.cartons_per_group) : null;
  let cx: number | null = null;
  if (ctnTotal != null && cartonsPerGroup != null) cx = ctnTotal * cartonsPerGroup;
  else if (ctnTotal != null) cx = ctnTotal;
  return { un, bx, cx };
}

export default function ProdutosBrasilListagem() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { bgStyle, BgColorButton } = usePageBgColor("produtos_brasil_listagem");

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-brasil-list-grid"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select(`
          id, codigo_brasil, china_codigo, nome_brasil, china_nome, marca, ncm, status,
          tipo_produto, foto_url, projeto_id, submissao_china_id,
          qty_per_display, itens_display, ean_caixa_master, ean_display,
          submissao:china_produto_submissoes!produtos_brasil_submissao_china_id_fkey (
            qty_total, qty_per_display, dados_excel
          )
        `)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProdutoRow[];
    },
  });

  const kpis = useMemo(() => {
    const counts: Record<string, number> = {};
    produtos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return {
      total: produtos.length,
      aguardando: counts["aguardando_precadastro"] || 0,
      andamento: counts["precadastro_em_andamento"] || 0,
      regulatorio: counts["aguardando_regulatorio"] || 0,
      aprovados: counts["aprovado_cadastro"] || 0,
      ativos: counts["produto_ativo"] || 0,
    };
  }, [produtos]);

  const filtered = useMemo(() => {
    let list = produtos;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p) =>
        p.china_nome?.toLowerCase().includes(s) ||
        p.china_codigo?.toLowerCase().includes(s) ||
        p.nome_brasil?.toLowerCase().includes(s) ||
        p.codigo_brasil?.toLowerCase().includes(s) ||
        p.marca?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [produtos, search, statusFilter]);

  const statusBadgeVariant = (status: string) => {
    const map: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
      produto_importado: "secondary",
      aguardando_precadastro: "outline",
      precadastro_em_andamento: "default",
      aguardando_regulatorio: "outline",
      aprovado_cadastro: "default",
      produto_ativo: "default",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="min-h-screen" style={bgStyle}>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BgColorButton />
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Produtos Importados</h1>
            <p className="text-sm text-muted-foreground">Pré-cadastro e gestão de produtos importados da China</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
          <NovoProdutoImportadoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total" value={kpis.total} icon={Package} color="bg-primary/10 text-primary" />
          <KpiCard label="Aguardando" value={kpis.aguardando} icon={Clock} color="bg-yellow-500/10 text-yellow-600" />
          <KpiCard label="Em Andamento" value={kpis.andamento} icon={FileText} color="bg-blue-500/10 text-blue-600" />
          <KpiCard label="Regulatório" value={kpis.regulatorio} icon={Shield} color="bg-orange-500/10 text-orange-600" />
          <KpiCard label="Aprovados" value={kpis.aprovados} icon={CheckCircle2} color="bg-green-500/10 text-green-600" />
          <KpiCard label="Ativos" value={kpis.ativos} icon={Sparkles} color="bg-emerald-500/10 text-emerald-600" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou marca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Nenhum produto encontrado. Clique em "Novo Produto" para iniciar um pré-cadastro.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2 w-12"></th>
                    <th className="text-left font-medium px-3 py-2">Código</th>
                    <th className="text-left font-medium px-3 py-2">Nome</th>
                    <th className="text-left font-medium px-3 py-2">Marca</th>
                    <th className="text-right font-medium px-3 py-2" title="Unidades (kits)">UN</th>
                    <th className="text-right font-medium px-3 py-2" title="Display (BX)">BX</th>
                    <th className="text-right font-medium px-3 py-2" title="Caixa máster (CX)">CX</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-left font-medium px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const { un, bx, cx } = computeCxBxUn(p);
                    const isKit = (p.itens_display ?? 0) > 1;
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/dashboard/projetos/produto-brasil/${p.id}`)}
                      >
                        <td className="px-3 py-2">
                          {p.foto_url ? (
                            <img src={p.foto_url} alt="" className="h-8 w-8 rounded-md object-cover border border-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                          {p.codigo_brasil || p.china_codigo}
                          {p.tipo_produto && p.tipo_produto !== "ACABADO" && (
                            <Badge variant="outline" className="ml-1 text-[9px]">{p.tipo_produto}</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate max-w-[320px]">
                              {p.nome_brasil || p.china_nome || "Sem nome"}
                            </span>
                            {isKit && <Badge variant="secondary" className="text-[9px]">Kit</Badge>}
                            {!p.projeto_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>Sem projeto vinculado</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {p.ncm && (
                            <span className="text-[10px] text-muted-foreground font-mono">NCM: {p.ncm}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.marca || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNum(un)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNum(bx)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtNum(cx)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadgeVariant(p.status)} className="text-[10px]">
                            {PRODUCT_STATUS_LABELS[p.status] || p.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
