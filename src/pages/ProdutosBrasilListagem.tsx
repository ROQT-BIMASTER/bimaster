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
import { Package, Search, ArrowLeft, Loader2, ChevronRight, Plus, AlertTriangle, Clock, FileText, Shield, CheckCircle2, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { PRODUCT_STATUS_LABELS } from "@/hooks/useProdutoBrasil";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { NovoProdutoImportadoDialog } from "@/components/produto-brasil/NovoProdutoImportadoDialog";

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

export default function ProdutosBrasilListagem() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-brasil-list"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  const kpis = useMemo(() => {
    const counts: Record<string, number> = {};
    produtos.forEach((p: any) => { counts[p.status] = (counts[p.status] || 0) + 1; });
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
    if (statusFilter !== "all") {
      list = list.filter((p: any) => p.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((p: any) =>
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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
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

      {/* List */}
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
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate(`/dashboard/projetos/produto-brasil/${p.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {p.foto_url ? (
                  <img src={p.foto_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary">{p.codigo_brasil || p.china_codigo}</span>
                    {p.tipo_produto && p.tipo_produto !== "ACABADO" && (
                      <Badge variant="outline" className="text-[9px]">{p.tipo_produto}</Badge>
                    )}
                    {p.marca && (
                      <span className="text-[10px] text-muted-foreground">{p.marca}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.nome_brasil || p.china_nome || "Sem nome"}
                  </p>
                  {p.ncm && (
                    <span className="text-[10px] text-muted-foreground font-mono">NCM: {p.ncm}</span>
                  )}
                </div>
                {!p.projeto_id && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Sem projeto vinculado</TooltipContent>
                  </Tooltip>
                )}
                <Badge variant={statusBadgeVariant(p.status)} className="text-[10px] shrink-0">
                  {PRODUCT_STATUS_LABELS[p.status] || p.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
