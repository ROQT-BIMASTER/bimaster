import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useSupplierPaymentExceptions,
  getExceptionSummary,
  type CreateSupplierExceptionInput,
} from "@/hooks/useSupplierPaymentExceptions";
import { getDayNameShort } from "@/hooks/useFinancialPaymentPolicies";
import { supabase } from "@/integrations/supabase/client";
import { FornecedorQuickAdd } from "@/components/fabrica/FornecedorQuickAdd";
import {
  Loader2,
  Calendar,
  Clock,
  Trash2,
  Power,
  Building2,
  Plus,
  ChevronsUpDown,
  Check,
  Search,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

interface Supplier {
  id: string;
  razao_social: string;
  cnpj: string | null;
}

export function SupplierPaymentExceptionsTab() {
  const { exceptions, isLoading, createException, deleteException, toggleException } =
    useSupplierPaymentExceptions();

  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const [form, setForm] = useState<CreateSupplierExceptionInput>({
    supplier_id: "",
    name: "",
    cutoff_day_of_week: 4,
    cutoff_time: "18:00",
    payment_day_of_week: 1,
    allows_exceptions: false,
    exception_requires_approval: true,
    description: "",
  });

  // Fetch suppliers for combobox
  useEffect(() => {
    if (!showForm) return;
    setLoadingSuppliers(true);
    supabase
      .from("fabrica_fornecedores")
      .select("id, razao_social, cnpj")
      .eq("ativo", true)
      .order("razao_social")
      .then(({ data }) => {
        setSuppliers(data || []);
        setLoadingSuppliers(false);
      });
  }, [showForm]);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);

  const handleCreate = async () => {
    if (!form.supplier_id || !form.name.trim()) return;
    await createException.mutateAsync(form);
    setShowForm(false);
    setForm({
      supplier_id: "",
      name: "",
      cutoff_day_of_week: 4,
      cutoff_time: "18:00",
      payment_day_of_week: 1,
      allows_exceptions: false,
      exception_requires_approval: true,
      description: "",
    });
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setForm((prev) => ({
      ...prev,
      supplier_id: supplier.id,
      name: prev.name || `Exceção - ${supplier.razao_social}`,
    }));
    setSupplierPopoverOpen(false);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.razao_social.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(supplierSearch))
  );

  const isFormValid = form.name.trim().length > 0 && form.supplier_id.length > 0;

  return (
    <div className="space-y-4">
      {/* Existing exceptions */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : exceptions.length > 0 ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Exceções por Fornecedor</Label>
          {exceptions.map((exc) => (
            <Card
              key={exc.id}
              className={exc.is_active ? "border-primary/50 bg-primary/5" : "opacity-60"}
            >
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">
                        {exc.supplier?.razao_social || "Fornecedor"}
                      </span>
                      {exc.supplier?.cnpj && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {exc.supplier.cnpj}
                        </Badge>
                      )}
                      {exc.is_active && (
                        <Badge variant="default" className="text-xs">
                          Ativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{exc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getExceptionSummary(exc)}
                    </p>
                    {exc.allows_exceptions && (
                      <Badge variant="outline" className="text-xs">
                        Aceita exceções
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toggleException.mutate({ id: exc.id, is_active: !exc.is_active })
                      }
                      title={exc.is_active ? "Desativar" : "Ativar"}
                    >
                      <Power
                        className={`h-4 w-4 ${
                          exc.is_active ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteException.mutate(exc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma exceção por fornecedor configurada.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Crie exceções para fornecedores com calendários de pagamento diferenciados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Form Toggle */}
      {!showForm ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Criar Exceção por Fornecedor
        </Button>
      ) : (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-4">
            {/* Supplier Select */}
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <div className="flex gap-2">
                <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="flex-1 justify-between font-normal"
                    >
                      {selectedSupplier ? (
                        <span className="truncate">
                          {selectedSupplier.razao_social}
                          {selectedSupplier.cnpj && (
                            <span className="text-muted-foreground ml-2 text-xs font-mono">
                              {selectedSupplier.cnpj}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Selecione um fornecedor...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por nome ou CNPJ..."
                        value={supplierSearch}
                        onValueChange={setSupplierSearch}
                      />
                      <CommandList>
                        {loadingSuppliers ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : filteredSuppliers.length === 0 ? (
                          <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {filteredSuppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.id}
                                onSelect={() => handleSelectSupplier(supplier)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm">{supplier.razao_social}</span>
                                  {supplier.cnpj && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {supplier.cnpj}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FornecedorQuickAdd
                  onFornecedorCriado={(novo) => {
                    const newSupplier: Supplier = {
                      id: novo.id,
                      razao_social: novo.nome,
                      cnpj: novo.cnpj || null,
                    };
                    setSuppliers((prev) => [newSupplier, ...prev]);
                    handleSelectSupplier(newSupplier);
                  }}
                />
              </div>
              {selectedSupplier && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs gap-1"
                   onClick={() => {
                    window.open(`/dashboard/fabrica/materias-primas`, "_blank");
                   }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir cadastro do fornecedor
                </Button>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome da Exceção *</Label>
              <Input
                placeholder="Ex: Pagamento semanal - Fornecedor X"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Cutoff & Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Dia de Corte
                </Label>
                <Select
                  value={String(form.cutoff_day_of_week)}
                  onValueChange={(v) => setForm({ ...form, cutoff_day_of_week: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Horário de Corte
                </Label>
                <Input
                  type="time"
                  value={form.cutoff_time}
                  onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Dia de Pagamento
              </Label>
              <Select
                value={String(form.payment_day_of_week)}
                onValueChange={(v) => setForm({ ...form, payment_day_of_week: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exceptions toggle */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Aceita Sub-Exceções</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite lançamentos fora deste calendário
                  </p>
                </div>
                <Switch
                  checked={form.allows_exceptions}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, allows_exceptions: checked })
                  }
                />
              </div>

              {form.allows_exceptions && (
                <div className="flex items-center justify-between pl-4">
                  <div>
                    <Label className="text-sm">Requer Aprovação</Label>
                    <p className="text-xs text-muted-foreground">
                      Sub-exceções precisam aprovação do financeiro
                    </p>
                  </div>
                  <Switch
                    checked={form.exception_requires_approval}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, exception_requires_approval: checked })
                    }
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva as regras específicas deste fornecedor..."
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Preview */}
            {form.supplier_id && (
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Pré-visualização:
                  </p>
                  <p className="text-sm">
                    <strong>{selectedSupplier?.razao_social}</strong> — Corte:{" "}
                    <strong>{getDayNameShort(form.cutoff_day_of_week)}</strong>{" "}
                    <strong>{form.cutoff_time}</strong> — Pagamento:{" "}
                    <strong>{getDayNameShort(form.payment_day_of_week)}</strong>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!isFormValid || createException.isPending}
              >
                {createException.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar Exceção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
