import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useFinancialCorrectionRules,
  type CorrectionRule,
} from "@/hooks/useFinancialCorrectionRules";
import {
  Loader2,
  Trash2,
  Power,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";

const FIELD_LABELS: { key: string; label: string; description: string }[] = [
  { key: "lock_supplier_name", label: "Fornecedor", description: "Nome / Razão Social do fornecedor" },
  { key: "lock_supplier_document", label: "CNPJ/CPF", description: "Documento do fornecedor" },
  { key: "lock_document_type", label: "Tipo de Documento", description: "NF, Boleto, Recibo, etc." },
  { key: "lock_document_number", label: "Número do Documento", description: "Número da NF ou documento" },
  { key: "lock_due_date", label: "Data de Vencimento", description: "Data de vencimento do pagamento" },
  { key: "lock_portador", label: "Portador / Forma de Pagamento", description: "Banco, PIX, Carteira, etc." },
  { key: "lock_attachments", label: "Anexos", description: "Documentos anexados à despesa" },
];

export function CorrectionRulesTab() {
  const { rules, isLoading, createRule, deleteRule, toggleActive } =
    useFinancialCorrectionRules();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    lock_supplier_name: true,
    lock_supplier_document: true,
    lock_document_type: false,
    lock_document_number: false,
    lock_due_date: false,
    lock_portador: false,
    lock_attachments: false,
  });

  const handleCreate = async () => {
    await createRule.mutateAsync(form);
    setShowForm(false);
    setForm({
      name: "",
      description: "",
      lock_supplier_name: true,
      lock_supplier_document: true,
      lock_document_type: false,
      lock_document_number: false,
      lock_due_date: false,
      lock_portador: false,
      lock_attachments: false,
    });
  };

  const lockedCount = (rule: CorrectionRule) =>
    FIELD_LABELS.filter((f) => (rule as any)[f.key]).length;

  const unlockedCount = (rule: CorrectionRule) =>
    FIELD_LABELS.filter((f) => !(rule as any)[f.key]).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Defina quais campos ficam <strong>bloqueados</strong> quando o solicitante corrige uma conta rejeitada. 
        Campos bloqueados não podem ser alterados na correção.
      </div>

      {/* Existing rules */}
      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className={rule.is_active ? "border-primary/50 bg-primary/5" : "opacity-60"}
            >
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{rule.name}</span>
                      {rule.is_active && (
                        <Badge variant="default" className="text-xs">Ativa</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {FIELD_LABELS.map((f) => {
                        const isLocked = (rule as any)[f.key];
                        return (
                          <Badge
                            key={f.key}
                            variant={isLocked ? "destructive" : "outline"}
                            className="text-[10px] gap-1"
                          >
                            {isLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                            {f.label}
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lockedCount(rule)} bloqueado(s) • {unlockedCount(rule)} editável(is)
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleActive.mutate({ id: rule.id, is_active: !rule.is_active })}
                      title={rule.is_active ? "Desativar" : "Ativar"}
                    >
                      <Power className={`h-4 w-4 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteRule.mutate(rule.id)}
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
              Nenhuma regra configurada. Será usado o padrão: fornecedor bloqueado, demais campos editáveis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {!showForm ? (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          + Criar Nova Regra
        </Button>
      ) : (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Nome da Regra *</Label>
              <Input
                placeholder="Ex: Padrão - Bloquear fornecedor"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva quais campos serão bloqueados e por quê..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Campos Bloqueados na Correção</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Campos marcados como "bloqueado" não poderão ser alterados pelo solicitante ao corrigir a conta rejeitada.
              </p>
              <div className="space-y-2">
                {FIELD_LABELS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between py-1.5 px-3 rounded-md border">
                    <div>
                      <span className="text-sm font-medium">{f.label}</span>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {(form as any)[f.key] ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <Lock className="h-2.5 w-2.5 mr-0.5" />Bloqueado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <Unlock className="h-2.5 w-2.5 mr-0.5" />Editável
                          </Badge>
                        )}
                      </span>
                      <Switch
                        checked={(form as any)[f.key]}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, [f.key]: checked })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização:</p>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_LABELS.map((f) => (
                    <Badge
                      key={f.key}
                      variant={(form as any)[f.key] ? "destructive" : "outline"}
                      className="text-[10px] gap-1"
                    >
                      {(form as any)[f.key] ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name.trim() || createRule.isPending}
              >
                {createRule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Regra
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
