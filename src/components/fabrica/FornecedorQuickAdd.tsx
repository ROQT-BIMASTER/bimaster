import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";

interface Props {
  onFornecedorCriado: (fornecedor: { id: string; nome: string; cnpj?: string }) => void;
}

export function FornecedorQuickAdd({ onFornecedorCriado }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState("corrente");
  const [favorecido, setFavorecido] = useState("");
  
  const [pixTipo, setPixTipo] = useState("");
  const [pixChave, setPixChave] = useState("");
  
  const [linhaDigitavel, setLinhaDigitavel] = useState("");

  const resetForm = () => {
    setNome(""); setCnpj(""); setBanco(""); setAgencia(""); setConta("");
    setTipoConta("corrente"); setFavorecido(""); setPixTipo(""); setPixChave("");
    setLinhaDigitavel("");
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }

    if (pixChave.trim() && !pixTipo) {
      toast.error("Selecione o tipo da chave PIX");
      return;
    }
    if (pixTipo && !pixChave.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }

    setSaving(true);
    try {
      const cnpjClean = cnpj.replace(/\D/g, "").trim();

      // Check if CNPJ already exists in fornecedores
      if (cnpjClean.length >= 11) {
        const { data: existing } = await supabase
          .from("fornecedores")
          .select("id, nome, cnpj")
          .eq("cnpj", cnpjClean)
          .maybeSingle();
        
        if (existing) {
          // Update existing with banking data if provided
          const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
          if (banco.trim()) updateFields.banco = banco.trim();
          if (agencia.trim()) updateFields.agencia = agencia.trim();
          if (conta.trim()) updateFields.conta_bancaria = conta.trim();
          if (tipoConta) updateFields.tipo_conta = tipoConta;
          if (favorecido.trim()) updateFields.favorecido = favorecido.trim();
          if (pixTipo) updateFields.tipo_pix = pixTipo;
          if (pixChave.trim()) updateFields.chave_pix = pixChave.trim();
          if (linhaDigitavel.trim()) updateFields.linha_digitavel = linhaDigitavel.trim();

          if (Object.keys(updateFields).length > 1) {
            await supabase.from("fornecedores").update(updateFields).eq("id", existing.id);
          }

          toast.success("Fornecedor já existente — dados bancários atualizados!");
          onFornecedorCriado({ id: existing.id, nome: existing.nome, cnpj: existing.cnpj || undefined });
          resetForm();
          setOpen(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          nome: nome.trim(),
          cnpj: cnpjClean || "00000000000000",
          razao_social: nome.trim(),
          nome_fantasia: nome.trim(),
          status: "ativo",
          banco: banco.trim() || null,
          agencia: agencia.trim() || null,
          conta_bancaria: conta.trim() || null,
          tipo_conta: tipoConta || null,
          favorecido: favorecido.trim() || null,
          tipo_pix: pixTipo || null,
          chave_pix: pixChave.trim() || null,
          linha_digitavel: linhaDigitavel.trim() || null,
        })
        .select("id, nome, cnpj, tipo_pix, chave_pix")
        .single();

      if (error) throw error;

      const msgs = ["Fornecedor cadastrado!"];
      if (data.chave_pix) msgs.push(`PIX ${data.tipo_pix}: ${data.chave_pix}`);
      toast.success(msgs.join(" • "));

      onFornecedorCriado({ 
        id: data.id, 
        nome: data.nome,
        cnpj: data.cnpj || undefined
      });
      resetForm();
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao criar fornecedor:", error);
      toast.error("Erro ao cadastrar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Cadastrar novo fornecedor">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Novo Fornecedor</h4>
          
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="banco">Banco</TabsTrigger>
              <TabsTrigger value="pix">PIX/Boleto</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basico" className="space-y-3 mt-3">
              <div>
                <Label htmlFor="quick-nome">Nome / Razão Social *</Label>
                <Input id="quick-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do fornecedor" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="quick-cnpj">CNPJ/CPF</Label>
                <div className="flex gap-2 mt-1">
                  <Input id="quick-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="flex-1" />
                  <CnpjSearchButton
                    cnpj={cnpj}
                    onDataFound={(data: CnpjData) => {
                      setNome(data.razaoSocial || data.nomeFantasia || nome);
                      if (data.razaoSocial || data.nomeFantasia) {
                        setFavorecido(data.razaoSocial || data.nomeFantasia || favorecido);
                      }
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="banco" className="space-y-3 mt-3">
              <div>
                <Label htmlFor="quick-banco">Banco</Label>
                <Input id="quick-banco" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ex: Bradesco, Itaú, Nubank" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="quick-agencia">Agência</Label>
                  <Input id="quick-agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="0000" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="quick-conta">Conta</Label>
                  <Input id="quick-conta" value={conta} onChange={(e) => setConta(e.target.value)} placeholder="00000-0" className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="quick-tipo-conta">Tipo de Conta</Label>
                <Select value={tipoConta} onValueChange={setTipoConta}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupança</SelectItem>
                    <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quick-favorecido">Favorecido</Label>
                <Input id="quick-favorecido" value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Nome do titular da conta" className="mt-1" />
              </div>
            </TabsContent>
            
            <TabsContent value="pix" className="space-y-3 mt-3">
              <div>
                <Label htmlFor="quick-pix-tipo">Tipo de Chave PIX</Label>
                <Select value={pixTipo} onValueChange={setPixTipo}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                <Label htmlFor="quick-pix-chave">Chave PIX</Label>
                <Input id="quick-pix-chave" value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="Digite a chave PIX" className="mt-1" />
              </div>
              <div className="pt-2 border-t">
                <Label htmlFor="quick-linha-digitavel">Linha Digitável (Boleto)</Label>
                <Input id="quick-linha-digitavel" value={linhaDigitavel} onChange={(e) => setLinhaDigitavel(e.target.value)} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" className="mt-1 text-xs" />
                <p className="text-xs text-muted-foreground mt-1">Se o pagamento for por boleto, cole a linha digitável aqui</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSalvar} disabled={saving || !nome.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
