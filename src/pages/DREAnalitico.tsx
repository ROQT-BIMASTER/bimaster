import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, FileDown, Calendar, TrendingUp, TrendingDown, Building2, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

interface DRENode {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'grupo' | 'conta' | 'departamento' | 'lancamento';
  nivel: number;
  valor: number;
  natureza: 'D' | 'C';
  accountType: string;
  children?: DRENode[];
  metadata?: any;
}

export default function DREAnalitico() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes');
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visaoAtiva, setVisaoAtiva] = useState<'contas' | 'departamentos'>('contas');

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
        setDataFim(format(endOfYear(hoje), 'yyyy-MM-dd'));
        break;
    }
  };

  // Buscar estrutura do plano de contas (TODOS OS TIPOS)
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

  // Buscar total de contas no banco
  const { data: totalContas } = useQuery({
    queryKey: ['total-contas'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contas_pagar')
        .select('*', { count: 'exact', head: true })
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Buscar lançamentos do período
  const { data: lancamentos, isLoading } = useSupabaseQuery(
    ['lancamentos-dre', dataInicio, dataFim],
    async () => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select(`
          *,
          departamento:departamentos(id, nome)
        `)
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);
      
      if (error) throw error;
      return data;
    },
    {
      staleTime: 0, // Sempre buscar dados frescos
      refetchOnMount: true // Refetch quando montar a página
    }
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

  // Construir hierarquia DRE
  const construirHierarquiaDRE = (): DRENode[] => {
    if (!planoContas || !lancamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));

    // Agrupar por tipo (receita/despesa/custo/ativo/passivo)
    const receitas: DRENode = {
      id: 'receitas',
      codigo: '4',
      nome: 'RECEITAS',
      tipo: 'grupo',
      nivel: 1,
      valor: 0,
      natureza: 'C',
      accountType: 'revenue',
      children: []
    };

    const despesas: DRENode = {
      id: 'despesas',
      codigo: '5',
      nome: 'DESPESAS OPERACIONAIS',
      tipo: 'grupo',
      nivel: 1,
      valor: 0,
      natureza: 'D',
      accountType: 'expense',
      children: []
    };

    const custos: DRENode = {
      id: 'custos',
      codigo: '6',
      nome: 'CUSTOS E CENTROS DE CUSTO',
      tipo: 'grupo',
      nivel: 1,
      valor: 0,
      natureza: 'D',
      accountType: 'cost_center',
      children: []
    };

    const patrimoniais: DRENode = {
      id: 'patrimoniais',
      codigo: '7',
      nome: 'MOVIMENTAÇÕES PATRIMONIAIS',
      tipo: 'grupo',
      nivel: 1,
      valor: 0,
      natureza: 'D',
      accountType: 'asset',
      children: []
    };

    // Grupo para lançamentos não classificados
    const naoClassificados: DRENode = {
      id: 'nao-classificados',
      codigo: '9',
      nome: 'NÃO CLASSIFICADOS',
      tipo: 'grupo',
      nivel: 1,
      valor: 0,
      natureza: 'D',
      accountType: 'expense',
      children: []
    };

    // Processar lançamentos
    lancamentos.forEach(lancamento => {
      const valor = parseFloat(String(lancamento.valor_pago || lancamento.valor_original || 0));
      
      // Se não tem plano de contas, vai para "Não Classificados"
      if (!lancamento.plano_contas_id) {
        naoClassificados.valor += valor;
        
        // Agrupar por categoria
        let nodoCategoria = naoClassificados.children?.find(
          c => c.nome === (lancamento.categoria_nome || 'Sem Categoria')
        );
        
        if (!nodoCategoria) {
          nodoCategoria = {
            id: `cat-${lancamento.categoria_nome || 'sem'}`,
            codigo: '',
            nome: lancamento.categoria_nome || 'Sem Categoria',
            tipo: 'conta',
            nivel: 2,
            valor: 0,
            natureza: 'D',
            accountType: 'expense',
            children: []
          };
          naoClassificados.children?.push(nodoCategoria);
        }
        
        nodoCategoria.valor += valor;

        // Adicionar lançamento individual
        nodoCategoria.children?.push({
          id: lancamento.id,
          codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${format(new Date(lancamento.data_vencimento), 'dd/MM/yyyy')}`,
          tipo: 'lancamento',
          nivel: 5,
          valor: valor,
          natureza: 'D',
          accountType: 'expense',
          metadata: lancamento
        });
        
        return; // Próximo lançamento
      }

      const conta = contasMap.get(lancamento.plano_contas_id);
      if (!conta) return;

      // Determinar grupo raiz baseado no tipo de conta
      let grupoRaiz: DRENode;
      if (conta.account_type === 'revenue') {
        grupoRaiz = receitas;
      } else if (conta.account_type === 'cost_center' || conta.account_type === 'budget') {
        grupoRaiz = custos;
      } else if (conta.account_type === 'asset' || conta.account_type === 'liability') {
        grupoRaiz = patrimoniais;
      } else {
        grupoRaiz = despesas; // expense e outros
      }

      // Encontrar ou criar nó da conta
      let nodoConta = grupoRaiz.children?.find(c => c.id === conta.id);
      if (!nodoConta) {
        nodoConta = {
          id: conta.id,
          codigo: conta.code,
          nome: conta.name,
          tipo: 'conta',
          nivel: conta.nivel,
          valor: 0,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          children: [],
          metadata: conta
        };
        grupoRaiz.children?.push(nodoConta);
      }

      // Adicionar ao valor da conta
      nodoConta.valor += valor;
      grupoRaiz.valor += valor;

      // Agrupar por departamento se existir
      if (lancamento.departamento_id) {
        let nodoDept = nodoConta.children?.find(d => d.id === lancamento.departamento_id);
        if (!nodoDept) {
          const dept = departamentos?.find(d => d.id === lancamento.departamento_id);
          nodoDept = {
            id: lancamento.departamento_id,
            codigo: '',
            nome: dept?.nome || 'Sem Departamento',
            tipo: 'departamento',
            nivel: 4,
            valor: 0,
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type,
            children: []
          };
          nodoConta.children?.push(nodoDept);
        }
        
        nodoDept.valor += valor;

        // Adicionar lançamento individual
        nodoDept.children?.push({
          id: lancamento.id,
          codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${lancamento.categoria_nome || 'Sem categoria'}`,
          tipo: 'lancamento',
          nivel: 5,
          valor: valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          metadata: lancamento
        });
      } else {
        // Lançamento sem departamento
        nodoConta.children?.push({
          id: lancamento.id,
          codigo: lancamento.numero_documento || '',
          nome: `${lancamento.fornecedor_nome || 'N/A'} - ${lancamento.categoria_nome || 'Sem categoria'}`,
          tipo: 'lancamento',
          nivel: 5,
          valor: valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          metadata: lancamento
        });
      }
    });

    // Ordenar hierarquia
    const ordenarNos = (nos: DRENode[]) => {
      nos.sort((a, b) => a.codigo.localeCompare(b.codigo));
      nos.forEach(no => {
        if (no.children) ordenarNos(no.children);
      });
    };

    if (receitas.children) ordenarNos(receitas.children);
    if (despesas.children) ordenarNos(despesas.children);
    if (custos.children) ordenarNos(custos.children);
    if (patrimoniais.children) ordenarNos(patrimoniais.children);
    if (naoClassificados.children) ordenarNos(naoClassificados.children);

    // Montar árvore na ordem correta
    arvore.push(receitas);
    
    if (despesas.valor > 0) arvore.push(despesas);
    if (custos.valor > 0) arvore.push(custos);
    if (patrimoniais.valor > 0) arvore.push(patrimoniais);
    
    // Adicionar não classificados se houver
    if (naoClassificados.valor > 0) {
      arvore.push(naoClassificados);
    }

    // Adicionar linha de resultado (incluir todos os débitos no cálculo)
    const totalDespesasCompleto = despesas.valor + custos.valor + patrimoniais.valor + naoClassificados.valor;
    arvore.push({
      id: 'resultado',
      codigo: '',
      nome: 'RESULTADO DO PERÍODO',
      tipo: 'grupo',
      nivel: 1,
      valor: receitas.valor - totalDespesasCompleto,
      natureza: 'C',
      accountType: 'revenue'
    });

    return arvore;
  };

  const hierarquia = construirHierarquiaDRE();

  // Construir hierarquia por departamento
  const construirHierarquiaPorDepartamento = (): DRENode[] => {
    if (!planoContas || !lancamentos || !departamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));
    const deptsMap = new Map(departamentos.map(d => [d.id, d]));

    // Agrupar lançamentos por departamento
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

    // Criar nó para cada departamento
    lancamentosPorDept.forEach((lancsDept, deptId) => {
      const dept = deptsMap.get(deptId);
      if (!dept) return;

      const nodoDept: DRENode = {
        id: deptId,
        codigo: '',
        nome: dept.nome,
        tipo: 'departamento',
        nivel: 1,
        valor: 0,
        natureza: 'D',
        accountType: 'expense',
        children: []
      };

      // Agrupar por tipo de conta dentro do departamento
      const grupos = new Map<string, DRENode>();

      lancsDept.forEach(lanc => {
        const valor = parseFloat(String(lanc.valor_pago || lanc.valor_original || 0));
        nodoDept.valor += valor;

        if (!lanc.plano_contas_id) return;

        const conta = contasMap.get(lanc.plano_contas_id);
        if (!conta) return;

        // Determinar grupo (Receitas, Despesas, Custos, etc)
        let grupoNome = 'Despesas';
        let grupoId = 'despesas';
        if (conta.account_type === 'revenue') {
          grupoNome = 'Receitas';
          grupoId = 'receitas';
        } else if (conta.account_type === 'cost_center' || conta.account_type === 'budget') {
          grupoNome = 'Custos';
          grupoId = 'custos';
        } else if (conta.account_type === 'asset' || conta.account_type === 'liability') {
          grupoNome = 'Patrimoniais';
          grupoId = 'patrimoniais';
        }

        const grupoKey = `${deptId}-${grupoId}`;
        
        if (!grupos.has(grupoKey)) {
          grupos.set(grupoKey, {
            id: grupoKey,
            codigo: '',
            nome: grupoNome,
            tipo: 'grupo',
            nivel: 2,
            valor: 0,
            natureza: conta.account_type === 'revenue' ? 'C' : 'D',
            accountType: conta.account_type,
            children: []
          });
        }

        const grupo = grupos.get(grupoKey)!;
        grupo.valor += valor;

        // Adicionar conta
        let nodoConta = grupo.children?.find(c => c.id === conta.id);
        if (!nodoConta) {
          nodoConta = {
            id: `${grupoKey}-${conta.id}`,
            codigo: conta.code,
            nome: conta.name,
            tipo: 'conta',
            nivel: 3,
            valor: 0,
            natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
            accountType: conta.account_type,
            children: [],
            metadata: conta
          };
          grupo.children?.push(nodoConta);
        }

        nodoConta.valor += valor;

        // Adicionar lançamento individual
        nodoConta.children?.push({
          id: `${grupoKey}-${conta.id}-${lanc.id}`,
          codigo: lanc.numero_documento || '',
          nome: `${lanc.fornecedor_nome || 'N/A'} - ${lanc.categoria_nome || 'Sem categoria'}`,
          tipo: 'lancamento',
          nivel: 4,
          valor: valor,
          natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
          accountType: conta.account_type,
          metadata: lanc
        });
      });

      // Adicionar grupos ao departamento
      nodoDept.children = Array.from(grupos.values());
      arvore.push(nodoDept);
    });

    // Adicionar lançamentos sem departamento
    if (lancamentosSemDept.length > 0) {
      const nodoSemDept: DRENode = {
        id: 'sem-departamento',
        codigo: '',
        nome: 'SEM DEPARTAMENTO',
        tipo: 'departamento',
        nivel: 1,
        valor: 0,
        natureza: 'D',
        accountType: 'expense',
        children: []
      };

      lancamentosSemDept.forEach(lanc => {
        const valor = parseFloat(String(lanc.valor_pago || lanc.valor_original || 0));
        nodoSemDept.valor += valor;

        if (lanc.plano_contas_id) {
          const conta = contasMap.get(lanc.plano_contas_id);
          if (conta) {
            nodoSemDept.children?.push({
              id: `sem-dept-${lanc.id}`,
              codigo: conta.code,
              nome: `${conta.name} - ${lanc.fornecedor_nome || 'N/A'}`,
              tipo: 'lancamento',
              nivel: 2,
              valor: valor,
              natureza: (conta.natureza === 'C' ? 'C' : 'D') as 'C' | 'D',
              accountType: conta.account_type,
              metadata: lanc
            });
          }
        }
      });

      arvore.push(nodoSemDept);
    }

    // Ordenar departamentos por valor
    arvore.sort((a, b) => b.valor - a.valor);

    return arvore;
  };

  const hierarquiaDepartamentos = construirHierarquiaPorDepartamento();

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: DRENode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const paddingLeft = level * 24;

    const getRowStyle = () => {
      if (node.tipo === 'grupo' && level === 1) return 'bg-primary/10 font-bold text-lg';
      if (node.tipo === 'conta') return 'bg-muted/50 font-semibold';
      if (node.tipo === 'departamento') return 'bg-accent/30';
      return 'hover:bg-accent/20';
    };

    const formatarValor = (valor: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(Math.abs(valor));
    };

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-2 px-4 border-b transition-colors ${getRowStyle()}`}
          style={{ paddingLeft: `${paddingLeft + 16}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleNode(node.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {!hasChildren && <div className="w-6" />}
            
            {node.codigo && (
              <span className="font-mono text-sm text-muted-foreground min-w-[80px]">
                {node.codigo}
              </span>
            )}
            
            <span className={node.tipo === 'lancamento' ? 'text-sm' : ''}>
              {node.nome}
            </span>

            {node.id === 'nao-classificados' && (
              <Badge variant="destructive" className="ml-2">
                Pendente de Classificação
              </Badge>
            )}

            {node.tipo === 'lancamento' && node.metadata && (
              <Badge variant="outline" className="ml-2 text-xs">
                {format(new Date(node.metadata.data_vencimento), 'dd/MM/yyyy')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 min-w-[200px] justify-end">
            {node.accountType === 'revenue' ? (
              <span className="font-mono text-green-600 font-semibold">
                {formatarValor(node.valor)}
              </span>
            ) : node.accountType === 'expense' || node.accountType === 'cost_center' || node.accountType === 'budget' ? (
              <span className="font-mono text-red-600 font-semibold">
                ({formatarValor(node.valor)})
              </span>
            ) : node.accountType === 'asset' || node.accountType === 'liability' ? (
              <span className="font-mono text-blue-600 font-semibold">
                ({formatarValor(node.valor)})
              </span>
            ) : (
              <span className={`font-mono font-bold ${node.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {node.valor >= 0 ? formatarValor(node.valor) : `(${formatarValor(node.valor)})`}
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const exportarExcel = () => {
    const flattenData = (nodes: DRENode[], parentCode: string = ''): any[] => {
      const result: any[] = [];
      
      nodes.forEach(node => {
        result.push({
          'Código': node.codigo,
          'Descrição': node.nome,
          'Tipo': node.tipo,
          'Valor': node.valor,
          'Natureza': node.accountType === 'revenue' ? 'Receita' : 
                     node.accountType === 'expense' ? 'Despesa' :
                     node.accountType === 'cost_center' ? 'Custo' :
                     node.accountType === 'budget' ? 'Orçamento' :
                     node.accountType === 'asset' ? 'Ativo' :
                     node.accountType === 'liability' ? 'Passivo' : 'Resultado'
        });

        if (node.children) {
          result.push(...flattenData(node.children, node.codigo));
        }
      });

      return result;
    };

    const data = flattenData(hierarquia);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DRE");
    
    const fileName = `DRE_${format(new Date(dataInicio), 'dd-MM-yyyy')}_a_${format(new Date(dataFim), 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success("Relatório exportado com sucesso!");
  };

  const totalReceitas = hierarquia.find(h => h.id === 'receitas')?.valor || 0;
  const totalDespesas = hierarquia.find(h => h.id === 'despesas')?.valor || 0;
  const totalCustos = hierarquia.find(h => h.id === 'custos')?.valor || 0;
  const totalPatrimoniais = hierarquia.find(h => h.id === 'patrimoniais')?.valor || 0;
  const totalNaoClassificados = hierarquia.find(h => h.id === 'nao-classificados')?.valor || 0;
  const resultado = totalReceitas - totalDespesas - totalCustos - totalPatrimoniais - totalNaoClassificados;

  const totalContasNaDRE = lancamentos?.length || 0;
  const percentualClassificado = totalContas ? ((totalContasNaDRE - (hierarquia.find(h => h.id === 'nao-classificados')?.children?.length || 0)) / totalContas * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">DRE Analítico</h1>
            <p className="text-muted-foreground mt-1">
              Demonstrativo de Resultado com drill-down completo
            </p>
          </div>
          <Button onClick={exportarExcel} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        {/* Indicadores de Classificação */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContas || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Contas no período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Classificadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalContasNaDRE - (hierarquia.find(h => h.id === 'nao-classificados')?.children?.length || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {percentualClassificado.toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Não Classificadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {hierarquia.find(h => h.id === 'nao-classificados')?.children?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pendentes de classificação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resultado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {resultado >= 0 ? 'Lucro' : 'Prejuízo'} do período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período de Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Tipo de Período</Label>
                <Select value={periodo} onValueChange={(v: any) => handlePeriodoChange(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Mês</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="ano">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={() => {
                    setExpandedNodes(new Set(['receitas', 'despesas', 'custos', 'patrimoniais']));
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Expandir Principais
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo por Categoria */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCustos)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Patrimoniais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPatrimoniais)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Não Classificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-orange-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalNaoClassificados)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela DRE com Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Demonstrativo de Resultado do Exercício</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={visaoAtiva} onValueChange={(v) => setVisaoAtiva(v as 'contas' | 'departamentos')}>
              <div className="border-b px-4 pt-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="contas" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Visão por Contas
                  </TabsTrigger>
                  <TabsTrigger value="departamentos" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Visão por Departamentos
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="contas" className="mt-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Carregando dados...
                  </div>
                ) : hierarquia.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum lançamento encontrado no período selecionado
                  </div>
                ) : (
                  <div className="border-t">
                    {hierarquia.map(node => renderNode(node))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="departamentos" className="mt-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Carregando dados...
                  </div>
                ) : hierarquiaDepartamentos.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum lançamento encontrado no período selecionado
                  </div>
                ) : (
                  <div className="border-t">
                    {hierarquiaDepartamentos.map(node => renderNode(node))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
