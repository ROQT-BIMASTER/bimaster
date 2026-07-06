// Torre de Controle de Despesas — Fase 1 (tela + variações, sem motor de alertas).
// Lê SÓ as 3 RPCs agregadas (fn_despesas_departamentos/drill/variacoes) — nunca pagina
// contas_pagar no cliente. Detecção determinística (motor) e IA vêm nas Fases 2/3.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, ChevronsUpDown, CheckCircle, TowerControl } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TorreHeaderKpis } from "@/components/financeiro/torre/TorreHeaderKpis";
import { TorreHeatmap } from "@/components/financeiro/torre/TorreHeatmap";
import { TorreSerieChart } from "@/components/financeiro/torre/TorreSerieChart";
import { TorreDrill } from "@/components/financeiro/torre/TorreDrill";
import { TorreVariacoes } from "@/components/financeiro/torre/TorreVariacoes";
import { TorreAlertas } from "@/components/financeiro/torre/TorreAlertas";
import { useTorreDepartamentos, useTorreVariacoes } from "@/hooks/financeiro/useTorreDespesas";
import type { TorreFiltros, TorreSelecao, TorreNatureza } from "@/types/financeiro/torre-despesas";

interface EmpresaOpc {
  id: number;
  nome: string;
}

/** Últimos `n` meses como opções (value = 'YYYY-MM-01', rótulo pt-BR). */
function ultimosMeses(n: number): { value: string; label: string }[] {
  const hoje = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

export default function TorreDespesas() {
  const [filtros, setFiltros] = useState<TorreFiltros>({
    empresaIds: [],
    natureza: null,
    mesRef: null,
    confMinima: null,
  });
  const [selecao, setSelecao] = useState<TorreSelecao | null>(null);

  // Empresas para o filtro — mesmo padrão da ContasAPagar (cadastro oficial).
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-torre"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as EmpresaOpc[];
    },
    staleTime: 5 * 60_000,
  });

  const meses = useMemo(() => ultimosMeses(13), []);

  const departamentos = useTorreDepartamentos({
    mesRef: filtros.mesRef,
    empresaIds: filtros.empresaIds,
    natureza: filtros.natureza,
    confMinima: filtros.confMinima,
  });

  const variacoes = useTorreVariacoes({
    mes: filtros.mesRef,
    empresaIds: filtros.empresaIds,
    natureza: filtros.natureza,
  });

  // Ao trocar a janela de mês, a seleção anterior pode cair fora do range → limpa.
  useEffect(() => {
    setSelecao(null);
  }, [filtros.mesRef]);

  const naturezaValue = filtros.natureza ?? "todas";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
          <TowerControl className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Torre de Controle de Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Despesa por departamento com variação mês a mês e ano a ano, drill até o título e sinais de anomalia para ação imediata.
          </p>
        </div>
      </div>

      {/* Filtros globais da página */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        {/* Empresas (multi) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 min-w-[160px] justify-between font-normal"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3.5 w-3.5" />
                {filtros.empresaIds.length === 0
                  ? "Todas as empresas"
                  : filtros.empresaIds.length === 1
                    ? empresas.find((e) => e.id === filtros.empresaIds[0])?.nome || "1 empresa"
                    : `${filtros.empresaIds.length} empresas`}
              </span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setFiltros((f) => ({ ...f, empresaIds: [] }))}
              >
                <CheckCircle
                  className={`mr-2 h-4 w-4 ${filtros.empresaIds.length === 0 ? "opacity-100" : "opacity-0"}`}
                />
                Todas as empresas
              </Button>
            </div>
            <div className="max-h-[220px] overflow-auto p-2 space-y-1">
              {empresas.map((emp) => (
                <div key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                  <Checkbox
                    id={`torre-emp-${emp.id}`}
                    checked={filtros.empresaIds.includes(emp.id)}
                    onCheckedChange={(checked) =>
                      setFiltros((f) => ({
                        ...f,
                        empresaIds: checked
                          ? [...f.empresaIds, emp.id]
                          : f.empresaIds.filter((id) => id !== emp.id),
                      }))
                    }
                  />
                  <label htmlFor={`torre-emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                    {emp.nome}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Natureza */}
        <ToggleGroup
          type="single"
          value={naturezaValue}
          size="sm"
          onValueChange={(v) =>
            setFiltros((f) => ({ ...f, natureza: v === "" || v === "todas" ? null : (v as TorreNatureza) }))
          }
          className="rounded-md border border-border"
        >
          <ToggleGroupItem value="todas" className="h-9 text-xs px-3">
            Todas
          </ToggleGroupItem>
          <ToggleGroupItem value="provisionado" className="h-9 text-xs px-3">
            Provisão
          </ToggleGroupItem>
          <ToggleGroupItem value="lancado" className="h-9 text-xs px-3">
            Lançado
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Mês de referência */}
        <Select
          value={filtros.mesRef ?? "atual"}
          onValueChange={(v) => setFiltros((f) => ({ ...f, mesRef: v === "atual" ? null : v }))}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="atual">Mês atual</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ocultar classificação fraca (p_conf_minima = 0.7) */}
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="torre-conf"
            checked={filtros.confMinima !== null}
            onCheckedChange={(on) => setFiltros((f) => ({ ...f, confMinima: on ? 0.7 : null }))}
          />
          <Label htmlFor="torre-conf" className="text-xs text-muted-foreground cursor-pointer">
            Ocultar classificação fraca
          </Label>
        </div>
      </div>

      {/* KPIs do mês de referência + banner de qualidade */}
      <TorreHeaderKpis payload={departamentos.data} isLoading={departamentos.isLoading} />

      {/* Heatmap departamento × mês (clique alimenta série + drill) */}
      <TorreHeatmap
        payload={departamentos.data}
        isLoading={departamentos.isLoading}
        selecao={selecao}
        onSelect={setSelecao}
      />

      {/* Fila de alertas forenses (Fase 2) — detecção automática + triagem com trilha */}
      <TorreAlertas />

      {/* Série com bandas + Drill do que estiver selecionado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TorreSerieChart payload={departamentos.data} isLoading={departamentos.isLoading} selecao={selecao} />
        <TorreDrill selecao={selecao} empresaIds={filtros.empresaIds} natureza={filtros.natureza} />
      </div>

      {/* Variações do mês — a fila provisória da Fase 1 (altas/quedas/novos/duplicidades) */}
      <TorreVariacoes payload={variacoes.data} isLoading={variacoes.isLoading} />
    </div>
  );
}
