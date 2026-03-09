import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFinancialPaymentPolicies,
  type CreatePolicyInput,
  getDayName,
  getDayNameShort,
  formatCutoffTime,
} from "@/hooks/useFinancialPaymentPolicies";
import { SupplierPaymentExceptionsTab } from "./SupplierPaymentExceptionsTab";
import { CorrectionRulesTab } from "./CorrectionRulesTab";
import {
  Loader2,
  Calendar,
  Clock,
  Settings2,
  AlertCircle,
  Trash2,
  Power,
  Building2,
  ShieldCheck,
} from "lucide-react";

interface PaymentPolicyConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

export function PaymentPolicyConfigDialog({
  open,
  onOpenChange,
}: PaymentPolicyConfigDialogProps) {
  const { policies, isLoading, createPolicy, deletePolicy, togglePolicyActive } =
    useFinancialPaymentPolicies();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreatePolicyInput>({
    name: "",
    cutoff_day_of_week: 4,
    cutoff_time: "18:00",
    payment_day_of_week: 1,
    allows_exceptions: false,
    exception_requires_approval: true,
    description: "",
  });

  const handleCreate = async () => {
    await createPolicy.mutateAsync(form);
    setShowForm(false);
    setForm({
      name: "",
      cutoff_day_of_week: 4,
      cutoff_time: "18:00",
      payment_day_of_week: 1,
      allows_exceptions: false,
      exception_requires_approval: true,
      description: "",
    });
  };

  const isFormValid = form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Política de Pagamento
          </DialogTitle>
          <DialogDescription>
            Configure calendários de pagamento gerais e exceções por fornecedor
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral" className="gap-2">
              <Calendar className="h-4 w-4" />
              Política Geral
            </TabsTrigger>
            <TabsTrigger value="fornecedor" className="gap-2">
              <Building2 className="h-4 w-4" />
              Exceções Fornecedor
            </TabsTrigger>
            <TabsTrigger value="correcao" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Regras de Correção
            </TabsTrigger>
          </TabsList>

          {/* ────── ABA: POLÍTICA GERAL ────── */}
          <TabsContent value="geral" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : policies.length > 0 ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Políticas Existentes</Label>
                {policies.map((policy) => (
                  <Card
                    key={policy.id}
                    className={policy.is_active ? "border-primary/50 bg-primary/5" : "opacity-60"}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{policy.name}</span>
                            {policy.is_active && (
                              <Badge variant="default" className="text-xs">Ativa</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Corte: {getDayName(policy.cutoff_day_of_week)} às{" "}
                            {formatCutoffTime(policy.cutoff_time)} — Pagamento:{" "}
                            {getDayName(policy.payment_day_of_week)}
                          </p>
                          {policy.allows_exceptions && (
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
                              togglePolicyActive.mutate({
                                id: policy.id,
                                is_active: !policy.is_active,
                              })
                            }
                            title={policy.is_active ? "Desativar" : "Ativar"}
                          >
                            <Power
                              className={`h-4 w-4 ${
                                policy.is_active ? "text-primary" : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deletePolicy.mutate(policy.id)}
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
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma política configurada. Crie uma para controlar os prazos de pagamento.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Create Form Toggle */}
            {!showForm ? (
              <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
                + Criar Nova Política
              </Button>
            ) : (
              <Card className="border-primary/30">
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="policy-name">Nome da Política *</Label>
                    <Input
                      id="policy-name"
                      placeholder="Ex: Política Semanal Padrão"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Dia de Corte
                      </Label>
                      <Select
                        value={String(form.cutoff_day_of_week)}
                        onValueChange={(v) =>
                          setForm({ ...form, cutoff_day_of_week: Number(v) })
                        }
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
                        onChange={(e) =>
                          setForm({ ...form, cutoff_time: e.target.value })
                        }
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
                      onValueChange={(v) =>
                        setForm({ ...form, payment_day_of_week: Number(v) })
                      }
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

                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Aceita Exceções</Label>
                        <p className="text-xs text-muted-foreground">
                          Permite lançamentos fora do prazo de corte
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
                            Exceções precisam de aprovação do financeiro
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

                  <div className="space-y-2">
                    <Label htmlFor="policy-desc">Descrição (opcional)</Label>
                    <Textarea
                      id="policy-desc"
                      placeholder="Descreva as regras da política para os usuários..."
                      value={form.description || ""}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Preview */}
                  <Card className="bg-muted/50">
                    <CardContent className="py-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Pré-visualização:
                      </p>
                      <p className="text-sm">
                        Lançamentos até{" "}
                        <strong>{getDayNameShort(form.cutoff_day_of_week)}</strong>{" "}
                        <strong>{form.cutoff_time}</strong> — Pagamento na{" "}
                        <strong>{getDayNameShort(form.payment_day_of_week)}</strong>
                      </p>
                      {form.allows_exceptions && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ✓ Aceita exceções{" "}
                          {form.exception_requires_approval
                            ? "(com aprovação do financeiro)"
                            : "(sem aprovação)"}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!isFormValid || createPolicy.isPending}
                    >
                      {createPolicy.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Criar Política
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ────── ABA: EXCEÇÕES POR FORNECEDOR ────── */}
          <TabsContent value="fornecedor" className="mt-4">
            <SupplierPaymentExceptionsTab />
          </TabsContent>

          {/* ────── ABA: REGRAS DE CORREÇÃO ────── */}
          <TabsContent value="correcao" className="mt-4">
            <CorrectionRulesTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
