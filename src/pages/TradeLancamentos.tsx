import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import {
  FileText,
  CheckCircle,
  FileUp,
  Clock,
  XCircle,
  TrendingUp,
  DollarSign,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  FileCheck,
  Calendar,
  AlertCircle,
  AlertTriangle,
  SplitSquareVertical,
  Barcode,
  Copy,
  ChevronDown,
  Paperclip,
  Download,
  Image,
  File,
} from "lucide-react";
import { TRADE_EXPENSE_CATEGORIES } from "@/components/trade/tradeExpenseCategories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { AdicionarEvidenciaDialog } from "@/components/trade/AdicionarEvidenciaDialog";
import { NovoLancamentoDialog } from "@/components/trade/NovoLancamentoDialog";
import { EditarLancamentoDialog } from "@/components/trade/EditarLancamentoDialog";
import { EnviarFinanceiroTradeDialog } from "@/components/trade/EnviarFinanceiroTradeDialog";
import { PaymentPolicyBanner } from "@/components/financeiro/payments/PaymentPolicyBanner";
import { ExpenseAIChatFloat } from "@/components/ai/ExpenseAIChatFloat";
import { PaymentChatPanel } from "@/components/financeiro/payments/PaymentChatPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, ChevronUp } from "lucide-react";
import { useExpenseFinancialStatus } from "@/hooks/useExpenseFinancialStatus";
import { FinancialRejectionBanner } from "@/components/shared/FinancialRejectionBanner";

export default function TradeLancamentos() {
  const navigate = useNavigate();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sendFinancialDialogOpen, setSendFinancialDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chatEntry, setChatEntry] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId !== null && !roleLoading) {
      fetchData();
    }
  }, [currentUserId, roleLoading, isAdminOrSupervisor]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchData = async () => {
    try {
      let query = supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code),
          budget:trade_budgets(name, code),
          investment:trade_investments(amount, category)
        `);

      if (!isAdminOrSupervisor && currentUserId) {
        query = query.eq("created_by", currentUserId);
      }

      if (statusFilter !== "all") {
        if (statusFilter === "pending_financial") {
          query = query.eq("status", "pending_financial");
        } else {
          query = query.eq("approval_status", statusFilter);
        }
      }

      const { data, error } = await query.order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (entry.description || "").toLowerCase().includes(term) ||
      (entry.account?.name || "").toLowerCase().includes(term) ||
      (entry.account?.code || "").toLowerCase().includes(term) ||
      (entry.store?.name || "").toLowerCase().includes(term) ||
      (TRADE_EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || "").toLowerCase().includes(term)
    );
  });

  // KPIs
  const totalEntries = entries.length;
  const pendingEntries = entries.filter(e => e.approval_status === "pending").length;
  const totalPrevisto = entries.reduce((sum, e) => sum + (parseFloat(e.valor_previsto) || 0), 0);
  const totalRealizado = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_allocation: "Alocação de Verba",
      investment: "Investimento",
      expense: "Despesa",
      revenue: "Receita",
      adjustment: "Ajuste",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: "outline", label: "Pendente", icon: Clock },
      approved: { variant: "default", label: "Aprovado", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejeitado", icon: XCircle },
      completed: { variant: "secondary", label: "Concluído", icon: CheckCircle },
      pending_financial: { variant: "warning", label: "No Financeiro", icon: DollarSign },
    };

    const { variant, label, icon: Icon } = config[status] || config.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const canAddEvidence = (entry: any) => {
    return (
      entry.created_by === currentUserId &&
      entry.approval_status === "approved" &&
      entry.status !== "completed"
    );
  };

  const canEdit = (entry: any) => {
    return (
      entry.created_by === currentUserId &&
      (entry.approval_status === "pending" || entry.approval_status === "rejected")
    );
  };

  const handleEvidenceClick = (entry: any) => {
    setTimeout(() => {
      setSelectedEntry(entry);
      setEvidenceDialogOpen(true);
    }, 0);
  };

  const handleEditClick = (entry: any) => {
    setTimeout(() => {
      setSelectedEntry(entry);
      setEditDialogOpen(true);
    }, 0);
  };

  const canSendToFinancial = (entry: any) => {
    return (
      entry.approval_status === "approved" &&
      !entry.send_to_financial &&
      entry.status !== "pending_financial" &&
      entry.status !== "paid"
    );
  };

  const handleSendFinancialClick = (entry: any) => {
    setTimeout(() => {
      setSelectedEntry(entry);
      setSendFinancialDialogOpen(true);
    }, 0);
  };

  const copyBoletoBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    toast.success("Linha digitável copiada!");
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getAttachmentIcon = (type: string) => {
    if (type?.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type?.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Trade Marketing"
          moduleHref="/dashboard/trade"
          currentPage="Lançamentos Financeiros"
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
            <p className="text-muted-foreground mt-1">
              Histórico completo de todos os lançamentos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard/trade/financeiro/dashboard")}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            {isAdminOrSupervisor && (
              <Button variant="outline" onClick={() => navigate("/dashboard/trade/aprovacoes")} className="relative">
                <FileCheck className="mr-2 h-4 w-4" />
                Aprovações
                {pendingEntries > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingEntries}
                  </span>
                )}
              </Button>
            )}
            <NovoLancamentoDialog onSuccess={fetchData} />
          </div>
        </div>

        <PaymentPolicyBanner />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalEntries}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{pendingEntries}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Previsto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  R$ {totalPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">
                  R$ {totalRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Lançamentos</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lançamentos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="approved">Aprovados</SelectItem>
                    <SelectItem value="pending_financial">No Financeiro</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="rejected">Rejeitados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum lançamento encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Tente ajustar sua busca" : "Crie um novo lançamento para começar"}
                </p>
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                   <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="text-right">Valor Previsto</TableHead>
                      <TableHead className="text-right">Valor Realizado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => {
                      const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
                      const hasAttachments = attachments.length > 0;
                      const isExpanded = expandedRows.has(entry.id);

                      return (
                        <React.Fragment key={entry.id}>
                        <TableRow className="hover:bg-muted/50">
                          <TableCell className="w-10 px-2">
                            {hasAttachments ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleRowExpand(entry.id)}
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                              </Button>
                            ) : (
                              <span className="block h-7 w-7" />
                            )}
                          </TableCell>
                        <TableCell>
                          {format(new Date(entry.entry_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getEntryTypeLabel(entry.entry_type)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{entry.description || "-"}</span>
                            {hasAttachments && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" onClick={() => toggleRowExpand(entry.id)} className="inline-flex shrink-0">
                                    <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80">
                                      <Paperclip className="h-2.5 w-2.5" />
                                      {attachments.length}
                                    </Badge>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Clique para ver anexos</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {/* Installment badge */}
                            {entry.installment_number && entry.installment_total && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <SplitSquareVertical className="h-2.5 w-2.5" />
                                {entry.installment_number}/{entry.installment_total}
                              </Badge>
                            )}
                            {/* Boleto barcode indicator */}
                            {entry.boleto_barcode && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => copyBoletoBarcode(entry.boleto_barcode)}
                                    className="inline-flex"
                                  >
                                    <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80">
                                      <Barcode className="h-2.5 w-2.5" />
                                      Boleto
                                      <Copy className="h-2 w-2 ml-0.5" />
                                    </Badge>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-mono text-xs break-all">{entry.boleto_barcode}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">Clique para copiar</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {entry.due_date && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Venc: {format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.account ? (
                            <span className="font-mono text-xs">
                              {entry.account.code} - {entry.account.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.category ? (
                            <Badge variant="outline" className="text-xs">
                              {TRADE_EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.document_type ? (
                            <Badge variant="outline" className={`text-xs ${entry.document_type === 'orcamento' ? 'border-amber-300 text-amber-700 dark:text-amber-400' : ''}`}>
                              {entry.document_type === 'orcamento' ? 'Orçamento' : 
                               entry.document_type === 'nf' ? 'NF' :
                               entry.document_type === 'nfse' ? 'NFS-e' :
                               entry.document_type === 'boleto' ? 'Boleto' :
                               entry.document_type === 'recibo' ? 'Recibo' :
                               entry.document_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {entry.valor_previsto ? (
                            <>R$ {parseFloat(entry.valor_previsto).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2, maximumFractionDigits: 2,
                            })}</>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(entry.status === "pending_financial" ? "pending_financial" : entry.approval_status)}
                            {entry.document_type === "orcamento" && (
                              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 w-fit text-[10px]">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Pendente NF
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit(entry) && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEditClick(entry)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {entry.approval_status === "rejected" ? "Editar e Resubmeter" : "Editar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {canAddEvidence(entry) && (
                                <DropdownMenuItem onClick={() => handleEvidenceClick(entry)}>
                                  <FileUp className="mr-2 h-4 w-4" />
                                  Adicionar Evidência
                                </DropdownMenuItem>
                              )}
                              {entry.boleto_barcode && (
                                <DropdownMenuItem onClick={() => copyBoletoBarcode(entry.boleto_barcode)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar Linha Digitável
                                </DropdownMenuItem>
                              )}
                              {canSendToFinancial(entry) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleSendFinancialClick(entry)}>
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Enviar ao Financeiro
                                  </DropdownMenuItem>
                                </>
                              )}
                              {entry.payment_queue_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setChatEntry(entry)}>
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Comunicação Financeiro
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!canEdit(entry) && !canAddEvidence(entry) && !canSendToFinancial(entry) && !entry.boleto_barcode && !entry.payment_queue_id && (
                                <DropdownMenuItem disabled>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Sem ações disponíveis
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded attachments row */}
                      {isExpanded && hasAttachments && (
                        <TableRow className="bg-muted/30 hover:bg-muted/40">
                          <TableCell colSpan={11} className="py-3 px-6">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Paperclip className="h-3.5 w-3.5" />
                                Documentos Anexados ({attachments.length})
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {attachments.map((att: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex-shrink-0 text-muted-foreground">
                                      {getAttachmentIcon(att.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{att.name}</p>
                                      <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={async () => {
                                          const { signedUrl, error } = await resolveStorageUrl(att.url);
                                          if (error || !signedUrl) { toast.error(error || "Erro ao abrir arquivo"); return; }
                                          window.open(signedUrl, "_blank");
                                        }}
                                        title="Visualizar"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={async () => {
                                          const { signedUrl, error } = await resolveStorageUrl(att.url);
                                          if (error || !signedUrl) { toast.error(error || "Erro ao baixar"); return; }
                                          const a = document.createElement("a");
                                          a.href = signedUrl;
                                          a.download = att.name;
                                          a.click();
                                        }}
                                        title="Baixar"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedEntry && (
        <>
          <AdicionarEvidenciaDialog
            open={evidenceDialogOpen}
            onOpenChange={setEvidenceDialogOpen}
            entry={selectedEntry}
            onSuccess={fetchData}
          />
          <EditarLancamentoDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            entryId={selectedEntry.id}
            onSuccess={fetchData}
          />
          <EnviarFinanceiroTradeDialog
            entry={selectedEntry}
            open={sendFinancialDialogOpen}
            onOpenChange={setSendFinancialDialogOpen}
            onSuccess={fetchData}
          />
        </>
      )}

      <Dialog open={!!chatEntry} onOpenChange={(open) => !open && setChatEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Comunicação com Financeiro
            </DialogTitle>
          </DialogHeader>
          {chatEntry?.payment_queue_id && (
            <PaymentChatPanel
              paymentQueueId={chatEntry.payment_queue_id}
              userType="solicitante"
              compact
            />
          )}
        </DialogContent>
      </Dialog>

      <ExpenseAIChatFloat
        context={{ screen: "trade_lancamentos", totalEntries: entries.length }}
        contextLabel="Lançamentos Trade"
      />
    </DashboardLayout>
  );
}
