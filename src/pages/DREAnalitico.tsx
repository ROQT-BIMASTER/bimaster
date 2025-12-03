import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, FileDown, Calendar, TrendingUp, TrendingDown, Building2, FileText, ArrowUp, ArrowDown, Minus, LayoutGrid, Eye, GripVertical, Flag, Target } from "lucide-react";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import { PlanoReducaoGastos } from "@/components/financeiro/PlanoReducaoGastos";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths, subYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { DetalheLancamentoDialog } from "@/components/financeiro/DetalheLancamentoDialog";

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'grupo' | 'conta' | 'departamento' | 'lancamento';
  nivel: number;
  valor: number;
  valoresMensais?: { [mes: string]: number };
  natureza: 'D' | 'C';
  accountType: string;
  children?: DRENode[];
  metadata?: any;
}

interface MonthData {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

type TableFormat = 'compacto' | 'padrao' | 'expandido';

const tableFormatConfig = {
  compacto: {
    nameColWidth: 'min-w-[220px] max-w-[220px]',
    monthColWidth: 'w-[70px]',
    totalColWidth: 'w-[90px]',
    variationColWidth: 'w-[60px]',
    fontSize: 'text-[10px]',
    fontSizeValue: 'text-[10px]',
    padding: 'py-1 px-2',
    headerPadding: 'py-2 px-2',
    rowGap: 'gap-0.5',
    iconSize: 'h-3 w-3',
    expandBtnSize: 'h-4 w-4 p-0',
  },
  padrao: {
    nameColWidth: 'min-w-[280px] max-w-[280px]',
    monthColWidth: 'w-[100px]',
    totalColWidth: 'w-[120px]',
    variationColWidth: 'w-[80px]',
    fontSize: 'text-xs',
    fontSizeValue: 'text-xs',
    padding: 'py-2 px-2',
    headerPadding: 'py-3 px-2',
    rowGap: 'gap-1',
    iconSize: 'h-4 w-4',
    expandBtnSize: 'h-5 w-5 p-0',
  },
  expandido: {
    nameColWidth: 'min-w-[350px] max-w-[350px]',
    monthColWidth: 'w-[130px]',
    totalColWidth: 'w-[150px]',
    variationColWidth: 'w-[100px]',
    fontSize: 'text-sm',
    fontSizeValue: 'text-sm',
    padding: 'py-3 px-3',
    headerPadding: 'py-4 px-3',
    rowGap: 'gap-2',
    iconSize: 'h-5 w-5',
    expandBtnSize: 'h-6 w-6 p-0',
  },
};

export default function DREAnalitico() {
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('ano');
  const [dataInicio, setDataInicio] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visaoAtiva, setVisaoAtiva] = useState<'contas' | 'departamentos'>('contas');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todas');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [tableFormat, setTableFormat] = useState<TableFormat>('padrao');
  const [selectedLancamento, setSelectedLancamento] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [tabAtiva, setTabAtiva] = useState<'dre' | 'reducao'>('dre');
  const [marcarRevisaoOpen, setMarcarRevisaoOpen] = useState(false);
  const [itemParaRevisao, setItemParaRevisao] = useState<any>(null);
  
  // Novos filtros
  const [filterDepartamento, setFilterDepartamento] = useState<string>('todos');
  const [filterConta, setFilterConta] = useState<string>('todas');
  const [filterDescricao, setFilterDescricao] = useState<string>('');
  
  // Estado para larguras das colunas (em pixels)
  const [columnWidths, setColumnWidths] = useState({
    name: 280,
    month: 100,
    total: 120,
    variation: 80
  });
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);
  
  const formatConfig = tableFormatConfig[tableFormat];

  // Handlers para redimensionar colunas
  const handleMouseDown = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    resizingColumn.current = column;
    startX.current = e.clientX;
    startWidth.current = columnWidths[column as keyof typeof columnWidths];
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return;
    
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const resetColumnWidths = useCallback(() => {
    setColumnWidths({ name: 280, month: 100, total: 120, variation: 80 });
  }, []);

  // Gerar meses para o período selecionado
  const mesesPeriodo = useMemo((): MonthData[] => {
    const meses: MonthData[] = [];
    const inicio = parseISO(dataInicio);
    const fim = parseISO(dataFim);
    
    let current = startOfMonth(inicio);
    while (current <= fim) {
      meses.push({
        key: format(current, 'yyyy-MM'),
        label: format(current, 'MMM/yy', { locale: ptBR }),
        startDate: format(startOfMonth(current), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(current), 'yyyy-MM-dd')
      });
      current = startOfMonth(subMonths(current, -1));
    }
    return meses;
  }, [dataInicio, dataFim]);

  // Atualizar datas quando período mudar
  const handlePeriodoChange = (novoPeriodo: 'mes' | 'trimestre' | 'ano') => {
    setPeriodo(novoPeriodo);
    const hoje = new Date();
    
    switch (novoPeriodo) {
      case 'mes':
        setDataInicio(format(startOfMonth(hoje), 'yyyy-MM-dd'));
        setDataFim(format(endOfMonth(hoje), 'yyyy-MM-dd'));
        break;
      case 'trimestre':
        setDataInicio(format(startOfQuarter(hoje), 'yyyy-MM-dd'));
        setDataFim(format(endOfQuarter(hoje), 'yyyy-MM-dd'));
        break;
      case 'ano':
        setDataInicio(format(startOfYear(hoje), 'yyyy-MM-dd'));
        setDataFim(format(endOfMonth(hoje), 'yyyy-MM-dd'));
        break;
    }
  };

  // Buscar estrutura do plano de contas
  const { data: planoContas } = useQuery({
    queryKey: ['plano-contas-dre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('*')
        .in('account_type', ['revenue', 'expense', 'cost_center', 'budget', 'asset', 'liability'])
        .order('code');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar empresas disponíveis
  const { data: empresas } = useQuery({
    queryKey: ['empresas-dre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('empresa_nome')
        .not('empresa_nome', 'is', null);
      
      if (error) throw error;
      const uniqueEmpresas = [...new Set(data.map(item => item.empresa_nome))];
      return uniqueEmpresas.filter(Boolean);
    }
  });

  // Buscar total de contas
  const { data: totalContas } = useQuery({
    queryKey: ['total-contas', dataInicio, dataFim, filterEmpresa],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*', { count: 'exact', head: true })
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  // Buscar lançamentos do período
  const { data: lancamentos, isLoading } = useSupabaseQuery(
    ['lancamentos-dre', dataInicio, dataFim, filterEmpresa, mostrarInativos, filterDepartamento, filterConta, filterDescricao],
    async () => {
      let query = supabase
        .from('contas_pagar')
        .select(`*, departamento:departamentos(id, nome)`)
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      if (filterDepartamento !== 'todos') {
        query = query.eq('departamento_id', filterDepartamento);
      }
      
      if (filterConta !== 'todas') {
        query = query.eq('plano_contas_id', filterConta);
      }
      
      // Filtrar apenas lançamentos ativos se não mostrar inativos
      if (!mostrarInativos) {
        query = query.neq('ativo_dre', false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Filtrar por descrição/fornecedor no frontend (busca mais flexível)
      if (filterDescricao.trim()) {
        const searchTerm = filterDescricao.toLowerCase().trim();
        return data.filter(item => 
          (item.fornecedor_nome && item.fornecedor_nome.toLowerCase().includes(searchTerm)) ||
          (item.categoria_nome && item.categoria_nome.toLowerCase().includes(searchTerm)) ||
          (item.numero_documento && item.numero_documento.toLowerCase().includes(searchTerm)) ||
          (item.plano_contas_nome && item.plano_contas_nome.toLowerCase().includes(searchTerm))
        );
      }
      
      return data;
    },
    { staleTime: 0, refetchOnMount: true }
  );

  // Buscar lançamentos do ano anterior para YoY
  const anoAnteriorInicio = format(subYears(parseISO(dataInicio), 1), 'yyyy-MM-dd');
  const anoAnteriorFim = format(subYears(parseISO(dataFim), 1), 'yyyy-MM-dd');
  
  const { data: lancamentosAnoAnterior } = useSupabaseQuery(
    ['lancamentos-dre-yoy', anoAnteriorInicio, anoAnteriorFim, filterEmpresa],
    async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*, plano_contas_id')
        .gte('data_vencimento', anoAnteriorInicio)
        .lte('data_vencimento', anoAnteriorFim);
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    { staleTime: 0 }
  );

  // Buscar departamentos
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-dre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    }
  });

  // Calcular MoM (Month over Month) %
  const calcularMoM = (valoresMensais: { [mes: string]: number }): number | null => {
    const keys = Object.keys(valoresMensais).sort();
    if (keys.length < 2) return null;
    
    const mesAtual = valoresMensais[keys[keys.length - 1]];
    const mesAnterior = valoresMensais[keys[keys.length - 2]];
    
    if (mesAnterior === 0) return mesAtual > 0 ? 100 : 0;
    return ((mesAtual - mesAnterior) / Math.abs(mesAnterior)) * 100;
  };

  // Calcular totais ano anterior por conta
  const totaisAnoAnteriorPorConta = useMemo(() => {
    const totais: { [key: string]: number } = {};
    if (!lancamentosAnoAnterior) return totais;
    
    lancamentosAnoAnterior.forEach(l => {
      const valor = parseFloat(String(l.valor_pago || l.valor_original || 0));
      const contaId = l.plano_contas_id || 'nao-classificados';
      totais[contaId] = (totais[contaId] || 0) + valor;
    });
    return totais;
  }, [lancamentosAnoAnterior]);

  // Calcular YoY
  const calcularYoY = (contaId: string, valorAtual: number): number | null => {
    const valorAnoAnterior = totaisAnoAnteriorPorConta[contaId] || 0;
    if (valorAnoAnterior === 0) return valorAtual > 0 ? 100 : null;
    return ((valorAtual - valorAnoAnterior) / Math.abs(valorAnoAnterior)) * 100;
  };

  // Construir hierarquia DRE com valores mensais
  const construirHierarquiaDRE = (): DRENode[] => {
    if (!planoContas || !lancamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));

    const criarGrupo = (id: string, codigo: string, nome: string, natureza: 'D' | 'C', accountType: string): DRENode => {
      const grupo: DRENode = {
        id, codigo, nome, tipo: 'grupo', nivel: 1, valor: 0, valoresMensais: {},
        natureza, accountType, children: []
      };
      mesesPeriodo.forEach(m => grupo.valoresMensais![m.key] = 0);
      return grupo;
    };

    const receitas = criarGrupo('receitas', '4', 'RECEITAS', 'C', 'revenue');
    const despesas = criarGrupo('despesas', '5', 'DESPESAS OPERACIONAIS', 'D', 'expense');
    const custos = criarGrupo('custos', '6', 'CUSTOS E CENTROS DE CUSTO', 'D', 'cost_center');
    const patrimoniais = criarGrupo('patrimoniais', '7', 'MOVIMENTAÇÕES PATRIMONIAIS', 'D', 'asset');
    const naoClassificados = criarGrupo('nao-classificados', '9', 'NÃO CLASSIFICADOS', 'D', 'expense');

    lancamentos.forEach(lancamento => {
      const valor = parseFloat(String(lancamento.valor_pago || lancamento.valor_original || 0));
      const mesKey = lancamento.data_vencimento ? format(parseISO(lancamento.data_vencimento), 'yyyy-MM') : null;
      
      if (!lancamento.plano_contas_id) {
        naoClassificados.valor += valor;
        if (mesKey && naoClassificados.valoresMensais![mesKey] !== undefined) {
          naoClassificados.valoresMensais![mesKey] += valor;
        }
        
        let nodoCategoria = naoClassificados.children?.find(c => c.nome === (lancamento.categoria_nome || 'Sem Categoria'));
        
        if (!nodoCategoria) {
          nodoCategoria = {
            id: `cat-${lancamento.categoria_nome || 'sem'}`, codigo: '',
            nome: lancamento.categoria_nome || 'Sem Categoria',
            tipo: 'conta', nivel: 2, valor: 0, valoresMensais: {},
            natureza: 'D', accountType: 'expense', children: []
          };
          mesesPeriodo.forEach(m => nodoCategoria!.valoresMensais![m.key] = 0);
          naoClassificados.children?.push(nodoCategoria);
        }
        
        nodoCategoria.valor += valor;
        if (mesKey && nodoCategoria.valoresMensais![mesKey] !== undefined) {
          nodoCategoria.valoresMensais![mesKey] += valor;
        }

        nodoCategoria.children?.push({
          id: lancamento.id, codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy')}`,
          tipo: 'lancamento', nivel: 5, valor, natureza: 'D', accountType: 'expense', metadata: lancamento
        });
        return;
      }

      const conta = contasMap.get(lancamento.plano_contas_id);
      if (!conta) return;

      let grupoRaiz: DRENode;
      if (conta.account_type === 'revenue') grupoRaiz = receitas;
      else if (conta.account_type === 'cost_center' || conta.account_type === 'budget') grupoRaiz = custos;
      else if (conta.account_type === 'asset' || conta.account_type === 'liability') grupoRaiz = patrimoniais;
      else grupoRaiz = despesas;

      let nodoConta = grupoRaiz.children?.find(c => c.id === conta.id);
      if (!nodoConta) {
        nodoConta = {
          id: conta.id, codigo: conta.code, nome: conta.name,
          tipo: 'conta', nivel: conta.nivel, valor: 0, valoresMensais: {},
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type, children: [], metadata: conta
        };
        mesesPeriodo.forEach(m => nodoConta!.valoresMensais![m.key] = 0);
        grupoRaiz.children?.push(nodoConta);
      }

      nodoConta.valor += valor;
      grupoRaiz.valor += valor;
      if (mesKey) {
        if (nodoConta.valoresMensais![mesKey] !== undefined) nodoConta.valoresMensais![mesKey] += valor;
        if (grupoRaiz.valoresMensais![mesKey] !== undefined) grupoRaiz.valoresMensais![mesKey] += valor;
      }

      if (lancamento.departamento_id) {
        let nodoDept = nodoConta.children?.find(d => d.id === lancamento.departamento_id);
        if (!nodoDept) {
          const dept = departamentos?.find(d => d.id === lancamento.departamento_id);
          nodoDept = {
            id: lancamento.departamento_id, codigo: '',
            nome: dept?.nome || 'Sem Departamento',
            tipo: 'departamento', nivel: 4, valor: 0, valoresMensais: {},
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type, children: []
          };
          mesesPeriodo.forEach(m => nodoDept!.valoresMensais![m.key] = 0);
          nodoConta.children?.push(nodoDept);
        }
        
        nodoDept.valor += valor;
        if (mesKey && nodoDept.valoresMensais![mesKey] !== undefined) {
          nodoDept.valoresMensais![mesKey] += valor;
        }

        nodoDept.children?.push({
          id: lancamento.id, codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${lancamento.categoria_nome || 'Sem categoria'}`,
          tipo: 'lancamento', nivel: 5, valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type, metadata: lancamento
        });
      } else {
        nodoConta.children?.push({
          id: lancamento.id, codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${lancamento.categoria_nome || 'Sem categoria'}`,
          tipo: 'lancamento', nivel: 5, valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type, metadata: lancamento
        });
      }
    });

    const ordenarNos = (nos: DRENode[]) => {
      nos.sort((a, b) => a.codigo.localeCompare(b.codigo));
      nos.forEach(no => { if (no.children) ordenarNos(no.children); });
    };

    [receitas, despesas, custos, patrimoniais, naoClassificados].forEach(g => {
      if (g.children) ordenarNos(g.children);
    });

    arvore.push(receitas);
    if (despesas.valor > 0) arvore.push(despesas);
    if (custos.valor > 0) arvore.push(custos);
    if (patrimoniais.valor > 0) arvore.push(patrimoniais);
    if (naoClassificados.valor > 0) arvore.push(naoClassificados);

    const totalDespesasCompleto = despesas.valor + custos.valor + patrimoniais.valor + naoClassificados.valor;
    const resultadoValoresMensais: { [mes: string]: number } = {};
    mesesPeriodo.forEach(m => {
      const recMes = receitas.valoresMensais![m.key] || 0;
      const despMes = (despesas.valoresMensais![m.key] || 0) + (custos.valoresMensais![m.key] || 0) + 
                      (patrimoniais.valoresMensais![m.key] || 0) + (naoClassificados.valoresMensais![m.key] || 0);
      resultadoValoresMensais[m.key] = recMes - despMes;
    });

    arvore.push({
      id: 'resultado', codigo: '', nome: 'RESULTADO DO PERÍODO',
      tipo: 'grupo', nivel: 1, valor: receitas.valor - totalDespesasCompleto,
      valoresMensais: resultadoValoresMensais, natureza: 'C', accountType: 'revenue'
    });

    return arvore;
  };

  // Construir hierarquia por departamento
  const construirHierarquiaPorDepartamento = (): DRENode[] => {
    if (!planoContas || !lancamentos || !departamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));
    const deptsMap = new Map(departamentos.map(d => [d.id, d]));

    const lancamentosPorDept = new Map<string, any[]>();
    const lancamentosSemDept: any[] = [];

    lancamentos.forEach(lancamento => {
      if (lancamento.departamento_id) {
        if (!lancamentosPorDept.has(lancamento.departamento_id)) {
          lancamentosPorDept.set(lancamento.departamento_id, []);
        }
        lancamentosPorDept.get(lancamento.departamento_id)!.push(lancamento);
      } else {
        lancamentosSemDept.push(lancamento);
      }
    });

    lancamentosPorDept.forEach((lancsDept, deptId) => {
      const dept = deptsMap.get(deptId);
      if (!dept) return;

      const nodoDept: DRENode = {
        id: deptId, codigo: '', nome: dept.nome,
        tipo: 'departamento', nivel: 1, valor: 0, valoresMensais: {},
        natureza: 'D', accountType: 'expense', children: []
      };
      mesesPeriodo.forEach(m => nodoDept.valoresMensais![m.key] = 0);

      const grupos = new Map<string, DRENode>();

      lancsDept.forEach(lanc => {
        const valor = parseFloat(String(lanc.valor_pago || lanc.valor_original || 0));
        const mesKey = lanc.data_vencimento ? format(parseISO(lanc.data_vencimento), 'yyyy-MM') : null;
        
        nodoDept.valor += valor;
        if (mesKey && nodoDept.valoresMensais![mesKey] !== undefined) {
          nodoDept.valoresMensais![mesKey] += valor;
        }

        if (!lanc.plano_contas_id) return;

        const conta = contasMap.get(lanc.plano_contas_id);
        if (!conta) return;

        let grupoNome = 'Despesas', grupoId = 'despesas';
        if (conta.account_type === 'revenue') { grupoNome = 'Receitas'; grupoId = 'receitas'; }
        else if (conta.account_type === 'cost_center' || conta.account_type === 'budget') { grupoNome = 'Custos'; grupoId = 'custos'; }
        else if (conta.account_type === 'asset' || conta.account_type === 'liability') { grupoNome = 'Patrimoniais'; grupoId = 'patrimoniais'; }

        const grupoKey = `${deptId}-${grupoId}`;
        
        if (!grupos.has(grupoKey)) {
          const novoGrupo: DRENode = {
            id: grupoKey, codigo: '', nome: grupoNome,
            tipo: 'grupo', nivel: 2, valor: 0, valoresMensais: {},
            natureza: conta.account_type === 'revenue' ? 'C' : 'D',
            accountType: conta.account_type, children: []
          };
          mesesPeriodo.forEach(m => novoGrupo.valoresMensais![m.key] = 0);
          grupos.set(grupoKey, novoGrupo);
        }

        const grupo = grupos.get(grupoKey)!;
        grupo.valor += valor;
        if (mesKey && grupo.valoresMensais![mesKey] !== undefined) {
          grupo.valoresMensais![mesKey] += valor;
        }

        let nodoConta = grupo.children?.find(c => c.id === `${grupoKey}-${conta.id}`);
        if (!nodoConta) {
          nodoConta = {
            id: `${grupoKey}-${conta.id}`, codigo: conta.code, nome: conta.name,
            tipo: 'conta', nivel: 3, valor: 0, valoresMensais: {},
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type, children: [], metadata: conta
          };
          mesesPeriodo.forEach(m => nodoConta!.valoresMensais![m.key] = 0);
          grupo.children?.push(nodoConta);
        }

        nodoConta.valor += valor;
        if (mesKey && nodoConta.valoresMensais![mesKey] !== undefined) {
          nodoConta.valoresMensais![mesKey] += valor;
        }

        const categoriaNome = lanc.categoria_nome || 'Sem Categoria';
        const categoriaKey = `${nodoConta.id}-cat-${categoriaNome}`;
        
        let nodoCategoria = nodoConta.children?.find(c => c.id === categoriaKey);
        if (!nodoCategoria) {
          nodoCategoria = {
            id: categoriaKey, codigo: '', nome: categoriaNome.toUpperCase(),
            tipo: 'departamento', nivel: 4, valor: 0, valoresMensais: {},
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type, children: []
          };
          mesesPeriodo.forEach(m => nodoCategoria!.valoresMensais![m.key] = 0);
          nodoConta.children?.push(nodoCategoria);
        }

        nodoCategoria.valor += valor;
        if (mesKey && nodoCategoria.valoresMensais![mesKey] !== undefined) {
          nodoCategoria.valoresMensais![mesKey] += valor;
        }

        nodoCategoria.children?.push({
          id: `${categoriaKey}-${lanc.id}`, codigo: lanc.numero_documento || '',
          nome: `${lanc.fornecedor_nome || 'N/A'}${lanc.data_vencimento ? ` - ${format(new Date(lanc.data_vencimento), 'dd/MM/yyyy')}` : ''}`,
          tipo: 'lancamento', nivel: 5, valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type, metadata: lanc
        });
      });

      nodoDept.children = Array.from(grupos.values());
      arvore.push(nodoDept);
    });

    if (lancamentosSemDept.length > 0) {
      const nodoSemDept: DRENode = {
        id: 'sem-departamento', codigo: '', nome: 'SEM DEPARTAMENTO',
        tipo: 'departamento', nivel: 1, valor: 0, valoresMensais: {},
        natureza: 'D', accountType: 'expense', children: []
      };
      mesesPeriodo.forEach(m => nodoSemDept.valoresMensais![m.key] = 0);

      lancamentosSemDept.forEach(lanc => {
        const valor = parseFloat(String(lanc.valor_pago || lanc.valor_original || 0));
        const mesKey = lanc.data_vencimento ? format(parseISO(lanc.data_vencimento), 'yyyy-MM') : null;
        
        nodoSemDept.valor += valor;
        if (mesKey && nodoSemDept.valoresMensais![mesKey] !== undefined) {
          nodoSemDept.valoresMensais![mesKey] += valor;
        }

        if (lanc.plano_contas_id) {
          const conta = contasMap.get(lanc.plano_contas_id);
          if (conta) {
            nodoSemDept.children?.push({
              id: `sem-dept-${lanc.id}`, codigo: conta.code,
              nome: `${conta.name} - ${lanc.fornecedor_nome || 'N/A'}`,
              tipo: 'lancamento', nivel: 2, valor,
              natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
              accountType: conta.account_type, metadata: lanc
            });
          }
        }
      });

      arvore.push(nodoSemDept);
    }

    arvore.sort((a, b) => b.valor - a.valor);
    return arvore;
  };

  const hierarquia = construirHierarquiaDRE();
  const hierarquiaDepartamentos = construirHierarquiaPorDepartamento();

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedNodes(newExpanded);
  };

  const formatarValor = (valor: number, compacto = false) => {
    if (compacto && Math.abs(valor) >= 1000) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1
      }).format(Math.abs(valor));
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Math.abs(valor));
  };

  const formatarVariacao = (variacao: number | null) => {
    if (variacao === null) return '-';
    const sinal = variacao > 0 ? '+' : '';
    return `${sinal}${variacao.toFixed(1)}%`;
  };

  const renderVariacaoCell = (variacao: number | null, isExpense: boolean = false) => {
    if (variacao === null) return <span className="text-muted-foreground">-</span>;
    
    const isPositive = variacao > 0;
    const isGood = isExpense ? !isPositive : isPositive;
    const color = Math.abs(variacao) < 1 ? 'text-muted-foreground' : isGood ? 'text-emerald-600' : 'text-red-600';
    const Icon = isPositive ? ArrowUp : variacao < 0 ? ArrowDown : Minus;
    
    return (
      <div className={`flex items-center justify-end gap-0.5 ${color}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">{formatarVariacao(variacao)}</span>
      </div>
    );
  };

  const renderNode = (node: DRENode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indentMultiplier = tableFormat === 'compacto' ? 14 : tableFormat === 'expandido' ? 24 : 20;
    const paddingLeft = level * indentMultiplier;
    const isExpense = ['expense', 'cost_center', 'budget', 'asset', 'liability'].includes(node.accountType);

    const getRowStyle = () => {
      if (node.id === 'resultado') return 'bg-gradient-to-r from-primary/20 to-primary/5 font-bold border-t-2 border-primary/30';
      if (node.tipo === 'grupo' && level === 0) return 'bg-slate-100 dark:bg-slate-800 font-bold';
      if (node.tipo === 'conta') return 'bg-slate-50 dark:bg-slate-800/50 font-semibold';
      if (node.tipo === 'departamento') return 'bg-blue-50/50 dark:bg-blue-900/20';
      return 'hover:bg-muted/50';
    };

    const getValueColor = () => {
      if (node.id === 'resultado') return node.valor >= 0 ? 'text-emerald-600' : 'text-red-600';
      if (node.accountType === 'revenue') return 'text-emerald-600';
      if (isExpense) return 'text-red-600';
      return node.valor >= 0 ? 'text-emerald-600' : 'text-red-600';
    };

    const mom = node.valoresMensais ? calcularMoM(node.valoresMensais) : null;
    const yoy = calcularYoY(node.id, node.valor);

    const handleLancamentoClick = () => {
      if (node.tipo === 'lancamento' && node.metadata) {
        setSelectedLancamento(node.metadata);
        setDetailDialogOpen(true);
      }
    };

    const isClickable = node.tipo === 'lancamento' && node.metadata;

    return (
      <div key={node.id}>
        <div 
          className={`flex items-center border-b transition-colors ${getRowStyle()} ${isClickable ? 'cursor-pointer hover:bg-primary/10' : ''}`}
          onClick={isClickable ? handleLancamentoClick : undefined}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleLancamentoClick(); } : undefined}
        >
          {/* Coluna fixa: Nome */}
          <div 
            className={`flex items-center ${formatConfig.rowGap} ${formatConfig.padding} sticky left-0 bg-inherit z-10 border-r`}
            style={{ paddingLeft: `${paddingLeft + 12}px`, width: columnWidths.name, minWidth: columnWidths.name }}
          >
            {hasChildren ? (
              <Button variant="ghost" size="sm" className={`${formatConfig.expandBtnSize} hover:bg-transparent`} onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
                {isExpanded ? <ChevronDown className={formatConfig.iconSize} /> : <ChevronRight className={formatConfig.iconSize} />}
              </Button>
            ) : node.tipo === 'lancamento' ? (
              <Eye className={`${formatConfig.iconSize} text-muted-foreground/50`} />
            ) : (
              <div className={tableFormat === 'compacto' ? 'w-4' : tableFormat === 'expandido' ? 'w-6' : 'w-5'} />
            )}
            
            {node.codigo && (
              <span className={`font-mono ${formatConfig.fontSize} text-muted-foreground ${tableFormat === 'compacto' ? 'w-[45px]' : tableFormat === 'expandido' ? 'w-[65px]' : 'w-[55px]'} flex-shrink-0`}>{node.codigo}</span>
            )}
            
            <span className={`truncate ${node.tipo === 'lancamento' ? `${formatConfig.fontSize} text-muted-foreground hover:text-foreground` : formatConfig.fontSize}`}>
              {node.nome}
            </span>

            {node.id === 'nao-classificados' && (
              <Badge variant="destructive" className={`ml-1 ${tableFormat === 'compacto' ? 'text-[8px] px-0.5 py-0 h-3' : tableFormat === 'expandido' ? 'text-[10px] px-1.5 py-0.5 h-5' : 'text-[9px] px-1 py-0 h-4'}`}>Pendente</Badge>
            )}

            {node.tipo === 'lancamento' && node.metadata?.ativo_dre === false && (
              <Badge variant="secondary" className={`ml-1 ${tableFormat === 'compacto' ? 'text-[7px] px-0.5 py-0 h-3' : 'text-[8px] px-1 py-0 h-4'} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`}>Inativo</Badge>
            )}

            {node.tipo === 'lancamento' && node.metadata?.classificacao_manual && (
              <Badge variant="outline" className={`ml-1 ${tableFormat === 'compacto' ? 'text-[7px] px-0.5 py-0 h-3' : 'text-[8px] px-1 py-0 h-4'}`}>Manual</Badge>
            )}

            {(node.tipo === 'conta' || node.tipo === 'grupo' || node.tipo === 'departamento') && node.valor > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemParaRevisao({
                    planoContasId: node.metadata?.id || null,
                    departamentoId: node.tipo === 'departamento' ? node.id : null,
                    categoriaNome: node.nome,
                    valor: node.valor,
                    nome: node.nome
                  });
                  setMarcarRevisaoOpen(true);
                }}
                title="Marcar para revisão de gastos"
              >
                <Flag className="h-3 w-3 text-amber-500" />
              </Button>
            )}
          </div>

          {/* Colunas de valores mensais */}
          <div className="flex items-center flex-nowrap">
            {mesesPeriodo.map(mes => {
              const valorMes = node.valoresMensais?.[mes.key] || 0;
              const isResultado = node.id === 'resultado';
              const temValor = isResultado ? valorMes !== 0 : valorMes > 0;
              return (
                <div 
                  key={mes.key} 
                  className={`flex-shrink-0 text-right ${formatConfig.padding}`}
                  style={{ width: columnWidths.month }}
                >
                  {temValor ? (
                    <span className={`font-mono ${formatConfig.fontSizeValue} ${isResultado ? (valorMes >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : getValueColor()}`}>
                      {isResultado 
                        ? (valorMes < 0 ? `(${formatarValor(Math.abs(valorMes), true)})` : formatarValor(valorMes, true))
                        : (isExpense ? `(${formatarValor(valorMes, true)})` : formatarValor(valorMes, true))}
                    </span>
                  ) : (
                    <span className={`text-muted-foreground ${formatConfig.fontSizeValue}`}>-</span>
                  )}
                </div>
              );
            })}

            {/* Total */}
            <div 
              className={`flex-shrink-0 text-right ${formatConfig.padding} border-l-2 bg-slate-50/50 dark:bg-slate-800/30`}
              style={{ width: columnWidths.total }}
            >
              <span className={`font-mono ${formatConfig.fontSizeValue} font-semibold ${node.id === 'resultado' ? (node.valor >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : getValueColor()}`}>
                {node.id === 'resultado' 
                  ? (node.valor < 0 ? `(${formatarValor(Math.abs(node.valor))})` : formatarValor(node.valor))
                  : (isExpense && node.valor > 0 ? `(${formatarValor(node.valor)})` : formatarValor(node.valor))}
              </span>
            </div>

            {/* MoM */}
            <div 
              className={`flex-shrink-0 text-right ${formatConfig.padding} border-l`}
              style={{ width: columnWidths.variation }}
            >
              {renderVariacaoCell(mom, isExpense)}
            </div>

            {/* YoY */}
            <div 
              className={`flex-shrink-0 text-right ${formatConfig.padding} border-l`}
              style={{ width: columnWidths.variation }}
            >
              {renderVariacaoCell(yoy, isExpense)}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map(child => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const exportarExcel = () => {
    const flattenData = (nodes: DRENode[]): any[] => {
      const result: any[] = [];
      
      nodes.forEach(node => {
        const row: any = { 'Código': node.codigo, 'Descrição': node.nome, 'Tipo': node.tipo };
        mesesPeriodo.forEach(m => { row[m.label] = node.valoresMensais?.[m.key] || 0; });
        row['Total'] = node.valor;
        row['MoM %'] = calcularMoM(node.valoresMensais || {});
        row['YoY %'] = calcularYoY(node.id, node.valor);
        result.push(row);
        if (node.children) result.push(...flattenData(node.children));
      });

      return result;
    };

    const data = flattenData(visaoAtiva === 'contas' ? hierarquia : hierarquiaDepartamentos);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DRE");
    
    XLSX.writeFile(wb, `DRE_${format(new Date(dataInicio), 'dd-MM-yyyy')}_a_${format(new Date(dataFim), 'dd-MM-yyyy')}.xlsx`);
    toast.success("Relatório exportado com sucesso!");
  };

  const totalReceitas = hierarquia.find(h => h.id === 'receitas')?.valor || 0;
  const totalDespesas = hierarquia.find(h => h.id === 'despesas')?.valor || 0;
  const totalCustos = hierarquia.find(h => h.id === 'custos')?.valor || 0;
  const totalPatrimoniais = hierarquia.find(h => h.id === 'patrimoniais')?.valor || 0;
  const totalNaoClassificados = hierarquia.find(h => h.id === 'nao-classificados')?.valor || 0;
  const resultado = totalReceitas - totalDespesas - totalCustos - totalPatrimoniais - totalNaoClassificados;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Demonstrativo de Resultado do Exercício</h1>
            <p className="text-muted-foreground">Análise financeira com comparativos MoM e YoY</p>
          </div>
          <Button onClick={exportarExcel} className="gap-2">
            <FileDown className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={periodo} onValueChange={(v: any) => handlePeriodoChange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Mensal</SelectItem>
                    <SelectItem value="trimestre">Trimestral</SelectItem>
                    <SelectItem value="ano">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                    {empresas?.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Departamentos</SelectItem>
                    {departamentos?.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={filterConta} onValueChange={setFilterConta}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Contas</SelectItem>
                    {planoContas?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Buscar por Descrição/Fornecedor</Label>
                <Input 
                  placeholder="Digite para filtrar..." 
                  value={filterDescricao} 
                  onChange={(e) => setFilterDescricao(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <LayoutGrid className="h-3 w-3" />
                  Formato Tabela
                </Label>
                <Select value={tableFormat} onValueChange={(v) => setTableFormat(v as TableFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compacto">Compacto</SelectItem>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="expandido">Expandido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mostrar-inativos"
                    checked={mostrarInativos}
                    onCheckedChange={(checked) => setMostrarInativos(checked as boolean)}
                  />
                  <Label htmlFor="mostrar-inativos" className="text-xs text-muted-foreground cursor-pointer">
                    Mostrar inativos
                  </Label>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <Button 
                  onClick={() => setExpandedNodes(new Set(['receitas', 'despesas', 'custos', 'patrimoniais']))}
                  variant="outline" className="flex-1"
                >
                  Expandir Grupos
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <Button 
                  onClick={() => {
                    setFilterDepartamento('todos');
                    setFilterConta('todas');
                    setFilterDescricao('');
                  }}
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-muted-foreground"
                >
                  Limpar Filtros
                </Button>
                <Button 
                  onClick={resetColumnWidths}
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-muted-foreground"
                  title="Resetar largura das colunas"
                >
                  Resetar Colunas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Receitas
              </div>
              <div className="text-2xl font-bold text-emerald-600">{formatarValor(totalReceitas)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Despesas
              </div>
              <div className="text-2xl font-bold text-red-600">{formatarValor(totalDespesas)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-sm text-muted-foreground mb-1">Custos</div>
              <div className="text-2xl font-bold text-orange-600">{formatarValor(totalCustos)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="text-sm text-muted-foreground mb-1">Patrimoniais</div>
              <div className="text-2xl font-bold text-blue-600">{formatarValor(totalPatrimoniais)}</div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${resultado >= 0 ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'}`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-sm text-muted-foreground mb-1">Resultado</div>
              <div className={`text-2xl font-bold ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principais */}
        <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as 'dre' | 'reducao')}>
          <TabsList className="mb-4">
            <TabsTrigger value="dre" className="gap-2">
              <FileText className="h-4 w-4" />
              DRE Analítico
            </TabsTrigger>
            <TabsTrigger value="reducao" className="gap-2">
              <Target className="h-4 w-4" />
              Plano de Redução de Gastos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reducao" className="m-0">
            <PlanoReducaoGastos 
              dataInicio={dataInicio}
              dataFim={dataFim}
              filterEmpresa={filterEmpresa}
            />
          </TabsContent>

          <TabsContent value="dre" className="m-0">
            <Card>
              <Tabs value={visaoAtiva} onValueChange={(v) => setVisaoAtiva(v as 'contas' | 'departamentos')}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle>Análise Detalhada</CardTitle>
                    <TabsList>
                      <TabsTrigger value="contas" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Por Contas
                      </TabsTrigger>
                      <TabsTrigger value="departamentos" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        Por Departamentos
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

            <CardContent className="p-0 mt-4">
              {/* Header da tabela */}
              <div className={`flex items-center bg-muted/80 border-y ${formatConfig.fontSize} font-semibold text-muted-foreground sticky top-0 z-20`}>
                <div 
                  className={`${formatConfig.headerPadding} sticky left-0 bg-muted/80 z-10 border-r flex items-center justify-between group`}
                  style={{ width: columnWidths.name, minWidth: columnWidths.name }}
                >
                  <span>Conta / Descrição</span>
                  <div 
                    className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                    onMouseDown={(e) => handleMouseDown(e, 'name')}
                  />
                </div>
                <div className="flex items-center flex-nowrap">
                  {mesesPeriodo.map((mes, idx) => (
                    <div 
                      key={mes.key} 
                      className={`flex-shrink-0 text-right ${formatConfig.headerPadding} uppercase relative group`}
                      style={{ width: columnWidths.month }}
                    >
                      {mes.label}
                      {idx === 0 && (
                        <div 
                          className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                          onMouseDown={(e) => handleMouseDown(e, 'month')}
                          title="Arraste para redimensionar todas as colunas de meses"
                        />
                      )}
                    </div>
                  ))}
                  <div 
                    className={`flex-shrink-0 text-right ${formatConfig.headerPadding} border-l-2 bg-muted/50 font-bold relative group`}
                    style={{ width: columnWidths.total }}
                  >
                    Total
                    <div 
                      className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                      onMouseDown={(e) => handleMouseDown(e, 'total')}
                    />
                  </div>
                  <div 
                    className={`flex-shrink-0 text-right ${formatConfig.headerPadding} border-l relative group`}
                    style={{ width: columnWidths.variation }}
                  >
                    MoM
                    <div 
                      className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                      onMouseDown={(e) => handleMouseDown(e, 'variation')}
                      title="Arraste para redimensionar colunas de variação"
                    />
                  </div>
                  <div 
                    className={`flex-shrink-0 text-right ${formatConfig.headerPadding} border-l`}
                    style={{ width: columnWidths.variation }}
                  >
                    YoY
                  </div>
                </div>
              </div>

              <TabsContent value="contas" className="m-0">
                <ScrollArea className="h-[600px]">
                  {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <div className="animate-pulse">Carregando dados financeiros...</div>
                    </div>
                  ) : (
                    hierarquia.map(node => renderNode(node, 0))
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="departamentos" className="m-0">
                <ScrollArea className="h-[600px]">
                  {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <div className="animate-pulse">Carregando dados financeiros...</div>
                    </div>
                  ) : hierarquiaDepartamentos.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      Nenhum lançamento com departamento no período
                    </div>
                  ) : (
                    hierarquiaDepartamentos.map(node => renderNode(node, 0))
                  )}
                </ScrollArea>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de Detalhes do Lançamento */}
        <DetalheLancamentoDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          lancamento={selectedLancamento}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
          }}
        />

        {/* Dialog de Marcar para Revisão */}
        {itemParaRevisao && (
          <MarcarRevisaoDialog
            open={marcarRevisaoOpen}
            onOpenChange={setMarcarRevisaoOpen}
            planoContasId={itemParaRevisao.planoContasId}
            departamentoId={itemParaRevisao.departamentoId}
            categoriaNome={itemParaRevisao.categoriaNome}
            valorAtual={itemParaRevisao.valor}
            nomeItem={itemParaRevisao.nome}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['contas-revisao'] });
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
