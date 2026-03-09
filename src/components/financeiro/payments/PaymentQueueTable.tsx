import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, Target, Calendar, Loader2, Building, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PaymentQueueItem, PaymentQueueStatus, SourceType } from "@/hooks/useFinancialPaymentQueue";
import { usePaymentMessageCounts } from "@/hooks/usePaymentMessages";
import { PaymentChatPanel } from "./PaymentChatPanel";

interface Department {
  id: string;
  nome: string;
}

interface Empresa {
  id: number;
  nome: string;
}

interface PaymentQueueTableProps {
  items: PaymentQueueItem[];
  isLoading: boolean;
  onReview: (item: PaymentQueueItem) => void;
  departments: Department[];
  empresas: Empresa[];
  filters: {
    status: PaymentQueueStatus | 'all';
    source_type: string; // Can be SourceType, 'all', or 'dept:DepartmentName'
    empresa_id: number | 'all';
    search: string;
  };
  onFiltersChange: (filters: PaymentQueueTableProps['filters']) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const statusConfig: Record<PaymentQueueStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  accepted: { label: "Aceito", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  paid: { label: "Pago", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const sourceTypeConfig: Record<SourceType, { label: string; icon: typeof Target; color: string }> = {
  trade_entry: { label: "Trade - Lançamento", icon: Target, color: "text-blue-500" },
  trade_investment: { label: "Trade - Investimento", icon: Target, color: "text-purple-500" },
  trade_campaign: { label: "Trade - Campanha", icon: Target, color: "text-indigo-500" },
  event_expense: { label: "Evento", icon: Calendar, color: "text-pink-500" },
  department_expense: { label: "Departamento", icon: Building, color: "text-teal-500" },
};

export function PaymentQueueTable({ items, isLoading, onReview, departments, empresas, filters, onFiltersChange }: PaymentQueueTableProps) {
  const [chatItem, setChatItem] = useState<PaymentQueueItem | null>(null);
  const { data: messageCounts } = usePaymentMessageCounts(items.map(i => i.id));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fornecedor ou código..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        
        <Select
          value={filters.source_type}
          onValueChange={(value) => onFiltersChange({ ...filters, source_type: value })}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Origens</SelectItem>
            
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground px-2">Trade</SelectLabel>
              <SelectItem value="trade_entry">Trade - Lançamento</SelectItem>
              <SelectItem value="trade_investment">Trade - Investimento</SelectItem>
              <SelectItem value="trade_campaign">Trade - Campanha</SelectItem>
            </SelectGroup>
            
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground px-2">Eventos</SelectLabel>
              <SelectItem value="event_expense">Evento</SelectItem>
            </SelectGroup>
            
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground px-2">Departamentos</SelectLabel>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={`dept:${dept.nome}`}>
                  {dept.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Empresa/Filial filter */}
        <Select
          value={filters.empresa_id === 'all' ? 'all' : filters.empresa_id.toString()}
          onValueChange={(value) => onFiltersChange({ 
            ...filters, 
            empresa_id: value === 'all' ? 'all' : parseInt(value) 
          })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Filiais</SelectItem>
            {empresas.map((empresa) => (
              <SelectItem key={empresa.id} value={empresa.id.toString()}>
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3" />
                  {empresa.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as PaymentQueueStatus | 'all' })}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="accepted">Aceitos</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">Código</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">Chat</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const sourceConfig = sourceTypeConfig[item.source_type];
                const status = statusConfig[item.financial_status];
                const isOverdue = new Date(item.due_date) < new Date() && item.financial_status === 'pending';

                return (
                  <TableRow key={item.id} className={cn(isOverdue && "bg-destructive/10")}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <sourceConfig.icon className={cn("h-4 w-4", sourceConfig.color)} />
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {item.source_type === 'department_expense' && item.department_name
                              ? item.department_name
                              : sourceConfig.label}
                          </span>
                          {item.source_code && (
                            <span className="text-xs text-muted-foreground">{item.source_code}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.empresa_nome ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]" title={item.empresa_nome}>
                            {item.empresa_nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.supplier_name}</span>
                        {item.supplier_document && (
                          <span className="text-xs text-muted-foreground">{item.supplier_document}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <span className={cn(isOverdue && "text-destructive font-medium")}>
                        {format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {isOverdue && (
                        <span className="text-xs text-destructive block">Vencido</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const counts = messageCounts?.[item.id];
                        return (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 relative"
                            onClick={() => setChatItem(item)}
                          >
                            <MessageCircle className="h-4 w-4" />
                            {counts && counts.unread > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center" style={{ animation: "blink-unread 1.2s ease-in-out infinite" }}>
                                {counts.unread}
                              </span>
                            )}
                            {counts && counts.total > 0 && counts.unread === 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center">
                                {counts.total}
                              </span>
                            )}
                          </Button>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReview(item)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Chat Dialog */}
      <Dialog open={!!chatItem} onOpenChange={(open) => !open && setChatItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comunicação — {chatItem?.code}
            </DialogTitle>
          </DialogHeader>
          {chatItem && (
            <PaymentChatPanel
              paymentQueueId={chatItem.id}
              userType="financeiro"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
