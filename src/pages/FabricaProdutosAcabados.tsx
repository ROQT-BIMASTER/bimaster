import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { useSystemProfiles } from "@/hooks/useSystemProfiles";
import { formatRelativeTime } from "@/lib/formatters";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { custoTotalDoSnapshot } from "@/lib/fabrica/ficha-custo-snapshot";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { usePageBgColor } from "@/components/shared/PageBgCustomizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package, Edit, Trash2, Upload, DollarSign, FileX, Filter, Layers, X, TrendingUp, ClipboardList, HelpCircle, LayoutGrid, TableIcon, BarChart3, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, MessageSquare, Kanban, Link2, Eye, EyeOff, User, PanelLeftClose, PanelLeftOpen, Calendar, Clock, AlertTriangle, Maximize2, Minimize2, Palette, ArrowLeft, ShieldQuestion, MoreHorizontal, BookOpen } from "lucide-react";
import { PhotoPermissionDiagnosticsDialog } from "@/components/fabrica/PhotoPermissionDiagnosticsDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { formatLocalDate, parseLocalDate } from "@/utils/dateUtils";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProdutoCard } from "@/components/fabrica/ProdutoCard";
import { ProdutoKanbanBoard } from "@/components/fabrica/ProdutoKanbanBoard";
import { ProdutosAcabadosAdminDashboard } from "@/components/fabrica/ProdutosAcabadosAdminDashboard";
import { StatusAprovacaoBadge } from "@/components/fabrica/FichaAprovacaoBanner";
import { StatusPill } from "@/components/shared/StatusPill";
import type { StatusAprovacao } from "@/hooks/useFichaRevisao";
import { Link, useNavigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { NovoProdutoAcabadoDialog } from "@/components/fabrica/NovoProdutoAcabadoDialog";
import { NovoCenarioDialog } from "@/components/fabrica/cenarios/NovoCenarioDialog";
import { CenariosList } from "@/components/fabrica/cenarios/CenariosList";
import { toast } from "sonner";
import { useTour } from "@/components/tour/TourProvider";
import { FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps } from "@/components/tour/tours/fabricaProdutosAcabadosTour";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ProvadorBadge } from "@/components/fabrica/ProvadorBadge";
import {
  isFichaInFamily,
  type FichaStatusFamily,
} from "@/lib/status-families";
import { useFilterMismatch } from "@/hooks/useFilterMismatch";
import { FilterMismatchAlert } from "@/components/shared/FilterMismatchAlert";

export default function FabricaProdutosAcabados() {
  const { hasPermission, loading: permLoading } = useScreenPermissions();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: systemProfiles } = useSystemProfiles();
  const { startTour, hasSeenTour } = useTour();
  const [dialogNovo, setDialogNovo] = useState(false);
  const [dialogNovoCenario, setDialogNovoCenario] = useState(false);
  const [abaModulo, setAbaModulo] = useState<"oficiais" | "cenarios">("oficiais");
  const [diagnosticoOpen, setDiagnosticoOpen] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("none");
  const [filtroLinha, setFiltroLinha] = useState("none");
  const [filtroTipo, setFiltroTipo] = useState("none");
  const [filtroProvador, setFiltroProvador] = useState<"todos" | "venda" | "provador">("todos");
  const [filtroStatusFicha, setFiltroStatusFicha] = useState<"none" | FichaStatusFamily>("none");
  const [agrupamentoAtivo, setAgrupamentoAtivo] = useState(false);
  const [viewMode, setViewMode] = useState<"tabela" | "cards" | "kanban">("tabela");
  const [agruparPor, setAgruparPor] = useState("marca");
  const [showAdminDash, setShowAdminDash] = useState(false);
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tableFocus, setTableFocus] = useState(false);
  // Expansão de concorrentes vinculados a Sugestões (colapsados por padrão).
  const [expandedSugestoes, setExpandedSugestoes] = useState<Set<string>>(new Set());
  const [expandAllConcorrentes, setExpandAllConcorrentes] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("fabrica:produtos:expandConcorrentes") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("fabrica:produtos:expandConcorrentes", expandAllConcorrentes ? "1" : "0");
  }, [expandAllConcorrentes]);
  const toggleSugestaoExpand = (id: string) => {
    setExpandedSugestoes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [headerStyle, setHeaderStyle] = useState<"solid" | "subtle">(() => {
    if (typeof window === "undefined") return "solid";
    return (localStorage.getItem("pa_header_style") as "solid" | "subtle") || "solid";
  });
  const [kpisVisiveis, setKpisVisiveis] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("pa-kpis-visiveis") !== "false";
  });

  useEffect(() => {
    localStorage.setItem("pa_header_style", headerStyle);
  }, [headerStyle]);

  useEffect(() => {
    localStorage.setItem("pa-kpis-visiveis", String(kpisVisiveis));
  }, [kpisVisiveis]);

  // ESC sai do modo foco
  useEffect(() => {
    if (!tableFocus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTableFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tableFocus]);

  useEffect(() => {
    if (!permLoading && hasPermission && !hasSeenTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID)) {
      const timer = setTimeout(() => {
        startTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [permLoading, hasPermission]);

  const { data: produtos, isLoading, refetch } = useSupabaseQuery(
    ["fabrica-produtos-acabados"],
    async () => {
      // Traz oficiais + concorrentes (sugestao_pai_id IS NOT NULL) para que
      // a tela principal mostre a disputa logo abaixo do produto Sugestão.
      // Arquivados (modo='arquivado') continuam fora.
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select(`
          *,
          unidade:fabrica_unidades_medida(sigla, nome)
        `)
        .in("tipo", ["ACABADO", "INTER", "DISPLAY"])
        .or('modo.eq.oficial,sugestao_pai_id.not.is.null')
        .or('origem.is.null,origem.neq.importado')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Buscar relacionamentos Kit → Filhos (grade de itens do Display)
  const { data: gradeItens } = useSupabaseQuery(
    ["fabrica-produto-grade-itens"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_produto_grade_itens")
        .select("produto_pai_id, produto_filho_id");
      if (error) throw error;
      return data;
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Mapas de relacionamento pai-filho
  const { filhoParaPaiMap, paiParaFilhosMap } = useMemo(() => {
    const filhoParaPai = new Map<string, string>();
    const paiParaFilhos = new Map<string, string[]>();
    gradeItens?.forEach((item) => {
      filhoParaPai.set(item.produto_filho_id, item.produto_pai_id);
      if (!paiParaFilhos.has(item.produto_pai_id)) paiParaFilhos.set(item.produto_pai_id, []);
      paiParaFilhos.get(item.produto_pai_id)!.push(item.produto_filho_id);
    });
    return { filhoParaPaiMap: filhoParaPai, paiParaFilhosMap: paiParaFilhos };
  }, [gradeItens]);

  // Mapa Sugestão -> Concorrentes (via sugestao_pai_id)
  const sugestaoParaConcorrentesMap = useMemo(() => {
    const m = new Map<string, any[]>();
    produtos?.forEach((p: any) => {
      if (p.sugestao_pai_id) {
        if (!m.has(p.sugestao_pai_id)) m.set(p.sugestao_pai_id, []);
        m.get(p.sugestao_pai_id)!.push(p);
      }
    });
    // ordena por custo asc (vencedor primeiro, depois menores custos)
    m.forEach((arr, k) => {
      arr.sort((a, b) => (a.custo_unitario ?? Infinity) - (b.custo_unitario ?? Infinity));
    });
    return m;
  }, [produtos]);

  const { data: fichasConfig } = useSupabaseQuery(
    ["fabrica-produtos-fichas-config"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_produto_custos_config")
        .select("produto_id, status_aprovacao");
      if (error) throw error;
      return data;
    },
    { staleTime: 0, refetchOnMount: "always" }
  );

  // Buscar snapshots de revisão para obter custo total
  const { data: revisoes } = useSupabaseQuery(
    ["fabrica-produtos-revisoes-custos"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_ficha_custo_revisoes" as any)
        .select("produto_id, snapshot_totais, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    { staleTime: 0, refetchOnMount: "always" }
  );

  // Buscar alertas de aumento de custo recente
  const { data: alertasAumento } = useSupabaseQuery(
    ["fabrica-produtos-alertas-aumento"],
    async () => {
      const { data, error } = await supabase
        .from("fabrica_insumo_custo_historico" as any)
        .select("produto_id, valor_anterior, valor_novo, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
    { staleTime: 30000 }
  );

  // Map de custo total por produto (da última revisão)
  const custoTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!revisoes) return map;
    // Pegar a primeira revisão de cada produto (já está ordenada por created_at desc)
    revisoes.forEach((r: any) => {
      if (!map.has(r.produto_id) && r.snapshot_totais) {
        const totais = typeof r.snapshot_totais === 'string' ? JSON.parse(r.snapshot_totais) : r.snapshot_totais;
        const custo = custoTotalDoSnapshot(totais);
        if (custo) map.set(r.produto_id, custo);
      }
    });
    return map;
  }, [revisoes]);

  // Set de produtos com aumento recente (últimos 30 dias)
  const produtosComAumento = useMemo(() => {
    const set = new Set<string>();
    if (!alertasAumento) return set;
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    alertasAumento.forEach((a: any) => {
      if (Number(a.valor_novo) > Number(a.valor_anterior) && new Date(a.created_at) >= trintaDiasAtras) {
        set.add(a.produto_id);
      }
    });
    return set;
  }, [alertasAumento]);

  const marcasUnicas = useMemo(() => {
    if (!produtos) return [];
    const marcas = [...new Set(produtos.map((p) => p.marca).filter(Boolean))].sort();
    return marcas as string[];
  }, [produtos]);

  const linhasUnicas = useMemo(() => {
    if (!produtos) return [];
    const linhas = [...new Set(produtos.map((p) => p.linha).filter(Boolean))].sort();
    return linhas as string[];
  }, [produtos]);

  const temFiltrosAtivos = filtroMarca !== "none" || filtroLinha !== "none" || filtroTipo !== "none" || filtroStatusFicha !== "none" || filtroProvador !== "todos" || !!dataInicio || !!dataFim;

  const limparFiltros = () => {
    setFiltroMarca("none");
    setFiltroLinha("none");
    setFiltroTipo("none");
    setFiltroStatusFicha("none");
    setFiltroProvador("todos");
    setDataInicio("");
    setDataFim("");
    setBusca("");
  };

  const fichasMap = useMemo(() => {
    const map = new Map<string, string>();
    fichasConfig?.forEach((f) => map.set(f.produto_id, f.status_aprovacao || "rascunho"));
    return map;
  }, [fichasConfig]);

  const totalOcultos = useMemo(() => produtos?.filter(p => p.oculto).length || 0, [produtos]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, string>();
    systemProfiles?.forEach((p) => map.set(p.id, p.nome));
    return map;
  }, [systemProfiles]);

  const produtosFiltrados = useMemo(() => {
    const parsedInicio = dataInicio ? parseLocalDate(dataInicio) : null;
    const parsedFim = dataFim ? parseLocalDate(dataFim) : null;
    if (parsedFim) parsedFim.setHours(23, 59, 59, 999);

    // Concorrentes (sugestao_pai_id != null) NÃO entram nos filtros/contagens
    // como linha solta — são renderizados embaixo do produto Sugestão pai.
    const baseProdutos = produtos?.filter((p: any) => !p.sugestao_pai_id) ?? [];

    const filtered = baseProdutos.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchMarca = filtroMarca === "none" || p.marca === filtroMarca;
      const matchLinha = filtroLinha === "none" || p.linha === filtroLinha;
      const matchTipo = filtroTipo === "none" || p.tipo === filtroTipo;
      const isProv = !!(p as any).is_provador;
      const matchProvador =
        filtroProvador === "todos" ||
        (filtroProvador === "venda" && !isProv) ||
        (filtroProvador === "provador" && isProv);
      const matchVisibilidade = mostrarOcultos || !p.oculto;
      const createdDate = p.created_at ? new Date(p.created_at) : null;
      const matchDataInicio = !parsedInicio || (createdDate && createdDate >= parsedInicio);
      const matchDataFim = !parsedFim || (createdDate && createdDate <= parsedFim);
      const statusFichaProduto = fichasMap.get(p.id) as
        | "rascunho"
        | "em_revisao"
        | "revisao_solicitada"
        | "aprovada"
        | undefined;
      const familyAlvo: FichaStatusFamily | "none" =
        filtroStatusFicha === "none" ? "none" : (filtroStatusFicha as FichaStatusFamily);
      const matchStatusFicha = isFichaInFamily(statusFichaProduto ?? null, familyAlvo);
      return matchBusca && matchMarca && matchLinha && matchTipo && matchProvador && matchVisibilidade && matchDataInicio && matchDataFim && matchStatusFicha;
    });
    if (!filtered) return [];

    // Reordenar: posicionar filhos imediatamente após seus pais
    const filteredIds = new Set(filtered.map(p => p.id));
    const childrenPlaced = new Set<string>();
    const result: any[] = [];

    for (const p of filtered) {
      // Se é filho e o pai está na lista, pular (será inserido após o pai)
      if (filhoParaPaiMap.has(p.id) && filteredIds.has(filhoParaPaiMap.get(p.id)!)) {
        if (childrenPlaced.has(p.id)) continue;
        continue;
      }
      if (childrenPlaced.has(p.id)) continue;
      result.push(p);
      // Concorrentes da Sugestão logo após (colapsado por padrão).
      // Mostra quando: toggle global ativo, linha expandida manualmente,
      // ou a disputa já tem vencedor promovido (feedback de resultado).
      if (p.is_sugestao) {
        const concorrentes = sugestaoParaConcorrentesMap.get(p.id);
        const deveExpandir =
          expandAllConcorrentes ||
          expandedSugestoes.has(p.id) ||
          !!p.vencedor_produto_id;
        if (deveExpandir && concorrentes && concorrentes.length > 0) {
          for (const c of concorrentes) result.push(c);
        }
      }
      // Se é pai (Display), inserir filhos logo após
      const childIds = paiParaFilhosMap.get(p.id);
      if (childIds) {
        for (const childId of childIds) {
          if (filteredIds.has(childId) && !childrenPlaced.has(childId)) {
            const child = filtered.find(c => c.id === childId);
            if (child) {
              result.push(child);
              childrenPlaced.add(childId);
            }
          }
        }
      }
    }
    // Adicionar filhos órfãos (cujo pai não está na lista filtrada)
    for (const p of filtered) {
      if (!childrenPlaced.has(p.id) && !result.includes(p)) {
        result.push(p);
      }
    }
    return result;
  }, [produtos, busca, filtroMarca, filtroLinha, filtroTipo, filtroProvador, filtroStatusFicha, fichasMap, mostrarOcultos, dataInicio, dataFim, paiParaFilhosMap, sugestaoParaConcorrentesMap, expandAllConcorrentes, expandedSugestoes]);

  // Comparativo KPI "Em Revisão" vs lista filtrada — alerta quando algum
  // filtro ativo está escondendo itens contados no KPI.
  const visiveisIdsSet = useMemo(
    () => new Set(produtosFiltrados.map((p: any) => p.id)),
    [produtosFiltrados]
  );
  const mismatchEmRevisao = useFilterMismatch<any>({
    rawList: produtos,
    countsForKpi: (p) => isFichaInFamily((fichasMap.get(p.id) ?? null) as any, "em_revisao"),
    passesAllFilters: (p) => visiveisIdsSet.has(p.id),
    reasonResolvers: [
      {
        label: "Oculto",
        isResponsible: (p) => p.oculto === true && !mostrarOcultos,
      },
      {
        label: "Filtro de marca",
        isResponsible: (p) => filtroMarca !== "none" && p.marca !== filtroMarca,
      },
      {
        label: "Filtro de linha",
        isResponsible: (p) => filtroLinha !== "none" && p.linha !== filtroLinha,
      },
      {
        label: "Filtro de tipo",
        isResponsible: (p) => filtroTipo !== "none" && p.tipo !== filtroTipo,
      },
      {
        label: "Busca textual",
        isResponsible: (p) =>
          busca.trim().length > 0 &&
          !p.nome.toLowerCase().includes(busca.toLowerCase()) &&
          !p.codigo.toLowerCase().includes(busca.toLowerCase()),
      },
      {
        label: "Filtro de data",
        isResponsible: (p) => {
          if (!dataInicio && !dataFim) return false;
          const created = p.created_at ? new Date(p.created_at).getTime() : null;
          if (created === null) return true;
          if (dataInicio && created < new Date(dataInicio).getTime()) return true;
          if (dataFim) {
            const end = new Date(dataFim);
            end.setHours(23, 59, 59, 999);
            if (created > end.getTime()) return true;
          }
          return false;
        },
      },
      {
        label: "Filtro de status (incompatível)",
        isResponsible: (p) =>
          filtroStatusFicha !== "none" &&
          filtroStatusFicha !== "em_revisao" &&
          !isFichaInFamily(
            (fichasMap.get(p.id) ?? null) as any,
            filtroStatusFicha as FichaStatusFamily
          ),
      },
    ],
    getId: (p) => p.id,
  });

  const dadosAgrupados = useMemo(() => {
    if (!produtosFiltrados) return new Map<string, any[]>();
    if (!agrupamentoAtivo) {
      return new Map([["Todos", produtosFiltrados]]);
    }
    const campo = agruparPor === "marca" ? "marca" : "linha";
    const grouped = new Map<string, any[]>();
    produtosFiltrados.forEach((p) => {
      const key = (p[campo] as string) || "Sem Categoria";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    });
    return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [produtosFiltrados, agrupamentoAtivo, agruparPor]);

  if (permLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleEditar = (produto: any) => {
    setProdutoEdit(produto);
    setDialogNovo(true);
  };

  const handleExcluir = async (produto: any) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from("fabrica_produtos")
        .delete()
        .eq("id", produto.id);
      if (error) throw error;
      toast.success("Produto excluído com sucesso!");
      refetch();
    } catch (error: any) {
      logger.error("Erro ao excluir produto:", error);
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const handleToggleOculto = async (produto: any) => {
    try {
      const novoValor = !produto.oculto;
      const { error } = await supabase
        .from("fabrica_produtos")
        .update({ oculto: novoValor } as any)
        .eq("id", produto.id);
      if (error) throw error;
      toast.success(novoValor ? "Produto ocultado" : "Produto visível novamente");
      refetch();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const tipoLabels: Record<string, string> = {
    ACABADO: "Acabado",
    INTER: "Intermediário",
    MP: "Matéria-Prima",
    DISPLAY: "Display",
  };

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderProdutoRow = (produto: any) => {
    const statusFicha = fichasMap.get(produto.id);
    const isEmRevisao = statusFicha === "revisao_solicitada" || statusFicha === "em_revisao";
    const custoTotal = custoTotalMap.get(produto.id);
    const temAumento = produtosComAumento.has(produto.id);

    const isDisplay = produto.tipo === "DISPLAY";

    const isChild = filhoParaPaiMap.has(produto.id);
    const parentId = filhoParaPaiMap.get(produto.id);
    const parentProduct = isChild && produtos ? produtos.find(p => p.id === parentId) : null;

    // Concorrente de Sugestão
    const isConcorrente = !!produto.sugestao_pai_id;
    const sugestaoPai = isConcorrente && produtos
      ? produtos.find((p: any) => p.id === produto.sugestao_pai_id)
      : null;
    const isVencedor = isConcorrente && sugestaoPai?.vencedor_produto_id === produto.id;
    const custoPai = sugestaoPai ? (custoTotalMap.get(sugestaoPai.id) ?? sugestaoPai.custo_unitario) : null;
    const deltaCustoPct =
      isConcorrente && custoTotal != null && custoPai != null && custoPai > 0
        ? ((custoTotal - custoPai) / custoPai) * 100
        : null;

    // Contagem de concorrentes (se o produto é Sugestão)
    const concorrentesCount = produto.is_sugestao
      ? (sugestaoParaConcorrentesMap.get(produto.id)?.length ?? 0)
      : 0;

    return (
      <TableRow
        key={produto.id}
        title={
          isEmRevisao
            ? "Ficha em revisão — aguardando ajustes"
            : isConcorrente && sugestaoPai
              ? `Concorrente da Sugestão ${sugestaoPai.codigo}`
              : isChild && parentProduct
                ? `Item vinculado ao Kit ${parentProduct.codigo}`
                : isDisplay
                  ? "Produto do tipo Display / Kit"
                  : undefined
        }
        className={`${produto.oculto ? "opacity-50" : ""} ${
          isEmRevisao
            ? "bg-amber-500/15 border-l-4 border-l-amber-500 [&_.text-muted-foreground]:!text-amber-700 dark:[&_.text-muted-foreground]:!text-amber-200"
            : isConcorrente
              ? `bg-violet-500/[0.06] border-l-2 ${isVencedor ? "border-l-emerald-500" : "border-l-violet-500/60"}`
              : produto.is_sugestao
                ? "bg-violet-500/[0.04] border-l-2 border-l-violet-500"
                : isDisplay
                  ? "bg-primary/[0.06] border-l-2 border-l-primary/50"
                  : isChild
                    ? "bg-foreground/[0.03] border-l-2 border-l-blue-500/50"
                    : "hover:bg-foreground/[0.04]"
        } border-b border-border/40 transition-colors`}
      >
        <TableCell className="pr-0 py-2">
          <ProductThumbnail src={produto.foto_url} alt={produto.nome} size="sm" />
        </TableCell>
        <TableCell className="font-mono text-[12px] py-2 whitespace-nowrap">
          {produto.is_provador && (
            <div className="mb-0.5">
              <ProvadorBadge />
            </div>
          )}
          {produto.is_sugestao && (
            <div className="mb-0.5">
              <Badge className="text-[9px] px-1.5 py-0 bg-violet-600 text-white hover:bg-violet-700">
                Sugestão{concorrentesCount > 0 ? ` · ${concorrentesCount}` : ""}
              </Badge>
            </div>
          )}
          {isConcorrente && (
            <div className="mb-0.5">
              {isVencedor ? (
                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 text-white hover:bg-emerald-700">
                  Vencedor
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-500/60 text-violet-700 dark:text-violet-300">
                  Em disputa
                </Badge>
              )}
            </div>
          )}
          {produto.codigo}
        </TableCell>
        <TableCell className="font-medium py-2 text-[13px]">
          <div className="flex items-center gap-1.5">
            {produto.is_sugestao && concorrentesCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSugestaoExpand(produto.id);
                }}
                className="shrink-0 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-violet-500/15 text-violet-600 dark:text-violet-300"
                title={
                  expandAllConcorrentes || expandedSugestoes.has(produto.id) || !!produto.vencedor_produto_id
                    ? "Recolher concorrentes"
                    : `Mostrar ${concorrentesCount} concorrente${concorrentesCount > 1 ? "s" : ""}`
                }
                aria-label="Alternar concorrentes"
              >
                {expandAllConcorrentes || expandedSugestoes.has(produto.id) || !!produto.vencedor_produto_id ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {isDisplay && <Layers className="h-3.5 w-3.5 text-primary shrink-0" />}
            {isChild && (
              <span className="text-blue-500 shrink-0 flex items-center gap-1 mr-1">
                <span className="text-muted-foreground">↳</span>
                <Link2 className="h-3 w-3" />
              </span>
            )}
            {isConcorrente && (
              <span className="text-violet-500 shrink-0 flex items-center gap-1 mr-1">
                <span className="text-muted-foreground">↳</span>
                <Link2 className="h-3 w-3" />
              </span>
            )}
            <span className={isChild || isConcorrente ? "pl-4" : ""}>{produto.nome}</span>
          </div>
          {isChild && parentProduct && (
            <div className="text-[10px] text-blue-500 mt-0.5 pl-9">
              Kit: {parentProduct.codigo}
            </div>
          )}
          {isConcorrente && sugestaoPai && (
            <div className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5 pl-9 flex items-center gap-2">
              <span>Sugestão: {sugestaoPai.codigo}</span>
              {deltaCustoPct != null && (
                <span
                  className={`tabular-nums font-medium ${
                    deltaCustoPct < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : deltaCustoPct > 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {deltaCustoPct > 0 ? "+" : ""}
                  {deltaCustoPct.toFixed(1)}% vs Sugestão
                </span>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="py-2">
          <StatusPill
            tone={isDisplay ? "indigo" : produto.tipo === "INTER" ? "slate" : "neutral"}
            icon={isDisplay ? <Layers /> : undefined}
          >
            {tipoLabels[produto.tipo] || produto.tipo}
            {isDisplay && produto.itens_display ? ` · ${produto.itens_display}un` : ""}
          </StatusPill>
        </TableCell>
        <TableCell className="py-2">
          <StatusPill
            tone={produto.origem === "importado" ? "amber" : "emerald"}
            dot
          >
            {produto.origem === "importado" ? "Importado" : "Nacional"}
          </StatusPill>
        </TableCell>
        <TableCell data-tour="pa-status-ficha" className="py-2">
          {fichasMap.has(produto.id) ? (
            <StatusAprovacaoBadge status={statusFicha as StatusAprovacao} />
          ) : (
            <StatusPill tone="neutral" icon={<FileX />}>
              Sem Ficha
            </StatusPill>
          )}
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center gap-1">
            {custoTotal != null ? (
              <>
                <span className="font-mono text-[13px] font-medium tabular-nums">{formatarMoeda(custoTotal)}</span>
                {temAumento && (
                  <TrendingUp className="h-3 w-3 text-destructive" />
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        </TableCell>
        <TableCell className="py-2">
          {produto.formula_id ? (
            <StatusPill tone="primary">Vinculada</StatusPill>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </TableCell>
        <TableCell className="py-2 text-[12px]">
          {produto.tipo === "DISPLAY" ? "Display" : (produto.unidade?.sigla || "—")}
        </TableCell>
        <TableCell className="py-2">
          <StatusPill tone={produto.ativo ? "emerald" : "neutral"} dot>
            {produto.ativo ? "Ativo" : "Inativo"}
          </StatusPill>
        </TableCell>
        <TableCell className="py-2">
          {(() => {
            const editadoPor = produto.updated_by ? profilesMap.get(produto.updated_by) : null;
            const criadoPor = produto.created_by ? profilesMap.get(produto.created_by) : null;
            const nome = editadoPor || criadoPor;
            const label = editadoPor ? "Editou" : "Criou";
            const data = editadoPor ? produto.updated_at : produto.created_at;
            if (!nome) return <span className="text-muted-foreground text-sm">—</span>;
            const iniciais = nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {iniciais}
                </div>
                <div className="leading-tight min-w-0">
                  <div className="text-[12px] font-medium truncate max-w-[140px]">{nome}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {label} · {data ? formatRelativeTime(data) : ""}
                  </div>
                </div>
              </div>
            );
          })()}
        </TableCell>
        <TableCell className="py-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {produto.created_at ? formatLocalDate(produto.created_at, 'dd/MM/yyyy') : '—'}
          </span>
        </TableCell>
        <TableCell className="text-right py-2">
          <div className="inline-flex items-center rounded-md border border-border/60 bg-card/60 divide-x divide-border/60">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-none rounded-l-md"
              onClick={() => navigate(`/dashboard/fabrica/produtos/${produto.id}/custos`)}
              title="Ficha de Custos"
            >
              <DollarSign className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-none"
              onClick={() => handleToggleOculto(produto)}
              title={produto.oculto ? "Tornar visível" : "Ocultar"}
            >
              {produto.oculto ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-none"
              onClick={() => handleEditar(produto)}
              title="Editar"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-none rounded-r-md text-destructive hover:text-destructive"
              onClick={() => handleExcluir(produto)}
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const { bgStyle, BgColorButton } = usePageBgColor("fabrica_produtos_acabados");

  // Auto-fit altura: mede o offsetTop real do container (banner de impersonação,
  // alertas de menção, status offline, etc.) e calcula 100dvh - offset, evitando
  // que a barra superior do sistema corte a tabela em tela cheia.
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageHeight, setPageHeight] = useState<string>("calc(100dvh - 52px)");
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setPageHeight(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <DashboardLayout>
      <div
        ref={pageRef}
        className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 flex flex-col gap-4 overflow-hidden"
        style={{ ...bgStyle, height: pageHeight }}
      >
        {/* Bloco fixo: header + dashboard admin + KPIs + alertas (não rola junto com a tabela) */}
        <div className="shrink-0 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap" data-tour="pa-header">
          <div className="flex items-center gap-2">
            <BgColorButton />
            <div>
              <h1 className="text-xl font-semibold tracking-tight leading-tight">Produtos Acabados</h1>
              <p className="text-xs text-muted-foreground">
                Gerencie o catálogo de produtos fabricados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setKpisVisiveis(!kpisVisiveis)}
              title={kpisVisiveis ? "Ocultar KPIs" : "Mostrar KPIs"}
            >
              {kpisVisiveis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant={showAdminDash ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setShowAdminDash(!showAdminDash)}
              data-tour="pa-admin-dash-btn"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Painel
              <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showAdminDash ? "rotate-180" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" className="h-8" asChild data-tour="pa-revisao-btn">
              <Link to="/dashboard/fabrica/comunicacao-revisoes">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Revisões
              </Link>
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-8" asChild>
                <Link to="/dashboard/fabrica/produtos/importar">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Importar
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" title="Mais opções">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/fabrica/auditoria-fotos">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Auditoria de fotos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDiagnosticoOpen(true)}>
                  <ShieldQuestion className="h-4 w-4 mr-2" />
                  Diagnóstico de fotos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => startTour(FABRICA_PRODUTOS_ACABADOS_TOUR_ID, fabricaProdutosAcabadosTourSteps)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Tour guiado
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0">
                  <div className="w-full">
                    <ManualFabricaDrawer screen="produtos-acabados" />
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Novo
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setProdutoEdit(null); setDialogNovo(true); }}>
                  <Package className="h-4 w-4 mr-2" /> Novo Produto Acabado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialogNovoCenario(true)}>
                  <Layers className="h-4 w-4 mr-2" /> Novo Cenário (simulação)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Abas: Oficiais vs Cenários */}
        <div className="flex gap-1 rounded-md border p-0.5 w-fit">
          <Button size="sm" variant={abaModulo === "oficiais" ? "default" : "ghost"} className="h-7" onClick={() => setAbaModulo("oficiais")}>
            <Package className="h-3.5 w-3.5 mr-1.5" /> Oficiais
          </Button>
          <Button size="sm" variant={abaModulo === "cenarios" ? "default" : "ghost"} className="h-7" onClick={() => setAbaModulo("cenarios")}>
            <Layers className="h-3.5 w-3.5 mr-1.5" /> Cenários (simulação)
          </Button>
        </div>

        {abaModulo === "cenarios" && (
          <div className="pb-4"><CenariosList /></div>
        )}



        {/* Dashboard Administrativo */}
        <Collapsible open={showAdminDash} onOpenChange={setShowAdminDash}>
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <ProdutosAcabadosAdminDashboard
              revisoes={revisoes}
              fichasConfig={fichasConfig}
              alertasAumento={alertasAumento}
              produtos={produtos}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* KPIs */}
        {kpisVisiveis && (() => {
          const totalProdutos = produtos?.length || 0;
          const totalAtivos = produtos?.filter((p) => p.ativo).length || 0;
          const totalAcabados = produtos?.filter((p) => p.tipo === "ACABADO").length || 0;
          const totalInter = produtos?.filter((p) => p.tipo === "INTER").length || 0;
          const totalDisplay = produtos?.filter((p) => p.tipo === "DISPLAY").length || 0;
          const totalDisplayItens = produtos?.filter((p) => p.tipo === "DISPLAY").reduce((s, p) => s + (p.itens_display || 0), 0) || 0;
          const totalNacionais = produtos?.filter((p) => p.origem === "nacional" || !p.origem).length || 0;
          const totalImportados = produtos?.filter((p) => p.origem === "importado").length || 0;
          const totalEmRevisao = produtos?.filter((p) =>
            isFichaInFamily((fichasMap.get(p.id) ?? null) as any, "em_revisao")
          ).length || 0;

          const kpis: Array<{
            key: string;
            label: string;
            value: number;
            sub?: string;
            icon: typeof Package;
            tone: "neutral" | "primary";
          }> = [
            { key: "total", label: "Total", value: totalProdutos, sub: `${totalAtivos} ativos`, icon: Package, tone: "neutral" },
            { key: "acabados", label: "Acabados", value: totalAcabados, icon: Package, tone: "neutral" },
            { key: "inter", label: "Intermediários", value: totalInter, icon: Package, tone: "neutral" },
            { key: "display", label: "Displays / Kits", value: totalDisplay, sub: `${totalDisplayItens} itens`, icon: Layers, tone: "primary" },
            { key: "nac", label: "Nacionais", value: totalNacionais, icon: Package, tone: "neutral" },
            { key: "imp", label: "Importados", value: totalImportados, icon: Package, tone: "neutral" },
          ];

          return (
            <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7" data-tour="pa-kpis">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <div
                    key={k.key}
                    className="rounded-lg border border-border/50 bg-card/70 backdrop-blur-sm px-3 py-2.5 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none mb-1.5 truncate">
                        {k.label}
                      </div>
                      <div className={`text-xl font-semibold tabular-nums leading-none ${k.tone === "primary" ? "text-primary" : ""}`}>
                        {k.value}
                      </div>
                      {k.sub && (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate">{k.sub}</div>
                      )}
                    </div>
                    <Icon className={`h-4 w-4 shrink-0 ${k.tone === "primary" ? "text-primary/60" : "text-muted-foreground/40"}`} />
                  </div>
                );
              })}

              {/* KPI destacado: Em Revisão (clicável) */}
              <button
                type="button"
                onClick={() =>
                  setFiltroStatusFicha(filtroStatusFicha === "em_revisao" ? "none" : "em_revisao")
                }
                className={`text-left rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-all hover:shadow-sm ${
                  filtroStatusFicha === "em_revisao"
                    ? "ring-2 ring-amber-500 border-amber-500/60 bg-amber-100/60 dark:bg-amber-900/30"
                    : "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30"
                }`}
                title="Filtrar produtos em revisão"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold leading-none mb-1.5">
                    Em Revisão
                  </div>
                  <div className="text-xl font-semibold tabular-nums leading-none text-amber-700 dark:text-amber-200">
                    {totalEmRevisao}
                  </div>
                  <div className="text-[10px] text-amber-700/70 dark:text-amber-300/70 mt-1 truncate">
                    {filtroStatusFicha === "em_revisao" ? "Filtro ativo" : "Clique p/ filtrar"}
                  </div>
                </div>
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              </button>
            </div>
          );
        })()}
        </div>
        {/* /Bloco fixo */}

        {/* Bloco scrollável: filtros + tabela */}
        <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
          {/* Left Sidebar Filters */}
          {filtrosAbertos && (
            <aside className="w-56 shrink-0 overflow-y-auto" data-tour="pa-filtros">
              <div className="rounded-lg border border-border/50 bg-card/60 backdrop-blur-sm p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <Filter className="h-3 w-3" />
                    Filtros
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiltrosAbertos(false)} title="Fechar filtros">
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Busca */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Buscar</div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Código ou nome..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Marca */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Marca</div>
                  <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todas</SelectItem>
                      {marcasUnicas.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Tipo</div>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos</SelectItem>
                      <SelectItem value="ACABADO">Acabado</SelectItem>
                      <SelectItem value="DISPLAY">Display / Kit</SelectItem>
                      <SelectItem value="INTER">Intermediário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Linha */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Linha</div>
                  <Select value={filtroLinha} onValueChange={setFiltroLinha}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todas</SelectItem>
                      {linhasUnicas.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status da Ficha */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Status da Ficha</div>
                  <Select value={filtroStatusFicha} onValueChange={(v) => setFiltroStatusFicha(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos</SelectItem>
                      <SelectItem value="sem_ficha">Sem Ficha</SelectItem>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="em_revisao">Em Revisão (+ Solicitada)</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de produto (venda x provador) */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Uso do produto</div>
                  <Select value={filtroProvador} onValueChange={(v) => setFiltroProvador(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="venda">Apenas venda</SelectItem>
                      <SelectItem value="provador">Apenas provadores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Cadastro */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    Cadastro
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="h-8 text-[11px] px-2"
                      title="De"
                    />
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="h-8 text-[11px] px-2"
                      title="Até"
                    />
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2">
                  {/* Agrupamento */}
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="agrupamento" className="text-xs cursor-pointer flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      Agrupar
                    </Label>
                    <Switch
                      id="agrupamento"
                      checked={agrupamentoAtivo}
                      onCheckedChange={setAgrupamentoAtivo}
                    />
                  </div>
                  {agrupamentoAtivo && (
                    <Select value={agruparPor} onValueChange={setAgruparPor}>
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marca">Marca</SelectItem>
                        <SelectItem value="linha">Linha</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Ocultos */}
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="mostrarOcultos" className="text-xs cursor-pointer flex items-center gap-1.5 text-muted-foreground">
                      {mostrarOcultos ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      Ocultos
                      {totalOcultos > 0 && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{totalOcultos}</Badge>
                      )}
                    </Label>
                    <Switch
                      id="mostrarOcultos"
                      checked={mostrarOcultos}
                      onCheckedChange={setMostrarOcultos}
                    />
                  </div>
                </div>

                {/* View Mode */}
                <div className="border-t border-border/50 pt-3 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">Visualização</div>
                  <div className="inline-flex items-center w-full rounded-md border border-border/60 bg-background p-0.5">
                    <Button
                      variant={viewMode === "tabela" ? "secondary" : "ghost"}
                      size="sm"
                      className="flex-1 h-6 px-0"
                      onClick={() => setViewMode("tabela")}
                      title="Tabela"
                    >
                      <TableIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={viewMode === "cards" ? "secondary" : "ghost"}
                      size="sm"
                      className="flex-1 h-6 px-0"
                      onClick={() => setViewMode("cards")}
                      title="Grade"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={viewMode === "kanban" ? "secondary" : "ghost"}
                      size="sm"
                      className="flex-1 h-6 px-0"
                      onClick={() => setViewMode("kanban")}
                      title="Kanban"
                    >
                      <Kanban className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Aparência da tabela */}
                {viewMode === "tabela" && (
                  <div className="border-t border-border/50 pt-3 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium flex items-center gap-1">
                      <Palette className="h-3 w-3" /> Cabeçalho
                    </div>
                    <div className="inline-flex items-center w-full rounded-md border border-border/60 bg-background p-0.5">
                      <Button
                        variant={headerStyle === "solid" ? "secondary" : "ghost"}
                        size="sm"
                        className="flex-1 h-6 px-0 text-[10px] uppercase tracking-wide"
                        onClick={() => setHeaderStyle("solid")}
                        title="Cabeçalho destacado (novo)"
                      >
                        Sólido
                      </Button>
                      <Button
                        variant={headerStyle === "subtle" ? "secondary" : "ghost"}
                        size="sm"
                        className="flex-1 h-6 px-0 text-[10px] uppercase tracking-wide"
                        onClick={() => setHeaderStyle("subtle")}
                        title="Cabeçalho discreto (anterior)"
                      >
                        Sutil
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTableFocus(true)}
                      className="w-full h-7 text-[11px] gap-1.5"
                      title="Modo foco em tela cheia"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Tela cheia
                    </Button>
                  </div>
                )}

                {/* Limpar */}
                {temFiltrosAtivos && (
                  <Button variant="outline" size="sm" onClick={limparFiltros} className="w-full h-7 text-xs text-muted-foreground">
                    <X className="h-3 w-3 mr-1" />
                    Limpar filtros
                  </Button>
                )}
              </div>
            </aside>
          )}

          {/* Main Content — único container scrollável da tabela */}
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
            {/* Toggle sidebar button when closed */}
            {!filtrosAbertos && (
              <div className="mb-3">
                <Button variant="outline" size="sm" onClick={() => setFiltrosAbertos(true)}>
                  <PanelLeftOpen className="h-4 w-4 mr-2" />
                  Filtros
                  {temFiltrosAtivos && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Ativos</Badge>}
                </Button>
              </div>
            )}

            {/* Alerta compacto: produtos em revisão (esconde quando filtro já está ativo) */}
            {(() => {
              const emRevisaoCount = produtos?.filter((p) =>
                isFichaInFamily((fichasMap.get(p.id) ?? null) as any, "em_revisao")
              ).length || 0;
              if (emRevisaoCount === 0) return null;
              if (filtroStatusFicha === "em_revisao") {
                return (
                  <div className="mb-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700 dark:text-amber-200">
                    <Filter className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      Filtro ativo: <strong>Em revisão</strong>
                      <span className="text-muted-foreground ml-2">
                        · mostrando {produtosFiltrados?.length || 0} de {produtos?.length || 0}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] border-amber-500/40 bg-transparent"
                      onClick={() => setFiltroStatusFicha("none")}
                      title="Sair do filtro Em revisão"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Sair do filtro
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={limparFiltros}>
                      Limpar todos
                    </Button>
                  </div>
                );
              }
              return (
                <div className="mb-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <strong className="tabular-nums">{emRevisaoCount}</strong> em revisão
                    {mismatchEmRevisao.mismatch && (
                      <span className="text-muted-foreground ml-2">
                        · {mismatchEmRevisao.hiddenItems.length} oculto(s) pelos filtros
                      </span>
                    )}
                  </span>
                  {mismatchEmRevisao.mismatch && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={limparFiltros}>
                      Limpar filtros
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px] border-amber-500/40 bg-transparent"
                    onClick={() => setFiltroStatusFicha("em_revisao")}
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    Filtrar
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] border-amber-500/40 bg-transparent" asChild>
                    <Link to="/dashboard/fabrica/comunicacao-revisoes">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Revisões
                    </Link>
                  </Button>
                </div>
              );
            })()}

            <div className={tableFocus ? "fixed inset-0 z-[60] bg-background flex flex-col" : ""}>
              {tableFocus && (
                <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 -ml-2"
                      onClick={() => setTableFocus(false)}
                      title="Voltar (ESC)"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar
                    </Button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <TableIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold truncate">Produtos Acabados — Modo Foco</span>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {produtosFiltrados?.length || 0} itens
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground hidden md:inline">Pressione ESC para sair</span>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => setTableFocus(false)}>
                      <Minimize2 className="h-3.5 w-3.5" />
                      Sair
                    </Button>
                  </div>
                </div>
              )}
              <Card data-tour="pa-tabela" className={tableFocus ? "flex-1 overflow-auto rounded-none border-0" : "border border-border bg-card overflow-hidden shadow-sm"}>
                <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Carregando produtos...
                  </div>
                ) : viewMode === "kanban" ? (
                  <div className="p-4">
                    <ProdutoKanbanBoard
                      produtos={produtosFiltrados || []}
                      fichasMap={fichasMap}
                      custoTotalMap={custoTotalMap}
                      produtosComAumento={produtosComAumento}
                      formatarMoeda={formatarMoeda}
                      onProdutoClick={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
                    />
                  </div>
                ) : produtosFiltrados?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nenhum produto encontrado
                  </div>
                ) : viewMode === "cards" ? (
                  <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {agrupamentoAtivo
                      ? Array.from(dadosAgrupados.entries()).map(([grupo, items]) => (
                          <div key={`group-${grupo}`} className="col-span-full space-y-3">
                            <div className="flex items-center gap-2 font-semibold text-sm border-b pb-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              {grupo}
                              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {items.map((produto: any) => (
                                <ProdutoCard
                                  key={produto.id}
                                  produto={produto}
                                  statusFicha={fichasMap.get(produto.id)}
                                  custoTotal={custoTotalMap.get(produto.id)}
                                  temAumento={produtosComAumento.has(produto.id)}
                                  responsavelNome={produto.updated_by ? profilesMap.get(produto.updated_by) || profilesMap.get(produto.created_by) : profilesMap.get(produto.created_by)}
                                  responsavelLabel={produto.updated_by && profilesMap.get(produto.updated_by) ? "Editou" : "Criou"}
                                  responsavelData={produto.updated_by ? produto.updated_at : produto.created_at}
                                  onEditar={handleEditar}
                                  onExcluir={handleExcluir}
                                  onFichaCustos={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
                                  formatarMoeda={formatarMoeda}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      : produtosFiltrados?.map((produto: any) => (
                          <ProdutoCard
                            key={produto.id}
                            produto={produto}
                            statusFicha={fichasMap.get(produto.id)}
                            custoTotal={custoTotalMap.get(produto.id)}
                            temAumento={produtosComAumento.has(produto.id)}
                            responsavelNome={produto.updated_by ? profilesMap.get(produto.updated_by) || profilesMap.get(produto.created_by) : profilesMap.get(produto.created_by)}
                            responsavelLabel={produto.updated_by && profilesMap.get(produto.updated_by) ? "Editou" : "Criou"}
                            responsavelData={produto.updated_by ? produto.updated_at : produto.created_at}
                            onEditar={handleEditar}
                            onExcluir={handleExcluir}
                            onFichaCustos={(p) => navigate(`/dashboard/fabrica/produtos/${p.id}/custos`)}
                            formatarMoeda={formatarMoeda}
                          />
                        ))}
                  </div>
                ) : (
                  /* Table View */
                  <div>
                    {/* Legenda dos fundos especiais */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-b border-border/60 bg-foreground/[0.04] text-[10px] text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider">Legenda:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm border-l-2 border-l-amber-500 bg-amber-500/15" />
                        Em revisão
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm bg-primary/15 border border-primary/40" />
                        Display / Kit
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm border-l-2 border-l-blue-500 bg-blue-500/10" />
                        Item vinculado a um Kit (variante / componente)
                      </span>
                    </div>
                    <Table
                      wrapperClassName="overflow-x-auto overflow-y-visible border-0 rounded-none bg-transparent"
                      minWidthClass="min-w-[1100px]"
                    >
                      <TableHeader className={
                        headerStyle === "solid"
                          ? "bg-card sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/95 shadow-[0_1px_0_0_hsl(var(--border))]"
                          : "bg-foreground/[0.04] sticky top-0 z-20 backdrop-blur shadow-[0_1px_0_0_hsl(var(--border))]"
                      }>
                        <TableRow className={
                          headerStyle === "solid"
                            ? "hover:bg-transparent border-b-2 border-border"
                            : "hover:bg-transparent border-b-border/60"
                        }>
                          {(() => {
                            const headClass = headerStyle === "solid"
                              ? "h-10 text-[10px] uppercase tracking-wider font-bold text-foreground/80 whitespace-nowrap"
                              : "h-9 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap";
                            return (
                              <>
                                <TableHead className={headerStyle === "solid" ? "w-[52px] h-10" : "w-[52px] h-9"}></TableHead>
                                <TableHead className={headClass}>Código</TableHead>
                                <TableHead className={headClass}>Nome</TableHead>
                                <TableHead className={headClass}>Tipo</TableHead>
                                <TableHead className={headClass}>Origem</TableHead>
                                <TableHead className={headClass}>Ficha</TableHead>
                                <TableHead className={headClass}>Custo</TableHead>
                                <TableHead className={headClass}>Fórmula</TableHead>
                                <TableHead className={headClass}>Un</TableHead>
                                <TableHead className={`${headClass} w-[90px]`}>Status</TableHead>
                                <TableHead className={`${headClass} w-[150px]`}>Responsável</TableHead>
                                <TableHead className={`${headClass} w-[90px]`}>Cadastro</TableHead>
                                <TableHead className={`${headClass} w-[140px] text-right`}>Ações</TableHead>
                              </>
                            );
                          })()}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agrupamentoAtivo
                          ? Array.from(dadosAgrupados.entries()).map(([grupo, items]) => (
                              <>
                                <TableRow key={`group-${grupo}`} className="bg-muted/50 hover:bg-muted/50">
                                  <TableCell colSpan={13} className="font-semibold text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <Layers className="h-4 w-4 text-muted-foreground" />
                                      {grupo}
                                      <Badge variant="secondary" className="ml-1 text-xs">
                                        {items.length}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {items.map(renderProdutoRow)}
                              </>
                            ))
                          : produtosFiltrados?.map(renderProdutoRow)}
                      </TableBody>
                    </Table>
                  </div>
                )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <NovoProdutoAcabadoDialog
        open={dialogNovo}
        onOpenChange={(open) => {
          setDialogNovo(open);
          if (!open) setProdutoEdit(null);
        }}
        produtoEdit={produtoEdit}
        onSuccess={() => {
          refetch();
          setProdutoEdit(null);
        }}
      />

      <NovoCenarioDialog
        open={dialogNovoCenario}
        onOpenChange={setDialogNovoCenario}
        onSuccess={() => { setAbaModulo("cenarios"); }}
      />

      <PhotoPermissionDiagnosticsDialog
        open={diagnosticoOpen}
        onOpenChange={setDiagnosticoOpen}
      />
    </DashboardLayout>
  );
}
