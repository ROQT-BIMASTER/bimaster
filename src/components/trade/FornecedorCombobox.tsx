import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Truck, Loader2, AlertTriangle, Building2, Key, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FornecedorQuickAdd } from "@/components/fabrica/FornecedorQuickAdd";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface FornecedorComboboxProps {
  value: string;
  onChange: (value: string) => void;
  enabled?: boolean;
}

interface BankData {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  favorecido: string | null;
}

export function FornecedorCombobox({ value, onChange, enabled = true }: FornecedorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [skipBank, setSkipBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const queryClient = useQueryClient();

  // Bank form state
  const [formBanco, setFormBanco] = useState("");
  const [formAgencia, setFormAgencia] = useState("");
  const [formConta, setFormConta] = useState("");
  const [formTipoConta, setFormTipoConta] = useState("corrente");
  const [formFavorecido, setFormFavorecido] = useState("");
  const [formPixTipo, setFormPixTipo] = useState("");
  const [formPixChave, setFormPixChave] = useState("");

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['trade-fornecedores-combobox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("status", "ativo")
        .order("razao_social")
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const selectedFornecedor = value !== "none" ? fornecedores.find(f => f.id === value) : null;
  const hasBankData = bankData && (bankData.banco || bankData.pix_chave);

  useEffect(() => {
    if (value === "none" || !value) {
      setBankData(null);
      setShowBankForm(false);
      setSkipBank(false);
      return;
    }
    const fetchBank = async () => {
      setLoadingBank(true);
      setShowBankForm(false);
      setSkipBank(false);
      try {
        const { data, error } = await supabase
          .from("fornecedores")
          .select("banco, agencia, conta_bancaria, tipo_conta, chave_pix, tipo_pix, favorecido")
          .eq("id", value)
          .single();
        if (error) throw error;
        setBankData({
          banco: data.banco,
          agencia: data.agencia,
          conta: data.conta_bancaria,
          tipo_conta: data.tipo_conta,
          pix_chave: data.chave_pix,
          pix_tipo: data.tipo_pix,
          favorecido: data.favorecido,
        });
      } catch {
        setBankData(null);
      } finally {
        setLoadingBank(false);
      }
    };
    fetchBank();
  }, [value]);

  const filtered = fornecedores.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nome = (f.nome_fantasia || f.razao_social || "").toLowerCase();
    const cnpj = (f.cnpj || "").toLowerCase();
    return nome.includes(q) || cnpj.includes(q);
  });

  const handleSaveBank = async () => {
    if (!value || value === "none") return;
    setSavingBank(true);
    try {
      const { error } = await supabase
        .from("fornecedores")
        .update({
          banco: formBanco.trim() || null,
          agencia: formAgencia.trim() || null,
          conta_bancaria: formConta.trim() || null,
          tipo_conta: formTipoConta || null,
          favorecido: formFavorecido.trim() || null,
          tipo_pix: formPixTipo || null,
          chave_pix: formPixChave.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", value);
      if (error) throw error;
      toast.success("Dados bancários salvos!");
      setBankData({
        banco: formBanco.trim() || null,
        agencia: formAgencia.trim() || null,
        conta: formConta.trim() || null,
        tipo_conta: formTipoConta || null,
        favorecido: formFavorecido.trim() || null,
        pix_tipo: formPixTipo || null,
        pix_chave: formPixChave.trim() || null,
      });
      setShowBankForm(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSavingBank(false);
    }
  };

  const handleCnpjEnrich = async (data: CnpjData) => {
    if (!value || value === "none") return;
    // Update fornecedor with enriched data
    const updateFields: Record<string, any> = {};
    if (data.razaoSocial) updateFields.razao_social = data.razaoSocial;
    if (data.nomeFantasia) updateFields.nome_fantasia = data.nomeFantasia;
    if (data.telefone) updateFields.telefone = data.telefone;
    if (data.email) updateFields.email = data.email;
    if (data.situacao) updateFields.situacao_cadastral = data.situacao;
    if (data.porte) updateFields.porte = data.porte;
    if (data.capitalSocial) updateFields.capital_social = data.capitalSocial;
    if (data.regimeTributario) updateFields.regime_tributario = data.regimeTributario;

    if (Object.keys(updateFields).length > 0) {
      await supabase.from("fornecedores").update({ ...updateFields, updated_at: new Date().toISOString() }).eq("id", value);
      queryClient.invalidateQueries({ queryKey: ['trade-fornecedores-combobox'] });
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Fornecedor
      </Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal h-9"
              type="button"
            >
              {selectedFornecedor
                ? (selectedFornecedor.nome_fantasia || selectedFornecedor.razao_social)
                : "Selecione o fornecedor (opcional)"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por nome ou CNPJ..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => { onChange("none"); setOpen(false); setSearchQuery(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground">Nenhum fornecedor</span>
                  </CommandItem>
                  {filtered.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={f.id}
                      onSelect={() => { onChange(f.id); setOpen(false); setSearchQuery(""); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === f.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{f.nome_fantasia || f.razao_social}</span>
                        {f.cnpj && <span className="text-xs text-muted-foreground">{f.cnpj}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* CNPJ enrichment button */}
        {selectedFornecedor?.cnpj && (
          <CnpjSearchButton
            cnpj={selectedFornecedor.cnpj}
            onDataFound={handleCnpjEnrich}
            size="icon"
            variant="outline"
          />
        )}

        <FornecedorQuickAdd
          onFornecedorCriado={(f) => {
            queryClient.invalidateQueries({ queryKey: ['trade-fornecedores-combobox'] });
            onChange(f.id);
          }}
        />
      </div>

      {/* Bank data section */}
      {value !== "none" && !loadingBank && bankData && (
        <>
          {hasBankData ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Dados para Pagamento
                </p>
                {bankData.banco && (
                  <p className="text-xs text-muted-foreground">
                    {bankData.banco} • Ag: {bankData.agencia || "—"} • Cc: {bankData.conta || "—"}
                    {bankData.tipo_conta ? ` (${bankData.tipo_conta})` : ""}
                  </p>
                )}
                {bankData.pix_chave && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Key className="h-3 w-3" /> PIX ({bankData.pix_tipo || "—"}): {bankData.pix_chave}
                  </p>
                )}
                {bankData.favorecido && (
                  <p className="text-xs text-muted-foreground">Favorecido: {bankData.favorecido}</p>
                )}
              </CardContent>
            </Card>
          ) : !skipBank && !showBankForm ? (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Dados bancários não cadastrados</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">Este fornecedor não possui dados bancários para pagamento.</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="default" onClick={() => setShowBankForm(true)}>
                    Preencher agora
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSkipBank(true)}>
                    Seguir sem dados
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {showBankForm && (
            <Card>
              <CardContent className="p-3 space-y-3">
                <p className="text-xs font-semibold">Dados Bancários do Fornecedor</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Banco</Label>
                    <Input value={formBanco} onChange={e => setFormBanco(e.target.value)} placeholder="Bradesco" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Agência</Label>
                    <Input value={formAgencia} onChange={e => setFormAgencia(e.target.value)} placeholder="0000" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Conta</Label>
                    <Input value={formConta} onChange={e => setFormConta(e.target.value)} placeholder="00000-0" className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tipo Conta</Label>
                    <Select value={formTipoConta} onValueChange={setFormTipoConta}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                        <SelectItem value="pagamento">Pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Favorecido</Label>
                    <Input value={formFavorecido} onChange={e => setFormFavorecido(e.target.value)} placeholder="Titular" className="h-8 text-xs" />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tipo PIX</Label>
                    <Select value={formPixTipo} onValueChange={setFormPixTipo}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Chave PIX</Label>
                    <Input value={formPixChave} onChange={e => setFormPixChave(e.target.value)} placeholder="Chave" className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowBankForm(false)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={handleSaveBank} disabled={savingBank}>
                    {savingBank ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar Dados"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {skipBank && (
            <p className="text-xs text-muted-foreground italic">Prosseguindo sem dados bancários.</p>
          )}
        </>
      )}

      {value !== "none" && loadingBank && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Verificando dados bancários...
        </p>
      )}
    </div>
  );
}
