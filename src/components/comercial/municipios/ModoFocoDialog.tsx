import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { REGIOES_UFS } from "@/lib/constants/regioes";
import {
  Search, Pickaxe, ChevronRight, Users, MapPin, TrendingUp,
  Globe, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";
import type { MunicipioIntelligence } from "@/hooks/useMunicipiosIntelligence";

interface ModoFocoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GroupedData = Record<string, Record<string, MunicipioIntelligence[]>>;

export function ModoFocoDialog({ open, onOpenChange }: ModoFocoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [miningId, setMiningId] = useState<number | null>(null);
  const [batchMining, setBatchMining] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

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

  // Region counts
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
        body: { ...params, maxResults: 20 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-minerados"] });
    },
  });

  const handleMine = useCallback(
    async (m: MunicipioIntelligence) => {
      setMiningId(m.municipio_id);
      try {
        const result = await mineMutation.mutateAsync({
          query: `distribuidora alimentos ${m.municipio_nome} ${m.uf_sigla}`,
          cidade: m.municipio_nome,
          uf: m.uf_sigla,
        });
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
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      setBatchProgress({ current: i + 1, total: items.length });
      try {
        await mineMutation.mutateAsync({
          query: `distribuidora alimentos ${m.municipio_nome} ${m.uf_sigla}`,
          cidade: m.municipio_nome,
          uf: m.uf_sigla,
        });
        success++;
      } catch {
        // continue with next
      }
    }

    setBatchMining(false);
    setSelected(new Set());
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
      if (allSelected) {
        ufs.forEach((m) => next.delete(m.municipio_id));
      } else {
        ufs.forEach((m) => next.add(m.municipio_id));
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Pickaxe className="h-5 w-5 text-amber-500" />
            Modo Foco — Municípios Inexplorados
          </DialogTitle>
          <DialogDescription>
            Todos os municípios sem presença comercial, organizados por região
          </DialogDescription>
        </DialogHeader>

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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar município, UF ou microrregião..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {selected.size > 0 && (
              <Button
                size="sm"
                onClick={handleBatchMine}
                disabled={batchMining}
                className="gap-1 shrink-0"
              >
                {batchMining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pickaxe className="h-4 w-4" />
                )}
                Minerar {selected.size} selecionados
              </Button>
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
                              onMine={handleMine}
                            />
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
