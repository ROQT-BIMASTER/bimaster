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
  Building2, 
  User, 
  Bot, 
  Lock, 
  FileText, 
  Pencil,
  ChevronsDown,
  ChevronsRight,
  AlertTriangle
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
  confianca_classificacao?: number | null;
}

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'grupo' | 'subgrupo' | 'conta' | 'departamento' | 'fornecedor' | 'lancamento';
  nivel: number;
  valor: number;
  valores_mes: Record<string, number>;
  children: DRENode[];
  lancamentosIds: string[];
  categoriaDre?: string | null;
  isGroup?: boolean;
  contaOrigem?: {
    id: string;
    codigo: string;
    nome: string;
    valor: number;
    lancamentosIds: string[];
    categoriaDre?: string | null;
    tipoDre?: 'conta' | 'grupo' | 'fornecedor' | 'departamento';
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

const CATEGORIAS_DRE = [
  { value: 'custo_vendas', label: 'Custo de Vendas', color: 'bg-red-500/10 text-red-700 border-red-300' },
  { value: 'despesas_variaveis', label: 'Custo Variável', color: 'bg-amber-500/10 text-amber-700 border-amber-300' },
  { value: 'despesas_fixas', label: 'Despesas Fixas', color: 'bg-blue-500/10 text-blue-700 border-blue-300' },
  { value: 'impostos_lucro', label: 'Impostos s/ Lucro', color: 'bg-purple-500/10 text-purple-700 border-purple-300' },
];

const getCategoriaLabel = (value: string | null | undefined) => {
  if (!value) return 'Não classificado';
  const cat = CATEGORIAS_DRE.find(c => c.value === value);
  return cat?.label || value;
};

const getCategoriaColor = (value: string | null | undefined) => {
  if (!value) return 'bg-muted text-muted-foreground';
  const cat = CATEGORIAS_DRE.find(c => c.value === value);
  return cat?.color || 'bg-muted text-muted-foreground';
};

export function ContasPagarDREView({ 
  filterAno, 
  filterMes, 
  filterEmpresas,
  filterDepartamento 
}: ContasPagarDREViewProps) {
  const queryClient = useQueryClient();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [reclassificarOpen, setReclassificarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DRENode | null>(null);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  const [selectedFornecedor, setSelectedFornecedor] = useState<{ nome: string; lancamentosIds: string[] } | null>(null);

  // Format functions - defined early to be used in useMemo
  const formatDate = useCallback((date: string) => {
    return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
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
      return [{ key: filterMes.padStart(2, '0'), label: new Date(2000, parseInt(filterMes) - 1).toLocaleString('pt-BR', { month: 'short' }) }];
    }
    return Array.from({ length: 12 }, (_, i) => ({
      key: String(i + 1).padStart(2, '0'),
      label: new Date(2000, i).toLocaleString('pt-BR', { month: 'short' })
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
        .select('id, code, name, account_type, categoria_dre, is_group, nivel')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return (data || []) as unknown as PlanoContas[];
    }
  });

  // Build hierarchical tree
  const hierarquia = useMemo(() => {
    if (!lancamentos || !planoContas) return [];

    const ano = filterAno === 'all' ? new Date().getFullYear() : parseInt(filterAno);

    // Group lancamentos by plano_contas_codigo
    const lancamentosPorConta: Record<string, ContaPagar[]> = {};
    lancamentos.forEach(l => {
      const codigo = l.plano_contas_codigo || 'SEM_CLASSIFICACAO';
      if (!lancamentosPorConta[codigo]) {
        lancamentosPorConta[codigo] = [];
      }
      lancamentosPorConta[codigo].push(l);
    });

    // Create account map for quick lookup
    const contaMap = new Map<string, PlanoContas>();
    planoContas.forEach(c => contaMap.set(c.code, c));

    // Get unique parent codes (groups)
    const grupos = new Set<string>();
    Object.keys(lancamentosPorConta).forEach(codigo => {
      if (codigo === 'SEM_CLASSIFICACAO') return;
      const parts = codigo.split('.');
      // Add all parent levels
      for (let i = 1; i < parts.length; i++) {
        grupos.add(parts.slice(0, i).join('.'));
      }
    });

    // Build tree function
    const buildNode = (codigo: string, nivel: number): DRENode | null => {
      const conta = contaMap.get(codigo);
      const lancamentosDaConta = lancamentosPorConta[codigo] || [];

      // Calculate monthly values
      const valoresMes: Record<string, number> = {};
      meses.forEach(m => valoresMes[m.key] = 0);

      lancamentosDaConta.forEach(l => {
        const mes = l.data_vencimento.substring(5, 7);
        valoresMes[mes] = (valoresMes[mes] || 0) + l.valor_original;
      });

      const valorTotal = lancamentosDaConta.reduce((sum, l) => sum + l.valor_original, 0);

      // Build children (by fornecedor)
      const fornecedoresMap = new Map<string, ContaPagar[]>();
      lancamentosDaConta.forEach(l => {
        const key = l.fornecedor_nome || 'Sem fornecedor';
        if (!fornecedoresMap.has(key)) {
          fornecedoresMap.set(key, []);
        }
        fornecedoresMap.get(key)!.push(l);
      });

      const fornecedorNodes: DRENode[] = Array.from(fornecedoresMap.entries())
        .map(([nome, lancs]) => {
          const valoresMesForn: Record<string, number> = {};
          meses.forEach(m => valoresMesForn[m.key] = 0);
          lancs.forEach(l => {
            const mes = l.data_vencimento.substring(5, 7);
            valoresMesForn[mes] = (valoresMesForn[mes] || 0) + l.valor_original;
          });

          const lancamentoNodes: DRENode[] = lancs.map(l => ({
            id: l.id,
            codigo: '',
            nome: `${l.categoria_nome} - ${formatDate(l.data_vencimento)}`,
            tipo: 'lancamento' as const,
            nivel: nivel + 2,
            valor: l.valor_original,
            valores_mes: { [l.data_vencimento.substring(5, 7)]: l.valor_original },
            children: [],
            lancamentosIds: [l.id],
            conta: l
          }));

          return {
            id: `forn_${codigo}_${nome}`,
            codigo: '',
            nome,
            tipo: 'fornecedor' as const,
            nivel: nivel + 1,
            valor: lancs.reduce((s, l) => s + l.valor_original, 0),
            valores_mes: valoresMesForn,
            children: lancamentoNodes,
            lancamentosIds: lancs.map(l => l.id),
            contaOrigem: {
              id: `forn_${codigo}_${nome}`,
              codigo: codigo,
              nome,
              valor: lancs.reduce((s, l) => s + l.valor_original, 0),
              lancamentosIds: lancs.map(l => l.id),
              categoriaDre: conta?.categoria_dre,
              tipoDre: 'fornecedor' as const
            }
          };
        })
        .sort((a, b) => b.valor - a.valor);

      if (valorTotal === 0 && fornecedorNodes.length === 0) return null;

      return {
        id: codigo,
        codigo,
        nome: conta?.name || codigo,
        tipo: conta?.is_group ? 'grupo' : 'conta',
        nivel,
        valor: valorTotal,
        valores_mes: valoresMes,
        children: fornecedorNodes,
        lancamentosIds: lancamentosDaConta.map(l => l.id),
        categoriaDre: conta?.categoria_dre,
        isGroup: conta?.is_group,
        contaOrigem: conta ? {
          id: conta.id,
          codigo: conta.code,
          nome: conta.name,
          valor: valorTotal,
          lancamentosIds: lancamentosDaConta.map(l => l.id),
          categoriaDre: conta.categoria_dre,
          tipoDre: (conta.is_group ? 'grupo' : 'conta') as 'grupo' | 'conta'
        } : undefined
      };
    };

    // Build tree by category
    const result: DRENode[] = [];

    CATEGORIAS_DRE.forEach(cat => {
      const contasCategoria = planoContas.filter(c => c.categoria_dre === cat.value);
      const nodes: DRENode[] = [];

      contasCategoria.forEach(c => {
        const node = buildNode(c.code, 1);
        if (node) nodes.push(node);
      });

      if (nodes.length > 0) {
        const valoresMesCat: Record<string, number> = {};
        meses.forEach(m => valoresMesCat[m.key] = 0);
        nodes.forEach(n => {
          Object.entries(n.valores_mes).forEach(([k, v]) => {
            valoresMesCat[k] = (valoresMesCat[k] || 0) + v;
          });
        });

        result.push({
          id: cat.value,
          codigo: '',
          nome: cat.label,
          tipo: 'grupo',
          nivel: 0,
          valor: nodes.reduce((s, n) => s + n.valor, 0),
          valores_mes: valoresMesCat,
          children: nodes.sort((a, b) => b.valor - a.valor),
          lancamentosIds: nodes.flatMap(n => n.lancamentosIds),
          categoriaDre: cat.value,
          isGroup: true
        });
      }
    });

    // Add unclassified
    const semClassificacao = lancamentosPorConta['SEM_CLASSIFICACAO'];
    if (semClassificacao && semClassificacao.length > 0) {
      const valoresMes: Record<string, number> = {};
      meses.forEach(m => valoresMes[m.key] = 0);
      semClassificacao.forEach(l => {
        const mes = l.data_vencimento.substring(5, 7);
        valoresMes[mes] = (valoresMes[mes] || 0) + l.valor_original;
      });

      result.push({
        id: 'SEM_CLASSIFICACAO',
        codigo: '',
        nome: '⚠️ Sem Classificação',
        tipo: 'grupo',
        nivel: 0,
        valor: semClassificacao.reduce((s, l) => s + l.valor_original, 0),
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
    }

    return result;
  }, [lancamentos, planoContas, meses, filterAno]);

  // Calculate totals
  const totais = useMemo(() => {
    const valoresMes: Record<string, number> = {};
    meses.forEach(m => valoresMes[m.key] = 0);
    let total = 0;

    hierarquia.forEach(cat => {
      total += cat.valor;
      Object.entries(cat.valores_mes).forEach(([k, v]) => {
        valoresMes[k] = (valoresMes[k] || 0) + v;
      });
    });

    return { total, valoresMes };
  }, [hierarquia, meses]);

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
    setExpandedNodes(new Set());
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
    } else if ((node.tipo === 'conta' || node.tipo === 'grupo') && node.contaOrigem) {
      e.stopPropagation();
      setSelectedNode(node);
      setReclassificarOpen(true);
    }
  };


  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-table'] });
    setReclassificarOpen(false);
    setEditarOpen(false);
    setTransferirOpen(false);
    setSelectedNode(null);
    setSelectedConta(null);
    setSelectedFornecedor(null);
  };

  const renderNode = (node: DRENode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const paddingLeft = depth * 24 + 8;

    const getRowStyle = () => {
      switch (node.tipo) {
        case 'grupo':
          return 'bg-muted/50 font-semibold hover:bg-muted/70';
        case 'conta':
          return 'bg-background hover:bg-muted/30 font-medium';
        case 'fornecedor':
          return 'bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20';
        case 'lancamento':
          return 'bg-background hover:bg-muted/20 text-muted-foreground text-sm';
        default:
          return 'hover:bg-muted/30';
      }
    };

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center border-b cursor-pointer transition-colors",
            getRowStyle()
          )}
          onClick={(e) => {
            if (hasChildren) {
              toggleNode(node.id);
            } else {
              handleNodeClick(node, e);
            }
          }}
        >
          {/* Description column */}
          <div 
            className="flex-1 min-w-[300px] flex items-center py-2 px-2"
            style={{ paddingLeft }}
          >
            {hasChildren ? (
              <button className="mr-2 p-0.5 hover:bg-muted rounded">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-6" />
            )}

            {node.tipo === 'fornecedor' && <User className="h-4 w-4 mr-2 text-amber-600" />}
            {node.tipo === 'departamento' && <Building2 className="h-4 w-4 mr-2 text-blue-600" />}
            {node.tipo === 'lancamento' && <FileText className="h-4 w-4 mr-2 text-muted-foreground" />}

            {node.codigo && (
              <Badge variant="outline" className="mr-2 font-mono text-xs">
                {node.codigo}
              </Badge>
            )}
            <span className="truncate">{node.nome}</span>

            {node.tipo === 'lancamento' && node.conta && (
              <div className="ml-2 flex items-center gap-1">
                {node.conta.classificado_automaticamente && !node.conta.classificacao_manual && (
                  <Bot className="h-3 w-3 text-primary" />
                )}
                {node.conta.classificacao_manual && (
                  <Lock className="h-3 w-3 text-primary" />
                )}
              </div>
            )}

            {node.tipo === 'fornecedor' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 ml-2 opacity-50 hover:opacity-100"
                onClick={(e) => handleNodeClick(node, e)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Monthly values */}
          {meses.map(m => (
            <div key={m.key} className="w-[90px] text-right py-2 px-2 text-sm">
              {node.valores_mes[m.key] > 0 ? formatCurrency(node.valores_mes[m.key]) : '-'}
            </div>
          ))}

          {/* Total */}
          <div className="w-[100px] text-right py-2 px-2 font-medium">
            {formatCurrency(node.valor)}
          </div>

          {/* AV% */}
          <div className="w-[70px] text-right py-2 px-2 text-sm text-muted-foreground">
            {totais.total > 0 ? ((node.valor / totais.total) * 100).toFixed(1) + '%' : '-'}
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = isLoadingLancamentos || isLoadingPlano;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            <ChevronsDown className="h-4 w-4 mr-1" />
            Expandir Todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <ChevronsRight className="h-4 w-4 mr-1" />
            Recolher
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-blue-500" />
            <span>IA</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-green-600" />
            <span>Bloqueado</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Sem classificação</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center bg-muted/80 border-b font-medium sticky top-0 z-10">
            <div className="flex-1 min-w-[300px] py-3 px-4">Descrição</div>
            {meses.map(m => (
              <div key={m.key} className="w-[90px] text-right py-3 px-2 uppercase text-xs">
                {m.label}
              </div>
            ))}
            <div className="w-[100px] text-right py-3 px-2">TOTAL</div>
            <div className="w-[70px] text-right py-3 px-2 text-xs">AV%</div>
          </div>

          {/* Body */}
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : hierarquia.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum lançamento encontrado para o período selecionado.
              </div>
            ) : (
              <>
                {hierarquia.map(node => renderNode(node))}
                
                {/* Total row */}
                <div className="flex items-center bg-primary/10 border-t-2 font-bold sticky bottom-0">
                  <div className="flex-1 min-w-[300px] py-3 px-4">TOTAL DESPESAS</div>
                  {meses.map(m => (
                    <div key={m.key} className="w-[90px] text-right py-3 px-2">
                      {formatCurrency(totais.valoresMes[m.key] || 0)}
                    </div>
                  ))}
                  <div className="w-[100px] text-right py-3 px-2">
                    {formatCurrency(totais.total)}
                  </div>
                  <div className="w-[70px] text-right py-3 px-2">100%</div>
                </div>
              </>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedNode?.contaOrigem && (
        <ReclassificarContaDREDialog
          open={reclassificarOpen}
          onOpenChange={setReclassificarOpen}
          contaOrigem={selectedNode.contaOrigem}
          onSuccess={handleSuccess}
        />
      )}

      {selectedConta && (
        <EditarClassificacaoRapidaDialog
          open={editarOpen}
          onOpenChange={setEditarOpen}
          conta={selectedConta as any}
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
    </div>
  );
}
