import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
import { DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { AprovarDespesaDepartamentoDialog } from "./AprovarDespesaDepartamentoDialog";
import {
  X,
  Search,
  Receipt,
  DollarSign,
  Calendar,
  User,
  Paperclip,
  Building2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DespesasFocoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: DepartmentExpense[];
  departments: { id: string; nome: string }[];
}

export function DespesasFocoModeDialog({
  open,
  onOpenChange,
  expenses,
  departments,
}: DespesasFocoModeDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedExpense, setSelectedExpense] = useState<DepartmentExpense | null>(null);

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.creator?.nome.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment =
      filterDepartment === "all" || expense.department_id === filterDepartment;
    const matchesCategory =
      filterCategory === "all" || expense.category === filterCategory;

    return matchesSearch && matchesDepartment && matchesCategory;
  });

  const totalValue = filteredExpenses.reduce(
    (sum, e) => sum + (e.valor_realizado || e.valor_previsto || 0),
    0
  );

  const getCategoryLabel = (value: string) => {
    const cat = DEPARTMENT_EXPENSE_CATEGORIES.find((c) => c.value === value);
    return cat?.label || value;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Receipt className="h-5 w-5 text-destructive" />
                Modo Foco — Despesas Pendentes
              </DialogTitle>
              <DialogDescription className="mt-1">
                Revise todas as despesas pendentes em tela cheia com filtros avançados
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Counters + Filters */}
          <div className="px-6 pb-4 space-y-3">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{filteredExpenses.length}</Badge>
                <span className="text-muted-foreground">
                  despesa{filteredExpenses.length !== 1 ? "s" : ""} pendente{filteredExpenses.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="font-semibold">
                  R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground">valor total</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, descrição, criador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos Departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas Categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {DEPARTMENT_EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Table */}
          <ScrollArea className="flex-1 px-6 py-4">
            {filteredExpenses.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma despesa encontrada</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm || filterDepartment !== "all" || filterCategory !== "all"
                    ? "Tente ajustar os filtros"
                    : "Todas as despesas foram revisadas"}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Criador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Anexos</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead className="text-center w-[80px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => {
                      const hasAttachments =
                        expense.attachments && expense.attachments.length > 0;

                      return (
                        <TableRow
                          key={expense.id}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {expense.code}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">
                                {expense.department?.nome || "—"}
                              </span>
                            </div>
                            {(expense.empresa_nome || expense.empresa?.nome) && (
                              <span className="text-xs text-muted-foreground">
                                {expense.empresa?.nome || expense.empresa_nome}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {getCategoryLabel(expense.category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="text-sm truncate block">
                              {expense.description || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">
                                {expense.creator?.nome || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {expense.expense_date ? (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">
                                  {format(
                                    new Date(expense.expense_date),
                                    "dd/MM/yyyy",
                                    { locale: ptBR }
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {hasAttachments ? (
                              <Badge variant="outline" className="gap-1">
                                <Paperclip className="h-3 w-3" />
                                {expense.attachments.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            R${" "}
                            {(expense.valor_previsto || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            R${" "}
                            {(expense.valor_realizado || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedExpense(expense);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      {selectedExpense && (
        <AprovarDespesaDepartamentoDialog
          open={!!selectedExpense}
          onOpenChange={(openVal) => !openVal && setSelectedExpense(null)}
          expense={selectedExpense}
        />
      )}
    </>
  );
}
