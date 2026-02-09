import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Store, Loader2, AlertTriangle, Building2, Key } from "lucide-react";
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
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";

interface BankData {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  favorecido: string | null;
}

interface LojaComboboxProps {
  value: string;
  onChange: (value: string) => void;
  stores: Array<{ id: string; name: string; code: string; cnpj?: string | null }>;
  onAddNew?: () => void;
}

export function LojaCombobox({ value, onChange, stores, onAddNew }: LojaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [skipBank, setSkipBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  // Bank form state
  const [formBanco, setFormBanco] = useState("");
  const [formAgencia, setFormAgencia] = useState("");
  const [formConta, setFormConta] = useState("");
  const [formTipoConta, setFormTipoConta] = useState("corrente");
  const [formFavorecido, setFormFavorecido] = useState("");
  const [formPixTipo, setFormPixTipo] = useState("");
  const [formPixChave, setFormPixChave] = useState("");

  const selected = value !== "none" ? stores.find(s => s.id === value) : null;
  const hasBankData = bankData && (bankData.banco || bankData.pix_chave);

  // Fetch bank data when store changes
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
          .from("stores")
          .select("banco, agencia, conta, tipo_conta, pix_chave, pix_tipo, favorecido")
          .eq("id", value)
          .single();
        if (error) throw error;
        setBankData(data as BankData);
      } catch {
        setBankData(null);
      } finally {
        setLoadingBank(false);
      }
    };
    fetchBank();
  }, [value]);

  const filtered = stores.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.cnpj || "").includes(q);
  });

  const handleSaveBank = async () => {
    if (!value || value === "none") return;
    setSavingBank(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          banco: formBanco.trim() || null,
          agencia: formAgencia.trim() || null,
          conta: formConta.trim() || null,
          tipo_conta: formTipoConta || null,
          favorecido: formFavorecido.trim() || null,
          pix_tipo: formPixTipo || null,
          pix_chave: formPixChave.trim() || null,
        })
        .eq("id", value);
      if (error) throw error;
      toast.success("Dados bancários da loja salvos!");
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
    const updateFields: Record<string, any> = {};
    if (data.situacao) updateFields.situacao_cadastral = data.situacao;
    if (data.porte) updateFields.porte_empresa = data.porte;
    if (data.capitalSocial) updateFields.capital_social = data.capitalSocial.toString();
    if (data.regimeTributario) updateFields.regime_tributario = data.regimeTributario;
    if (data.cnae) updateFields.cnae_principal = data.cnae;
    if (data.telefone) updateFields.phone = data.telefone;
    if (data.email) updateFields.email = data.email;
    if (data.endereco) updateFields.address = data.endereco;
    if (data.cidade) updateFields.city = data.cidade;
    if (data.uf) updateFields.state = data.uf;
    if (data.cep) updateFields.zip_code = data.cep;

    if (Object.keys(updateFields).length > 0) {
      await supabase.from("stores").update(updateFields).eq("id", value);
    }
  };

  // Get selected store's CNPJ for enrichment
  const selectedCnpj = selected?.cnpj || null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Store className="h-4 w-4" />
        Loja/PDV
      </Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal h-9 text-sm"
              type="button"
            >
              {selected ? `${selected.code} - ${selected.name}` : "Selecione a loja (opcional)"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por código, nome ou CNPJ..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => { onChange("none"); setOpen(false); setSearchQuery(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground">Nenhuma loja</span>
                  </CommandItem>
                  {filtered.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => { onChange(s.id); setOpen(false); setSearchQuery(""); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{s.code} - {s.name}</span>
                        {s.cnpj && <span className="text-xs text-muted-foreground">{s.cnpj}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* CNPJ enrichment button */}
        {selectedCnpj && (
          <CnpjSearchButton
            cnpj={selectedCnpj}
            onDataFound={handleCnpjEnrich}
            size="icon"
            variant="outline"
          />
        )}

        {onAddNew && (
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onAddNew}>
            <span className="text-lg leading-none">+</span>
          </Button>
        )}
      </div>

      {/* Bank data section for store */}
      {value !== "none" && !loadingBank && bankData && (
        <>
          {hasBankData ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Dados para Pagamento da Loja
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
              <AlertTitle>Dados bancários da loja não cadastrados</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">Esta loja não possui dados bancários para pagamento.</p>
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
                <p className="text-xs font-semibold">Dados Bancários da Loja</p>
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
            <p className="text-xs text-muted-foreground italic">Prosseguindo sem dados bancários da loja.</p>
          )}
        </>
      )}

      {value !== "none" && loadingBank && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Verificando dados bancários da loja...
        </p>
      )}
    </div>
  );
}
