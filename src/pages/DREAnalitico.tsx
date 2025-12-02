import { useState, useMemo } from "react";
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
import { ChevronRight, ChevronDown, FileDown, Calendar, TrendingUp, TrendingDown, Building2, FileText, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths, subYears, parseISO, getMonth, getYear } from "date-fns";
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

export default function DREAnalitico() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('ano');
  const [dataInicio, setDataInicio] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [visaoAtiva, setVisaoAtiva] = useState<'contas' | 'departamentos'>('contas');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todas');

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

  // Buscar total de contas no banco
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
    ['lancamentos-dre', dataInicio, dataFim, filterEmpresa],
    async () => {
      let query = supabase
        .from('contas_pagar')
        .select(`
          *,
          departamento:departamentos(id, nome)
        `)
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim);
      
      if (filterEmpresa !== 'todas') {
        query = query.eq('empresa_nome', filterEmpresa);
      }
      
      const { data, error } = await query;
      if (error) throw error;
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
        .select('*')
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

  // Calcular valores por mês para um conjunto de lançamentos
  const calcularValoresPorMes = (lancs: any[]): { [mes: string]: number } => {
    const valores: { [mes: string]: number } = {};
    mesesPeriodo.forEach(m => valores[m.key] = 0);
    
    lancs.forEach(l => {
      const dataVenc = l.data_vencimento;
      if (dataVenc) {
        const mesKey = format(parseISO(dataVenc), 'yyyy-MM');
        if (valores[mesKey] !== undefined) {
          valores[mesKey] += parseFloat(String(l.valor_pago || l.valor_original || 0));
        }
      }
    });
    
    return valores;
  };

  // Calcular MoM (Month over Month) %
  const calcularMoM = (valoresMensais: { [mes: string]: number }): number | null => {
    const keys = Object.keys(valoresMensais).sort();
    if (keys.length < 2) return null;
    
    const mesAtual = valoresMensais[keys[keys.length - 1]];
    const mesAnterior = valoresMensais[keys[keys.length - 2]];
    
    if (mesAnterior === 0) return mesAtual > 0 ? 100 : 0;
    return ((mesAtual - mesAnterior) / Math.abs(mesAnterior)) * 100;
  };

  // Calcular YoY (Year over Year) %
  const calcularYoY = (valorAtual: number, valorAnoAnterior: number): number | null => {
    if (valorAnoAnterior === 0) return valorAtual > 0 ? 100 : 0;
    return ((valorAtual - valorAnoAnterior) / Math.abs(valorAnoAnterior)) * 100;
  };

  // Construir hierarquia DRE com valores mensais
  const construirHierarquiaDRE = (): DRENode[] => {
    if (!planoContas || !lancamentos) return [];

    const arvore: DRENode[] = [];
    const contasMap = new Map(planoContas.map(c => [c.id, c]));

    // Grupos principais
    const receitas: DRENode = {
      id: 'receitas', codigo: '4', nome: 'RECEITAS', tipo: 'grupo', nivel: 1,
      valor: 0, valoresMensais: {}, natureza: 'C', accountType: 'revenue', children: []
    };
    mesesPeriodo.forEach(m => receitas.valoresMensais![m.key] = 0);

    const despesas: DRENode = {
      id: 'despesas', codigo: '5', nome: 'DESPESAS OPERACIONAIS', tipo: 'grupo', nivel: 1,
      valor: 0, valoresMensais: {}, natureza: 'D', accountType: 'expense', children: []
    };
    mesesPeriodo.forEach(m => despesas.valoresMensais![m.key] = 0);

    const custos: DRENode = {
      id: 'custos', codigo: '6', nome: 'CUSTOS E CENTROS DE CUSTO', tipo: 'grupo', nivel: 1,
      valor: 0, valoresMensais: {}, natureza: 'D', accountType: 'cost_center', children: []
    };
    mesesPeriodo.forEach(m => custos.valoresMensais![m.key] = 0);

    const patrimoniais: DRENode = {
      id: 'patrimoniais', codigo: '7', nome: 'MOVIMENTAÇÕES PATRIMONIAIS', tipo: 'grupo', nivel: 1,
      valor: 0, valoresMensais: {}, natureza: 'D', accountType: 'asset', children: []
    };
    mesesPeriodo.forEach(m => patrimoniais.valoresMensais![m.key] = 0);

    const naoClassificados: DRENode = {
      id: 'nao-classificados', codigo: '9', nome: 'NÃO CLASSIFICADOS', tipo: 'grupo', nivel: 1,
      valor: 0, valoresMensais: {}, natureza: 'D', accountType: 'expense', children: []
    };
    mesesPeriodo.forEach(m => naoClassificados.valoresMensais![m.key] = 0);

    // Processar lançamentos
    lancamentos.forEach(lancamento => {
      const valor = parseFloat(String(lancamento.valor_pago || lancamento.valor_original || 0));
      const mesKey = lancamento.data_vencimento ? format(parseISO(lancamento.data_vencimento), 'yyyy-MM') : null;
      
      // Se não tem plano de contas
      if (!lancamento.plano_contas_id) {
        naoClassificados.valor += valor;
        if (mesKey && naoClassificados.valoresMensais![mesKey] !== undefined) {
          naoClassificados.valoresMensais![mesKey] += valor;
        }
        
        let nodoCategoria = naoClassificados.children?.find(
          c => c.nome === (lancamento.categoria_nome || 'Sem Categoria')
        );
        
        if (!nodoCategoria) {
          nodoCategoria = {
            id: `cat-${lancamento.categoria_nome || 'sem'}`,
            codigo: '', nome: lancamento.categoria_nome || 'Sem Categoria',
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

      // Agrupar por departamento
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
      }
    });

    // Ordenar hierarquia
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

    // Resultado
    const totalDespesasCompleto = despesas.valor + custos.valor + patrimoniais.valor + naoClassificados.valor;
    const resultadoValoresMensais: { [mes: string]: number } = {};
    mesesPeriodo.forEach(m => {
      const recMes = receitas.valoresMensais![m.key] || 0;
      const despMes = (despesas.valoresMensais![m.key] || 0) + 
                      (custos.valoresMensais![m.key] || 0) + 
                      (patrimoniais.valoresMensais![m.key] || 0) + 
                      (naoClassificados.valoresMensais![m.key] || 0);
      resultadoValoresMensais[m.key] = recMes - despMes;
    });

    arvore.push({
      id: 'resultado', codigo: '', nome: 'RESULTADO DO PERÍODO',
      tipo: 'grupo', nivel: 1, valor: receitas.valor - totalDespesasCompleto,
      valoresMensais: resultadoValoresMensais, natureza: 'C', accountType: 'revenue'
    });

    return arvore;
  };

  const hierarquia = construirHierarquiaDRE();

  // Calcular totais ano anterior para YoY
  const totaisAnoAnterior = useMemo(() => {
    if (!lancamentosAnoAnterior) return { receitas: 0, despesas: 0, custos: 0, patrimoniais: 0 };
    
    const totais = { receitas: 0, despesas: 0, custos: 0, patrimoniais: 0 };
    lancamentosAnoAnterior.forEach(l => {
      const valor = parseFloat(String(l.valor_pago || l.valor_original || 0));
      // Simplificação: consideramos tudo como despesa se não tem plano de contas
      totais.despesas += valor;
    });
    return totais;
  }, [lancamentosAnoAnterior]);

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedNodes(newExpanded);
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(Math.abs(valor));
  };

  const formatarVariacao = (variacao: number | null) => {
    if (variacao === null) return '-';
    const sinal = variacao > 0 ? '+' : '';
    return `${sinal}${variacao.toFixed(1)}%`;
  };

  const renderVariacaoIcon = (variacao: number | null, isExpense: boolean = false) => {
    if (variacao === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    
    // Para despesas, aumento é ruim (vermelho), diminuição é bom (verde)
    // Para receitas, aumento é bom (verde), diminuição é ruim (vermelho)
    const isPositive = variacao > 0;
    const isGood = isExpense ? !isPositive : isPositive;
    
    if (isPositive) {
      return <ArrowUp className={`h-3 w-3 ${isGood ? 'text-green-600' : 'text-red-600'}`} />;
    } else if (variacao < 0) {
      return <ArrowDown className={`h-3 w-3 ${isGood ? 'text-green-600' : 'text-red-600'}`} />;
    }
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const renderNode = (node: DRENode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const paddingLeft = level * 16;

    const getRowStyle = () => {
      if (node.tipo === 'grupo' && level === 0) return 'bg-primary/10 font-bold';
      if (node.tipo === 'conta') return 'bg-muted/50 font-semibold text-sm';
      if (node.tipo === 'departamento') return 'bg-accent/30 text-sm';
      return 'hover:bg-accent/20 text-xs';
    };

    const isExpense = ['expense', 'cost_center', 'budget', 'asset', 'liability'].includes(node.accountType);
    const mom = node.valoresMensais ? calcularMoM(node.valoresMensais) : null;
    const yoy = calcularYoY(node.valor, totaisAnoAnterior.despesas * (node.valor / (hierarquia.find(h => h.id === 'despesas')?.valor || 1)));

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-1.5 px-2 border-b transition-colors ${getRowStyle()}`}
          style={{ paddingLeft: `${paddingLeft + 8}px` }}
        >
          {/* Nome da conta */}
          <div className="flex items-center gap-1 min-w-[250px] flex-shrink-0">
            {hasChildren && (
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => toggleNode(node.id)}>
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            )}
            {!hasChildren && <div className="w-5" />}
            
            {node.codigo && (
              <span className="font-mono text-xs text-muted-foreground w-[60px]">{node.codigo}</span>
            )}
            
            <span className="truncate">{node.nome}</span>

            {node.id === 'nao-classificados' && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">Pendente</Badge>
            )}
          </div>

          {/* Valores por mês */}
          <div className="flex items-center flex-1 overflow-x-auto">
            {mesesPeriodo.map(mes => {
              const valorMes = node.valoresMensais?.[mes.key] || 0;
              return (
                <div key={mes.key} className="min-w-[80px] text-right px-1">
                  <span className={`font-mono text-xs ${
                    node.accountType === 'revenue' ? 'text-green-600' :
                    isExpense ? 'text-red-600' :
                    node.valor >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {valorMes > 0 ? (isExpense ? `(${formatarValor(valorMes)})` : formatarValor(valorMes)) : '-'}
                  </span>
                </div>
              );
            })}

            {/* Total */}
            <div className="min-w-[100px] text-right px-2 font-semibold border-l">
              <span className={`font-mono text-sm ${
                node.accountType === 'revenue' ? 'text-green-600' :
                isExpense ? 'text-red-600' :
                node.valor >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {isExpense ? `(${formatarValor(node.valor)})` : formatarValor(node.valor)}
              </span>
            </div>

            {/* MoM */}
            <div className="min-w-[70px] text-right px-2 border-l">
              <div className="flex items-center justify-end gap-1">
                {renderVariacaoIcon(mom, isExpense)}
                <span className={`text-xs font-medium ${
                  mom === null ? 'text-muted-foreground' :
                  (isExpense ? mom < 0 : mom > 0) ? 'text-green-600' : 
                  (isExpense ? mom > 0 : mom < 0) ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {formatarVariacao(mom)}
                </span>
              </div>
            </div>

            {/* YoY */}
            <div className="min-w-[70px] text-right px-2 border-l">
              <div className="flex items-center justify-end gap-1">
                {renderVariacaoIcon(yoy, isExpense)}
                <span className={`text-xs font-medium ${
                  yoy === null ? 'text-muted-foreground' :
                  (isExpense ? yoy < 0 : yoy > 0) ? 'text-green-600' : 
                  (isExpense ? yoy > 0 : yoy < 0) ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {formatarVariacao(yoy)}
                </span>
              </div>
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
    const flattenData = (nodes: DRENode[], parentCode: string = ''): any[] => {
      const result: any[] = [];
      
      nodes.forEach(node => {
        const row: any = {
          'Código': node.codigo,
          'Descrição': node.nome,
          'Tipo': node.tipo,
        };
        
        mesesPeriodo.forEach(m => {
          row[m.label] = node.valoresMensais?.[m.key] || 0;
        });
        
        row['Total'] = node.valor;
        row['MoM %'] = calcularMoM(node.valoresMensais || {});
        row['YoY %'] = calcularYoY(node.valor, 0);
        
        result.push(row);

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

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">DRE Analítico</h1>
            <p className="text-muted-foreground text-sm">Demonstrativo com análise MoM e YoY</p>
          </div>
          <Button onClick={exportarExcel} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Filtros compactos */}
        <Card>
          <CardContent className="py-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Período</Label>
                <Select value={periodo} onValueChange={(v: any) => handlePeriodoChange(v)}>
                  <SelectTrigger className="h-8">
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
                <Label className="text-xs">Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-8" />
              </div>

              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-8" />
              </div>

              <div>
                <Label className="text-xs">Empresa</Label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {empresas?.map((empresa) => (
                      <SelectItem key={empresa} value={empresa}>{empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={() => setExpandedNodes(new Set(['receitas', 'despesas', 'custos', 'patrimoniais']))}
                  variant="outline" size="sm" className="w-full h-8"
                >
                  Expandir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Receitas
            </div>
            <div className="text-lg font-bold text-green-600">{formatarValor(totalReceitas)}</div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-600" />
              Despesas
            </div>
            <div className="text-lg font-bold text-red-600">{formatarValor(totalDespesas)}</div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Custos</div>
            <div className="text-lg font-bold text-red-600">{formatarValor(totalCustos)}</div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Patrimoniais</div>
            <div className="text-lg font-bold text-blue-600">{formatarValor(totalPatrimoniais)}</div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Resultado</div>
            <div className={`text-lg font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado)}
            </div>
          </Card>
        </div>

        {/* Tabela DRE */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Demonstrativo de Resultado do Exercício</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header da tabela */}
            <div className="flex items-center py-2 px-2 bg-muted/50 border-b text-xs font-semibold sticky top-0">
              <div className="min-w-[250px] flex-shrink-0">Conta</div>
              <div className="flex items-center flex-1 overflow-x-auto">
                {mesesPeriodo.map(mes => (
                  <div key={mes.key} className="min-w-[80px] text-right px-1">{mes.label}</div>
                ))}
                <div className="min-w-[100px] text-right px-2 border-l">Total</div>
                <div className="min-w-[70px] text-right px-2 border-l">MoM</div>
                <div className="min-w-[70px] text-right px-2 border-l">YoY</div>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando dados...</div>
              ) : (
                hierarquia.map(node => renderNode(node, 0))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
