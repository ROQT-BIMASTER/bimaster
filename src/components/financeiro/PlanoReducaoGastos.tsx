import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, TrendingDown, CheckCircle2, Clock, AlertTriangle,
  Ban, RefreshCw, Eye, Users, Calendar, FileDown, Trash2, Edit, Check, ChevronDown, ChevronRight, Plus
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { MetasReducaoChart } from "./MetasReducaoChart";
import { RevisaoGastosCard } from "./RevisaoGastosCard";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface PlanoReducaoGastosProps {
  dataInicio: string;
  dataFim: string;
  filterEmpresa: string;
}

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: Ban },
};

const tipoConfig = {
  eliminar: { label: 'Eliminar', color: 'text-red-500', icon: Ban },
  reduzir: { label: 'Reduzir', color: 'text-orange-500', icon: TrendingDown },
  renegociar: { label: 'Renegociar', color: 'text-blue-500', icon: RefreshCw },
  monitorar: { label: 'Monitorar', color: 'text-purple-500', icon: Eye },
};

const prioridadeConfig = {
  alta: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  media: { label: 'Média', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  baixa: { label: 'Baixa', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export function PlanoReducaoGastos({ dataInicio, dataFim, filterEmpresa }: PlanoReducaoGastosProps) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('todas');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: revisoes, isLoading, refetch } = useQuery({
    queryKey: ['contas-revisao', filterStatus, filterPrioridade, filterTipo],
    queryFn: async () => {
      // Buscar revisões
      let query = supabase
        .from('contas_pagar_revisao')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'todos') {
        query = query.eq('status', filterStatus);
      }
      if (filterPrioridade !== 'todas') {
        query = query.eq('prioridade', filterPrioridade);
      }
      if (filterTipo !== 'todos') {
        query = query.eq('tipo_revisao', filterTipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Buscar dados relacionados separadamente
      const responsaveisIds = [...new Set(data?.filter(r => r.responsavel_id).map(r => r.responsavel_id))];
      const planoContasIds = [...new Set(data?.filter(r => r.plano_contas_id).map(r => r.plano_contas_id))];
      const departamentoIds = [...new Set(data?.filter(r => r.departamento_id).map(r => r.departamento_id))];
      
      const [responsaveisRes, planoContasRes, departamentosRes] = await Promise.all([
        responsaveisIds.length > 0 
          ? supabase.from('profiles').select('id, nome, email').in('id', responsaveisIds)
          : { data: [] },
        planoContasIds.length > 0
          ? supabase.from('trade_chart_of_accounts').select('id, name, code').in('id', planoContasIds)
          : { data: [] },
        departamentoIds.length > 0
          ? supabase.from('departamentos').select('id, nome').in('id', departamentoIds)
          : { data: [] }
      ]);
      
      const responsaveisMap = new Map((responsaveisRes.data || []).map(r => [r.id, r]));
      const planoContasMap = new Map((planoContasRes.data || []).map(r => [r.id, r]));
      const departamentosMap = new Map((departamentosRes.data || []).map(r => [r.id, r]));
      
      // Enriquecer dados
      return data?.map(r => ({
        ...r,
        responsavel: r.responsavel_id ? responsaveisMap.get(r.responsavel_id) : null,
        plano_contas: r.plano_contas_id ? planoContasMap.get(r.plano_contas_id) : null,
        departamento: r.departamento_id ? departamentosMap.get(r.departamento_id) : null,
      }));
    }
  });

  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email');
      if (error) throw error;
      return data;
    }
  });

  // Calcular KPIs
  const totalMarcados = revisoes?.length || 0;
  const metaTotalEconomia = revisoes?.reduce((acc, r) => acc + (r.meta_reducao_valor || 0), 0) || 0;
  const economiaRealizada = revisoes?.filter(r => r.status === 'concluido').reduce((acc, r) => acc + (r.resultado_obtido || 0), 0) || 0;
  const percentualAtingido = metaTotalEconomia > 0 ? (economiaRealizada / metaTotalEconomia) * 100 : 0;
  const itensPendentes = revisoes?.filter(r => r.status === 'pendente').length || 0;
  const itensVencidos = revisoes?.filter(r => r.prazo_revisao && new Date(r.prazo_revisao) < new Date() && r.status !== 'concluido' && r.status !== 'cancelado').length || 0;

  const filteredRevisoes = revisoes?.filter(r => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const nome = r.plano_contas?.name?.toLowerCase() || r.categoria_nome?.toLowerCase() || '';
      const depto = r.departamento?.nome?.toLowerCase() || '';
      const fornecedor = r.fornecedor_nome?.toLowerCase() || '';
      const documento = r.numero_documento?.toLowerCase() || '';
      return nome.includes(search) || depto.includes(search) || fornecedor.includes(search) || documento.includes(search);
    }
    return true;
  });

  // Agrupar por responsável
  const revisoesPorResponsavel = filteredRevisoes?.reduce((acc, r: any) => {
    const key = r.responsavel?.nome || r.responsavel?.email || 'Sem Responsável';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, typeof revisoes>);

  const handleUpdateStatus = async (id: string, novoStatus: string, resultadoObtido?: number) => {
    try {
      const updateData: any = { status: novoStatus };
      if (resultadoObtido !== undefined) {
        updateData.resultado_obtido = resultadoObtido;
      }

      const { error } = await supabase
        .from('contas_pagar_revisao')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success("Status atualizado!");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta marcação?")) return;
    
    try {
      const { error } = await supabase
        .from('contas_pagar_revisao')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Marcação excluída!");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const exportarExcel = async () => {
    if (!revisoes) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const worksheet = workbook.addWorksheet('Plano Redução');

    worksheet.columns = [
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Fornecedor', key: 'fornecedor', width: 25 },
      { header: 'Documento', key: 'documento', width: 15 },
      { header: 'Tipo Documento', key: 'tipo_documento', width: 15 },
      { header: 'Vencimento', key: 'vencimento', width: 12 },
      { header: 'Empresa', key: 'empresa', width: 20 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Prioridade', key: 'prioridade', width: 10 },
      { header: 'Valor Atual', key: 'valor_atual', width: 15 },
      { header: 'Meta Redução (%)', key: 'meta_percentual', width: 15 },
      { header: 'Meta Redução (R$)', key: 'meta_valor', width: 15 },
      { header: 'Resultado Obtido', key: 'resultado', width: 15 },
      { header: 'Responsável', key: 'responsavel', width: 25 },
      { header: 'Prazo', key: 'prazo', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Observações', key: 'observacoes', width: 40 },
    ];

    revisoes.forEach(r => {
      worksheet.addRow({
        item: r.plano_contas?.name || r.categoria_nome || 'N/A',
        fornecedor: r.fornecedor_nome || 'N/A',
        documento: r.numero_documento || 'N/A',
        tipo_documento: r.tipo_documento || 'N/A',
        vencimento: r.data_vencimento ? format(parseISO(r.data_vencimento), 'dd/MM/yyyy') : 'N/A',
        empresa: r.empresa_nome || 'N/A',
        departamento: r.departamento?.nome || 'N/A',
        tipo: tipoConfig[r.tipo_revisao as keyof typeof tipoConfig]?.label || r.tipo_revisao,
        prioridade: prioridadeConfig[r.prioridade as keyof typeof prioridadeConfig]?.label || r.prioridade,
        valor_atual: r.valor_atual || 0,
        meta_percentual: r.meta_reducao_percentual || 0,
        meta_valor: r.meta_reducao_valor || 0,
        resultado: r.resultado_obtido || 0,
        responsavel: (r as any).responsavel?.nome || (r as any).responsavel?.email || 'N/A',
        prazo: r.prazo_revisao ? format(parseISO(r.prazo_revisao), 'dd/MM/yyyy') : 'N/A',
        status: statusConfig[r.status as keyof typeof statusConfig]?.label || r.status,
        observacoes: r.observacoes || '',
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Plano_Reducao_Gastos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success("Relatório exportado!");
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-blue-500" />
              Itens Marcados
            </div>
            <div className="text-2xl font-bold">{totalMarcados}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Meta de Economia
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaTotalEconomia)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Economia Realizada
            </div>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economiaRealizada)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pendentes
            </div>
            <div className="text-2xl font-bold text-yellow-600">{itensPendentes}</div>
          </CardContent>
        </Card>

        <Card className={itensVencidos > 0 ? 'border-red-500' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Vencidos
            </div>
            <div className={`text-2xl font-bold ${itensVencidos > 0 ? 'text-red-600' : ''}`}>
              {itensVencidos}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <MetasReducaoChart revisoes={revisoes || []} />

      {/* Filtros e Ações */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-lg">Itens em Revisão</CardTitle>
            <Button onClick={exportarExcel} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <Input
                placeholder="Fornecedor, nome, documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prioridade</Label>
              <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {Object.entries(prioridadeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(tipoConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Visualização</Label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lista">Lista</SelectItem>
                  <SelectItem value="responsavel">Por Responsável</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                <div className="animate-pulse">Carregando...</div>
              </div>
            ) : viewMode === 'lista' ? (
              <div className="space-y-3">
                {filteredRevisoes?.map((revisao) => (
                  <RevisaoGastosCard
                    key={revisao.id}
                    revisao={revisao}
                    onUpdateStatus={handleUpdateStatus}
                    onDelete={handleDelete}
                  />
                ))}
                {filteredRevisoes?.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    Nenhum item marcado para revisão
                  </div>
                )}
              </div>
            ) : viewMode === 'responsavel' ? (
              <div className="space-y-6">
                {Object.entries(revisoesPorResponsavel || {}).map(([responsavel, items]) => (
                  <div key={responsavel} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-2 border-b">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{responsavel}</span>
                      <Badge variant="secondary">{items?.length || 0} itens</Badge>
                    </div>
                    {items?.map((revisao) => (
                      <RevisaoGastosCard
                        key={revisao.id}
                        revisao={revisao}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRevisoes
                  ?.filter(r => r.prazo_revisao)
                  .sort((a, b) => new Date(a.prazo_revisao!).getTime() - new Date(b.prazo_revisao!).getTime())
                  .map((revisao) => {
                    const diasRestantes = differenceInDays(new Date(revisao.prazo_revisao!), new Date());
                    return (
                      <div key={revisao.id} className="flex items-center gap-4">
                        <div className={`text-center p-2 rounded-lg min-w-[60px] ${
                          diasRestantes < 0 ? 'bg-red-100 text-red-700' :
                          diasRestantes <= 7 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          <div className="text-xs">
                            {diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Hoje' : `${diasRestantes}d`}
                          </div>
                          <div className="text-sm font-medium">
                            {format(parseISO(revisao.prazo_revisao!), 'dd/MM')}
                          </div>
                        </div>
                        <div className="flex-1">
                          <RevisaoGastosCard
                            revisao={revisao}
                            onUpdateStatus={handleUpdateStatus}
                            onDelete={handleDelete}
                            compact
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
