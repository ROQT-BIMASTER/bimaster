import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  X,
  Search,
  FileText,
  DollarSign,
  Calendar,
  Store,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Paperclip,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  ClipboardList,
  User,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lancamento {
  id: string;
  cliente: string;
  campanha: string;
  valorPedido: number;
  valorPago: number | null;
  status: string;
  roi: number | null;
  data: string;
  campaign_id?: string;
  customer_id?: string;
  evidencias?: string[];
  sell_out_anterior?: number;
  sell_out_atual?: number;
  tipo_brinde?: string;
  acoes_manuais?: string;
  source?: 'campaign' | 'financial_entry';
  description?: string;
  supplier_name?: string;
  entry_type?: string;
}

interface TradeFocoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamentos: Lancamento[];
}

export function TradeFocoModeDialog({ open, onOpenChange, lancamentos }: TradeFocoModeDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "outline" },
      approved: { label: "Aprovado", variant: "default" },
      pending_financial: { label: "Pend. Financeiro", variant: "secondary" },
      sent_financial: { label: "Env. Financeiro", variant: "secondary" },
      rejected: { label: "Rejeitado", variant: "destructive" },
      completed: { label: "Concluído", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const getRoiBadge = (roi: number | null) => {
    if (roi === null) return <span className="flex items-center gap-1 text-muted-foreground text-xs"><Minus className="h-3 w-3" />N/A</span>;
    if (roi > 0) return <span className="flex items-center gap-1 text-emerald-500 font-medium text-xs"><TrendingUp className="h-3 w-3" />+{roi.toFixed(1)}%</span>;
    return <span className="flex items-center gap-1 text-destructive font-medium text-xs"><TrendingDown className="h-3 w-3" />{roi.toFixed(1)}%</span>;
  };

  const filtered = lancamentos.filter((l) => {
    const matchesSearch =
      l.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.campanha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.supplier_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesSource = sourceFilter === "all" || l.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const totalPago = filtered.reduce((sum, l) => sum + (l.valorPago ?? 0), 0);
  const totalPedido = filtered.reduce((sum, l) => sum + l.valorPedido, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Modo Foco — Lançamentos Trade
            </DialogTitle>
            <DialogDescription className="mt-1">
              Visualização detalhada de todos os lançamentos com drill-down completo
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Counters + Filters */}
        <div className="px-6 pb-4 space-y-3">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filtered.length}</Badge>
              <span className="text-muted-foreground">
                lançamento{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold">{formatCurrency(totalPedido)}</span>
              <span className="text-muted-foreground">valor total</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-emerald-600">{formatCurrency(totalPago)}</span>
              <span className="text-muted-foreground">pago</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, campanha, fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending_financial">Pend. Financeiro</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="campaign">Campanhas</SelectItem>
                <SelectItem value="financial_entry">Lançamentos Diretos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum lançamento encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || statusFilter !== "all" || sourceFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Nenhum lançamento no período"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Cliente / Fornecedor</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Docs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lancamento) => {
                    const isExpanded = expandedId === lancamento.id;
                    const hasEvidencias = lancamento.evidencias && lancamento.evidencias.length > 0;
                    const hasDetails = hasEvidencias || lancamento.sell_out_anterior !== undefined || lancamento.sell_out_atual !== undefined || lancamento.tipo_brinde || lancamento.acoes_manuais || lancamento.description;

                    return (
                      <Collapsible key={lancamento.id} open={isExpanded} onOpenChange={() => setExpandedId(prev => prev === lancamento.id ? null : lancamento.id)} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/30 transition-colors">
                              <TableCell className="px-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="font-medium text-sm">{lancamento.cliente}</span>
                                </div>
                                {lancamento.supplier_name && lancamento.supplier_name !== lancamento.cliente && (
                                  <span className="text-xs text-muted-foreground">{lancamento.supplier_name}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm">{lancamento.campanha}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {lancamento.source === 'financial_entry' ? 'Direto' : 'Campanha'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(lancamento.valorPedido)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded text-sm">
                                  {formatCurrency(lancamento.valorPago ?? 0)}
                                </span>
                              </TableCell>
                              <TableCell>{getStatusBadge(lancamento.status)}</TableCell>
                              <TableCell className="text-right">{getRoiBadge(lancamento.roi)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">
                                    {lancamento.data ? format(new Date(lancamento.data), "dd/MM/yy", { locale: ptBR }) : "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {hasEvidencias ? (
                                  <Badge variant="outline" className="gap-1">
                                    <Paperclip className="h-3 w-3" />
                                    {lancamento.evidencias!.length}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>

                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={10} className="p-0">
                                <div className="px-8 py-4 bg-muted/20 border-t border-b space-y-4">
                                  {/* Detail grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {lancamento.description && (
                                      <div className="col-span-2 space-y-1">
                                        <p className="text-xs text-muted-foreground font-medium">Descrição</p>
                                        <p className="text-sm">{lancamento.description}</p>
                                      </div>
                                    )}

                                    {lancamento.entry_type && (
                                      <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                          <Tag className="h-3 w-3" /> Tipo
                                        </p>
                                        <Badge variant="outline" className="text-xs">{lancamento.entry_type}</Badge>
                                      </div>
                                    )}

                                    {lancamento.tipo_brinde && (
                                      <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                          <Tag className="h-3 w-3" /> Tipo de Brinde
                                        </p>
                                        <Badge variant="outline" className="text-xs">{lancamento.tipo_brinde}</Badge>
                                      </div>
                                    )}
                                  </div>

                                  {/* Sell Out comparison */}
                                  {(lancamento.sell_out_anterior !== undefined || lancamento.sell_out_atual !== undefined) && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 rounded-lg border bg-background">
                                        <p className="text-xs text-muted-foreground mb-1">Sell Out Anterior</p>
                                        <p className="font-bold text-lg">
                                          {lancamento.sell_out_anterior !== undefined ? formatCurrency(lancamento.sell_out_anterior) : "-"}
                                        </p>
                                      </div>
                                      <div className="p-3 rounded-lg border bg-background">
                                        <p className="text-xs text-muted-foreground mb-1">Sell Out Atual</p>
                                        <p className="font-bold text-lg">
                                          {lancamento.sell_out_atual !== undefined ? formatCurrency(lancamento.sell_out_atual) : "-"}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Ações Manuais */}
                                  {lancamento.acoes_manuais && (
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground font-medium">Ações Realizadas</p>
                                      <p className="text-sm p-3 rounded-lg bg-background border">{lancamento.acoes_manuais}</p>
                                    </div>
                                  )}

                                  {/* Evidências / Documentos */}
                                  {hasEvidencias && (
                                    <div className="space-y-2">
                                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                        <Paperclip className="h-3 w-3" />
                                        Evidências ({lancamento.evidencias!.length})
                                      </p>
                                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                        {lancamento.evidencias!.map((url, idx) => (
                                          <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block aspect-square rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all"
                                          >
                                            <img
                                              src={url}
                                              alt={`Evidência ${idx + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* No extra details message */}
                                  {!hasDetails && (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                      Sem detalhes adicionais disponíveis
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
