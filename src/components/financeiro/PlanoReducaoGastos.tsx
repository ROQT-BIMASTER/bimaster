import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Target, TrendingDown, CheckCircle2, Clock, AlertTriangle,
  Ban, RefreshCw, Eye, FileDown, Trash2, Edit, Check, ChevronDown, ChevronRight, Maximize2, Minimize2,
  Building2, Users, Activity, CalendarClock, Plus, FolderOpen, Share2, Search, UserPlus, X, Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('todas');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterDepartamento, setFilterDepartamento] = useState<string>('todos');
  const [filterEmpresaNome, setFilterEmpresaNome] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<'departamento' | 'fornecedor'>('departamento');
  const [editingSubstituto, setEditingSubstituto] = useState<string | null>(null);
  const [substitutoValue, setSubstitutoValue] = useState('');
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>('');
  const [showNewPlanoDialog, setShowNewPlanoDialog] = useState(false);
  const [newPlanoNome, setNewPlanoNome] = useState('');
  const [newPlanoDescricao, setNewPlanoDescricao] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareProfiles, setShareProfiles] = useState<any[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);
  // Fetch planos de redução
  const { data: planos, isLoading: planosLoading } = useQuery({
    queryKey: ['planos-reducao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_reducao')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch shares for the selected plano
  const { data: planoShares, refetch: refetchShares } = useQuery({
    queryKey: ['plano-shares', selectedPlanoId],
    enabled: !!selectedPlanoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_reducao_compartilhados' as any)
        .select('*')
        .eq('plano_id', selectedPlanoId);
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const userIds = (data as any[]).map((s: any) => s.user_id);
      const { data: profs } = await supabase.from('profiles').select('id, nome, email').in('id', userIds);
      const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));
      return (data as any[]).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        profile_name: profMap[s.user_id]?.nome,
        profile_email: profMap[s.user_id]?.email,
      }));
    }
  });

  const searchShareProfiles = async () => {
    if (shareSearch.length < 2) return;
    setShareLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email')
      .or(`nome.ilike.%${shareSearch}%,email.ilike.%${shareSearch}%`)
      .limit(10);
    setShareProfiles(data || []);
    setShareLoading(false);
  };

  const addShare = async (userId: string) => {
    if (planoShares?.some((s: any) => s.user_id === userId)) {
      toast.info("Usuário já possui acesso");
      return;
    }
    const { error } = await supabase.from('planos_reducao_compartilhados' as any).insert({
      plano_id: selectedPlanoId,
      user_id: userId,
    } as any);
    if (error) { toast.error("Erro ao compartilhar"); return; }
    toast.success("Acesso compartilhado!");
    setShareSearch('');
    setShareProfiles([]);
    refetchShares();
  };

  const removeShare = async (shareId: string) => {
    const { error } = await supabase.from('planos_reducao_compartilhados' as any).delete().eq('id', shareId);
    if (error) { toast.error("Erro ao remover acesso"); return; }
    toast.success("Acesso removido");
    refetchShares();
  };
  useEffect(() => {
    if (planos?.length && !selectedPlanoId) {
      setSelectedPlanoId(planos[0].id);
    }
  }, [planos, selectedPlanoId]);

  // Create new plano
  const createPlanoMutation = useMutation({
    mutationFn: async ({ nome, descricao }: { nome: string; descricao: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from('planos_reducao')
        .insert({ nome, descricao, criado_por: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Plano criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['planos-reducao'] });
      setSelectedPlanoId(data.id);
      setShowNewPlanoDialog(false);
      setNewPlanoNome('');
      setNewPlanoDescricao('');
    },
    onError: (error: any) => {
      toast.error("Erro ao criar plano: " + error.message);
    }
  });

  const { data: revisoes, isLoading, refetch } = useQuery({
    queryKey: ['contas-revisao', filterStatus, filterPrioridade, filterTipo, selectedPlanoId],
    enabled: !!selectedPlanoId,
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar_revisao')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedPlanoId) query = query.eq('plano_id', selectedPlanoId);
      if (filterStatus !== 'todos') query = query.eq('status', filterStatus);
      if (filterPrioridade !== 'todas') query = query.eq('prioridade', filterPrioridade);
      if (filterTipo !== 'todos') query = query.eq('tipo_revisao', filterTipo);

      const { data, error } = await query;
      if (error) throw error;
      
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
      
      return data?.map(r => ({
        ...r,
        responsavel: r.responsavel_id ? responsaveisMap.get(r.responsavel_id) : null,
        plano_contas: r.plano_contas_id ? planoContasMap.get(r.plano_contas_id) : null,
        departamento: r.departamento_id ? departamentosMap.get(r.departamento_id) : null,
      }));
    }
  });

  // Fetch supplier metrics
  const fornecedorCodigos = useMemo(() => 
    [...new Set(revisoes?.map(r => r.fornecedor_codigo).filter(Boolean) || [])] as string[],
    [revisoes]
  );

  const { data: metricasMap } = useQuery({
    queryKey: ['fornecedor-metricas', fornecedorCodigos],
    queryFn: async () => {
      if (fornecedorCodigos.length === 0) return {};
      const { data, error } = await supabase.rpc('get_fornecedor_metricas_reducao', { p_codigos: fornecedorCodigos });
      if (error) throw error;
      const map: Record<string, any> = {};
      data?.forEach((m: any) => { map[m.fornecedor_codigo] = m; });
      return map;
    },
    enabled: fornecedorCodigos.length > 0,
  });

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalMarcados = revisoes?.length || 0;
  const metaTotalEconomia = revisoes?.reduce((acc, r) => acc + (r.meta_reducao_valor || 0), 0) || 0;
  const economiaRealizada = revisoes?.filter(r => r.status === 'concluido').reduce((acc, r) => acc + (r.resultado_obtido || 0), 0) || 0;
  const itensPendentes = revisoes?.filter(r => r.status === 'pendente').length || 0;
  const itensVencidos = revisoes?.filter(r => r.prazo_revisao && new Date(r.prazo_revisao) < new Date() && r.status !== 'concluido' && r.status !== 'cancelado').length || 0;

  // Extract unique departments and empresas for filters
  const uniqueDepartamentos = [...new Set(revisoes?.map(r => (r as any).departamento?.nome).filter(Boolean) || [])].sort();
  const uniqueEmpresas = [...new Set(revisoes?.map(r => r.empresa_nome).filter(Boolean) || [])].sort();

  const filteredRevisoes = revisoes?.filter(r => {
    if (filterDepartamento !== 'todos') {
      const deptoNome = (r as any).departamento?.nome || '';
      if (deptoNome !== filterDepartamento) return false;
    }
    if (filterEmpresaNome !== 'todas') {
      if ((r.empresa_nome || '') !== filterEmpresaNome) return false;
    }
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

  // Group by departamento
  const groupedByDepartamento = filteredRevisoes?.reduce((acc, r) => {
    const key = (r as any).departamento?.nome || 'Sem Departamento';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, typeof filteredRevisoes>) || {};

  const groupedByFornecedor = filteredRevisoes?.reduce((acc, r) => {
    const key = r.fornecedor_nome || 'Sem Fornecedor';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, typeof filteredRevisoes>) || {};

  const activeGrouped = viewMode === 'fornecedor' ? groupedByFornecedor : groupedByDepartamento;

  const handleUpdateStatus = async (id: string, novoStatus: string, resultadoObtido?: number) => {
    try {
      const updateData: any = { status: novoStatus };
      if (resultadoObtido !== undefined) updateData.resultado_obtido = resultadoObtido;
      const { error } = await supabase.from('contas_pagar_revisao').update(updateData).eq('id', id);
      if (error) throw error;
      toast.success("Status atualizado!");
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleUpdateSubstituto = async (id: string, valor: string) => {
    try {
      const { error } = await supabase.from('contas_pagar_revisao').update({ substituido_por: valor }).eq('id', id);
      if (error) throw error;
      toast.success("Substituição atualizada!");
      setEditingSubstituto(null);
      refetch();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta marcação?")) return;
    try {
      const { error } = await supabase.from('contas_pagar_revisao').delete().eq('id', id);
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
        departamento: (r as any).departamento?.nome || 'N/A',
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

  const renderDesktopTable = (maxHeightClass = "max-h-[500px]") => (
    <div className={`${maxHeightClass} overflow-auto`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead>Fornecedor / Item</TableHead>
            <TableHead className="w-[90px]">Prioridade</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="text-right w-[130px]">Valor Atual</TableHead>
            <TableHead className="w-[180px]">Substituído por</TableHead>
            {viewMode === 'fornecedor' && (
              <>
                <TableHead className="text-right w-[110px]">Média/Mês</TableHead>
                <TableHead className="w-[90px]">Último Pgto</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
              </>
            )}
            <TableHead className="text-right w-[130px]">Meta Redução</TableHead>
            <TableHead className="w-[100px]">Prazo</TableHead>
            <TableHead className="text-right w-[120px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(activeGrouped).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, items]) => {
            const groupTotal = items?.reduce((acc, r) => acc + (r.valor_atual || 0), 0) || 0;
            const colSpanLeft = viewMode === 'fornecedor' ? 9 : 6;
            const colSpanRight = viewMode === 'fornecedor' ? 4 : 4;
            // For fornecedor view, get metrics from first item's codigo
            const groupMetricas = viewMode === 'fornecedor' && items?.[0]?.fornecedor_codigo 
              ? metricasMap?.[items[0].fornecedor_codigo] : null;
            return (
              <React.Fragment key={`group-${groupName}`}>{/* Group header */}
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={colSpanLeft} className="py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {viewMode === 'fornecedor' ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="font-semibold text-sm">{groupName}</span>
                      <Badge variant="secondary" className="text-xs">{items?.length || 0}</Badge>
                      {viewMode === 'fornecedor' && groupMetricas && (
                        <Badge variant={groupMetricas.ativo ? 'success' : 'destructive'} className="text-xs">
                          {groupMetricas.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      )}
                      <span className="ml-auto font-semibold text-sm font-mono">
                        {fmtCurrency(groupTotal)}
                      </span>
                      {viewMode === 'fornecedor' && groupMetricas && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Média: {fmtCurrency(groupMetricas.media_mensal || 0)}/mês
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell colSpan={colSpanRight} className="py-2" />
                </TableRow>
                {items?.map((revisao) => {
            const tipo = tipoConfig[revisao.tipo_revisao as keyof typeof tipoConfig];
            const status = statusConfig[revisao.status as keyof typeof statusConfig];
            const prioridade = prioridadeConfig[revisao.prioridade as keyof typeof prioridadeConfig];
            const TipoIcon = tipo?.icon;
            const StatusIcon = status?.icon;
            const isExpanded = expandedRow === revisao.id;
            const itemName = (revisao as any).plano_contas?.name || revisao.categoria_nome || 'N/A';
            const fornecedor = revisao.fornecedor_nome || '';
            const diasRestantes = revisao.prazo_revisao 
              ? differenceInDays(new Date(revisao.prazo_revisao), new Date()) 
              : null;
            const prazoVencido = diasRestantes !== null && diasRestantes < 0 && revisao.status !== 'concluido' && revisao.status !== 'cancelado';
            const isEditingSub = editingSubstituto === revisao.id;
            const metricas = revisao.fornecedor_codigo ? metricasMap?.[revisao.fornecedor_codigo] : null;

            return (
              <React.Fragment key={revisao.id}>{/* row + detail */}
                <TableRow 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedRow(isExpanded ? null : revisao.id)}
                >
                  <TableCell className="px-2">
                    {isExpanded 
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> 
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {TipoIcon && <TipoIcon className={`h-3.5 w-3.5 ${tipo?.color}`} />}
                      <span className="text-xs font-medium">{tipo?.label || revisao.tipo_revisao}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[250px]">{itemName}</div>
                      {fornecedor && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{fornecedor}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        revisao.prioridade === 'alta' ? 'bg-destructive' :
                        revisao.prioridade === 'media' ? 'bg-warning' : 'bg-success'
                      }`} />
                      <span className="text-xs">{prioridade?.label || revisao.prioridade}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${status?.color || ''}`}>
                      {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                      {status?.label || revisao.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {revisao.valor_atual 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.valor_atual)
                      : '—'
                    }
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isEditingSub ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-xs"
                          value={substitutoValue}
                          onChange={(e) => setSubstitutoValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateSubstituto(revisao.id, substitutoValue);
                            if (e.key === 'Escape') setEditingSubstituto(null);
                          }}
                          autoFocus
                          placeholder="Ex: BiMaster"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleUpdateSubstituto(revisao.id, substitutoValue)}>
                          <Check className="h-3.5 w-3.5 text-success" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs cursor-pointer hover:underline ${(revisao as any).substituido_por ? 'text-primary font-medium' : 'text-muted-foreground italic'}`}
                        onClick={() => { setEditingSubstituto(revisao.id); setSubstitutoValue((revisao as any).substituido_por || ''); }}
                      >
                        {(revisao as any).substituido_por || 'Definir...'}
                      </span>
                    )}
                  </TableCell>
                  {viewMode === 'fornecedor' && (
                    <>
                      <TableCell className="text-right font-mono text-xs">
                        {metricas ? fmtCurrency(metricas.media_mensal || 0) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {metricas?.ultimo_pagamento 
                          ? format(parseISO(metricas.ultimo_pagamento), 'dd/MM/yy')
                          : '—'
                        }
                      </TableCell>
                      <TableCell>
                        {metricas ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant={metricas.ativo ? 'success' : 'destructive'} className="text-xs">
                                  {metricas.ativo ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {metricas.ultimo_pagamento 
                                  ? `Último pagamento: ${format(parseISO(metricas.ultimo_pagamento), 'dd/MM/yyyy')} (${differenceInDays(new Date(), parseISO(metricas.ultimo_pagamento))} dias atrás)`
                                  : 'Sem pagamentos nos últimos 12 meses'
                                }
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : '—'}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right text-sm">
                    {revisao.meta_reducao_percentual 
                      ? <span className="font-medium">{revisao.meta_reducao_percentual}%</span>
                      : '—'
                    }
                    {revisao.meta_reducao_valor ? (
                      <div className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(revisao.meta_reducao_valor)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {revisao.prazo_revisao ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{format(parseISO(revisao.prazo_revisao), 'dd/MM')}</span>
                        {diasRestantes !== null && (
                          <span className={`text-xs font-medium ${
                            prazoVencido ? 'text-destructive' :
                            diasRestantes <= 7 ? 'text-warning' : 'text-muted-foreground'
                          }`}>
                            {diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atrás` :
                             diasRestantes === 0 ? 'Hoje' : `${diasRestantes}d`}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {revisao.status !== 'concluido' && revisao.status !== 'cancelado' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Concluir"
                          onClick={() => handleUpdateStatus(revisao.id, 'concluido')}>
                          <Check className="h-3.5 w-3.5 text-success" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar">
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir"
                        onClick={() => handleDelete(revisao.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${revisao.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={viewMode === 'fornecedor' ? 13 : 10} className="py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm px-2">
                        <div>
                          <span className="text-xs text-muted-foreground block">Documento</span>
                          <span className="font-medium">{revisao.numero_documento || 'N/A'}</span>
                          {revisao.tipo_documento && <span className="text-xs text-muted-foreground ml-1">({revisao.tipo_documento})</span>}
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Empresa</span>
                          <span className="font-medium">{revisao.empresa_nome || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Departamento</span>
                          <span className="font-medium">{(revisao as any).departamento?.nome || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Responsável</span>
                          <span className="font-medium">{(revisao as any).responsavel?.nome || (revisao as any).responsavel?.email || 'N/A'}</span>
                        </div>
                        {revisao.observacoes && (
                          <div className="col-span-full">
                            <span className="text-xs text-muted-foreground block">Observações</span>
                            <span className="text-sm">{revisao.observacoes}</span>
                          </div>
                        )}
                        {revisao.resultado_obtido ? (
                          <div>
                            <span className="text-xs text-muted-foreground block">Resultado Obtido</span>
                            <span className="font-medium text-success">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revisao.resultado_obtido)}
                            </span>
                          </div>
                        ) : null}
                        {viewMode === 'fornecedor' && metricas?.historico_mensal && (
                          <div className="col-span-full">
                            <span className="text-xs text-muted-foreground block mb-1.5">Histórico de Pagamentos (6 meses)</span>
                            <div className="flex gap-2 flex-wrap">
                              {(metricas.historico_mensal as any[]).map((h: any, i: number) => (
                                <div key={i} className="bg-muted rounded-md px-3 py-1.5 text-center min-w-[80px]">
                                  <div className="text-xs text-muted-foreground">{h.mes}</div>
                                  <div className={`text-xs font-mono font-medium ${Number(h.valor) > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {fmtCurrency(Number(h.valor))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const selectedPlano = planos?.find(p => p.id === selectedPlanoId);

  return (
    <div className="space-y-6">
      {/* Seletor de Plano */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Plano de Redução:</span>
            </div>
            <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Selecione um plano..." />
              </SelectTrigger>
              <SelectContent>
                {planos?.map((plano) => (
                  <SelectItem key={plano.id} value={plano.id}>
                    <span className="flex items-center gap-2">
                      {plano.nome}
                      {plano.criado_por === currentUserId ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Meu</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Compartilhado</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowNewPlanoDialog(true)} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Plano
            </Button>
            {selectedPlanoId && selectedPlano?.criado_por === currentUserId && (
              <Button onClick={() => setShowShareDialog(true)} variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
            )}
            {selectedPlanoId && (
              <Button onClick={() => navigate(`/dashboard/financeiro/plano-reducao/${selectedPlanoId}`)} variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                Ver Relatório
              </Button>
            )}
            {selectedPlano?.descricao && (
              <span className="text-sm text-muted-foreground ml-2">{selectedPlano.descricao}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-primary" />
              Itens Marcados
            </div>
            <div className="text-2xl font-bold">{totalMarcados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-warning" />
              Meta de Economia
            </div>
            <div className="text-2xl font-bold text-warning">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaTotalEconomia)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Economia Realizada
            </div>
            <div className="text-2xl font-bold text-success">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economiaRealizada)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-warning" />
              Pendentes
            </div>
            <div className="text-2xl font-bold text-warning">{itensPendentes}</div>
          </CardContent>
        </Card>
        <Card className={itensVencidos > 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Vencidos
            </div>
            <div className={`text-2xl font-bold ${itensVencidos > 0 ? 'text-destructive' : ''}`}>
              {itensVencidos}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <MetasReducaoChart revisoes={revisoes || []} />

      {/* Itens em Revisão */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg">Itens em Revisão</CardTitle>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'departamento' | 'fornecedor')} className="hidden md:block">
                <TabsList className="h-8">
                  <TabsTrigger value="departamento" className="text-xs gap-1.5 px-3 h-7">
                    <Building2 className="h-3.5 w-3.5" />
                    Departamento
                  </TabsTrigger>
                  <TabsTrigger value="fornecedor" className="text-xs gap-1.5 px-3 h-7">
                    <Users className="h-3.5 w-3.5" />
                    Fornecedor
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setFocusMode(true)} variant="outline" size="sm" className="gap-2 hidden md:flex">
                <Maximize2 className="h-4 w-4" />
                Modo Foco
              </Button>
              <Button onClick={exportarExcel} variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <Input placeholder="Fornecedor, nome, documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={filterEmpresaNome} onValueChange={setFilterEmpresaNome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {uniqueEmpresas.map((emp) => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Departamento</Label>
              <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueDepartamentos.map((dep) => (
                    <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(tipoConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="animate-pulse">Carregando...</div>
            </div>
          ) : filteredRevisoes?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum item marcado para revisão
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                {renderDesktopTable()}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredRevisoes?.map((revisao) => (
                      <RevisaoGastosCard
                        key={revisao.id}
                        revisao={revisao}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Focus Mode Dialog */}
      <Dialog open={focusMode} onOpenChange={setFocusMode}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Itens em Revisão — Modo Foco</h2>
            <div className="flex items-center gap-2">
              <Button onClick={exportarExcel} variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" />
                Exportar
              </Button>
              <Button onClick={() => setFocusMode(false)} variant="ghost" size="sm" className="gap-2">
                <Minimize2 className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {renderDesktopTable("max-h-[calc(95vh-120px)]")}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Plano Dialog */}
      <Dialog open={showNewPlanoDialog} onOpenChange={setShowNewPlanoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Plano de Redução</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input 
                placeholder="Ex: Redução Departamento de Marketing" 
                value={newPlanoNome} 
                onChange={(e) => setNewPlanoNome(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea 
                placeholder="Descreva o objetivo deste plano..." 
                value={newPlanoDescricao} 
                onChange={(e) => setNewPlanoDescricao(e.target.value)} 
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPlanoDialog(false)}>Cancelar</Button>
            <Button 
              onClick={() => createPlanoMutation.mutate({ nome: newPlanoNome, descricao: newPlanoDescricao })}
              disabled={!newPlanoNome.trim() || createPlanoMutation.isPending}
            >
              {createPlanoMutation.isPending ? 'Criando...' : 'Criar Plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Compartilhar Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchShareProfiles()}
                  placeholder="Buscar por nome ou email..."
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button size="icon" onClick={searchShareProfiles} disabled={shareLoading}>
                {shareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {shareProfiles.length > 0 && (
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {shareProfiles.filter(p => p.id !== currentUserId).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => addShare(p.id)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Pessoas com acesso ({planoShares?.length || 0})</p>
              {!planoShares?.length ? (
                <p className="text-xs text-muted-foreground">Nenhum compartilhamento</p>
              ) : (
                <div className="space-y-2">
                  {planoShares.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div className="text-sm">
                        <p className="font-medium">{s.profile_name || 'Usuário'}</p>
                        <p className="text-xs text-muted-foreground">{s.profile_email}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeShare(s.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
