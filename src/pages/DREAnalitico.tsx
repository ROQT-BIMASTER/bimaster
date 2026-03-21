import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { fetchAllRows } from "@/lib/utils/fetchAllRows";
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
import { ChevronRight, ChevronDown, FileDown, Calendar, TrendingUp, TrendingDown, Building2, FileText, ArrowUp, ArrowDown, Minus, LayoutGrid, Eye, GripVertical, Flag, Target, Maximize2, Pencil, BookOpen } from "lucide-react";
import { DREFocusMode } from "@/components/financeiro/DREFocusMode";
import { DREFocusContent } from "@/components/financeiro/DREFocusContent";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import { PlanoReducaoGastos } from "@/components/financeiro/PlanoReducaoGastos";
import { ReclassificarContaDREDialog } from "@/components/financeiro/ReclassificarContaDREDialog";
import { DREFontSizeControl, FontSizeLevel, fontSizeClasses } from "@/components/dre/DREFontSizeControl";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths, subYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DetalheLancamentoDialog } from "@/components/financeiro/DetalheLancamentoDialog";

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'grupo' | 'subtotal' | 'conta' | 'departamento' | 'fornecedor' | 'lancamento';
  nivel: number;
  valor: number;
  valoresMensais?: { [mes: string]: number };
  natureza: 'D' | 'C';
  accountType: string;
  children?: DRENode[];
  metadata?: any;
  sinal?: '+' | '-' | '='; // Indicador visual do sinal na DRE
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
    variationColWidth: 'w-[50px]',
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
    monthColWidth: 'w-[90px]',
    totalColWidth: 'w-[110px]',
    variationColWidth: 'w-[60px]',
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
    monthColWidth: 'w-[110px]',
    totalColWidth: 'w-[130px]',
    variationColWidth: 'w-[70px]',
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
  const [fontSize, setFontSize] = useState<FontSizeLevel>('sm');
  const [selectedLancamento, setSelectedLancamento] = useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [tabAtiva, setTabAtiva] = useState<'dre' | 'reducao'>('dre');
  const [marcarRevisaoOpen, setMarcarRevisaoOpen] = useState(false);
  const [itemParaRevisao, setItemParaRevisao] = useState<any>(null);
  const [reclassificarDialogOpen, setReclassificarDialogOpen] = useState(false);
  const [contaParaReclassificar, setContaParaReclassificar] = useState<{
    id: string;
    codigo: string;
    nome: string;
    valor: number;
    lancamentosIds: string[];
    categoriaDre?: string | null;
    tipoDre?: 'conta' | 'grupo' | 'fornecedor' | 'departamento';
  } | null>(null);
  
  // Regime de análise: 'competencia' (faturamento/emissão) ou 'caixa' (recebimento)
  const [regimeAnalise, setRegimeAnalise] = useState<'competencia' | 'caixa'>('competencia');
  
  // Novos filtros
  const [filterDepartamento, setFilterDepartamento] = useState<string>('todos');
  const [filterConta, setFilterConta] = useState<string>('todas');
  const [filterDescricao, setFilterDescricao] = useState<string>('');
  
  // Estado para larguras das colunas (em pixels)
  const [columnWidths, setColumnWidths] = useState({
    name: 320,
    month: 90,
    total: 110,
    variation: 55
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
    setColumnWidths({ name: 320, month: 90, total: 110, variation: 55 });
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

  // Buscar empresas disponíveis (de ambas as tabelas)
  const { data: empresas } = useQuery({
    queryKey: ['empresas-dre'],
    queryFn: async () => {
      const [pagar, receber] = await Promise.all([
        supabase.from('contas_pagar').select('empresa_nome').not('empresa_nome', 'is', null),
        supabase.from('contas_receber').select('empresa_nome').not('empresa_nome', 'is', null)
      ]);
      
      const empresasPagar = pagar.data?.map(item => item.empresa_nome) || [];
      const empresasReceber = receber.data?.map(item => item.empresa_nome) || [];
      const uniqueEmpresas = [...new Set([...empresasPagar, ...empresasReceber])];
      return uniqueEmpresas.filter(Boolean);
    }
  });

  // Funções para obter a data de referência baseado no regime de análise
  // Isso garante que tanto o filtro da query quanto o agrupamento mensal usem a mesma data
  const getDataRefReceber = (registro: any): string | null => {
    if (regimeAnalise === 'caixa') {
      // Regime de caixa usa data_vencimento como proxy (data_recebimento geralmente é NULL)
      return registro.data_vencimento || registro.data_emissao;
    }
    // Regime de competência usa data de emissão
    return registro.data_emissao || registro.data_vencimento;
  };

  const getDataRefPagar = (registro: any): string | null => {
    if (regimeAnalise === 'caixa') {
      // Regime de caixa usa data_pagamento
      return registro.data_pagamento || registro.data_vencimento;
    }
    // Regime de competência usa data de vencimento
    return registro.data_vencimento;
  };
  
  // Buscar contas a receber (receitas)
  const { data: contasReceber } = useSupabaseQuery(
    ['contas-receber-dre-v2', dataInicio, dataFim, filterEmpresa, regimeAnalise],
    async () => {
      let query = supabase
        .from('contas_receber')
        .select('id, empresa_id, empresa_nome, cliente_codigo, cliente_nome, numero_documento, parcela, data_emissao, data_vencimento, data_recebimento, valor_original, valor_recebido, valor_aberto, status, tipo_documento, vendedor_codigo, vendedor_nome');
      
      // Para regime de caixa (recebimento), filtra registros recebidos pela data de vencimento
      // Como data_recebimento geralmente não está preenchido, usamos data_vencimento como proxy
      if (regimeAnalise === 'caixa') {
        query = query
          .eq('status', 'recebido')
          .gte('data_vencimento', dataInicio)
          .lte('data_vencimento', dataFim);
      } else {
        // Regime de competência (faturamento) usa data de emissão - busca TODOS os registros
        query = query
          .gte('data_emissao', dataInicio)
          .lte('data_emissao', dataFim);
      }
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      const { data, error } = await query.limit(100000);
      if (error) throw error;
      return data;
    },
    { staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000 } // Cache de 2 min para performance
  );

  // Buscar lançamentos do período (sem filtro de descrição para cachear dados base)
  const { data: lancamentosBase, isLoading } = useSupabaseQuery(
    ['lancamentos-dre', dataInicio, dataFim, filterEmpresa, mostrarInativos, filterDepartamento, filterConta, regimeAnalise],
    async () => {
      let query = supabase
        .from('contas_pagar')
        .select(`*, departamento:departamentos(id, nome)`);
      
      // Para regime de caixa, filtra por data_pagamento e status pago
      // Para regime de competência, filtra por data_vencimento
      if (regimeAnalise === 'caixa') {
        query = query
          .eq('status', 'pago')
          .gte('data_pagamento', dataInicio)
          .lte('data_pagamento', dataFim);
      } else {
        query = query
          .gte('data_vencimento', dataInicio)
          .lte('data_vencimento', dataFim);
      }
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      if (filterDepartamento !== 'todos') {
        query = query.eq('departamento_id', filterDepartamento);
      }
      
      if (filterConta !== 'todas') {
        query = query.eq('plano_contas_id', filterConta);
      }
      
      if (!mostrarInativos) {
        query = query.neq('ativo_dre', false);
      }
      
      const { data, error } = await query.limit(100000);
      if (error) throw error;
      
      return data;
    },
    { staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000 } // Cache de 2 min para performance
  );

  // Aplicar filtro de descrição/fornecedor via useMemo (filtragem instantânea)
  const lancamentos = useMemo(() => {
    if (!lancamentosBase) return null;
    
    if (!filterDescricao.trim()) {
      return lancamentosBase;
    }
    
    const searchTerm = filterDescricao.toLowerCase().trim();
    return lancamentosBase.filter(item => 
      (item.fornecedor_nome && item.fornecedor_nome.toLowerCase().includes(searchTerm)) ||
      (item.categoria_nome && item.categoria_nome.toLowerCase().includes(searchTerm)) ||
      (item.numero_documento && item.numero_documento.toLowerCase().includes(searchTerm)) ||
      (item.plano_contas_nome && item.plano_contas_nome.toLowerCase().includes(searchTerm))
    );
  }, [lancamentosBase, filterDescricao]);

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
    { staleTime: 2 * 60 * 1000 } // Cache para dados YoY
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

  // Buscar contas em revisão para indicar no DRE
  const { data: contasEmRevisao } = useQuery({
    queryKey: ['contas-em-revisao-dre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_pagar_revisao')
        .select('conta_id, plano_contas_id, departamento_id, status, fornecedor_nome, numero_documento')
        .in('status', ['pendente', 'em_analise']);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Criar sets para busca rápida de contas em revisão
  const contasIdEmRevisao = useMemo(() => new Set(contasEmRevisao?.filter(c => c.conta_id).map(c => c.conta_id) || []), [contasEmRevisao]);
  const planosContasEmRevisao = useMemo(() => new Set(contasEmRevisao?.filter(c => c.plano_contas_id).map(c => c.plano_contas_id) || []), [contasEmRevisao]);
  const departamentosEmRevisao = useMemo(() => new Set(contasEmRevisao?.filter(c => c.departamento_id).map(c => c.departamento_id) || []), [contasEmRevisao]);

  // Auto-expandir nós quando filtro de descrição está ativo
  useEffect(() => {
    if (filterDescricao.trim() && lancamentos && lancamentos.length > 0) {
      const nodosParaExpandir = new Set<string>();
      
      nodosParaExpandir.add('receita-bruta');
      nodosParaExpandir.add('deducoes');
      nodosParaExpandir.add('custos-vendas');
      nodosParaExpandir.add('despesas-operacionais');
      nodosParaExpandir.add('impostos-lucro');
      nodosParaExpandir.add('nao-classificados');
      
      lancamentos.forEach(l => {
        if (l.plano_contas_id) nodosParaExpandir.add(l.plano_contas_id);
        if (l.departamento_id) nodosParaExpandir.add(l.departamento_id);
        if (l.categoria_nome) nodosParaExpandir.add(`cat-${l.categoria_nome}`);
      });
      
      setExpandedNodes(nodosParaExpandir);
    }
  }, [filterDescricao, lancamentos]);

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

  // Calcular AH (Análise Horizontal) - variação sobre período anterior
  const calcularAH = (valoresMensais: { [mes: string]: number }): number | null => {
    const keys = Object.keys(valoresMensais).sort();
    if (keys.length < 2) return null;
    
    const mesAtual = valoresMensais[keys[keys.length - 1]];
    const mesAnterior = valoresMensais[keys[keys.length - 2]];
    
    if (mesAnterior === 0) return mesAtual > 0 ? 100 : 0;
    return ((mesAtual - mesAnterior) / Math.abs(mesAnterior)) * 100;
  };

  // Construir hierarquia DRE Gerencial
  const construirHierarquiaDRE = (): DRENode[] => {
    if (!planoContas || !lancamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));

    // Inicializar valores mensais vazios
    const initValoresMensais = () => {
      const vm: { [key: string]: number } = {};
      mesesPeriodo.forEach(m => vm[m.key] = 0);
      return vm;
    };

    // === ESTRUTURA DRE GERENCIAL ===
    
    // 1. (+) RECEITAS COM VENDA (Faturamento)
    const receitaBruta: DRENode = {
      id: 'receita-bruta',
      codigo: '01',
      nome: '(+) RECEITAS COM VENDA (Faturamento)',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'C',
      accountType: 'revenue',
      sinal: '+',
      children: []
    };

    // 2. (-) DEDUÇÕES E ABATIMENTOS
    const deducoes: DRENode = {
      id: 'deducoes',
      codigo: '02.01',
      nome: '(-) DEDUÇÕES E ABATIMENTOS (Imp. e deduções)',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'D',
      accountType: 'expense',
      sinal: '-',
      children: []
    };

    // 4. (-) CUSTO DE VENDAS (custos variáveis)
    const custosVendas: DRENode = {
      id: 'custos-vendas',
      codigo: '02.02',
      nome: '(-) CUSTO DE VENDAS (custos variáveis)',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'D',
      accountType: 'cost_center',
      sinal: '-',
      children: []
    };

    // 6. (-) DESPESAS FIXAS (operacionais)
    const despesasFixas: DRENode = {
      id: 'despesas-operacionais',
      codigo: '02.03',
      nome: '(-) DESPESAS FIXAS (operacionais)',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'D',
      accountType: 'expense',
      sinal: '-',
      children: []
    };

    // 8. (-) ABATIMENTOS DO IRPJ E CSLL
    const impostosLucro: DRENode = {
      id: 'impostos-lucro',
      codigo: '02.90',
      nome: '(-) ABATIMENTOS DO IRPJ E CSLL',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'D',
      accountType: 'expense',
      sinal: '-',
      children: []
    };

    // Não classificados
    const naoClassificados: DRENode = {
      id: 'nao-classificados',
      codigo: '99',
      nome: 'NÃO CLASSIFICADOS',
      tipo: 'grupo',
      nivel: 0,
      valor: 0,
      valoresMensais: initValoresMensais(),
      natureza: 'D',
      accountType: 'expense',
      sinal: '-',
      children: []
    };

    // Processar contas a receber (RECEITAS)
    if (contasReceber && contasReceber.length > 0) {
      const receitasPorCliente = new Map<string, { nome: string; valor: number; valoresMensais: { [key: string]: number }; lancamentos: any[] }>();
      
      contasReceber.forEach(recebimento => {
        // Para regime de caixa, usar valor_recebido; para competência, usar valor_original
        const valor = regimeAnalise === 'caixa' 
          ? parseFloat(String(recebimento.valor_recebido || recebimento.valor_original || 0))
          : parseFloat(String(recebimento.valor_original || 0));
        
        // Usar a função getDataRefReceber para garantir consistência entre filtro e agrupamento
        const dataRef = getDataRefReceber(recebimento);
        const mesKey = dataRef ? format(parseISO(dataRef), 'yyyy-MM') : null;
        const clienteKey = recebimento.cliente_codigo || recebimento.cliente_nome || 'sem-cliente';
        const clienteNome = recebimento.cliente_nome || 'Cliente não identificado';
        
        receitaBruta.valor += valor;
        if (mesKey && receitaBruta.valoresMensais![mesKey] !== undefined) {
          receitaBruta.valoresMensais![mesKey] += valor;
        }
        
        if (!receitasPorCliente.has(clienteKey)) {
          receitasPorCliente.set(clienteKey, {
            nome: clienteNome,
            valor: 0,
            valoresMensais: initValoresMensais(),
            lancamentos: []
          });
        }
        
        const clienteData = receitasPorCliente.get(clienteKey)!;
        clienteData.valor += valor;
        if (mesKey && clienteData.valoresMensais[mesKey] !== undefined) {
          clienteData.valoresMensais[mesKey] += valor;
        }
        clienteData.lancamentos.push(recebimento);
      });
      
      // Criar subconta "Vendas / Faturamento"
      const vendasSubconta: DRENode = {
        id: 'vendas-faturamento',
        codigo: '01.01',
        nome: 'RECEITAS DE VENDA',
        tipo: 'conta',
        nivel: 1,
        valor: receitaBruta.valor,
        valoresMensais: { ...receitaBruta.valoresMensais! },
        natureza: 'C',
        accountType: 'revenue',
        children: []
      };
      
      receitasPorCliente.forEach((clienteData, clienteKey) => {
        const nodoCliente: DRENode = {
          id: `cliente-${clienteKey}`,
          codigo: '',
          nome: clienteData.nome,
          tipo: 'fornecedor',
          nivel: 2,
          valor: clienteData.valor,
          valoresMensais: clienteData.valoresMensais,
          natureza: 'C',
          accountType: 'revenue',
          children: clienteData.lancamentos.map(lanc => {
            // Usar mesmo critério de valor e data do agrupamento
            const lancValor = regimeAnalise === 'caixa'
              ? parseFloat(String(lanc.valor_recebido || lanc.valor_original || 0))
              : parseFloat(String(lanc.valor_original || 0));
            const lancDataRef = getDataRefReceber(lanc);
            const lancMesKey = lancDataRef ? format(parseISO(lancDataRef), 'yyyy-MM') : null;
            const lancValoresMensais = initValoresMensais();
            if (lancMesKey && lancValoresMensais[lancMesKey] !== undefined) {
              lancValoresMensais[lancMesKey] = lancValor;
            }
            
            return {
              id: lanc.id,
              codigo: lanc.numero_documento || '',
              nome: `Doc: ${lanc.numero_documento || 'S/N'} - ${format(new Date(lanc.data_vencimento), 'dd/MM/yyyy')}`,
              tipo: 'lancamento' as const,
              nivel: 3,
              valor: lancValor,
              valoresMensais: lancValoresMensais,
              natureza: 'C' as const,
              accountType: 'revenue',
              metadata: { ...lanc, tipo_lancamento: 'receita' }
            };
          })
        };
        vendasSubconta.children?.push(nodoCliente);
      });
      
      vendasSubconta.children?.sort((a, b) => b.valor - a.valor);
      receitaBruta.children?.push(vendasSubconta);
    }

    // Processar contas a pagar (DESPESAS) - categorizar conforme estrutura gerencial
    lancamentos.forEach(lancamento => {
      // Para regime de caixa, usar valor_pago; para competência, usar valor_original
      const valor = regimeAnalise === 'caixa'
        ? parseFloat(String(lancamento.valor_pago || lancamento.valor_original || 0))
        : parseFloat(String(lancamento.valor_original || 0));
      // Usar a função getDataRefPagar para garantir consistência entre filtro e agrupamento
      const dataRef = getDataRefPagar(lancamento);
      const mesKey = dataRef ? format(parseISO(dataRef), 'yyyy-MM') : null;
      
      if (!lancamento.plano_contas_id) {
        naoClassificados.valor += valor;
        if (mesKey && naoClassificados.valoresMensais![mesKey] !== undefined) {
          naoClassificados.valoresMensais![mesKey] += valor;
        }
        
        let nodoCategoria = naoClassificados.children?.find(c => c.nome === (lancamento.categoria_nome || 'Sem Categoria'));
        if (!nodoCategoria) {
          nodoCategoria = {
            id: `cat-${lancamento.categoria_nome || 'sem'}`,
            codigo: '',
            nome: lancamento.categoria_nome || 'Sem Categoria',
            tipo: 'conta',
            nivel: 1,
            valor: 0,
            valoresMensais: initValoresMensais(),
            natureza: 'D',
            accountType: 'expense',
            children: []
          };
          naoClassificados.children?.push(nodoCategoria);
        }
        
        nodoCategoria.valor += valor;
        if (mesKey && nodoCategoria.valoresMensais![mesKey] !== undefined) {
          nodoCategoria.valoresMensais![mesKey] += valor;
        }

        const lancValoresMensais = initValoresMensais();
        if (mesKey && lancValoresMensais[mesKey] !== undefined) {
          lancValoresMensais[mesKey] = valor;
        }

        nodoCategoria.children?.push({
          id: lancamento.id,
          codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy')}`,
          tipo: 'lancamento',
          nivel: 2,
          valor,
          valoresMensais: lancValoresMensais,
          natureza: 'D',
          accountType: 'expense',
          metadata: lancamento
        });
        return;
      }

      const conta = contasMap.get(lancamento.plano_contas_id);
      if (!conta) return;

      // Determinar grupo baseado na categoria_dre manual ou regras automáticas
      let grupoDestino: DRENode;
      const nomeConta = conta.name?.toLowerCase() || '';
      
      // 1. Se tem categoria_dre definida manualmente, usar ela
      if (conta.categoria_dre) {
        switch (conta.categoria_dre) {
          case 'deducoes': grupoDestino = deducoes; break;
          case 'custo_vendas': grupoDestino = custosVendas; break;
          case 'despesas_variaveis': grupoDestino = custosVendas; break; // Custo Variável vai para Custo de Vendas
          case 'despesas_fixas': grupoDestino = despesasFixas; break;
          case 'impostos_lucro': grupoDestino = impostosLucro; break;
          default: grupoDestino = despesasFixas;
        }
      } else {
        // 2. Fallback para regras automáticas (IA/texto)
        if (nomeConta.includes('icms') || nomeConta.includes('ipi') || nomeConta.includes('pis') || 
            nomeConta.includes('cofins') || nomeConta.includes('iss') ||
            nomeConta.includes('devolu') || nomeConta.includes('desconto') || nomeConta.includes('abatimento')) {
          grupoDestino = deducoes;
        } else if (nomeConta.includes('irpj') || nomeConta.includes('csll') || nomeConta.includes('imposto de renda') ||
                   nomeConta.includes('contribuição social')) {
          grupoDestino = impostosLucro;
        } else if (conta.account_type === 'cost_center' || nomeConta.includes('custo') || 
                   nomeConta.includes('matéria') || nomeConta.includes('material') ||
                   nomeConta.includes('mercadoria') || nomeConta.includes('frete') ||
                   nomeConta.includes('serviço') || nomeConta.includes('compra') ||
                   nomeConta.includes('comiss')) {
          grupoDestino = custosVendas;
        } else {
          grupoDestino = despesasFixas;
        }
      }

      grupoDestino.valor += valor;
      if (mesKey && grupoDestino.valoresMensais![mesKey] !== undefined) {
        grupoDestino.valoresMensais![mesKey] += valor;
      }

      // Buscar ou criar nó da conta
      let nodoConta = grupoDestino.children?.find(c => c.id === conta.id);
      if (!nodoConta) {
        nodoConta = {
          id: conta.id,
          codigo: conta.code,
          nome: conta.name,
          tipo: 'conta',
          nivel: 1,
          valor: 0,
          valoresMensais: initValoresMensais(),
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          children: [],
          metadata: conta
        };
        grupoDestino.children?.push(nodoConta);
      }

      nodoConta.valor += valor;
      if (mesKey && nodoConta.valoresMensais![mesKey] !== undefined) {
        nodoConta.valoresMensais![mesKey] += valor;
      }

      // Adicionar lançamento agrupado por departamento/fornecedor
      const adicionarLancamento = (parentNode: DRENode) => {
        const fornecedorKey = lancamento.fornecedor_codigo || lancamento.fornecedor_nome || 'sem-fornecedor';
        const fornecedorNome = lancamento.fornecedor_nome || 'N/A';
        
        let nodoFornecedor = parentNode.children?.find(f => 
          f.tipo === 'fornecedor' && f.id === `fornecedor-${fornecedorKey}`
        );
        
        if (!nodoFornecedor) {
          nodoFornecedor = {
            id: `fornecedor-${fornecedorKey}`,
            codigo: lancamento.fornecedor_codigo || '',
            nome: fornecedorNome,
            tipo: 'fornecedor',
            nivel: 2,
            valor: 0,
            valoresMensais: initValoresMensais(),
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type,
            children: []
          };
          parentNode.children?.push(nodoFornecedor);
        }
        
        nodoFornecedor.valor += valor;
        if (mesKey && nodoFornecedor.valoresMensais![mesKey] !== undefined) {
          nodoFornecedor.valoresMensais![mesKey] += valor;
        }
        
        const lancValoresMensais = initValoresMensais();
        if (mesKey && lancValoresMensais[mesKey] !== undefined) {
          lancValoresMensais[mesKey] = valor;
        }
        
        nodoFornecedor.children?.push({
          id: lancamento.id,
          codigo: lancamento.numero_documento || '',
          nome: `Doc: ${lancamento.numero_documento || 'S/N'} - ${format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy')}`,
          tipo: 'lancamento',
          nivel: 3,
          valor,
          valoresMensais: lancValoresMensais,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          metadata: lancamento
        });
      };

      if (lancamento.departamento_id) {
        let nodoDept = nodoConta.children?.find(d => d.id === lancamento.departamento_id);
        if (!nodoDept) {
          const dept = departamentos?.find(d => d.id === lancamento.departamento_id);
          nodoDept = {
            id: lancamento.departamento_id,
            codigo: '',
            nome: dept?.nome || 'Sem Departamento',
            tipo: 'departamento',
            nivel: 2,
            valor: 0,
            valoresMensais: initValoresMensais(),
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type,
            children: []
          };
          nodoConta.children?.push(nodoDept);
        }
        
        nodoDept.valor += valor;
        if (mesKey && nodoDept.valoresMensais![mesKey] !== undefined) {
          nodoDept.valoresMensais![mesKey] += valor;
        }

        adicionarLancamento(nodoDept);
      } else {
        adicionarLancamento(nodoConta);
      }
    });

    // Ordenar filhos
    const ordenarNos = (nos: DRENode[]) => {
      nos.sort((a, b) => b.valor - a.valor);
      nos.forEach(no => { if (no.children) ordenarNos(no.children); });
    };

    [receitaBruta, deducoes, custosVendas, despesasFixas, impostosLucro, naoClassificados].forEach(g => {
      if (g.children) ordenarNos(g.children);
    });

    // Montar árvore com subtotais intermediários
    arvore.push(receitaBruta);

    if (deducoes.valor > 0) arvore.push(deducoes);

    // (=) RECEITA LÍQUIDA
    const receitaLiquidaValores = initValoresMensais();
    mesesPeriodo.forEach(m => {
      receitaLiquidaValores[m.key] = (receitaBruta.valoresMensais![m.key] || 0) - (deducoes.valoresMensais![m.key] || 0);
    });
    const receitaLiquida: DRENode = {
      id: 'receita-liquida',
      codigo: '',
      nome: '(=) RECEITA LÍQUIDA',
      tipo: 'subtotal',
      nivel: 0,
      valor: receitaBruta.valor - deducoes.valor,
      valoresMensais: receitaLiquidaValores,
      natureza: 'C',
      accountType: 'revenue',
      sinal: '='
    };
    arvore.push(receitaLiquida);

    if (custosVendas.valor > 0) arvore.push(custosVendas);

    // (=) LUCRO BRUTO (margem de contribuição)
    const lucroBrutoValores = initValoresMensais();
    mesesPeriodo.forEach(m => {
      lucroBrutoValores[m.key] = receitaLiquidaValores[m.key] - (custosVendas.valoresMensais![m.key] || 0);
    });
    const lucroBruto: DRENode = {
      id: 'lucro-bruto',
      codigo: '',
      nome: '(=) LUCRO BRUTO (margem de contrib.)',
      tipo: 'subtotal',
      nivel: 0,
      valor: receitaLiquida.valor - custosVendas.valor,
      valoresMensais: lucroBrutoValores,
      natureza: 'C',
      accountType: 'revenue',
      sinal: '='
    };
    arvore.push(lucroBruto);

    if (despesasFixas.valor > 0) arvore.push(despesasFixas);

    // (=) RESULTADO BRUTO/OPERACIONAL
    const resultadoOperacionalValores = initValoresMensais();
    mesesPeriodo.forEach(m => {
      resultadoOperacionalValores[m.key] = lucroBrutoValores[m.key] - (despesasFixas.valoresMensais![m.key] || 0);
    });
    const resultadoOperacional: DRENode = {
      id: 'resultado-operacional',
      codigo: '',
      nome: '(=) RESULTADO BRUTO/OPERACIONAL (antes dos impostos)',
      tipo: 'subtotal',
      nivel: 0,
      valor: lucroBruto.valor - despesasFixas.valor,
      valoresMensais: resultadoOperacionalValores,
      natureza: 'C',
      accountType: 'revenue',
      sinal: '='
    };
    arvore.push(resultadoOperacional);

    if (impostosLucro.valor > 0) arvore.push(impostosLucro);

    // (=) RESULTADO LÍQUIDO
    const resultadoLiquidoValores = initValoresMensais();
    mesesPeriodo.forEach(m => {
      resultadoLiquidoValores[m.key] = resultadoOperacionalValores[m.key] - (impostosLucro.valoresMensais![m.key] || 0);
    });
    const resultadoLiquido: DRENode = {
      id: 'resultado-liquido',
      codigo: '',
      nome: '(=) RESULTADO LÍQUIDO',
      tipo: 'subtotal',
      nivel: 0,
      valor: resultadoOperacional.valor - impostosLucro.valor,
      valoresMensais: resultadoLiquidoValores,
      natureza: 'C',
      accountType: 'revenue',
      sinal: '='
    };
    arvore.push(resultadoLiquido);

    if (naoClassificados.valor > 0) arvore.push(naoClassificados);

    return arvore;
  };

  // Construir hierarquia por departamento (mantido similar ao original)
  const construirHierarquiaPorDepartamento = (): DRENode[] => {
    if (!planoContas || !lancamentos || !departamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));
    const deptsMap = new Map(departamentos.map(d => [d.id, d]));

    const initValoresMensais = () => {
      const vm: { [key: string]: number } = {};
      mesesPeriodo.forEach(m => vm[m.key] = 0);
      return vm;
    };

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
        tipo: 'departamento', nivel: 0, valor: 0, valoresMensais: initValoresMensais(),
        natureza: 'D', accountType: 'expense', children: []
      };

      lancsDept.forEach(lanc => {
        // Usar mesmo critério de valor e data do regime selecionado
        const valor = regimeAnalise === 'caixa'
          ? parseFloat(String(lanc.valor_pago || lanc.valor_original || 0))
          : parseFloat(String(lanc.valor_original || 0));
        const dataRef = getDataRefPagar(lanc);
        const mesKey = dataRef ? format(parseISO(dataRef), 'yyyy-MM') : null;
        
        nodoDept.valor += valor;
        if (mesKey && nodoDept.valoresMensais![mesKey] !== undefined) {
          nodoDept.valoresMensais![mesKey] += valor;
        }

        const conta = contasMap.get(lanc.plano_contas_id);
        let nodoConta = nodoDept.children?.find(c => c.id === `${deptId}-${lanc.plano_contas_id}`);
        
        if (!nodoConta) {
          nodoConta = {
            id: `${deptId}-${lanc.plano_contas_id}`,
            codigo: conta?.code || '',
            nome: conta?.name || 'Sem Classificação',
            tipo: 'conta',
            nivel: 1,
            valor: 0,
            valoresMensais: initValoresMensais(),
            natureza: 'D',
            accountType: conta?.account_type || 'expense',
            children: []
          };
          nodoDept.children?.push(nodoConta);
        }

        nodoConta.valor += valor;
        if (mesKey && nodoConta.valoresMensais![mesKey] !== undefined) {
          nodoConta.valoresMensais![mesKey] += valor;
        }

        const lancValoresMensais = initValoresMensais();
        if (mesKey && lancValoresMensais[mesKey] !== undefined) {
          lancValoresMensais[mesKey] = valor;
        }

        nodoConta.children?.push({
          id: lanc.id,
          codigo: lanc.numero_documento || '',
          nome: `${lanc.fornecedor_nome || 'N/A'} - ${lanc.data_vencimento ? format(new Date(lanc.data_vencimento), 'dd/MM/yyyy') : ''}`,
          tipo: 'lancamento',
          nivel: 2,
          valor,
          valoresMensais: lancValoresMensais,
          natureza: 'D',
          accountType: conta?.account_type || 'expense',
          metadata: lanc
        });
      });

      nodoDept.children?.sort((a, b) => b.valor - a.valor);
      arvore.push(nodoDept);
    });

    arvore.sort((a, b) => b.valor - a.valor);
    return arvore;
  };

  const hierarquia = construirHierarquiaDRE();
  const hierarquiaDepartamentos = construirHierarquiaPorDepartamento();

  // Calcular receita bruta total para AV
  const receitaBrutaTotal = hierarquia.find(h => h.id === 'receita-bruta')?.valor || 0;

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

  const formatarPercentual = (valor: number | null) => {
    if (valor === null || isNaN(valor)) return '-';
    return `${valor.toFixed(2)}%`;
  };

  const renderVariacaoCell = (variacao: number | null, isExpense: boolean = false) => {
    if (variacao === null || isNaN(variacao)) return <span className="text-muted-foreground">-</span>;
    
    const isPositive = variacao > 0;
    const isGood = isExpense ? !isPositive : isPositive;
    const color = Math.abs(variacao) < 1 ? 'text-muted-foreground' : isGood ? 'text-emerald-600' : 'text-red-600';
    
    return (
      <span className={`font-mono ${formatConfig.fontSizeValue} ${color}`}>
        {variacao > 0 ? '+' : ''}{variacao.toFixed(2)}%
      </span>
    );
  };

  // Função para extrair IDs de lançamentos de um node
  const extrairLancamentosIds = (node: DRENode): string[] => {
    const ids: string[] = [];
    
    const coletarIds = (n: DRENode) => {
      if (n.tipo === 'lancamento' && n.metadata?.id) {
        ids.push(n.metadata.id);
      }
      n.children?.forEach(coletarIds);
    };
    
    coletarIds(node);
    return ids;
  };

  const renderNode = (node: DRENode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indentMultiplier = tableFormat === 'compacto' ? 12 : tableFormat === 'expandido' ? 20 : 16;
    const paddingLeft = level * indentMultiplier;
    const isExpense = ['expense', 'cost_center', 'budget', 'asset', 'liability'].includes(node.accountType);
    const isSubtotal = node.tipo === 'subtotal';
    const isGrupo = node.tipo === 'grupo' && level === 0;

    // Calcular AV (% sobre Receita Bruta)
    const calcularAV = (valor: number) => {
      if (receitaBrutaTotal === 0) return null;
      return (valor / receitaBrutaTotal) * 100;
    };

    // Calcular AH
    const ah = node.valoresMensais ? calcularAH(node.valoresMensais) : null;

    const getRowStyle = () => {
      if (isSubtotal) {
        if (node.id === 'resultado-liquido') {
          return 'bg-gradient-to-r from-primary/30 to-primary/10 font-bold border-y-2 border-primary/40';
        }
        return 'bg-gradient-to-r from-slate-200/80 to-slate-100/50 dark:from-slate-700/80 dark:to-slate-800/50 font-bold border-y border-slate-300 dark:border-slate-600';
      }
      if (isGrupo) return 'bg-slate-100 dark:bg-slate-800 font-semibold';
      if (node.tipo === 'conta') return 'bg-slate-50/50 dark:bg-slate-800/30 font-medium';
      if (node.tipo === 'departamento') return 'bg-blue-50/30 dark:bg-blue-900/10';
      if (node.tipo === 'fornecedor') return 'bg-amber-50/20 dark:bg-amber-900/5';
      return 'hover:bg-muted/50';
    };

    const getValueColor = () => {
      if (isSubtotal) {
        return node.valor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
      }
      if (node.accountType === 'revenue') return 'text-emerald-600 dark:text-emerald-400';
      if (isExpense) return 'text-red-600 dark:text-red-400';
      return node.valor >= 0 ? 'text-emerald-600' : 'text-red-600';
    };

    const handleLancamentoClick = () => {
      if (node.tipo === 'lancamento' && node.metadata) {
        setSelectedLancamento(node.metadata);
        setDetailDialogOpen(true);
      }
    };

    const isClickable = node.tipo === 'lancamento' && node.metadata;

    // Indicador de sinal
    const renderSinal = () => {
      if (!node.sinal) return null;
      const sinalColor = node.sinal === '+' ? 'text-emerald-600' : node.sinal === '-' ? 'text-red-600' : 'text-primary';
      return <span className={`font-bold mr-1 ${sinalColor}`}>{node.sinal === '=' ? '' : ''}</span>;
    };

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
            style={{ paddingLeft: `${paddingLeft + 8}px`, width: columnWidths.name, minWidth: columnWidths.name }}
          >
            {hasChildren ? (
              <Button variant="ghost" size="sm" className={`${formatConfig.expandBtnSize} hover:bg-transparent`} onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
                {isExpanded ? <ChevronDown className={formatConfig.iconSize} /> : <ChevronRight className={formatConfig.iconSize} />}
              </Button>
            ) : node.tipo === 'lancamento' ? (
              <Eye className={`${formatConfig.iconSize} text-muted-foreground/50 ml-1`} />
            ) : (
              <div className={tableFormat === 'compacto' ? 'w-3' : tableFormat === 'expandido' ? 'w-5' : 'w-4'} />
            )}
            
            {renderSinal()}
            
            {node.codigo && !isSubtotal && (
              <span className={`font-mono ${formatConfig.fontSize} text-muted-foreground mr-2 flex-shrink-0`}>{node.codigo}</span>
            )}
            
            <span className={`truncate ${isSubtotal ? 'text-sm font-bold' : node.tipo === 'lancamento' ? `${formatConfig.fontSize} text-muted-foreground hover:text-foreground` : formatConfig.fontSize}`}>
              {node.nome}
            </span>

            {node.id === 'nao-classificados' && (
              <Badge variant="destructive" className={`ml-1 text-[8px] px-1 py-0 h-4`}>Pendente</Badge>
            )}

            {node.tipo === 'lancamento' && node.metadata?.ativo_dre === false && (
              <Badge variant="secondary" className="ml-1 text-[7px] px-0.5 py-0 h-3 bg-orange-100 text-orange-700">Inativo</Badge>
            )}

            {node.tipo === 'lancamento' && contasIdEmRevisao.has(node.metadata?.id) && (
              <Badge className="ml-1 text-[7px] px-0.5 py-0 h-3 bg-amber-500 text-white">
                <Target className="h-2 w-2 mr-0.5" />Revisão
              </Badge>
            )}

            {/* Botão para reclassificar conta */}
            {(node.tipo === 'conta' || node.tipo === 'departamento' || node.tipo === 'fornecedor' || (node.tipo === 'grupo' && level > 0)) && node.valor > 0 && !isSubtotal && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 opacity-40 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  const lancamentosIds = extrairLancamentosIds(node);
                  if (lancamentosIds.length === 0) {
                    toast.error("Nenhum lançamento encontrado para reclassificar");
                    return;
                  }
                  
                  // Get categoria_dre based on node type
                  let categoriaDre: string | null = null;
                  if (node.tipo === 'conta' || node.tipo === 'grupo') {
                    const contaPlano = planoContas?.find(c => c.code === node.codigo);
                    categoriaDre = contaPlano?.categoria_dre || null;
                  } else if (node.children?.length) {
                    // For dept/fornecedor, infer from first child account
                    const primeiraContaFilha = node.children.find((c: { tipo: string }) => c.tipo === 'conta');
                    if (primeiraContaFilha) {
                      const contaPlano = planoContas?.find(c => c.code === primeiraContaFilha.codigo);
                      categoriaDre = contaPlano?.categoria_dre || null;
                    }
                  }
                  
                  setContaParaReclassificar({
                    id: node.id,
                    codigo: node.codigo,
                    nome: node.nome,
                    valor: node.valor,
                    lancamentosIds,
                    categoriaDre,
                    tipoDre: node.tipo as 'conta' | 'grupo' | 'fornecedor' | 'departamento',
                  });
                  setReclassificarDialogOpen(true);
                }}
                title="Reclassificar lançamentos"
              >
                <Pencil className="h-2.5 w-2.5 text-blue-500" />
              </Button>
            )}

            {/* Botão para marcar revisão */}
            {(node.tipo === 'conta' || node.tipo === 'grupo' || node.tipo === 'departamento' || node.tipo === 'fornecedor') && node.valor > 0 && !isSubtotal && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 opacity-40 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemParaRevisao({
                    planoContasId: node.metadata?.id || null,
                    departamentoId: node.tipo === 'departamento' ? node.id : null,
                    categoriaNome: node.nome,
                    valor: node.valor,
                    nome: node.nome,
                    ...(node.tipo === 'fornecedor' && {
                      fornecedorNome: node.nome,
                      fornecedorCodigo: node.codigo || null,
                    })
                  });
                  setMarcarRevisaoOpen(true);
                }}
                title="Marcar para revisão"
              >
                <Flag className="h-2.5 w-2.5 text-amber-500" />
              </Button>
            )}
          </div>

          {/* Colunas de valores mensais com AV */}
          <div className="flex items-center flex-nowrap">
            {mesesPeriodo.map(mes => {
              const valorMes = node.valoresMensais?.[mes.key] || 0;
              const avMes = calcularAV(valorMes);
              const temValor = isSubtotal ? valorMes !== 0 : valorMes > 0;
              
              return (
                <div key={mes.key} className="flex flex-col">
                  {/* Valor */}
                  <div 
                    className={`flex-shrink-0 text-right ${formatConfig.padding}`}
                    style={{ width: columnWidths.month }}
                  >
                    {temValor ? (
                      <span className={`font-mono ${formatConfig.fontSizeValue} ${getValueColor()}`}>
                        {isSubtotal 
                          ? (valorMes < 0 ? `(${formatarValor(Math.abs(valorMes), true)})` : formatarValor(valorMes, true))
                          : (isExpense && !isSubtotal ? `(${formatarValor(valorMes, true)})` : formatarValor(valorMes, true))}
                      </span>
                    ) : (
                      <span className={`text-muted-foreground ${formatConfig.fontSizeValue}`}>-</span>
                    )}
                  </div>
                  {/* AV% */}
                  <div 
                    className={`flex-shrink-0 text-right px-2 pb-1`}
                    style={{ width: columnWidths.month }}
                  >
                    <span className={`font-mono text-[9px] text-muted-foreground`}>
                      {formatarPercentual(avMes)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Total e AV */}
            <div className="flex flex-col border-l-2 bg-slate-50/50 dark:bg-slate-800/30">
              <div 
                className={`flex-shrink-0 text-right ${formatConfig.padding}`}
                style={{ width: columnWidths.total }}
              >
                <span className={`font-mono ${formatConfig.fontSizeValue} font-semibold ${getValueColor()}`}>
                  {isSubtotal 
                    ? (node.valor < 0 ? `(${formatarValor(Math.abs(node.valor))})` : formatarValor(node.valor))
                    : (isExpense && node.valor > 0 && !isSubtotal ? `(${formatarValor(node.valor)})` : formatarValor(node.valor))}
                </span>
              </div>
              <div 
                className={`flex-shrink-0 text-right px-2 pb-1`}
                style={{ width: columnWidths.total }}
              >
                <span className={`font-mono text-[9px] text-muted-foreground font-medium`}>
                  {formatarPercentual(calcularAV(node.valor))}
                </span>
              </div>
            </div>

            {/* AH (Análise Horizontal) */}
            <div 
              className={`flex-shrink-0 text-right ${formatConfig.padding} border-l`}
              style={{ width: columnWidths.variation }}
            >
              {renderVariacaoCell(ah, isExpense && !isSubtotal)}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children!.map(child => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const exportarExcel = async () => {
    const flattenData = (nodes: DRENode[]): any[] => {
      const result: any[] = [];
      
      nodes.forEach(node => {
        const row: any = { 
          codigo: node.codigo, 
          descricao: node.nome, 
          tipo: node.tipo 
        };
        mesesPeriodo.forEach(m => { 
          row[`${m.key}_valor`] = node.valoresMensais?.[m.key] || 0;
          row[`${m.key}_av`] = receitaBrutaTotal > 0 ? ((node.valoresMensais?.[m.key] || 0) / receitaBrutaTotal * 100).toFixed(2) : 0;
        });
        row['total_valor'] = node.valor;
        row['total_av'] = receitaBrutaTotal > 0 ? (node.valor / receitaBrutaTotal * 100).toFixed(2) : 0;
        row['ah'] = calcularAH(node.valoresMensais || {})?.toFixed(2) || '-';
        result.push(row);
        if (node.children) result.push(...flattenData(node.children));
      });

      return result;
    };

    const data = flattenData(visaoAtiva === 'contas' ? hierarquia : hierarquiaDepartamentos);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const worksheet = workbook.addWorksheet('DRE Gerencial');
    
    // Build columns dynamically
    const columns: { header: string; key: string; width: number }[] = [
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Tipo', key: 'tipo', width: 12 },
    ];
    mesesPeriodo.forEach(m => {
      columns.push({ header: `${m.label} (R$)`, key: `${m.key}_valor`, width: 15 });
      columns.push({ header: `${m.label} (AV%)`, key: `${m.key}_av`, width: 12 });
    });
    columns.push({ header: 'Total (R$)', key: 'total_valor', width: 15 });
    columns.push({ header: 'Total (AV%)', key: 'total_av', width: 12 });
    columns.push({ header: 'AH%', key: 'ah', width: 10 });
    
    worksheet.columns = columns;
    data.forEach(row => worksheet.addRow(row));
    
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `DRE_Gerencial_${format(new Date(dataInicio), 'dd-MM-yyyy')}_a_${format(new Date(dataFim), 'dd-MM-yyyy')}.xlsx`);
    toast.success("Relatório DRE exportado com sucesso!");
  };

  const exportarDocumentacaoTecnica = () => {
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    const periodoFormatado = `${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`;
    
    // Estatísticas do relatório
    const totalLancamentos = lancamentos?.length || 0;
    const totalReceitas = contasReceber?.length || 0;
    const contasClassificadas = lancamentos?.filter(l => l.plano_contas_id)?.length || 0;
    const contasNaoClassificadas = totalLancamentos - contasClassificadas;
    
    const documentacao = `
================================================================================
           DOCUMENTAÇÃO TÉCNICA E ARQUITETÔNICA - DRE GERENCIAL
================================================================================
Documento gerado automaticamente pelo Sistema de Gestão Financeira
Data de geração: ${dataGeracao}
Período analisado: ${periodoFormatado}
Regime de análise: ${regimeAnalise === 'caixa' ? 'REGIME DE CAIXA' : 'REGIME DE COMPETÊNCIA'}
================================================================================

1. INTRODUÇÃO E ESCOPO
--------------------------------------------------------------------------------
Este documento descreve a arquitetura técnica, metodologia de cálculo e
critérios utilizados na elaboração do Demonstrativo de Resultado do Exercício
(DRE) Gerencial. O objetivo é fornecer transparência total sobre os processos
de classificação e cálculo para fins de auditoria contábil.

2. REGIME DE ANÁLISE
--------------------------------------------------------------------------------
${regimeAnalise === 'caixa' ? `
2.1 REGIME DE CAIXA (Aplicado neste relatório)
    - RECEITAS: Considera valor_recebido na data de recebimento efetivo
    - DESPESAS: Considera valor_pago na data de pagamento efetivo
    - STATUS FILTRADO: Apenas registros com status 'recebido' ou 'pago'
    - CRITÉRIO DE DATA: data_recebimento/data_pagamento para agrupamento mensal
` : `
2.1 REGIME DE COMPETÊNCIA (Aplicado neste relatório)  
    - RECEITAS: Considera valor_original na data de emissão (faturamento)
    - DESPESAS: Considera valor_original na data de vencimento
    - STATUS FILTRADO: Todos os registros (a pagar/receber e pagos/recebidos)
    - CRITÉRIO DE DATA: data_emissao/data_vencimento para agrupamento mensal
`}

3. ESTRUTURA HIERÁRQUICA DO DRE
--------------------------------------------------------------------------------
A estrutura segue o padrão contábil brasileiro adaptado para gestão gerencial:

┌─────────────────────────────────────────────────────────────────────────────┐
│ CÓDIGO  │ CATEGORIA                        │ SINAL │ NATUREZA │ FONTE      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 01      │ (+) RECEITAS COM VENDA           │   +   │ Crédito  │ Contas Rec │
│ 02.01   │ (-) DEDUÇÕES E ABATIMENTOS       │   -   │ Débito   │ Contas Pag │
│ =       │ (=) RECEITA LÍQUIDA              │   =   │ Calculado│ Subtração  │
│ 02.02   │ (-) CUSTO DE VENDAS              │   -   │ Débito   │ Contas Pag │
│ =       │ (=) LUCRO BRUTO                  │   =   │ Calculado│ Subtração  │
│ 02.03   │ (-) DESPESAS FIXAS               │   -   │ Débito   │ Contas Pag │
│ =       │ (=) LUCRO OPERACIONAL            │   =   │ Calculado│ Subtração  │
│ 02.90   │ (-) ABATIMENTOS IRPJ/CSLL        │   -   │ Débito   │ Contas Pag │
│ =       │ (=) RESULTADO LÍQUIDO            │   =   │ Calculado│ Subtração  │
└─────────────────────────────────────────────────────────────────────────────┘

4. CATEGORIZAÇÃO DRE (categoria_dre)
--------------------------------------------------------------------------------
As contas do plano de contas são classificadas nas seguintes categorias:

4.1 RECEITA BRUTA (receita_bruta)
    - Origem: tabela contas_receber
    - Descrição: Todas as receitas de vendas e faturamento
    - Natureza contábil: CRÉDITO
    - Impacto no resultado: POSITIVO

4.2 DEDUÇÕES E ABATIMENTOS (deducoes)  
    - Origem: tabela contas_pagar vinculada ao plano de contas
    - Conteúdo: ICMS, IPI, PIS, COFINS, ISS, Comissões sobre vendas
    - Critério de classificação automática: Nome da conta contém termos 
      fiscais (icms, ipi, pis, cofins, iss) ou comissão
    - Natureza contábil: DÉBITO
    - Impacto no resultado: NEGATIVO (reduz a receita líquida)

4.3 CUSTO DE VENDAS (custo_vendas)
    - Origem: tabela contas_pagar vinculada ao plano de contas  
    - Conteúdo: CMV, custos diretos de produção, matéria-prima
    - Critério de classificação automática: Nome contém 'cmv', 'custo',
      'matéria-prima', 'insumo', 'mercadoria'
    - Natureza contábil: DÉBITO
    - Impacto no resultado: NEGATIVO (reduz o lucro bruto)

4.4 DESPESAS FIXAS (despesas_fixas)
    - Origem: tabela contas_pagar vinculada ao plano de contas
    - Conteúdo: Despesas administrativas, pessoal, infraestrutura
    - Subcategorias:
      * Despesas com pessoal: salários, encargos, benefícios
      * Despesas administrativas: aluguel, utilidades, serviços
      * Despesas comerciais: marketing, propaganda
    - Critério: Todas as despesas não classificadas em outras categorias
    - Natureza contábil: DÉBITO  
    - Impacto no resultado: NEGATIVO (reduz lucro operacional)

4.5 IMPOSTOS SOBRE O LUCRO (impostos_lucro)
    - Origem: tabela contas_pagar vinculada ao plano de contas
    - Conteúdo: IRPJ, CSLL, contribuições sobre o lucro
    - Critério de classificação automática: Nome contém 'irpj', 'csll',
      'imposto de renda', 'contribuição social'
    - Natureza contábil: DÉBITO
    - Impacto no resultado: NEGATIVO (reduz resultado líquido)

5. METODOLOGIA DE CÁLCULO
--------------------------------------------------------------------------------

5.1 ANÁLISE VERTICAL (AV%)
    Fórmula: AV% = (Valor da Conta / Receita Bruta Total) × 100
    
    Interpretação:
    - Indica a participação percentual de cada conta em relação à receita bruta
    - Permite comparar a estrutura de custos entre períodos diferentes
    - Base de cálculo: Receita Bruta Total do período = R$ ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

5.2 ANÁLISE HORIZONTAL (AH%)
    Fórmula: AH% = ((Valor Mês Atual - Valor Mês Anterior) / |Valor Mês Anterior|) × 100
    
    Interpretação:
    - Indica a variação percentual entre o mês atual e o mês anterior
    - Valores positivos indicam crescimento
    - Valores negativos indicam redução
    - Quando mês anterior = 0, considera 100% se há valor no mês atual

5.3 CÁLCULO DOS SUBTOTAIS (FÓRMULAS)
    
    RECEITA LÍQUIDA = RECEITA BRUTA - DEDUÇÕES
    LUCRO BRUTO = RECEITA LÍQUIDA - CUSTO DE VENDAS  
    LUCRO OPERACIONAL = LUCRO BRUTO - DESPESAS FIXAS
    RESULTADO LÍQUIDO = LUCRO OPERACIONAL - IMPOSTOS SOBRE LUCRO

5.4 DEMONSTRAÇÃO DOS CÁLCULOS REALIZADOS (VALORES REAIS DO PERÍODO)
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │ CÁLCULO                                                                      │
    ├─────────────────────────────────────────────────────────────────────────────┤
    │ RECEITA LÍQUIDA                                                             │
    │   R$ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Receita Bruta)                                     │
    │ - R$ ${deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Deduções e Abatimentos)                            │
    │ ─────────────────────────────                                               │
    │ = R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Receita Líquida)                                  │
    ├─────────────────────────────────────────────────────────────────────────────┤
    │ LUCRO BRUTO                                                                 │
    │   R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Receita Líquida)                                  │
    │ - R$ ${custosVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Custo de Vendas)                                  │
    │ ─────────────────────────────                                               │
    │ = R$ ${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Lucro Bruto)                                        │
    │   Margem Bruta: ${receitaBrutaTotal > 0 ? ((lucroBruto / receitaBrutaTotal) * 100).toFixed(2) : '0.00'}% sobre Receita Bruta                            │
    ├─────────────────────────────────────────────────────────────────────────────┤
    │ RESULTADO LÍQUIDO (LUCRO/PREJUÍZO OPERACIONAL)                              │
    │   R$ ${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Lucro Bruto)                                        │
    │ - R$ ${despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Despesas Operacionais)                          │
    │ ─────────────────────────────                                               │
    │ = R$ ${resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15, ' ')} (Resultado Líquido)                                │
    │   Margem Líquida: ${receitaBrutaTotal > 0 ? ((resultadoLiquido / receitaBrutaTotal) * 100).toFixed(2) : '0.00'}% sobre Receita Bruta                         │
    └─────────────────────────────────────────────────────────────────────────────┘

5.5 EXEMPLO DE CÁLCULO DE ANÁLISE VERTICAL (AV%)
    Tomando como base a Receita Bruta de R$ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}:
    
    │ COMPONENTE           │ VALOR             │ CÁLCULO AV%                  │ RESULTADO │
    ├──────────────────────┼───────────────────┼──────────────────────────────┼───────────┤
    │ Receita Bruta        │ R$ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │   100.00% │
    │ Deduções             │ R$ ${deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((deducoes / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │
    │ Receita Líquida      │ R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((receitaLiquida / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │
    │ Custo de Vendas      │ R$ ${custosVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${custosVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((custosVendas / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │
    │ Lucro Bruto          │ R$ ${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((lucroBruto / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │
    │ Despesas Operacionais│ R$ ${despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((despesasOperacionais / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │
    │ Resultado Líquido    │ R$ ${resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} │ ${resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} / ${receitaBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12, ' ')} × 100 │ ${receitaBrutaTotal > 0 ? ((resultadoLiquido / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}% │

5.6 INDICADORES DE PERFORMANCE CALCULADOS
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │ INDICADOR              │ FÓRMULA                          │ VALOR          │
    ├────────────────────────┼──────────────────────────────────┼────────────────┤
    │ Margem Bruta           │ Lucro Bruto / Receita Bruta ×100 │ ${receitaBrutaTotal > 0 ? ((lucroBruto / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    │ Margem Operacional     │ Resultado Líq / Rec. Bruta ×100  │ ${receitaBrutaTotal > 0 ? ((resultadoLiquido / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    │ % Deduções             │ Deduções / Receita Bruta × 100   │ ${receitaBrutaTotal > 0 ? ((deducoes / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    │ % Custos               │ Custo Vendas / Rec. Bruta × 100  │ ${receitaBrutaTotal > 0 ? ((custosVendas / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    │ % Despesas Operacionais│ Desp. Oper. / Rec. Bruta × 100   │ ${receitaBrutaTotal > 0 ? ((despesasOperacionais / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    │ Eficiência Operacional │ (Rec.Bruta - Custos) / Rec.Bruta │ ${receitaBrutaTotal > 0 ? (((receitaBrutaTotal - custosVendas) / receitaBrutaTotal) * 100).toFixed(2).padStart(8, ' ') : '    0.00'}%       │
    └────────────────────────┴──────────────────────────────────┴────────────────┘

6. FONTE DOS DADOS
--------------------------------------------------------------------------------

6.1 TABELAS UTILIZADAS
    ┌────────────────────────┬────────────────────────────────────────────────┐
    │ TABELA                 │ UTILIZAÇÃO                                     │
    ├────────────────────────┼────────────────────────────────────────────────┤
    │ contas_receber         │ Receitas de vendas e faturamento              │
    │ contas_pagar           │ Despesas, custos e deduções                   │
    │ trade_chart_of_accounts│ Plano de contas com categorização DRE         │
    │ departamentos          │ Classificação por centro de custo             │
    └────────────────────────┴────────────────────────────────────────────────┘

6.2 CAMPOS PRINCIPAIS UTILIZADOS

    CONTAS A RECEBER:
    - valor_original: Valor faturado (regime competência)
    - valor_recebido: Valor efetivamente recebido (regime caixa)
    - data_emissao: Data do faturamento
    - data_recebimento: Data do recebimento efetivo
    - cliente_codigo, cliente_nome: Identificação do cliente

    CONTAS A PAGAR:
    - valor_original: Valor da obrigação (regime competência)
    - valor_pago: Valor efetivamente pago (regime caixa)
    - data_vencimento: Data da obrigação
    - data_pagamento: Data do pagamento efetivo
    - fornecedor_codigo, fornecedor_nome: Identificação do fornecedor
    - plano_contas_id: Vínculo com o plano de contas
    - departamento_id: Centro de custo/departamento

7. ESTATÍSTICAS DO PERÍODO
--------------------------------------------------------------------------------
    Período: ${periodoFormatado}
    Empresa: ${filterEmpresa === 'todas' ? 'Todas as empresas' : filterEmpresa}
    Departamento: ${filterDepartamento === 'todos' ? 'Todos os departamentos' : filterDepartamento}
    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ INDICADOR                              │ QUANTIDADE                     │
    ├─────────────────────────────────────────────────────────────────────────┤
    │ Total de receitas processadas          │ ${String(totalReceitas).padStart(10, ' ')}                     │
    │ Total de despesas processadas          │ ${String(totalLancamentos).padStart(10, ' ')}                     │
    │ Lançamentos classificados              │ ${String(contasClassificadas).padStart(10, ' ')}                     │
    │ Lançamentos não classificados          │ ${String(contasNaoClassificadas).padStart(10, ' ')}                     │
    │ Taxa de classificação                  │ ${totalLancamentos > 0 ? ((contasClassificadas / totalLancamentos) * 100).toFixed(1) : '0.0'}%                    │
    └─────────────────────────────────────────────────────────────────────────┘

8. RESUMO DOS RESULTADOS
--------------------------------------------------------------------------------
    (+) Receita Bruta:          R$ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (-) Deduções:               R$ ${deducoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (=) Receita Líquida:        R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (-) Custo de Vendas:        R$ ${custosVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (=) Lucro Bruto:            R$ ${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (-) Despesas Operacionais:  R$ ${despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    (=) Resultado Líquido:      R$ ${resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    
    Margem Bruta:       ${receitaBrutaTotal > 0 ? ((lucroBruto / receitaBrutaTotal) * 100).toFixed(2) : '0.00'}%
    Margem Operacional: ${receitaBrutaTotal > 0 ? ((resultadoLiquido / receitaBrutaTotal) * 100).toFixed(2) : '0.00'}%

9. CRITÉRIOS DE CLASSIFICAÇÃO AUTOMÁTICA
--------------------------------------------------------------------------------
O sistema utiliza os seguintes critérios para classificação automática quando
a categoria_dre não está definida manualmente no plano de contas:

9.1 REGRAS POR PALAVRAS-CHAVE NO NOME DA CONTA:

    DEDUÇÕES (Impostos sobre vendas e comissões):
    - icms, ipi, pis, cofins, iss, comissão, comissões, abatimento

    CUSTO DE VENDAS:
    - cmv, custo das mercadorias, custo de vendas, matéria-prima,
      insumo, mercadoria vendida, custo direto

    IMPOSTOS SOBRE LUCRO:
    - irpj, csll, imposto de renda pessoa jurídica, contribuição social,
      provisão para imposto

    DESPESAS FIXAS (padrão):
    - Todas as demais contas de despesa que não se enquadram acima

9.2 HIERARQUIA DE CLASSIFICAÇÃO:
    1º - categoria_dre manual definida no plano de contas (prioridade máxima)
    2º - Classificação automática por palavras-chave
    3º - Fallback para despesas_fixas

10. CONSIDERAÇÕES TÉCNICAS
--------------------------------------------------------------------------------
10.1 PRECISÃO NUMÉRICA
    - Todos os valores monetários são armazenados com precisão decimal
    - Cálculos percentuais utilizam até 4 casas decimais internamente
    - Apresentação utiliza 2 casas decimais

10.2 TRATAMENTO DE VALORES NULOS
    - Valores nulos são tratados como zero (0) para cálculos
    - Campos de texto nulos são apresentados como "N/A" ou "Não identificado"

10.3 ORDENAÇÃO
    - Hierarquia por código do plano de contas
    - Dentro de cada grupo: por valor (maior para menor)
    - Lançamentos individuais: por data de vencimento

10.4 LIMITES DE CONSULTA
    - Máximo de 50.000 registros por tabela por consulta
    - Otimização através de índices em campos de data e foreign keys

11. GLOSSÁRIO
--------------------------------------------------------------------------------
    AV%    - Análise Vertical: participação % sobre receita bruta
    AH%    - Análise Horizontal: variação % entre períodos
    CMV    - Custo das Mercadorias Vendidas
    CSLL   - Contribuição Social sobre o Lucro Líquido
    DRE    - Demonstrativo de Resultado do Exercício
    ICMS   - Imposto sobre Circulação de Mercadorias e Serviços
    IPI    - Imposto sobre Produtos Industrializados
    IRPJ   - Imposto de Renda Pessoa Jurídica
    ISS    - Imposto Sobre Serviços
    PIS    - Programa de Integração Social
    COFINS - Contribuição para Financiamento da Seguridade Social

12. AUDITORIA E RASTREABILIDADE
--------------------------------------------------------------------------------
Este relatório foi gerado com base nos dados disponíveis no sistema na data
de ${dataGeracao}. Todas as transações individuais podem ser
rastreadas através dos IDs únicos (UUID) presentes em cada lançamento.

Para verificação detalhada de qualquer valor, consulte:
- Relatório de Contas a Pagar filtrado pelo período
- Relatório de Contas a Receber filtrado pelo período  
- Plano de Contas com classificação DRE

================================================================================
                         FIM DA DOCUMENTAÇÃO TÉCNICA
================================================================================
Documento gerado automaticamente - Sistema de Gestão Financeira
Versão do motor de cálculo: 2.0
Data: ${dataGeracao}
================================================================================
`;

    // Criar e baixar arquivo TXT
    const blob = new Blob([documentacao], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DRE_Documentacao_Tecnica_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Documentação técnica exportada com sucesso!");
  };

  // Resumo
  const receitaBruta = hierarquia.find(h => h.id === 'receita-bruta')?.valor || 0;
  const deducoes = hierarquia.find(h => h.id === 'deducoes')?.valor || 0;
  const receitaLiquida = hierarquia.find(h => h.id === 'receita-liquida')?.valor || 0;
  const custosVendas = hierarquia.find(h => h.id === 'custos-vendas')?.valor || 0;
  const lucroBruto = hierarquia.find(h => h.id === 'lucro-bruto')?.valor || 0;
  const despesasOperacionais = hierarquia.find(h => h.id === 'despesas-operacionais')?.valor || 0;
  const resultadoLiquido = hierarquia.find(h => h.id === 'resultado-liquido')?.valor || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">DRE Gerencial</h1>
            <p className="text-muted-foreground">Demonstrativo de Resultado do Exercício com AV e AH</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportarDocumentacaoTecnica} variant="outline" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Doc. Técnica
            </Button>
            <Button onClick={exportarExcel} className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
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
                    {planoContas?.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Buscar (Fornecedor/Descrição)</Label>
                <Input 
                  placeholder="Digite para filtrar..." 
                  value={filterDescricao} 
                  onChange={(e) => setFilterDescricao(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <LayoutGrid className="h-3 w-3" />
                  Formato
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

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Regime
                </Label>
                <Select value={regimeAnalise} onValueChange={(v) => setRegimeAnalise(v as 'competencia' | 'caixa')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competencia">Competência (Faturamento)</SelectItem>
                    <SelectItem value="caixa">Caixa (Recebimento)</SelectItem>
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
                  onClick={() => setExpandedNodes(new Set(['receita-bruta', 'deducoes', 'custos-vendas', 'despesas-operacionais', 'impostos-lucro']))}
                  variant="outline" 
                  size="sm"
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
                    setExpandedNodes(new Set());
                  }}
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-muted-foreground"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Receita Bruta</div>
              <div className="text-lg font-bold text-emerald-600">{formatarValor(receitaBruta)}</div>
              <div className="text-[9px] text-muted-foreground">100%</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-400">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Deduções</div>
              <div className="text-lg font-bold text-orange-600">({formatarValor(deducoes)})</div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (deducoes / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Receita Líquida</div>
              <div className="text-lg font-bold text-blue-600">{formatarValor(receitaLiquida)}</div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (receitaLiquida / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-400">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Custos</div>
              <div className="text-lg font-bold text-red-500">({formatarValor(custosVendas)})</div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (custosVendas / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Lucro Bruto</div>
              <div className={`text-lg font-bold ${lucroBruto >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
                {lucroBruto < 0 ? '(' : ''}{formatarValor(Math.abs(lucroBruto))}{lucroBruto < 0 ? ')' : ''}
              </div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-400">
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Despesas Op.</div>
              <div className="text-lg font-bold text-purple-600">({formatarValor(despesasOperacionais)})</div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (despesasOperacionais / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${resultadoLiquido >= 0 ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'}`}>
            <CardContent className="pt-3 pb-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Resultado Líquido</div>
              <div className={`text-lg font-bold ${resultadoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {resultadoLiquido < 0 ? '(' : ''}{formatarValor(Math.abs(resultadoLiquido))}{resultadoLiquido < 0 ? ')' : ''}
              </div>
              <div className="text-[9px] text-muted-foreground">{formatarPercentual(receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principais */}
        <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as 'dre' | 'reducao')}>
          <TabsList className="mb-4">
            <TabsTrigger value="dre" className="gap-2">
              <FileText className="h-4 w-4" />
              DRE Gerencial
            </TabsTrigger>
            <TabsTrigger value="reducao" className="gap-2">
              <Target className="h-4 w-4" />
              Plano de Redução
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
                    <CardTitle className="flex items-center gap-2">
                      DRE Gerencial
                      <Badge variant="outline" className="text-xs">Gerencial</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <DREFontSizeControl currentSize={fontSize} onSizeChange={setFontSize} />
                      <DREFocusMode title="DRE Gerencial - Modo Foco" onExport={exportarExcel}>
                        <DREFocusContent 
                          visaoAtiva={visaoAtiva}
                          setVisaoAtiva={setVisaoAtiva}
                          hierarquia={hierarquia}
                          hierarquiaDepartamentos={hierarquiaDepartamentos}
                          mesesPeriodo={mesesPeriodo}
                          columnWidths={columnWidths}
                          formatConfig={formatConfig}
                          handleMouseDown={handleMouseDown}
                          renderNode={renderNode}
                          isLoading={isLoading}
                        />
                      </DREFocusMode>
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
                  </div>
                </CardHeader>

                <CardContent className="p-0 mt-4">
                  {/* Header da tabela */}
                  <div className={`flex items-center bg-muted/80 border-y ${fontSizeClasses[fontSize].header} font-semibold text-muted-foreground sticky top-0 z-20`}>
                    <div 
                      className={`${formatConfig.headerPadding} sticky left-0 bg-muted/80 z-10 border-r flex items-center justify-between group`}
                      style={{ width: columnWidths.name, minWidth: columnWidths.name }}
                    >
                      <span>Descrição</span>
                      <div 
                        className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                        onMouseDown={(e) => handleMouseDown(e, 'name')}
                      />
                    </div>
                    <div className="flex items-center flex-nowrap">
                      {mesesPeriodo.map((mes, idx) => (
                        <div 
                          key={mes.key} 
                          className="flex flex-col"
                        >
                          <div 
                            className={`flex-shrink-0 text-center ${formatConfig.headerPadding} uppercase relative group`}
                            style={{ width: columnWidths.month }}
                          >
                            {mes.label}
                            {idx === 0 && (
                              <div 
                                className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                                onMouseDown={(e) => handleMouseDown(e, 'month')}
                              />
                            )}
                          </div>
                          <div 
                            className={`flex-shrink-0 text-center text-[9px] pb-1`}
                            style={{ width: columnWidths.month }}
                          >
                            AV%
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-col border-l-2 bg-muted/50">
                        <div 
                          className={`flex-shrink-0 text-center ${formatConfig.headerPadding} font-bold relative group`}
                          style={{ width: columnWidths.total }}
                        >
                          TOTAL
                          <div 
                            className="w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 bottom-0"
                            onMouseDown={(e) => handleMouseDown(e, 'total')}
                          />
                        </div>
                        <div 
                          className={`flex-shrink-0 text-center text-[9px] pb-1`}
                          style={{ width: columnWidths.total }}
                        >
                          AV%
                        </div>
                      </div>
                      <div 
                        className={`flex-shrink-0 text-center ${formatConfig.headerPadding} border-l relative group`}
                        style={{ width: columnWidths.variation }}
                      >
                        AH%
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
            contaId={itemParaRevisao.contaId}
            planoContasId={itemParaRevisao.planoContasId}
            departamentoId={itemParaRevisao.departamentoId}
            categoriaNome={itemParaRevisao.categoriaNome}
            valorAtual={itemParaRevisao.valor}
            nomeItem={itemParaRevisao.nome}
            fornecedorNome={itemParaRevisao.fornecedorNome}
            fornecedorCodigo={itemParaRevisao.fornecedorCodigo}
            numeroDocumento={itemParaRevisao.numeroDocumento}
            dataVencimento={itemParaRevisao.dataVencimento}
            empresaNome={itemParaRevisao.empresaNome}
            tipoDocumento={itemParaRevisao.tipoDocumento}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['contas-revisao'] });
            }}
          />
        )}

        {/* Dialog de Reclassificação */}
        <ReclassificarContaDREDialog
          open={reclassificarDialogOpen}
          onOpenChange={setReclassificarDialogOpen}
          contaOrigem={contaParaReclassificar}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
            setReclassificarDialogOpen(false);
            setContaParaReclassificar(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
