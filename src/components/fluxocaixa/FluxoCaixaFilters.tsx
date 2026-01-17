import React, { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ChevronsUpDown, CheckCircle, X, CalendarDays } from "lucide-react";

const MESES = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" }
];

// Generate years from 2020 to current + 2
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = 2020; y <= currentYear + 2; y++) {
    years.push(y);
  }
  return years;
};

interface FluxoCaixaFiltersProps {
  filterAnos: number[];
  setFilterAnos: (anos: number[]) => void;
  filterMeses: number[];
  setFilterMeses: (meses: number[]) => void;
  filterEmpresas: number[];
  setFilterEmpresas: (empresas: number[]) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterVendedor: string;
  setFilterVendedor: (vendedor: string) => void;
  filterCliente: string;
  setFilterCliente: (cliente: string) => void;
  empresas: { id: number; nome: string }[];
  vendedores: string[];
  onClearFilters: () => void;
  onApply: () => void;
  totalReceber: number;
  totalPagar: number;
  anosDisponiveis?: number[];
}

export const FluxoCaixaFilters = memo(function FluxoCaixaFilters({
  filterAnos,
  setFilterAnos,
  filterMeses,
  setFilterMeses,
  filterEmpresas,
  setFilterEmpresas,
  filterStatus,
  setFilterStatus,
  filterVendedor,
  setFilterVendedor,
  filterCliente,
  setFilterCliente,
  empresas,
  vendedores,
  onClearFilters,
  onApply,
  totalReceber,
  totalPagar,
  anosDisponiveis = []
}: FluxoCaixaFiltersProps) {
  const ANOS = useMemo(() => {
    const generated = generateYears();
    // Merge with available years from data
    const allYears = new Set([...generated, ...anosDisponiveis]);
    return Array.from(allYears).sort((a, b) => b - a);
  }, [anosDisponiveis]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterAnos.length > 0) count++;
    if (filterMeses.length > 0) count++;
    if (filterEmpresas.length > 0) count++;
    if (filterVendedor !== "todos") count++;
    if (filterCliente.trim()) count++;
    if (filterStatus !== "todos") count++;
    return count;
  }, [filterAnos, filterMeses, filterEmpresas, filterVendedor, filterCliente, filterStatus]);

  const toggleAno = (ano: number) => {
    if (filterAnos.includes(ano)) {
      setFilterAnos(filterAnos.filter(a => a !== ano));
    } else {
      setFilterAnos([...filterAnos, ano]);
    }
  };

  const toggleMes = (mes: number) => {
    if (filterMeses.includes(mes)) {
      setFilterMeses(filterMeses.filter(m => m !== mes));
    } else {
      setFilterMeses([...filterMeses, mes]);
    }
  };

  const toggleEmpresa = (id: number) => {
    if (filterEmpresas.includes(id)) {
      setFilterEmpresas(filterEmpresas.filter(e => e !== id));
    } else {
      setFilterEmpresas([...filterEmpresas, id]);
    }
  };

  return (
    <Card className="border-primary/20 bg-muted/30">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Anos - Multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Ano(s)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {filterAnos.length === 0 
                        ? "Últimos 3 anos" 
                        : filterAnos.length === 1 
                          ? filterAnos[0].toString()
                          : `${filterAnos.length} anos`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm"
                    onClick={() => setFilterAnos([])}
                  >
                    <CheckCircle className={`mr-2 h-4 w-4 ${filterAnos.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                    Últimos 3 anos + 1 futuro
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-auto p-2">
                  <div className="grid grid-cols-3 gap-2">
                    {ANOS.map(ano => (
                      <Button
                        key={ano}
                        variant={filterAnos.includes(ano) ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => toggleAno(ano)}
                      >
                        {ano}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Meses - Multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Mês(es)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {filterMeses.length === 0 
                        ? "Todos" 
                        : filterMeses.length <= 3 
                          ? filterMeses.map(m => MESES.find(x => x.value === m)?.label).join(', ')
                          : `${filterMeses.length} meses`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm"
                    onClick={() => setFilterMeses([])}
                  >
                    <CheckCircle className={`mr-2 h-4 w-4 ${filterMeses.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                    Todos os meses
                  </Button>
                </div>
                <div className="p-2">
                  <div className="grid grid-cols-4 gap-2">
                    {MESES.map(mes => (
                      <Button
                        key={mes.value}
                        variant={filterMeses.includes(mes.value) ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => toggleMes(mes.value)}
                      >
                        {mes.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Empresa</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {filterEmpresas.length === 0 
                        ? "Todas" 
                        : `${filterEmpresas.length} selecionada(s)`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-sm"
                    onClick={() => setFilterEmpresas([])}
                  >
                    <CheckCircle className={`mr-2 h-4 w-4 ${filterEmpresas.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                    Todas as empresas
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-auto p-2 space-y-1">
                  {empresas.map(emp => (
                    <div key={emp.id} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded">
                      <Checkbox
                        id={`filter-emp-${emp.id}`}
                        checked={filterEmpresas.includes(emp.id)}
                        onCheckedChange={() => toggleEmpresa(emp.id)}
                      />
                      <label htmlFor={`filter-emp-${emp.id}`} className="text-sm cursor-pointer flex-1 truncate">
                        {emp.nome}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos (não pagos)</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Vendedor</Label>
            <Select value={filterVendedor} onValueChange={setFilterVendedor}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cliente/Fornecedor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Cliente/Fornecedor</Label>
            <div className="relative">
              <Input
                placeholder="Buscar..."
                value={filterCliente}
                onChange={(e) => setFilterCliente(e.target.value)}
                className="h-9 pr-8"
              />
              {filterCliente && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-8"
                  onClick={() => setFilterCliente("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">Presets:</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              const anoAtual = new Date().getFullYear();
              setFilterAnos([anoAtual]);
              setFilterMeses([]);
            }}
          >
            Ano Atual
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              const anoAtual = new Date().getFullYear();
              const mesAtual = new Date().getMonth() + 1;
              const meses12 = [];
              for (let i = 0; i < 12; i++) {
                meses12.push(((mesAtual - 1 + i) % 12) + 1);
              }
              setFilterAnos([anoAtual - 1, anoAtual]);
              setFilterMeses([]);
            }}
          >
            Últimos 12 meses
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              const anoAtual = new Date().getFullYear();
              setFilterAnos([anoAtual, anoAtual + 1]);
              setFilterMeses([]);
            }}
          >
            Projeção 1 ano
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => {
              const anoAtual = new Date().getFullYear();
              setFilterAnos([anoAtual - 1, anoAtual]);
              setFilterMeses([]);
            }}
          >
            Comparar {new Date().getFullYear() - 1} vs {new Date().getFullYear()}
          </Button>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            {totalReceber.toLocaleString()} entradas • {totalPagar.toLocaleString()} saídas
          </div>
          <div className="flex gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
            <Button size="sm" onClick={onApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
