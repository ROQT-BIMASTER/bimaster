import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Pencil,
  QrCode,
  Building,
  FileBarChart,
} from "lucide-react";

interface FornecedorPaymentInfoProps {
  fornecedorId: string;
}

interface PaymentData {
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  favorecido: string;
  pix_tipo: string;
  pix_chave: string;
  linha_digitavel: string;
}

export function FornecedorPaymentInfo({ fornecedorId }: FornecedorPaymentInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaymentData>({
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "corrente",
    favorecido: "",
    pix_tipo: "",
    pix_chave: "",
    linha_digitavel: "",
  });

  useEffect(() => {
    if (!fornecedorId || !isOpen) return;
    setLoading(true);
    supabase
      .from("fabrica_fornecedores")
      .select("banco, agencia, conta, tipo_conta, favorecido, pix_tipo, pix_chave, linha_digitavel")
      .eq("id", fornecedorId)
      .single()
      .then(({ data: row }) => {
        if (row) {
          setData({
            banco: row.banco || "",
            agencia: row.agencia || "",
            conta: row.conta || "",
            tipo_conta: row.tipo_conta || "corrente",
            favorecido: row.favorecido || "",
            pix_tipo: row.pix_tipo || "",
            pix_chave: row.pix_chave || "",
            linha_digitavel: row.linha_digitavel || "",
          });
        }
        setLoading(false);
      });
  }, [fornecedorId, isOpen]);

  const hasAnyData = data.pix_chave || data.banco || data.linha_digitavel;

  const handleSave = async () => {
    // PIX validation
    if (data.pix_chave.trim() && !data.pix_tipo) {
      toast.error("Selecione o tipo da chave PIX");
      return;
    }
    if (data.pix_tipo && !data.pix_chave.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("fabrica_fornecedores")
        .update({
          banco: data.banco.trim() || null,
          agencia: data.agencia.trim() || null,
          conta: data.conta.trim() || null,
          tipo_conta: data.tipo_conta || null,
          favorecido: data.favorecido.trim() || null,
          pix_tipo: data.pix_tipo || null,
          pix_chave: data.pix_chave.trim() || null,
          linha_digitavel: data.linha_digitavel.trim() || null,
        })
        .eq("id", fornecedorId);

      if (error) throw error;
      toast.success("Dados de pagamento do fornecedor atualizados!");
      setEditing(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-8 px-2"
        >
          <span className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Dados de Pagamento do Fornecedor
            {!isOpen && hasAnyData && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {data.pix_chave ? "PIX" : data.banco ? "Banco" : "Boleto"}
              </Badge>
            )}
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg p-3 mt-1 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Informações cadastradas</span>
              {!editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              )}
            </div>

            {/* PIX Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <QrCode className="h-3 w-3" />
                PIX
              </div>
              {editing ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Tipo de Chave</Label>
                    <Select value={data.pix_tipo} onValueChange={(v) => setData({ ...data, pix_tipo: v })}>
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Chave PIX</Label>
                    <Input
                      value={data.pix_chave}
                      onChange={(e) => setData({ ...data, pix_chave: e.target.value })}
                      placeholder="Chave PIX"
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  {data.pix_chave ? (
                    <span>
                      <Badge variant="outline" className="text-[9px] mr-1">{data.pix_tipo?.toUpperCase()}</Badge>
                      {data.pix_chave}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Não cadastrado</span>
                  )}
                </div>
              )}
            </div>

            {/* Bank Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Building className="h-3 w-3" />
                Conta Bancária
              </div>
              {editing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px]">Banco</Label>
                      <Input
                        value={data.banco}
                        onChange={(e) => setData({ ...data, banco: e.target.value })}
                        placeholder="Ex: Itaú"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Agência</Label>
                      <Input
                        value={data.agencia}
                        onChange={(e) => setData({ ...data, agencia: e.target.value })}
                        placeholder="0000"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Conta</Label>
                      <Input
                        value={data.conta}
                        onChange={(e) => setData({ ...data, conta: e.target.value })}
                        placeholder="00000-0"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Tipo de Conta</Label>
                      <Select value={data.tipo_conta} onValueChange={(v) => setData({ ...data, tipo_conta: v })}>
                        <SelectTrigger className="h-8 text-xs mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrente">Conta Corrente</SelectItem>
                          <SelectItem value="poupanca">Conta Poupança</SelectItem>
                          <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Favorecido</Label>
                      <Input
                        value={data.favorecido}
                        onChange={(e) => setData({ ...data, favorecido: e.target.value })}
                        placeholder="Titular"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  {data.banco ? (
                    <span>{data.banco} • Ag {data.agencia} • Cc {data.conta} ({data.tipo_conta})</span>
                  ) : (
                    <span className="text-muted-foreground italic">Não cadastrado</span>
                  )}
                </div>
              )}
            </div>

            {/* Boleto Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <FileBarChart className="h-3 w-3" />
                Boleto
              </div>
              {editing ? (
                <div>
                  <Label className="text-[11px]">Linha Digitável</Label>
                  <Input
                    value={data.linha_digitavel}
                    onChange={(e) => setData({ ...data, linha_digitavel: e.target.value })}
                    placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                    className="h-8 text-[10px] mt-0.5 font-mono"
                  />
                </div>
              ) : (
                <div className="text-xs">
                  {data.linha_digitavel ? (
                    <span className="font-mono text-[10px] break-all">{data.linha_digitavel}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Não cadastrado</span>
                  )}
                </div>
              )}
            </div>

            {/* Save/Cancel buttons */}
            {editing && (
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
