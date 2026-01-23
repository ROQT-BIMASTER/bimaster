import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronsDown,
  ChevronsRight,
  AlertTriangle,
  FileSpreadsheet,
  Bot,
  Lock,
  Pencil
} from "lucide-react";
import { ReclassificarContaDREDialog } from "./ReclassificarContaDREDialog";
import { EditarClassificacaoRapidaDialog } from "./EditarClassificacaoRapidaDialog";
import { TransferirFornecedorDialog } from "./TransferirFornecedorDialog";
import { cn } from "@/lib/utils";

interface ContaPagar {
  id: string;
  fornecedor_nome: string;
  categoria_nome: string;
  valor_original: number;
  data_vencimento: string;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  classificado_automaticamente: boolean | null;
  classificacao_manual: boolean | null;
  confianca_classificacao: number | null;
}

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'categoria' | 'grupo' | 'subgrupo' | 'conta' | 'fornecedor' | 'lancamento';
  nivel: number;
  valor: number;
  valores_mes: Record<string, number>;
  children: DRENode[];
  lancamentosIds: string[];
  categoriaDre?: string | null;
  isGroup?: boolean;
  isTotalizador?: boolean;
  contaOrigem?: {
    id: string;
    codigo: string;
    nome: string;
    valor: number;
    lancamentosIds: string[];
    categoriaDre?: string | null;
    tipoDre?: 'conta' | 'grupo' | 'fornecedor';
  };
  conta?: ContaPagar;
}

interface PlanoContas {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  categoria_dre: string | null;
  is_group: boolean | null;
  parent_code: string | null;
  nivel: number;
}

interface ContasPagarDREViewProps {
  filterAno: string;
  filterMes: string;
  filterEmpresas: number[];
  filterDepartamento: string;
}

// Estrutura DRE conforme planilha do gestor
const ESTRUTURA_DRE = [
  { 
    codigo: '2', 
    nome: 'CUSTOS VARIÁVEIS', 
    tipo: 'grupo' as const,
    categoria_dre: 'despesas_variaveis',
    children: [
      { codigo: '2.1', nome: 'Fornecedores de Produtos', categoria_dre: 'despesas_variaveis' },
      { codigo: '2.2', nome: 'Embalagens e Materiais para postagem', categoria_dre: 'despesas_variaveis' },
      { codigo: '2.4', nome: 'Fretes', categoria_dre: 'despesas_variaveis' },
      { codigo: '2.5', nome: 'Despesas Tributárias de Vendas', categoria_dre: 'despesas_variaveis', children: [
        { codigo: '2.5.1', nome: 'Simples Nacional', categoria_dre: 'despesas_variaveis' },
        { codigo: '2.5.2', nome: 'ICMS/GNRE', categoria_dre: 'despesas_variaveis' },
        { codigo: '2.5.3', nome: 'COFINS/CSLL/PIS/IRPJ', categoria_dre: 'despesas_variaveis' },
      ]},
      { codigo: '2.6', nome: 'Despesas Comerciais', categoria_dre: 'despesas_variaveis' },
    ]
  },
  {
    codigo: '3',
    nome: 'DESPESAS FIXAS',
    tipo: 'grupo' as const,
    categoria_dre: 'despesas_fixas',
    totalizador: 'TOTAL DAS DESPESAS FIXAS',
    children: [
      { codigo: '3.1', nome: 'Despesas Administrativas', categoria_dre: 'despesas_fixas' },
      { codigo: '3.2', nome: 'Despesas com Pessoal', categoria_dre: 'despesas_fixas' },
      { codigo: '3.3', nome: 'Despesas de Marketing', categoria_dre: 'despesas_fixas' },
      { codigo: '3.4', nome: 'Despesas/Receitas Financeiras', categoria_dre: 'despesas_fixas' },
      { codigo: '3.5', nome: 'Retirada dos Sócios', categoria_dre: 'despesas_fixas' },
    ]
  },
  {
    codigo: '4',
    nome: 'CONTAS DE PATRIMÔNIO',
    tipo: 'grupo' as const,
    categoria_dre: 'patrimonio',
    children: [
      { codigo: '4.3', nome: 'ATIVIDADES FINANCEIRAS', categoria_dre: 'patrimonio' },
      { codigo: '4.4', nome: 'ATIVIDADES COM OS SÓCIOS', categoria_dre: 'patrimonio', children: [
        { codigo: '4.4.1', nome: 'Aporte de Capital ( + )', categoria_dre: 'patrimonio' },
        { codigo: '4.4.2', nome: 'Retirada de Lucros ( - )', categoria_dre: 'patrimonio' },
      ]},
    ]
  }
];

export function ContasPagarDREView({ 
  filterAno, 
  filterMes, 
  filterEmpresas,
  filterDepartamento 
}: ContasPagarDREViewProps) {
  const queryClient = useQueryClient();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['2', '3', '4']));
  const [editarOpen, setEditarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  const [selectedFornecedor, setSelectedFornecedor] = useState<{ nome: string; lancamentosIds: string[] } | null>(null);

  // Format functions
  const formatCurrency = useCallback((value: number, showSign = false) => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    if (showSign && value < 0) return `(${formatted})`;
    return formatted;
  }, []);

  const formatPercent = useCallback((value: number) => {
    if (isNaN(value) || !isFinite(value)) return '-';
    return `${value.toFixed(0)}%`;
  }, []);

  // Build date range
  const dateRange = useMemo(() => {
    const ano = filterAno === 'all' ? new Date().getFullYear() : parseInt(filterAno);
    if (filterMes === 'all') {
      return { start: `${ano}-01-01`, end: `${ano}-12-31` };
    }
    const mes = filterMes.padStart(2, '0');
    const lastDay = new Date(ano, parseInt(filterMes), 0).getDate();
    return { start: `${ano}-${mes}-01`, end: `${ano}-${mes}-${lastDay}` };
  }, [filterAno, filterMes]);

  // Calculate months for columns
  const meses = useMemo(() => {
    if (filterMes !== 'all') {
      const mesNum = parseInt(filterMes);
      return [{ 
        key: filterMes.padStart(2, '0'), 
        label: new Date(2000, mesNum - 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', ''),
        mesNum
      }];
    }
    return Array.from({ length: 12 }, (_, i) => ({
      key: String(i + 1).padStart(2, '0'),
      label: new Date(2000, i).toLocaleString('pt-BR', { month: 'short' }).replace('.', ''),
      mesNum: i + 1
    }));
  }, [filterMes]);

  // Fetch lancamentos
  const { data: lancamentos, isLoading: isLoadingLancamentos } = useQuery({
    queryKey: ['contas-pagar-dre-view', filterAno, filterMes, filterEmpresas.join(','), filterDepartamento],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: ContaPagar[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('contas_pagar')
          .select('id, fornecedor_nome, categoria_nome, valor_original, data_vencimento, departamento_id, departamento_nome, plano_contas_id, plano_contas_codigo, plano_contas_nome, classificado_automaticamente, classificacao_manual')
          .gte('data_vencimento', dateRange.start)
          .lte('data_vencimento', dateRange.end);

        if (filterEmpresas.length > 0) {
          query = query.in('empresa_id', filterEmpresas);
        }

        if (filterDepartamento !== 'all') {
          query = query.eq('departamento_id', filterDepartamento);
        }

        query = query.range(from, from + PAGE_SIZE - 1);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data as ContaPagar[]];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      return allData;
    }
  });

  // Fetch plano de contas
  const { data: planoContas, isLoading: isLoadingPlano } = useQuery({
    queryKey: ['plano-contas-dre-view'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('id, code, name, account_type, categoria_dre, is_group, nivel, parent_code')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return (data || []) as unknown as PlanoContas[];
    }
  });

  // Build hierarchical tree following DRE structure
  const { hierarquia, totais, totalGeral } = useMemo(() => {
    if (!lancamentos || !planoContas) return { hierarquia: [], totais: { valoresMes: {}, total: 0 }, totalGeral: 0 };

    // Group lancamentos by plano_contas_codigo
    const lancamentosPorConta: Record<string, ContaPagar[]> = {};
    lancamentos.forEach(l => {
      const codigo = l.plano_contas_codigo || 'SEM_CLASSIFICACAO';
      if (!lancamentosPorConta[codigo]) {
        lancamentosPorConta[codigo] = [];
      }
      lancamentosPorConta[codigo].push(l);
    });

    // Create plano contas map
    const planoMap = new Map<string, PlanoContas>();
    planoContas.forEach(c => planoMap.set(c.code, c));

    // Helper to calculate values for a code prefix
    const calcularValores = (codigoPrefix: string): { valoresMes: Record<string, number>; total: number; lancamentosIds: string[] } => {
      const valoresMes: Record<string, number> = {};
      meses.forEach(m => valoresMes[m.key] = 0);
      let total = 0;
      const ids: string[] = [];

      Object.entries(lancamentosPorConta).forEach(([codigo, lancs]) => {
        if (codigo.startsWith(codigoPrefix) || codigo === codigoPrefix) {
          lancs.forEach(l => {
            const mes = l.data_vencimento.substring(5, 7);
            valoresMes[mes] = (valoresMes[mes] || 0) + l.valor_original;
            total += l.valor_original;
            ids.push(l.id);
          });
        }
      });

      return { valoresMes, total, lancamentosIds: ids };
    };

    // Build fornecedor children for a specific code
    const buildFornecedorNodes = (codigo: string, nivel: number): DRENode[] => {
      const lancsExatos = lancamentosPorConta[codigo] || [];
      if (lancsExatos.length === 0) return [];

      const fornMap = new Map<string, ContaPagar[]>();
      lancsExatos.forEach(l => {
        const key = l.fornecedor_nome || 'Sem fornecedor';
        if (!fornMap.has(key)) fornMap.set(key, []);
        fornMap.get(key)!.push(l);
      });

      return Array.from(fornMap.entries())
        .map(([nome, lancs]) => {
          const valoresMes: Record<string, number> = {};
          meses.forEach(m => valoresMes[m.key] = 0);
          lancs.forEach(l => {
            const mes = l.data_vencimento.substring(5, 7);
            valoresMes[mes] = (valoresMes[mes] || 0) + l.valor_original;
          });

          return {
            id: `forn_${codigo}_${nome}`,
            codigo: '',
            nome,
            tipo: 'fornecedor' as const,
            nivel: nivel,
            valor: lancs.reduce((s, l) => s + l.valor_original, 0),
            valores_mes: valoresMes,
            children: lancs.map(l => ({
              id: l.id,
              codigo: '',
              nome: `${l.categoria_nome || 'Lançamento'} - ${new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
              tipo: 'lancamento' as const,
              nivel: nivel + 1,
              valor: l.valor_original,
              valores_mes: { [l.data_vencimento.substring(5, 7)]: l.valor_original },
              children: [],
              lancamentosIds: [l.id],
              conta: l
            })),
            lancamentosIds: lancs.map(l => l.id),
            contaOrigem: {
              id: `forn_${codigo}_${nome}`,
              codigo,
              nome,
              valor: lancs.reduce((s, l) => s + l.valor_original, 0),
              lancamentosIds: lancs.map(l => l.id),
              tipoDre: 'fornecedor' as const
            }
          };
        })
        .sort((a, b) => b.valor - a.valor);
    };

    // Build tree recursively
    const buildTree = (items: any[], parentNivel: number): DRENode[] => {
      return items.map(item => {
        const { valoresMes, total, lancamentosIds } = calcularValores(item.codigo);
        const plano = planoMap.get(item.codigo);
        
        let children: DRENode[] = [];
        
        // If has explicit children in structure, build them
        if (item.children && item.children.length > 0) {
          children = buildTree(item.children, parentNivel + 1);
        } else {
          // Otherwise, check for sub-accounts in plano and build fornecedor nodes
          const subContas = planoContas.filter(c => 
            c.code.startsWith(item.codigo + '.') && 
            c.code.split('.').length === item.codigo.split('.').length + 1
          );
          
          if (subContas.length > 0) {
            children = subContas.map(sub => {
              const subVals = calcularValores(sub.code);
              const fornNodes = buildFornecedorNodes(sub.code, parentNivel + 2);
              
              return {
                id: sub.code,
                codigo: sub.code,
                nome: sub.name,
                tipo: 'subgrupo' as const,
                nivel: parentNivel + 1,
                valor: subVals.total,
                valores_mes: subVals.valoresMes,
                children: fornNodes,
                lancamentosIds: subVals.lancamentosIds,
                categoriaDre: sub.categoria_dre,
                contaOrigem: {
                  id: sub.id,
                  codigo: sub.code,
                  nome: sub.name,
                  valor: subVals.total,
                  lancamentosIds: subVals.lancamentosIds,
                  categoriaDre: sub.categoria_dre,
                  tipoDre: 'conta' as const
                }
              };
            }).filter(n => n.valor > 0);
          } else {
            // Leaf node - build fornecedor nodes
            children = buildFornecedorNodes(item.codigo, parentNivel + 1);
          }
        }

        return {
          id: item.codigo,
          codigo: item.codigo,
          nome: item.nome,
          tipo: item.tipo || 'conta',
          nivel: parentNivel,
          valor: total,
          valores_mes: valoresMes,
          children: children.filter(c => c.valor > 0),
          lancamentosIds,
          categoriaDre: item.categoria_dre,
          isGroup: item.tipo === 'grupo',
          contaOrigem: plano ? {
            id: plano.id,
            codigo: plano.code,
            nome: plano.name,
            valor: total,
            lancamentosIds,
            categoriaDre: plano.categoria_dre,
            tipoDre: 'conta' as const
          } : undefined
        };
      }).filter(n => n.valor > 0 || n.children.length > 0);
    };

    const result = buildTree(ESTRUTURA_DRE, 0);

    // Calculate totals
    let totalGeral = 0;
    const totaisValoresMes: Record<string, number> = {};
    meses.forEach(m => totaisValoresMes[m.key] = 0);

    result.forEach(cat => {
      totalGeral += cat.valor;
      Object.entries(cat.valores_mes).forEach(([k, v]) => {
        totaisValoresMes[k] = (totaisValoresMes[k] || 0) + v;
      });
    });

    // Add unclassified
    const semClassificacao = lancamentosPorConta['SEM_CLASSIFICACAO'];
    if (semClassificacao && semClassificacao.length > 0) {
      const valoresMes: Record<string, number> = {};
      meses.forEach(m => valoresMes[m.key] = 0);
      let total = 0;
      semClassificacao.forEach(l => {
        const mes = l.data_vencimento.substring(5, 7);
        valoresMes[mes] = (valoresMes[mes] || 0) + l.valor_original;
        total += l.valor_original;
      });

      result.push({
        id: 'SEM_CLASSIFICACAO',
        codigo: '',
        nome: '⚠️ SEM CLASSIFICAÇÃO',
        tipo: 'grupo',
        nivel: 0,
        valor: total,
        valores_mes: valoresMes,
        children: semClassificacao.map(l => ({
          id: l.id,
          codigo: '',
          nome: `${l.fornecedor_nome} - ${l.categoria_nome}`,
          tipo: 'lancamento' as const,
          nivel: 1,
          valor: l.valor_original,
          valores_mes: { [l.data_vencimento.substring(5, 7)]: l.valor_original },
          children: [],
          lancamentosIds: [l.id],
          conta: l
        })),
        lancamentosIds: semClassificacao.map(l => l.id),
        isGroup: true
      });

      totalGeral += total;
      Object.entries(valoresMes).forEach(([k, v]) => {
        totaisValoresMes[k] = (totaisValoresMes[k] || 0) + v;
      });
    }

    return { 
      hierarquia: result, 
      totais: { valoresMes: totaisValoresMes, total: totalGeral },
      totalGeral
    };
  }, [lancamentos, planoContas, meses]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: DRENode[]) => {
      nodes.forEach(n => {
        if (n.children.length > 0) {
          allIds.add(n.id);
          collectIds(n.children);
        }
      });
    };
    collectIds(hierarquia);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set(['2', '3', '4']));
  };

  const handleNodeClick = (node: DRENode, e: React.MouseEvent) => {
    if (node.tipo === 'lancamento' && node.conta) {
      e.stopPropagation();
      setSelectedConta(node.conta);
      setEditarOpen(true);
    } else if (node.tipo === 'fornecedor' && node.contaOrigem) {
      e.stopPropagation();
      setSelectedFornecedor({
        nome: node.nome,
        lancamentosIds: node.lancamentosIds
      });
      setTransferirOpen(true);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-table'] });
    setEditarOpen(false);
    setTransferirOpen(false);
    setSelectedConta(null);
    setSelectedFornecedor(null);
  };

  const isLoading = isLoadingLancamentos || isLoadingPlano;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderRow = (node: DRENode, depth: number = 0): React.ReactNode[] => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const paddingLeft = depth * 20 + 8;

    // Calculate %V (vertical) - percentage of total
    const percentV = totalGeral > 0 ? (node.valor / totalGeral) * 100 : 0;

    // Row styles based on type
    const getRowClasses = () => {
      switch (node.tipo) {
        case 'grupo':
          return 'bg-muted font-bold text-foreground';
        case 'subgrupo':
          return 'bg-muted/50 font-semibold';
        case 'conta':
          return 'font-medium hover:bg-muted/30';
        case 'fornecedor':
          return 'text-muted-foreground hover:bg-accent/50 text-sm';
        case 'lancamento':
          return 'text-muted-foreground hover:bg-accent/30 text-xs';
        default:
          return '';
      }
    };

    const rows: React.ReactNode[] = [];

    // Main row
    rows.push(
      <tr 
        key={node.id}
        className={cn(
          'border-b border-border/50 transition-colors cursor-pointer',
          getRowClasses()
        )}
        onClick={() => hasChildren ? toggleNode(node.id) : handleNodeClick(node, {} as React.MouseEvent)}
      >
        {/* Código */}
        <td className="px-2 py-1.5 text-left w-16 border-r border-border/30">
          <span className="text-xs font-mono">{node.codigo}</span>
        </td>

        {/* Descrição */}
        <td 
          className="px-2 py-1.5 text-left min-w-[250px] border-r border-border/30"
          style={{ paddingLeft }}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            )}
            {!hasChildren && node.tipo !== 'grupo' && <span className="w-4" />}
            
            <span className="truncate">{node.nome}</span>
            
            {node.tipo === 'lancamento' && node.conta && (
              <div className="flex items-center gap-1 ml-auto">
                {node.conta.classificado_automaticamente && (
                  <span title="Classificado por IA">
                    <Bot className="h-3 w-3 text-primary" />
                  </span>
                )}
                {node.conta.classificacao_manual && (
                  <span title="Classificação manual bloqueada">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </span>
                )}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </div>
            )}
            
            {node.tipo === 'fornecedor' && (
              <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                {node.children.length} lanç.
              </Badge>
            )}
          </div>
        </td>

        {/* Valores por mês */}
        {meses.map((m, idx) => {
          const valor = node.valores_mes[m.key] || 0;
          // Calculate %H (horizontal) - change from previous month
          const prevKey = meses[idx - 1]?.key;
          const prevValor = prevKey ? (node.valores_mes[prevKey] || 0) : 0;
          const percentH = prevValor > 0 ? ((valor - prevValor) / prevValor) * 100 : 0;
          const percentVMes = totais.valoresMes[m.key] > 0 ? (valor / totais.valoresMes[m.key]) * 100 : 0;

          return (
            <td key={m.key} className="px-2 py-1.5 text-right border-r border-border/30 tabular-nums">
              <div className="flex flex-col">
                <span className={cn(
                  'text-sm',
                  valor === 0 && 'text-muted-foreground/50'
                )}>
                  {valor > 0 ? formatCurrency(valor) : '-'}
                </span>
                {(node.tipo === 'grupo' || node.tipo === 'conta') && valor > 0 && filterMes === 'all' && (
                  <div className="flex justify-end gap-2 text-[10px] text-muted-foreground">
                    <span>{formatPercent(percentVMes)}</span>
                    {idx > 0 && (
                      <span className={cn(
                        percentH > 0 ? 'text-destructive' : percentH < 0 ? 'text-primary' : ''
                      )}>
                        {percentH > 0 ? '+' : ''}{formatPercent(percentH)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </td>
          );
        })}

        {/* Acumulado */}
        <td className="px-2 py-1.5 text-right font-semibold border-r border-border/30 tabular-nums bg-muted/30">
          {node.valor > 0 ? formatCurrency(node.valor) : '-'}
        </td>

        {/* %V */}
        <td className="px-2 py-1.5 text-right tabular-nums w-14">
          <span className={cn(
            'text-xs',
            percentV >= 10 ? 'font-semibold' : 'text-muted-foreground'
          )}>
            {percentV > 0 ? formatPercent(percentV) : '-'}
          </span>
        </td>
      </tr>
    );

    // Render children if expanded
    if (isExpanded && hasChildren) {
      node.children.forEach(child => {
        rows.push(...renderRow(child, depth + 1));
      });
    }

    return rows;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Visão DRE - Despesas</CardTitle>
              <p className="text-sm text-muted-foreground">
                {lancamentos?.length?.toLocaleString('pt-BR')} lançamentos • {filterAno !== 'all' ? filterAno : 'Todos os anos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronsDown className="h-4 w-4 mr-1" />
              Expandir
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <ChevronsRight className="h-4 w-4 mr-1" />
              Recolher
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b-2 border-border">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground border-r border-border/30 w-16">
                    Código
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground border-r border-border/30 min-w-[250px]">
                    DEMONSTRATIVO DE RESULTADOS - DESPESAS
                  </th>
                  {meses.map(m => (
                    <th key={m.key} className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground border-r border-border/30 min-w-[100px]">
                      <div className="flex flex-col items-end">
                        <span className="capitalize">{m.label}-{filterAno !== 'all' ? filterAno.slice(-2) : new Date().getFullYear().toString().slice(-2)}</span>
                        {filterMes === 'all' && <span className="text-[10px] text-muted-foreground/70">%V / %H</span>}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground border-r border-border/30 min-w-[110px] bg-muted/30">
                    Acumulado
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-14">
                    %V
                  </th>
                </tr>
              </thead>
              <tbody>
                {hierarquia.map(node => renderRow(node, 0))}
                
                {/* Total Row */}
                <tr className="border-t-2 border-border bg-primary/10 font-bold">
                  <td className="px-2 py-2 border-r border-border/30"></td>
                  <td className="px-2 py-2 border-r border-border/30">TOTAL GERAL DAS DESPESAS</td>
                  {meses.map(m => (
                    <td key={m.key} className="px-2 py-2 text-right border-r border-border/30 tabular-nums">
                      {formatCurrency(totais.valoresMes[m.key] || 0)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right border-r border-border/30 tabular-nums bg-muted/30">
                    {formatCurrency(totais.total)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>

      {/* Dialogs */}
      {selectedConta && (
        <EditarClassificacaoRapidaDialog
          open={editarOpen}
          onOpenChange={setEditarOpen}
          conta={selectedConta}
          onSuccess={handleSuccess}
        />
      )}

      {selectedFornecedor && (
        <TransferirFornecedorDialog
          open={transferirOpen}
          onOpenChange={setTransferirOpen}
          fornecedorNome={selectedFornecedor.nome}
          lancamentosIds={selectedFornecedor.lancamentosIds}
          onSuccess={handleSuccess}
        />
      )}
    </Card>
  );
}
