import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLeadMining, LeadMinerado } from "@/hooks/useLeadMining";
import { REGIOES_UFS } from "@/lib/constants/regioes";
import { formatLocalDate, getDateKey } from "@/utils/dateUtils";
import {
  Search, Pickaxe, ChevronRight, Users, MapPin,
  Globe, Loader2, CheckCircle2, Star, Phone, Copy,
  ExternalLink, MoreHorizontal, Eye, UserPlus, CheckCircle,
  Ban, Sparkles, XCircle, ArrowLeft, List, Layers, Calendar,
} from "lucide-react";
import type { MunicipioIntelligence } from "@/hooks/useMunicipiosIntelligence";

interface ModoFocoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GroupedData = Record<string, Record<string, MunicipioIntelligence[]>>;

type ViewMode = "hierarchy" | "results";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: Sparkles },
  qualificado: { label: "Qualificado", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", icon: CheckCircle },
  descartado: { label: "Descartado", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", icon: XCircle },
  convertido: { label: "Convertido", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", icon: UserPlus },
};

export function ModoFocoDialog({ open, onOpenChange }: ModoFocoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [miningId, setMiningId] = useState<number | null>(null);
  const [batchMining, setBatchMining] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("hierarchy");
  const [lastMinedCity, setLastMinedCity] = useState<string>("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<LeadMinerado | null>(null);
  const [miningQuery, setMiningQuery] = useState("distribuidora alimentos");

  // Use the existing lead mining hook for results view
  const {
    leads,
    isLoading: leadsLoading,
    stats,
    updateStatus,
    convertToProspect,
    isConverting,
  } = useLeadMining({ cidade: lastMinedCity || undefined });

  // Fetch ALL virgem municipalities
  const { data: allVirgens = [], isLoading } = useQuery({
    queryKey: ["municipios-virgem-all"],
    queryFn: async (): Promise<MunicipioIntelligence[]> => {
      const { data, error } = await supabase.rpc("fn_get_municipios_intelligence", {
        p_status: "virgem",
        p_sort_column: "pib_per_capita",
        p_sort_direction: "desc",
        p_limit: 6000,
        p_offset: 0,
      } as any);
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        ...r,
        populacao: Number(r.populacao),
        pib_mil_reais: Number(r.pib_mil_reais),
        pib_per_capita: Number(r.pib_per_capita),
        total_clientes: Number(r.total_clientes),
        clientes_com_compra: Number(r.clientes_com_compra),
        receita_total: Number(r.receita_total),
        receita_maior: Number(r.receita_maior),
        ticket_medio: Number(r.ticket_medio),
        total_prospects: Number(r.total_prospects),
        total_leads: Number(r.total_leads),
        densidade_comercial: Number(r.densidade_comercial),
        intensidade_comercial: Number(r.intensidade_comercial),
        total_count: Number(r.total_count),
      }));
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allVirgens;
    const q = search.toLowerCase();
    return allVirgens.filter(
      (m) =>
        m.municipio_nome.toLowerCase().includes(q) ||
        m.uf_sigla.toLowerCase().includes(q) ||
        m.microrregiao_nome?.toLowerCase().includes(q)
    );
  }, [allVirgens, search]);

  // Group by region > UF
  const grouped = useMemo<GroupedData>(() => {
    const g: GroupedData = {};
    for (const regiao of Object.keys(REGIOES_UFS)) {
      g[regiao] = {};
      for (const uf of REGIOES_UFS[regiao]) {
        g[regiao][uf] = [];
      }
    }
    for (const m of filtered) {
      const regiao = m.regiao_nome || "Outros";
      const uf = m.uf_sigla;
      if (!g[regiao]) g[regiao] = {};
      if (!g[regiao][uf]) g[regiao][uf] = [];
      g[regiao][uf].push(m);
    }
    return g;
  }, [filtered]);

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [regiao, ufs] of Object.entries(grouped)) {
      counts[regiao] = Object.values(ufs).reduce((s, arr) => s + arr.length, 0);
    }
    return counts;
  }, [grouped]);

  // Mining mutation
  const mineMutation = useMutation({
    mutationFn: async (params: { query: string; cidade: string; uf: string }) => {
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { ...params, maxResults: 30 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-minerados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-minerados-stats"] });
    },
  });

  const handleMine = useCallback(
    async (m: MunicipioIntelligence) => {
      setMiningId(m.municipio_id);
      try {
        const result = await mineMutation.mutateAsync({
          query: `${miningQuery} ${m.municipio_nome} ${m.uf_sigla}`,
          cidade: m.municipio_nome,
          uf: m.uf_sigla,
        });
        setLastMinedCity(m.municipio_nome);
        setViewMode("results");
        setSelectedLeads(new Set());
        toast({
          title: "Mineração concluída!",
          description: `${result.totalFetched || 0} leads encontrados em ${m.municipio_nome}/${m.uf_sigla}.`,
        });
      } catch (err: any) {
        toast({
          title: "Erro na mineração",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setMiningId(null);
      }
    },
    [mineMutation, toast]
  );

  const handleBatchMine = useCallback(async () => {
    if (selected.size === 0) return;
    const items = allVirgens.filter((m) => selected.has(m.municipio_id));
    setBatchMining(true);
    setBatchProgress({ current: 0, total: items.length });

    let success = 0;
    let lastCity = "";
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      setBatchProgress({ current: i + 1, total: items.length });
      try {
        await mineMutation.mutateAsync({
          query: `${miningQuery} ${m.municipio_nome} ${m.uf_sigla}`,
          cidade: m.municipio_nome,
          uf: m.uf_sigla,
        });
        success++;
        lastCity = m.municipio_nome;
      } catch {
        // continue
      }
    }

    setBatchMining(false);
    setSelected(new Set());
    if (lastCity) {
      setLastMinedCity("");
      setViewMode("results");
    }
    toast({
      title: "Mineração em lote concluída!",
      description: `${success}/${items.length} municípios minerados com sucesso.`,
    });
  }, [selected, allVirgens, mineMutation, toast]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInUF = (ufs: MunicipioIntelligence[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ufs.every((m) => next.has(m.municipio_id));
      if (allSelected) ufs.forEach((m) => next.delete(m.municipio_id));
      else ufs.forEach((m) => next.add(m.municipio_id));
      return next;
    });
  };

  const selectFirst20 = () => {
    const first20 = filtered.slice(0, 20);
    setSelected(new Set(first20.map(m => m.municipio_id)));
  };

  // Lead actions
  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast({ title: "Telefone copiado!" });
  };

  const handleSelectAllLeads = (checked: boolean) => {
    if (checked) setSelectedLeads(new Set(leads.map((l) => l.id)));
    else setSelectedLeads(new Set());
  };

  const handleSelectLead = (id: string, checked: boolean) => {
    const next = new Set(selectedLeads);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedLeads(next);
  };

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    if (action === "converter") {
      await convertToProspect(ids);
    } else {
      await updateStatus({ ids, status: action });
    }
    setSelectedLeads(new Set());
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-xs">N/A</span>;
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            {viewMode === "results" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setViewMode("hierarchy")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Pickaxe className="h-5 w-5 text-amber-500" />
                {viewMode === "hierarchy"
                  ? "Modo Foco — Municípios Inexplorados"
                  : `Leads Minerados${lastMinedCity ? ` — ${lastMinedCity}` : ""}`}
              </DialogTitle>
              <DialogDescription>
                {viewMode === "hierarchy"
                  ? "Todos os municípios sem presença comercial, organizados por região"
                  : "Gerencie os leads encontrados, qualifique e converta em prospects"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {viewMode === "hierarchy" ? (
          <HierarchyView
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            grouped={grouped}
            regionCounts={regionCounts}
            selected={selected}
            toggleSelect={toggleSelect}
            selectAllInUF={selectAllInUF}
            selectFirst20={selectFirst20}
            clearSelection={() => setSelected(new Set())}
            miningId={miningId}
            onMine={handleMine}
            batchMining={batchMining}
            batchProgress={batchProgress}
            onBatchMine={handleBatchMine}
            isLoading={isLoading}
            miningQuery={miningQuery}
            setMiningQuery={setMiningQuery}
          />
        ) : (
          <ResultsView
            leads={leads}
            leadsLoading={leadsLoading}
            stats={stats}
            selectedLeads={selectedLeads}
            onSelectAll={handleSelectAllLeads}
            onSelectLead={handleSelectLead}
            onBulkAction={handleBulkAction}
            isConverting={isConverting}
            updateStatus={updateStatus}
            convertToProspect={convertToProspect}
            renderStars={renderStars}
            copyPhone={copyPhone}
            detailLead={detailLead}
            setDetailLead={setDetailLead}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Hierarchy View ────────────────────────────────────────────────
interface HierarchyViewProps {
  search: string;
  setSearch: (v: string) => void;
  filtered: MunicipioIntelligence[];
  grouped: GroupedData;
  regionCounts: Record<string, number>;
  selected: Set<number>;
  toggleSelect: (id: number) => void;
  selectAllInUF: (ufs: MunicipioIntelligence[]) => void;
  selectFirst20: () => void;
  clearSelection: () => void;
  miningId: number | null;
  onMine: (m: MunicipioIntelligence) => void;
  batchMining: boolean;
  batchProgress: { current: number; total: number };
  onBatchMine: () => void;
  isLoading: boolean;
  miningQuery: string;
  setMiningQuery: (v: string) => void;
}

const RAMOS_PREDEFINIDOS = [
  { value: "distribuidora alimentos", label: "Distribuidora de Alimentos" },
  { value: "supermercado", label: "Supermercado" },
  { value: "mercearia", label: "Mercearia" },
  { value: "atacado alimentos", label: "Atacado de Alimentos" },
  { value: "padaria", label: "Padaria" },
  { value: "restaurante", label: "Restaurante" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "farmacia", label: "Farmácia" },
  { value: "loja conveniencia", label: "Loja de Conveniência" },
  { value: "bar", label: "Bar" },
  { value: "hotel pousada", label: "Hotel / Pousada" },
  { value: "perfumaria cosmeticos", label: "Perfumaria / Cosméticos" },
];

function HierarchyView({
  search, setSearch, filtered, grouped, regionCounts, selected,
  toggleSelect, selectAllInUF, selectFirst20, clearSelection, miningId, onMine,
  batchMining, batchProgress, onBatchMine, isLoading,
  miningQuery, setMiningQuery,
}: HierarchyViewProps) {
  const [customQuery, setCustomQuery] = useState(false);
  return (
    <>
      {/* KPIs + Search */}
      <div className="px-6 py-3 border-b shrink-0 space-y-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge variant="secondary" className="text-sm gap-1">
            <Globe className="h-3.5 w-3.5" />
            {filtered.length} inexplorados
          </Badge>
          {Object.entries(regionCounts)
            .filter(([, c]) => c > 0)
            .map(([r, c]) => (
              <Badge key={r} variant="outline" className="text-xs">
                {r}: {c}
              </Badge>
            ))}
        </div>
        {/* Mining query selector - Ramo / CNAE */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Ramo de Atividade / CNAE</Label>
            {customQuery ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: CNAE 4637-1, farmácia, padaria..."
                  value={miningQuery}
                  onChange={(e) => setMiningQuery(e.target.value)}
                  className="h-9"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs shrink-0"
                  onClick={() => {
                    setCustomQuery(false);
                    setMiningQuery("distribuidora alimentos");
                  }}
                >
                  Predefinidos
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={miningQuery} onValueChange={setMiningQuery}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o ramo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RAMOS_PREDEFINIDOS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs shrink-0"
                  onClick={() => {
                    setCustomQuery(true);
                    setMiningQuery("");
                  }}
                >
                  CNAE / Personalizado
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar município, UF ou microrregião..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={selectFirst20}
            disabled={batchMining || filtered.length === 0}
            className="gap-1 shrink-0"
          >
            <Users className="h-4 w-4" />
            Selecionar 20
          </Button>
          {selected.size > 0 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="shrink-0 text-muted-foreground"
              >
                Limpar seleção
              </Button>
              <Button
                size="sm"
                onClick={onBatchMine}
                disabled={batchMining || !miningQuery.trim()}
                className="gap-1 shrink-0"
              >
                {batchMining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pickaxe className="h-4 w-4" />
                )}
                Minerar {selected.size} selecionados
              </Button>
            </>
          )}
        </div>
        {batchMining && (
          <div className="space-y-1">
            <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Minerando {batchProgress.current}/{batchProgress.total}...
            </p>
          </div>
        )}
      </div>

      {/* Hierarchy content */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-3" />
            <p className="font-medium">Nenhum município inexplorado encontrado</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {Object.entries(grouped)
              .filter(([, ufs]) => Object.values(ufs).some((arr) => arr.length > 0))
              .map(([regiao, ufs]) => (
                <AccordionItem key={regiao} value={regiao}>
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {regiao}
                      <Badge variant="secondary" className="text-[10px]">
                        {regionCounts[regiao]} municípios
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-1 pl-2">
                      {Object.entries(ufs)
                        .filter(([, arr]) => arr.length > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([uf, municipios]) => (
                          <UfGroup
                            key={uf}
                            uf={uf}
                            municipios={municipios}
                            selected={selected}
                            onToggle={toggleSelect}
                            onSelectAll={() => selectAllInUF(municipios)}
                            miningId={miningId}
                            onMine={onMine}
                          />
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        )}
      </div>
    </>
  );
}

// ─── Results View (leads table) ────────────────────────────────────
type ListMode = "table" | "batches";

type GroupedByDateUF = Record<string, Record<string, LeadMinerado[]>>;

interface ResultsViewProps {
  leads: LeadMinerado[];
  leadsLoading: boolean;
  stats: { total: number; novos: number; qualificados: number; convertidos: number; descartados: number } | undefined;
  selectedLeads: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectLead: (id: string, checked: boolean) => void;
  onBulkAction: (action: string) => void;
  isConverting: boolean;
  updateStatus: (params: { ids: string[]; status: string }) => Promise<void>;
  convertToProspect: (ids: string[]) => Promise<string[]>;
  renderStars: (rating: number | null) => React.ReactNode;
  copyPhone: (phone: string) => void;
  detailLead: LeadMinerado | null;
  setDetailLead: (lead: LeadMinerado | null) => void;
}

function ResultsView({
  leads, leadsLoading, stats, selectedLeads,
  onSelectAll, onSelectLead, onBulkAction, isConverting,
  updateStatus, convertToProspect, renderStars, copyPhone,
  detailLead, setDetailLead,
}: ResultsViewProps) {
  const [listMode, setListMode] = useState<ListMode>("table");

  // Group leads by date then UF
  const groupedByDateUF = useMemo<GroupedByDateUF>(() => {
    const g: GroupedByDateUF = {};
    for (const lead of leads) {
      const dateKey = getDateKey(lead.created_at) || "sem-data";
      const uf = lead.uf || "N/A";
      if (!g[dateKey]) g[dateKey] = {};
      if (!g[dateKey][uf]) g[dateKey][uf] = [];
      g[dateKey][uf].push(lead);
    }
    return g;
  }, [leads]);

  // Sorted date keys (most recent first)
  const sortedDates = useMemo(
    () => Object.keys(groupedByDateUF).sort((a, b) => b.localeCompare(a)),
    [groupedByDateUF]
  );

  // Selection helpers for batch view
  const selectDateGroup = (dateKey: string, checked: boolean) => {
    const dateLeads = Object.values(groupedByDateUF[dateKey] || {}).flat();
    for (const lead of dateLeads) {
      onSelectLead(lead.id, checked);
    }
  };

  const selectUFGroup = (dateKey: string, uf: string, checked: boolean) => {
    const ufLeads = groupedByDateUF[dateKey]?.[uf] || [];
    for (const lead of ufLeads) {
      onSelectLead(lead.id, checked);
    }
  };

  const isDateFullySelected = (dateKey: string) => {
    const dateLeads = Object.values(groupedByDateUF[dateKey] || {}).flat();
    return dateLeads.length > 0 && dateLeads.every((l) => selectedLeads.has(l.id));
  };

  const isUFFullySelected = (dateKey: string, uf: string) => {
    const ufLeads = groupedByDateUF[dateKey]?.[uf] || [];
    return ufLeads.length > 0 && ufLeads.every((l) => selectedLeads.has(l.id));
  };

  return (
    <>
      {/* Stats bar */}
      <div className="px-6 py-3 border-b shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Total", value: stats?.total || 0 },
              { label: "Novos", value: stats?.novos || 0 },
              { label: "Qualificados", value: stats?.qualificados || 0 },
              { label: "Convertidos", value: stats?.convertidos || 0 },
              { label: "Descartados", value: stats?.descartados || 0 },
            ].map((s) => (
              <Badge key={s.label} variant="outline" className="text-xs gap-1">
                {s.label}: <span className="font-bold">{s.value}</span>
              </Badge>
            ))}
          </div>

          {/* Toggle Lista/Lotes */}
          <div className="flex items-center gap-1 ml-auto border rounded-md p-0.5">
            <Button
              size="sm"
              variant={listMode === "table" ? "default" : "ghost"}
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setListMode("table")}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </Button>
            <Button
              size="sm"
              variant={listMode === "batches" ? "default" : "ghost"}
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setListMode("batches")}
            >
              <Layers className="h-3.5 w-3.5" /> Lotes
            </Button>
          </div>
        </div>

        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">{selectedLeads.size} selecionado(s)</Badge>
            <Button size="sm" variant="outline" onClick={() => onBulkAction("qualificado")}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Qualificar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onBulkAction("descartado")}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Descartar
            </Button>
            <Button
              size="sm"
              onClick={() => onBulkAction("converter")}
              disabled={isConverting}
            >
              {isConverting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 mr-1" />
              )}
              Converter em Prospect
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {leadsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Pickaxe className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum lead encontrado para esta cidade.</p>
          </div>
        ) : listMode === "table" ? (
          /* ── Flat table view ── */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={leads.length > 0 && selectedLeads.size === leads.length}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <LeadTableRow
                  key={lead.id}
                  lead={lead}
                  selected={selectedLeads.has(lead.id)}
                  onSelect={(c) => onSelectLead(lead.id, c)}
                  renderStars={renderStars}
                  copyPhone={copyPhone}
                  setDetailLead={setDetailLead}
                  updateStatus={updateStatus}
                  convertToProspect={convertToProspect}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          /* ── Batch/hierarchy view ── */
          <div className="px-4 py-2">
            <Accordion type="multiple" className="w-full">
              {sortedDates.map((dateKey) => {
                const dateLeads = Object.values(groupedByDateUF[dateKey]).flat();
                const ufs = Object.keys(groupedByDateUF[dateKey]).sort();
                const dateSelected = isDateFullySelected(dateKey);

                return (
                  <AccordionItem key={dateKey} value={dateKey}>
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={dateSelected}
                            onCheckedChange={(c) => selectDateGroup(dateKey, !!c)}
                            className="h-4 w-4"
                          />
                        </div>
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>{formatLocalDate(dateKey, "dd/MM/yyyy")}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {dateLeads.length} leads
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="space-y-1 pl-2">
                        {ufs.map((uf) => {
                          const ufLeads = groupedByDateUF[dateKey][uf];
                          if (ufLeads.length === 0) return null;
                          return (
                            <BatchUFGroup
                              key={`${dateKey}-${uf}`}
                              dateKey={dateKey}
                              uf={uf}
                              leads={ufLeads}
                              selectedLeads={selectedLeads}
                              onSelectLead={onSelectLead}
                              isFullySelected={isUFFullySelected(dateKey, uf)}
                              onSelectAll={(c) => selectUFGroup(dateKey, uf, c)}
                              renderStars={renderStars}
                              copyPhone={copyPhone}
                              setDetailLead={setDetailLead}
                              updateStatus={updateStatus}
                              convertToProspect={convertToProspect}
                            />
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {detailLead && (
        <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{detailLead.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-muted-foreground">Telefone</Label>
                  <p className="font-medium">{detailLead.telefone || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tel. Internacional</Label>
                  <p className="font-medium">{detailLead.telefone_internacional || "—"}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Endereço</Label>
                  <p className="font-medium">{detailLead.endereco || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cidade</Label>
                  <p className="font-medium">{detailLead.cidade || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">UF</Label>
                  <p className="font-medium">{detailLead.uf || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">CEP</Label>
                  <p className="font-medium">{detailLead.cep || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rating</Label>
                  <div className="flex items-center gap-1">
                    {renderStars(detailLead.rating)}
                    <span className="text-muted-foreground ml-1">
                      ({detailLead.total_avaliacoes} avaliações)
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Website</Label>
                  {detailLead.website ? (
                    <a
                      href={detailLead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      {detailLead.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Tipos</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detailLead.tipos?.length > 0
                      ? detailLead.tipos.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))
                      : "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">CNPJ</Label>
                  <p className="font-medium">{detailLead.cnpj || "Não informado"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Busca</Label>
                  <p className="font-medium text-xs">{detailLead.busca_query} — {detailLead.busca_regiao}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {detailLead.status !== "convertido" && (
                  <Button
                    onClick={() => {
                      convertToProspect([detailLead.id]);
                      setDetailLead(null);
                    }}
                    className="flex-1"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Converter em Prospect
                  </Button>
                )}
                {detailLead.telefone && (
                  <Button
                    variant="outline"
                    onClick={() => copyPhone(detailLead.telefone!)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Telefone
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── Lead Table Row (extracted for reuse) ──────────────────────────
function LeadTableRow({
  lead, selected, onSelect, renderStars, copyPhone,
  setDetailLead, updateStatus, convertToProspect,
}: {
  lead: LeadMinerado;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  renderStars: (rating: number | null) => React.ReactNode;
  copyPhone: (phone: string) => void;
  setDetailLead: (lead: LeadMinerado | null) => void;
  updateStatus: (params: { ids: string[]; status: string }) => Promise<void>;
  convertToProspect: (ids: string[]) => Promise<string[]>;
}) {
  const sc = statusConfig[lead.status] || statusConfig.novo;
  return (
    <TableRow className="group">
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={(c) => onSelect(!!c)} />
      </TableCell>
      <TableCell className="font-medium max-w-[200px] truncate">{lead.nome}</TableCell>
      <TableCell>
        {lead.telefone ? (
          <button
            onClick={() => copyPhone(lead.telefone!)}
            className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
            title="Copiar telefone"
          >
            <Phone className="h-3.5 w-3.5" />
            {lead.telefone}
          </button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        {lead.cidade && lead.uf ? (
          <span className="text-sm">{lead.cidade}/{lead.uf}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>{renderStars(lead.rating)}</TableCell>
      <TableCell>
        {lead.website ? (
          <a href={lead.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Globe className="h-3.5 w-3.5" /> Site
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`${sc.color} text-xs`} variant="secondary">{sc.label}</Badge>
      </TableCell>
      <TableCell>
        <LeadActions
          lead={lead}
          copyPhone={copyPhone}
          setDetailLead={setDetailLead}
          updateStatus={updateStatus}
          convertToProspect={convertToProspect}
        />
      </TableCell>
    </TableRow>
  );
}

// ─── Lead Actions Dropdown ─────────────────────────────────────────
function LeadActions({
  lead, copyPhone, setDetailLead, updateStatus, convertToProspect,
}: {
  lead: LeadMinerado;
  copyPhone: (phone: string) => void;
  setDetailLead: (lead: LeadMinerado | null) => void;
  updateStatus: (params: { ids: string[]; status: string }) => Promise<void>;
  convertToProspect: (ids: string[]) => Promise<string[]>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetailLead(lead)}>
          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
        </DropdownMenuItem>
        {lead.telefone && (
          <DropdownMenuItem onClick={() => copyPhone(lead.telefone!)}>
            <Copy className="h-4 w-4 mr-2" /> Copiar telefone
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {lead.status !== "qualificado" && (
          <DropdownMenuItem onClick={() => updateStatus({ ids: [lead.id], status: "qualificado" })}>
            <CheckCircle className="h-4 w-4 mr-2" /> Qualificar
          </DropdownMenuItem>
        )}
        {lead.status !== "descartado" && (
          <DropdownMenuItem onClick={() => updateStatus({ ids: [lead.id], status: "descartado" })}>
            <Ban className="h-4 w-4 mr-2" /> Descartar
          </DropdownMenuItem>
        )}
        {lead.status !== "convertido" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => convertToProspect([lead.id])}>
              <UserPlus className="h-4 w-4 mr-2" /> Converter em Prospect
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Batch UF Group (collapsible inside date accordion) ────────────
interface BatchUFGroupProps {
  dateKey: string;
  uf: string;
  leads: LeadMinerado[];
  selectedLeads: Set<string>;
  onSelectLead: (id: string, checked: boolean) => void;
  isFullySelected: boolean;
  onSelectAll: (checked: boolean) => void;
  renderStars: (rating: number | null) => React.ReactNode;
  copyPhone: (phone: string) => void;
  setDetailLead: (lead: LeadMinerado | null) => void;
  updateStatus: (params: { ids: string[]; status: string }) => Promise<void>;
  convertToProspect: (ids: string[]) => Promise<string[]>;
}

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima",
  RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

function BatchUFGroup({
  uf, leads: ufLeads, selectedLeads, onSelectLead,
  isFullySelected, onSelectAll, renderStars, copyPhone,
  setDetailLead, updateStatus, convertToProspect,
}: BatchUFGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/50 text-sm transition-colors">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isFullySelected}
            onCheckedChange={(c) => onSelectAll(!!c)}
            className="h-3.5 w-3.5"
          />
        </div>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{uf} - {UF_NAMES[uf] || uf}</span>
        <Badge variant="outline" className="text-[10px] ml-1">
          {ufLeads.length} leads
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-8 space-y-0.5 mt-1 mb-2">
          {ufLeads.map((lead) => {
            const sc = statusConfig[lead.status] || statusConfig.novo;
            return (
              <div
                key={lead.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 text-xs transition-colors group"
              >
                <Checkbox
                  checked={selectedLeads.has(lead.id)}
                  onCheckedChange={(c) => onSelectLead(lead.id, !!c)}
                  className="h-3.5 w-3.5"
                />
                <span className="font-medium truncate min-w-0 flex-1">{lead.nome}</span>
                {lead.telefone && (
                  <button
                    onClick={() => copyPhone(lead.telefone!)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="Copiar telefone"
                  >
                    <Phone className="h-3 w-3" />
                    {lead.telefone}
                  </button>
                )}
                <span className="shrink-0">{renderStars(lead.rating)}</span>
                <Badge className={`${sc.color} text-[10px]`} variant="secondary">{sc.label}</Badge>
                <LeadActions
                  lead={lead}
                  copyPhone={copyPhone}
                  setDetailLead={setDetailLead}
                  updateStatus={updateStatus}
                  convertToProspect={convertToProspect}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── UF Group (collapsible) ────────────────────────────────────────
interface UfGroupProps {
  uf: string;
  municipios: MunicipioIntelligence[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  miningId: number | null;
  onMine: (m: MunicipioIntelligence) => void;
}

function UfGroup({ uf, municipios, selected, onToggle, onSelectAll, miningId, onMine }: UfGroupProps) {
  const [open, setOpen] = useState(false);
  const allSelected = municipios.every((m) => selected.has(m.municipio_id));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/50 text-sm transition-colors">
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-medium">{uf}</span>
        <Badge variant="outline" className="text-[10px] ml-1">
          {municipios.length}
        </Badge>
        <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            className="h-3.5 w-3.5"
          />
          <span className="text-[10px] text-muted-foreground">Todos</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 space-y-0.5 mt-1 mb-2">
          {municipios.map((m) => (
            <div
              key={m.municipio_id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 text-xs transition-colors group"
            >
              <Checkbox
                checked={selected.has(m.municipio_id)}
                onCheckedChange={() => onToggle(m.municipio_id)}
                className="h-3.5 w-3.5"
              />
              <span className="font-medium truncate min-w-0 flex-1">{m.municipio_nome}</span>
              <span className="text-muted-foreground shrink-0 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {m.populacao?.toLocaleString("pt-BR") || "—"}
              </span>
              <span className="text-muted-foreground shrink-0">
                PIB/C: R$ {(m.pib_per_capita || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-muted-foreground shrink-0 hidden sm:inline truncate max-w-[120px]">
                {m.microrregiao_nome}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                disabled={miningId === m.municipio_id}
                onClick={() => onMine(m)}
              >
                {miningId === m.municipio_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pickaxe className="h-3 w-3" />
                )}
                Minerar
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
