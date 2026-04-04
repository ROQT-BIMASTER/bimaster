import { useState, useMemo, useCallback } from "react";
import { formatNumber } from "@/lib/formatters";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronsDown,
  ChevronsRight,
  AlertTriangle,
  FileSpreadsheet,
  Bot,
  Lock,
  Pencil,
  Maximize2,
  X,
  Printer,
  FileDown,
  ArrowRightLeft,
  Search
} from "lucide-react";
import { ReclassificarContaDREDialog } from "./ReclassificarContaDREDialog";
import { EditarClassificacaoRapidaDialog } from "./EditarClassificacaoRapidaDialog";
import { TransferirFornecedorDialog } from "./TransferirFornecedorDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  nivel: number;
}

interface ContasPagarDREViewProps {
  filterAno: string;
  filterMes: string;
  filterEmpresas: number[];
  filterDepartamento: string;
}

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
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusSearch, setFocusSearch] = useState("");
  // Format functions
  const formatCurrency = useCallback((value: number, showSign = false) => {
    const formatted = formatNumber(Math.abs(value), 2);
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
    queryFn: async (): Promise<ContaPagar[]> => {
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

        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...(data as unknown as ContaPagar[])];
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
    queryFn: async (): Promise<PlanoContas[]> => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('id, code, name, account_type, categoria_dre, is_group, nivel')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return (data || []) as PlanoContas[];
    }
  });

  // Natural sort for accounting codes
  const naturalSort = (a: string, b: string) => {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] ?? -1;
      const numB = partsB[i] ?? -1;
      if (numA !== numB) return numA - numB;
    }
    return 0;
  };

  // Build hierarchical tree DYNAMICALLY from trade_chart_of_accounts
  const { hierarquia, totais, totalGeral } = useMemo(() => {
    if (!lancamentos || !planoContas) return { hierarquia: [], totais: { valoresMes: {}, total: 0 }, totalGeral: 0 };

    // Map plano de contas por id e code
    const planoById = new Map<string, PlanoContas>();
    const planoByCode = new Map<string, PlanoContas>();
    planoContas.forEach(p => {
      planoById.set(p.id, p);
      planoByCode.set(p.code, p);
    });

    // Group lancamentos by plano_contas code
    const lancamentosPorConta: Record<string, ContaPagar[]> = {};
    lancamentos.forEach(l => {
      const plano = l.plano_contas_id ? planoById.get(l.plano_contas_id) : undefined;
      const codigo = plano?.code || l.plano_contas_codigo || 'SEM_CLASSIFICACAO';
      const key = /^[1-9](\..+)?$/.test(codigo) ? codigo : 'SEM_CLASSIFICACAO';
      if (!lancamentosPorConta[key]) lancamentosPorConta[key] = [];
      lancamentosPorConta[key].push(l);
    });

    // Helper to calculate values for a code prefix
    const calcularValores = (codigoPrefix: string): { valoresMes: Record<string, number>; total: number; lancamentosIds: string[] } => {
      const valoresMes: Record<string, number> = {};
      meses.forEach(m => valoresMes[m.key] = 0);
      let total = 0;
      const ids: string[] = [];

      Object.entries(lancamentosPorConta).forEach(([codigo, lancs]) => {
        if (codigo === codigoPrefix || codigo.startsWith(codigoPrefix + '.')) {
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
            nivel,
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

    // Build tree dynamically from plano de contas
    const buildDynamicTree = (parentCode: string | null, nivel: number): DRENode[] => {
      // Find children of this parent
      const children = planoContas.filter(c => {
        if (parentCode === null) {
          // Root level: codes with no dots (single digit: 1, 2, 3, 4...)
          return /^\d+$/.test(c.code);
        }
        // Children: start with parentCode + "." and have exactly one more level
        const prefix = parentCode + '.';
        if (!c.code.startsWith(prefix)) return false;
        const remainder = c.code.substring(prefix.length);
        return !remainder.includes('.');
      });

      return children
        .sort((a, b) => naturalSort(a.code, b.code))
        .map(conta => {
          const vals = calcularValores(conta.code);
          const isGroup = conta.is_group === true;

          let childNodes: DRENode[] = [];

          if (isGroup) {
            // Recursively build sub-tree
            childNodes = buildDynamicTree(conta.code, nivel + 1);
          }

          // If it's an analytic account (leaf), add fornecedor breakdown
          if (!isGroup) {
            childNodes = buildFornecedorNodes(conta.code, nivel + 1);
          }

          // Determine tipo based on level
          let tipo: DRENode['tipo'] = 'conta';
          if (nivel === 0) tipo = 'grupo';
          else if (isGroup) tipo = 'subgrupo';

          return {
            id: conta.code,
            codigo: conta.code,
            nome: conta.name,
            tipo,
            nivel,
            valor: vals.total,
            valores_mes: vals.valoresMes,
            children: childNodes.filter(c => c.valor > 0),
            lancamentosIds: vals.lancamentosIds,
            categoriaDre: conta.categoria_dre,
            isGroup,
            contaOrigem: {
              id: conta.id,
              codigo: conta.code,
              nome: conta.name,
              valor: vals.total,
              lancamentosIds: vals.lancamentosIds,
              categoriaDre: conta.categoria_dre,
              tipoDre: isGroup ? 'grupo' as const : 'conta' as const
            }
          };
        })
        .filter(n => n.valor > 0 || n.children.length > 0);
    };

    const result = buildDynamicTree(null, 0);

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

      // Group by fornecedor
      const fornMap = new Map<string, ContaPagar[]>();
      semClassificacao.forEach(l => {
        const key = l.fornecedor_nome || 'Sem fornecedor';
        if (!fornMap.has(key)) fornMap.set(key, []);
        fornMap.get(key)!.push(l);
      });

      const fornNodes = Array.from(fornMap.entries()).map(([nome, lancs]) => {
        const fValoresMes: Record<string, number> = {};
        meses.forEach(m => fValoresMes[m.key] = 0);
        lancs.forEach(l => {
          const mes = l.data_vencimento.substring(5, 7);
          fValoresMes[mes] = (fValoresMes[mes] || 0) + l.valor_original;
        });
        return {
          id: `sem_forn_${nome}`,
          codigo: '',
          nome,
          tipo: 'fornecedor' as const,
          nivel: 1,
          valor: lancs.reduce((s, l) => s + l.valor_original, 0),
          valores_mes: fValoresMes,
          children: lancs.map(l => ({
            id: l.id,
            codigo: '',
            nome: `${l.categoria_nome || 'Lançamento'} - ${new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
            tipo: 'lancamento' as const,
            nivel: 2,
            valor: l.valor_original,
            valores_mes: { [l.data_vencimento.substring(5, 7)]: l.valor_original },
            children: [],
            lancamentosIds: [l.id],
            conta: l
          })),
          lancamentosIds: lancs.map(l => l.id),
          contaOrigem: {
            id: `sem_forn_${nome}`,
            codigo: '',
            nome,
            valor: lancs.reduce((s, l) => s + l.valor_original, 0),
            lancamentosIds: lancs.map(l => l.id),
            tipoDre: 'fornecedor' as const
          }
        };
      }).sort((a, b) => b.valor - a.valor);

      result.push({
        id: 'SEM_CLASSIFICACAO',
        codigo: '',
        nome: '⚠️ SEM CLASSIFICAÇÃO',
        tipo: 'grupo',
        nivel: 0,
        valor: total,
        valores_mes: valoresMes,
        children: fornNodes,
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

  const renderRow = (node: DRENode, depth: number = 0, searchFilter?: string): React.ReactNode[] => {
    // If search filter is active, check if this node or any child matches
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      const matchesSelf = node.nome.toLowerCase().includes(term) || node.codigo.toLowerCase().includes(term);
      const hasMatchingChild = node.children.some(c => nodeMatchesSearch(c, term));
      if (!matchesSelf && !hasMatchingChild) return [];
    }

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
          'border-b border-border/50 transition-colors cursor-pointer group',
          getRowClasses()
        )}
        onClick={() => hasChildren ? toggleNode(node.id) : undefined}
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
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
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
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConta(node.conta!);
                          setEditarOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Editar classificação</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            
            {node.tipo === 'fornecedor' && (
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {node.children.length} lanç.
                </Badge>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFornecedor({
                            nome: node.nome,
                            lancamentosIds: node.lancamentosIds
                          });
                          setTransferirOpen(true);
                        }}
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Transferir fornecedor</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </td>

        {/* Valores por mês */}
        {meses.map((m, idx) => {
          const valor = node.valores_mes[m.key] || 0;
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
                {(node.tipo === 'grupo' || node.tipo === 'subgrupo') && valor > 0 && filterMes === 'all' && (
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

    // Render children if expanded (or if search is active, auto-expand matching paths)
    const shouldExpand = isExpanded || (searchFilter && searchFilter.length > 0);
    if (shouldExpand && hasChildren) {
      node.children.forEach(child => {
        rows.push(...renderRow(child, depth + 1, searchFilter));
      });
    }

    return rows;
  };

  // Helper to check if a node or its descendants match search
  const nodeMatchesSearch = (node: DRENode, term: string): boolean => {
    if (node.nome.toLowerCase().includes(term) || node.codigo.toLowerCase().includes(term)) return true;
    return node.children.some(c => nodeMatchesSearch(c, term));
  };

  const tableContent = (isFocus = false) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b-2 border-border">
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground border-r border-border/30 w-16">
              Código
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground border-r border-border/30 min-w-[250px]">
              DEMONSTRATIVO DE RESULTADOS
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
            <td className="px-2 py-2 border-r border-border/30">TOTAL GERAL</td>
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
  );

  return (
    <>
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
              <Button variant="outline" size="sm" onClick={() => setFocusOpen(true)} className="gap-2">
                <Maximize2 className="h-4 w-4" />
                Modo Foco
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {tableContent()}
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

      {/* Focus Mode Dialog */}
      <Dialog open={focusOpen} onOpenChange={setFocusOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Visão DRE - Modo Foco
              <Badge variant="secondary" className="ml-2">
                {lancamentos?.length?.toLocaleString('pt-BR')} lançamentos
              </Badge>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="gap-1">
                <ChevronsDown className="h-4 w-4" />
                Expandir
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1">
                <ChevronsRight className="h-4 w-4" />
                Recolher
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setFocusOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-background">
            {tableContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
