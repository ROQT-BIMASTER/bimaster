import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings } from "lucide-react";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function ConfiguracaoEmpresaDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    razao_social: "",
    cnpj: "",
    inscricao_estadual: "",
    uf: "",
    regime_tributario: "lucro_presumido",
    regime_apuracao_icms: "normal",
    regime_apuracao_pis_cofins: "cumulativo",
    contribuinte_ipi: false,
    iva_dual_habilitado: false,
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      carregarConfiguracao();
    }
  }, [open]);

  const carregarConfiguracao = async () => {
    try {
      const { data, error } = await supabase
        .from("fabrica_empresa_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfigId(data.id);
        setFormData({
          razao_social: data.razao_social || "",
          cnpj: data.cnpj || "",
          inscricao_estadual: data.inscricao_estadual || "",
          uf: data.uf || "",
          regime_tributario: data.regime_tributario || "lucro_presumido",
          regime_apuracao_icms: data.regime_apuracao_icms || "normal",
          regime_apuracao_pis_cofins: data.regime_apuracao_pis_cofins || "cumulativo",
          contribuinte_ipi: data.contribuinte_ipi || false,
          iva_dual_habilitado: data.iva_dual_habilitado || false,
          observacoes: data.observacoes || "",
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar configuração:", error);
      toast.error("Erro ao carregar configuração da empresa");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        created_by: user.id,
      };

      if (configId) {
        const { error } = await supabase
          .from("fabrica_empresa_config")
          .update(payload)
          .eq("id", configId);

        if (error) throw error;
        toast.success("Configuração atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("fabrica_empresa_config")
          .insert([payload]);

        if (error) throw error;
        toast.success("Configuração salva com sucesso!");
      }

      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configuração da empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Configuração da Empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração Fiscal da Empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Razão Social *</Label>
              <Input
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
              />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input
                value={formData.inscricao_estadual}
                onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
              />
            </div>
            <div>
              <Label>UF *</Label>
              <Select value={formData.uf} onValueChange={(value) => setFormData({ ...formData, uf: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Regime Tributário *</Label>
              <Select value={formData.regime_tributario} onValueChange={(value) => setFormData({ ...formData, regime_tributario: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Apuração ICMS</Label>
              <Select value={formData.regime_apuracao_icms} onValueChange={(value) => setFormData({ ...formData, regime_apuracao_icms: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="simplificado">Simplificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Apuração PIS/COFINS</Label>
              <Select value={formData.regime_apuracao_pis_cofins} onValueChange={(value) => setFormData({ ...formData, regime_apuracao_pis_cofins: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cumulativo">Cumulativo</SelectItem>
                  <SelectItem value="nao_cumulativo">Não Cumulativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center space-x-2">
              <Checkbox
                id="contribuinte_ipi"
                checked={formData.contribuinte_ipi}
                onCheckedChange={(checked) => setFormData({ ...formData, contribuinte_ipi: checked as boolean })}
              />
              <Label htmlFor="contribuinte_ipi">Contribuinte de IPI</Label>
            </div>
            <div className="col-span-2 flex items-center space-x-2">
              <Checkbox
                id="iva_dual_habilitado"
                checked={formData.iva_dual_habilitado}
                onCheckedChange={(checked) => setFormData({ ...formData, iva_dual_habilitado: checked as boolean })}
              />
              <Label htmlFor="iva_dual_habilitado">Habilitar IVA Dual (CBS/IBS) — Reforma Tributária</Label>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
