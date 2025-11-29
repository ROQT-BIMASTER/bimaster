import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabelaEdit?: any;
  onSuccess: () => void;
}

export function NovaTabelaPrecoDialog({ open, onOpenChange, tabelaEdit, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    tipo_base: "custo_producao",
    tabela_base_id: "",
    tipo_markup: "percentual",
    valor_markup: "0",
    ordem: "1",
    ativo: true,
    data_vigencia_inicio: "",
    data_vigencia_fim: "",
    observacoes: "",
    owner_cnpj: "",
    visivel_para_cnpjs: [] as string[],
  });

  const { data: tabelasDisponiveis } = useQuery({
    queryKey: ["tabelas-para-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, codigo, nome")
        .eq("ativo", true)
        .order("ordem");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (tabelaEdit) {
      setFormData({
        codigo: tabelaEdit.codigo || "",
        nome: tabelaEdit.nome || "",
        descricao: tabelaEdit.descricao || "",
        tipo_base: tabelaEdit.tipo_base || "custo_producao",
        tabela_base_id: tabelaEdit.tabela_base_id || "",
        tipo_markup: tabelaEdit.tipo_markup || "percentual",
        valor_markup: tabelaEdit.valor_markup?.toString() || "0",
        ordem: tabelaEdit.ordem?.toString() || "1",
        ativo: tabelaEdit.ativo ?? true,
        data_vigencia_inicio: tabelaEdit.data_vigencia_inicio || "",
        data_vigencia_fim: tabelaEdit.data_vigencia_fim || "",
        observacoes: tabelaEdit.observacoes || "",
        owner_cnpj: tabelaEdit.owner_cnpj || "",
        visivel_para_cnpjs: tabelaEdit.visivel_para_cnpjs || [],
      });
    } else {
      setFormData({
        codigo: "",
        nome: "",
        descricao: "",
        tipo_base: "custo_producao",
        tabela_base_id: "",
        tipo_markup: "percentual",
        valor_markup: "0",
        ordem: "1",
        ativo: true,
        data_vigencia_inicio: "",
        data_vigencia_fim: "",
        observacoes: "",
        owner_cnpj: "",
        visivel_para_cnpjs: [],
      });
    }
  }, [tabelaEdit, open]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: formData.codigo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        tipo_base: formData.tipo_base,
        tabela_base_id: formData.tipo_base === "tabela_anterior" ? formData.tabela_base_id : null,
        tipo_markup: formData.tipo_markup,
        valor_markup: parseFloat(formData.valor_markup),
        ordem: parseInt(formData.ordem),
        ativo: formData.ativo,
        data_vigencia_inicio: formData.data_vigencia_inicio || null,
        data_vigencia_fim: formData.data_vigencia_fim || null,
        observacoes: formData.observacoes || null,
        owner_cnpj: formData.owner_cnpj.trim() || null,
        visivel_para_cnpjs: formData.visivel_para_cnpjs.filter(c => c.trim()),
        status: 'draft', // Sempre começa como draft
      };

      if (tabelaEdit) {
        const { error } = await supabase
          .from("fabrica_tabelas_preco")
          .update(payload)
          .eq("id", tabelaEdit.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fabrica_tabelas_preco")
          .insert([payload]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tabelaEdit ? "Tabela atualizada!" : "Tabela criada com sucesso!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar tabela: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo || !formData.nome) {
      toast.error("Preencha código e nome da tabela");
      return;
    }

    if (formData.tipo_base === "tabela_anterior" && !formData.tabela_base_id) {
      toast.error("Selecione a tabela base");
      return;
    }

    const valorMarkup = parseFloat(formData.valor_markup);
    if (isNaN(valorMarkup) || valorMarkup < 0) {
      toast.error("Valor de markup inválido");
      return;
    }

    salvarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tabelaEdit ? "Editar Tabela de Preço" : "Nova Tabela de Preço"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                placeholder="TAB-FAB"
                required
              />
            </div>

            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Tabela Fábrica"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição da tabela de preço"
              rows={2}
            />
          </div>

          {/* Base de Cálculo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_base">Tipo de Base</Label>
              <Select
                value={formData.tipo_base}
                onValueChange={(value) => setFormData({ ...formData, tipo_base: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custo_producao">Custo de Produção</SelectItem>
                  <SelectItem value="tabela_anterior">Tabela Anterior</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tipo_base === "tabela_anterior" && (
              <div>
                <Label htmlFor="tabela_base">Tabela Base *</Label>
                <Select
                  value={formData.tabela_base_id}
                  onValueChange={(value) => setFormData({ ...formData, tabela_base_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tabelasDisponiveis
                      ?.filter(t => !tabelaEdit || t.id !== tabelaEdit.id)
                      .map((tabela) => (
                        <SelectItem key={tabela.id} value={tabela.id}>
                          {tabela.codigo} - {tabela.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Markup */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_markup">Tipo de Markup</Label>
              <Select
                value={formData.tipo_markup}
                onValueChange={(value) => setFormData({ ...formData, tipo_markup: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="multiplicador">Multiplicador (x)</SelectItem>
                  <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor_markup">
                Valor do Markup{" "}
                {formData.tipo_markup === "percentual" && "(%)"}
                {formData.tipo_markup === "multiplicador" && "(x)"}
                {formData.tipo_markup === "valor_fixo" && "(R$)"}
              </Label>
              <Input
                id="valor_markup"
                type="number"
                step="0.01"
                value={formData.valor_markup}
                onChange={(e) => setFormData({ ...formData, valor_markup: e.target.value })}
                placeholder={formData.tipo_markup === "multiplicador" ? "1.7" : "35"}
                required
              />
            </div>
          </div>

          {/* Vigência e Ordem */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ordem">Ordem</Label>
              <Input
                id="ordem"
                type="number"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="data_vigencia_inicio">Vigência Início</Label>
              <Input
                id="data_vigencia_inicio"
                type="date"
                value={formData.data_vigencia_inicio}
                onChange={(e) => setFormData({ ...formData, data_vigencia_inicio: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="data_vigencia_fim">Vigência Fim</Label>
              <Input
                id="data_vigencia_fim"
                type="date"
                value={formData.data_vigencia_fim}
                onChange={(e) => setFormData({ ...formData, data_vigencia_fim: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={2}
            />
          </div>

          {/* CNPJ */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Controle de Acesso por CNPJ</h4>
            
            <div>
              <Label htmlFor="owner_cnpj">CNPJ Proprietário</Label>
              <Input
                id="owner_cnpj"
                value={formData.owner_cnpj}
                onChange={(e) => setFormData({ ...formData, owner_cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deixe em branco para tornar visível a todos usuários com permissão
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
            <Label htmlFor="ativo">Tabela ativa</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending}>
              {salvarMutation.isPending ? "Salvando..." : "Salvar Tabela"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
