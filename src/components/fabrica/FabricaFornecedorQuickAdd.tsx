import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";

interface Props {
  onFornecedorCriado: (fornecedor: { id: string; nome: string; cnpj?: string }) => void;
}

export function FabricaFornecedorQuickAdd({ onFornecedorCriado }: Props) {
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

  const resetForm = () => {
    setNome(""); setCnpj(""); setBanco(""); setAgencia(""); setConta("");
    setTipoConta("corrente"); setFavorecido(""); setPixTipo(""); setPixChave("");
  };

  const handleSalvar = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do fornecedor"); return; }
    setSaving(true);
    try {
      const cnpjClean = cnpj.replace(/\D/g, "").trim();

      if (cnpjClean.length >= 11) {
        const { data: existing } = await supabase
          .from("fabrica_fornecedores")
          .select("id, razao_social, cnpj")
          .eq("cnpj", cnpjClean)
          .maybeSingle();

        if (existing) {
          const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
          if (banco.trim()) updateFields.banco = banco.trim();
          if (agencia.trim()) updateFields.agencia = agencia.trim();
          if (conta.trim()) updateFields.conta = conta.trim();
          if (tipoConta) updateFields.tipo_conta = tipoConta;
          if (favorecido.trim()) updateFields.favorecido = favorecido.trim();
          if (pixTipo) updateFields.pix_tipo = pixTipo;
          if (pixChave.trim()) updateFields.pix_chave = pixChave.trim();

          if (Object.keys(updateFields).length > 1) {
            await supabase.from("fabrica_fornecedores").update(updateFields).eq("id", existing.id);
          }

          toast.success("Fornecedor já existente — dados atualizados!");
          onFornecedorCriado({ id: existing.id, nome: existing.razao_social, cnpj: existing.cnpj || undefined });
          resetForm();
          setOpen(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("fabrica_fornecedores")
        .insert({
          razao_social: nome.trim(),
          nome_fantasia: nome.trim(),
          cnpj: cnpjClean || null,
          ativo: true,
          banco: banco.trim() || null,
          agencia: agencia.trim() || null,
          conta: conta.trim() || null,
          tipo_conta: tipoConta || null,
          favorecido: favorecido.trim() || null,
          pix_tipo: pixTipo || null,
          pix_chave: pixChave.trim() || null,
        })
        .select("id, razao_social, cnpj")
        .single();

      if (error) throw error;

      toast.success("Fornecedor da fábrica cadastrado!");
      onFornecedorCriado({ id: data.id, nome: data.razao_social, cnpj: data.cnpj || undefined });
      resetForm();
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao criar fornecedor fábrica:", error);
      toast.error("Erro ao cadastrar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Cadastrar novo fornecedor (Fábrica)">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Novo Fornecedor (Fábrica)</h4>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="banco">Banco/PIX</TabsTrigger>
            </TabsList>
            <TabsContent value="basico" className="space-y-3 mt-3">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fornecedor" className="mt-1" />
              </div>
              <div>
                <Label>CNPJ/CPF</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="flex-1" />
                  <CnpjSearchButton
                    cnpj={cnpj}
                    onDataFound={(data: CnpjData) => {
                      setNome(data.razaoSocial || data.nomeFantasia || nome);
                      if (data.razaoSocial || data.nomeFantasia) setFavorecido(data.razaoSocial || data.nomeFantasia || favorecido);
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="banco" className="space-y-3 mt-3">
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Banco</Label><Input value={banco} onChange={e => setBanco(e.target.value)} className="mt-1" /></div>
                <div><Label>Agência</Label><Input value={agencia} onChange={e => setAgencia(e.target.value)} className="mt-1" /></div>
                <div><Label>Conta</Label><Input value={conta} onChange={e => setConta(e.target.value)} className="mt-1" /></div>
              </div>
              <div>
                <Label>Favorecido</Label>
                <Input value={favorecido} onChange={e => setFavorecido(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo PIX</Label>
                  <Select value={pixTipo} onValueChange={setPixTipo}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Chave PIX</Label><Input value={pixChave} onChange={e => setPixChave(e.target.value)} className="mt-1" /></div>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={saving || !nome.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
