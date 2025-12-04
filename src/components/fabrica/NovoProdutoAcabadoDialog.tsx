import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useMutationWithTimeout } from "@/hooks/useMutationWithTimeout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoEdit?: any;
  onSuccess: () => void;
}

export function NovoProdutoAcabadoDialog({ open, onOpenChange, produtoEdit, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    // Identificação básica
    codigo: "",
    sku: "",
    codigo_barras_ean: "",
    codigo_legado: "",
    
    // Nomes e descrições
    nome: "",
    nome_comercial: "",
    descricao: "",
    descricao_completa: "",
    descricao_curta: "",
    
    // Classificação
    categoria: "",
    subcategoria: "",
    linha: "",
    marca: "",
    fabricante: "",
    modelo: "",
    versao_variacao: "",
    
    // Dados técnicos
    formula_id: "",
    unidade_medida_id: "",
    tipo: "ACABADO",
    tempo_producao_minutos: "",
    rendimento: "",
    
    // Outros
    foto_url: "",
    status: "ativo",
    ativo: true,
  });

  const { data: formulas } = useQuery({
    queryKey: ["formulas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_formulas")
        .select("id, produto_id, versao, fabrica_produtos(nome)")
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_unidades_medida")
        .select("*")
        .order("sigla");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (produtoEdit && open) {
      setFormData({
        codigo: produtoEdit.codigo || "",
        sku: produtoEdit.sku || "",
        codigo_barras_ean: produtoEdit.codigo_barras_ean || "",
        codigo_legado: produtoEdit.codigo_legado || "",
        nome: produtoEdit.nome || "",
        nome_comercial: produtoEdit.nome_comercial || "",
        descricao: produtoEdit.descricao || "",
        descricao_completa: produtoEdit.descricao_completa || "",
        descricao_curta: produtoEdit.descricao_curta || "",
        categoria: produtoEdit.categoria || "",
        subcategoria: produtoEdit.subcategoria || "",
        linha: produtoEdit.linha || "",
        marca: produtoEdit.marca || "",
        fabricante: produtoEdit.fabricante || "",
        modelo: produtoEdit.modelo || "",
        versao_variacao: produtoEdit.versao_variacao || "",
        formula_id: produtoEdit.formula_id || "",
        unidade_medida_id: produtoEdit.unidade_medida_id || "",
        tipo: produtoEdit.tipo || "ACABADO",
        tempo_producao_minutos: produtoEdit.tempo_producao_minutos?.toString() || "",
        rendimento: produtoEdit.rendimento?.toString() || "",
        foto_url: produtoEdit.foto_url || "",
        status: produtoEdit.status || "ativo",
        ativo: produtoEdit.ativo ?? true,
      });
    } else if (!produtoEdit && open) {
      setFormData({
        codigo: "",
        sku: "",
        codigo_barras_ean: "",
        codigo_legado: "",
        nome: "",
        nome_comercial: "",
        descricao: "",
        descricao_completa: "",
        descricao_curta: "",
        categoria: "",
        subcategoria: "",
        linha: "",
        marca: "",
        fabricante: "",
        modelo: "",
        versao_variacao: "",
        formula_id: "",
        unidade_medida_id: "",
        tipo: "ACABADO",
        tempo_producao_minutos: "",
        rendimento: "",
        foto_url: "",
        status: "ativo",
        ativo: true,
      });
    }
  }, [produtoEdit, open]);

  const salvarMutation = useMutationWithTimeout({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        codigo: formData.codigo.trim().toUpperCase(),
        sku: formData.sku.trim() || null,
        codigo_barras_ean: formData.codigo_barras_ean.trim() || null,
        codigo_legado: formData.codigo_legado.trim() || null,
        nome: formData.nome.trim(),
        nome_comercial: formData.nome_comercial.trim() || null,
        descricao: formData.descricao.trim() || null,
        descricao_completa: formData.descricao_completa.trim() || null,
        descricao_curta: formData.descricao_curta.trim() || null,
        categoria: formData.categoria.trim() || null,
        subcategoria: formData.subcategoria.trim() || null,
        linha: formData.linha.trim() || null,
        marca: formData.marca.trim() || null,
        fabricante: formData.fabricante.trim() || null,
        modelo: formData.modelo.trim() || null,
        versao_variacao: formData.versao_variacao.trim() || null,
        formula_id: formData.formula_id || null,
        unidade_medida_id: formData.unidade_medida_id || null,
        tipo: formData.tipo,
        tempo_producao_minutos: formData.tempo_producao_minutos ? parseInt(formData.tempo_producao_minutos) : null,
        rendimento: formData.rendimento ? parseFloat(formData.rendimento) : null,
        foto_url: formData.foto_url.trim() || null,
        status: formData.status,
        ativo: formData.ativo,
        created_by: user.id,
      };

      if (produtoEdit) {
        const { error } = await supabase
          .from("fabrica_produtos")
          .update(payload)
          .eq("id", produtoEdit.id)
          .select();

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fabrica_produtos")
          .insert([payload])
          .select();

        if (error) throw error;
      }
    },
    timeout: 15000,
    invalidateKeys: [["fabrica-produtos-acabados"], ["fabrica-produtos"]],
    successMessage: produtoEdit ? "Produto atualizado!" : "Produto cadastrado com sucesso!",
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo.trim()) {
      toast.error("Código é obrigatório");
      return;
    }

    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    salvarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {produtoEdit ? "Editar Produto Acabado" : "Novo Produto Acabado"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
              <TabsTrigger value="classificacao">Classificação</TabsTrigger>
              <TabsTrigger value="producao">Produção</TabsTrigger>
              <TabsTrigger value="outros">Outros</TabsTrigger>
            </TabsList>

            {/* Aba Identificação */}
            <TabsContent value="identificacao" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigo">ID Interno / Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="PROD-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU do produto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigo_barras_ean">Código de Barras EAN/GTIN</Label>
                  <Input
                    id="codigo_barras_ean"
                    value={formData.codigo_barras_ean}
                    onChange={(e) => setFormData({ ...formData, codigo_barras_ean: e.target.value })}
                    placeholder="7891234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="codigo_legado">Código Legado (ERP Antigo)</Label>
                  <Input
                    id="codigo_legado"
                    value={formData.codigo_legado}
                    onChange={(e) => setFormData({ ...formData, codigo_legado: e.target.value })}
                    placeholder="Código do sistema anterior"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="nome">Nome do Produto *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo do produto"
                  required
                />
              </div>

              <div>
                <Label htmlFor="nome_comercial">Nome Comercial</Label>
                <Input
                  id="nome_comercial"
                  value={formData.nome_comercial}
                  onChange={(e) => setFormData({ ...formData, nome_comercial: e.target.value })}
                  placeholder="Nome usado em vendas"
                />
              </div>

              <div>
                <Label htmlFor="descricao_curta">Descrição Curta</Label>
                <Textarea
                  id="descricao_curta"
                  value={formData.descricao_curta}
                  onChange={(e) => setFormData({ ...formData, descricao_curta: e.target.value })}
                  placeholder="Descrição resumida (até 500 caracteres)"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div>
                <Label htmlFor="descricao_completa">Descrição Completa</Label>
                <Textarea
                  id="descricao_completa"
                  value={formData.descricao_completa}
                  onChange={(e) => setFormData({ ...formData, descricao_completa: e.target.value })}
                  placeholder="Descrição detalhada do produto"
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Aba Classificação */}
            <TabsContent value="classificacao" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Produto</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACABADO">Produto Acabado</SelectItem>
                      <SelectItem value="INTER">Intermediário</SelectItem>
                      <SelectItem value="MP">Matéria-Prima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Categoria principal"
                  />
                </div>

                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Input
                    id="subcategoria"
                    value={formData.subcategoria}
                    onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                    placeholder="Subcategoria"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="linha">Linha de Produtos</Label>
                <Input
                  id="linha"
                  value={formData.linha}
                  onChange={(e) => setFormData({ ...formData, linha: e.target.value })}
                  placeholder="Linha"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Marca do produto"
                  />
                </div>

                <div>
                  <Label htmlFor="fabricante">Fabricante</Label>
                  <Input
                    id="fabricante"
                    value={formData.fabricante}
                    onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                    placeholder="Fabricante"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modelo">Modelo</Label>
                  <Input
                    id="modelo"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    placeholder="Modelo"
                  />
                </div>

                <div>
                  <Label htmlFor="versao_variacao">Versão / Variação</Label>
                  <Input
                    id="versao_variacao"
                    value={formData.versao_variacao}
                    onChange={(e) => setFormData({ ...formData, versao_variacao: e.target.value })}
                    placeholder="Versão ou variação"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Aba Produção */}
            <TabsContent value="producao" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="formula">Fórmula (BOM)</Label>
                <Select
                  value={formData.formula_id || "SEM_FORMULA"}
                  onValueChange={(value) => setFormData({ ...formData, formula_id: value === "SEM_FORMULA" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma fórmula vinculada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEM_FORMULA">Nenhuma fórmula</SelectItem>
                    {formulas?.map((formula: any) => (
                      <SelectItem key={formula.id} value={formula.id}>
                        {formula.fabrica_produtos?.nome} (v{formula.versao})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode criar a fórmula depois e vinculá-la ao produto
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unidade">Unidade de Medida Principal</Label>
                  <Select
                    value={formData.unidade_medida_id}
                    onValueChange={(value) => setFormData({ ...formData, unidade_medida_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades?.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>
                          {unidade.sigla} - {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    UN, KG, CX, LT, etc.
                  </p>
                </div>

                <div>
                  <Label htmlFor="rendimento">Rendimento</Label>
                  <Input
                    id="rendimento"
                    type="number"
                    step="0.001"
                    value={formData.rendimento}
                    onChange={(e) => setFormData({ ...formData, rendimento: e.target.value })}
                    placeholder="Ex: 1000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tempo_producao">Tempo de Produção (minutos)</Label>
                <Input
                  id="tempo_producao"
                  type="number"
                  value={formData.tempo_producao_minutos}
                  onChange={(e) => setFormData({ ...formData, tempo_producao_minutos: e.target.value })}
                  placeholder="Ex: 60"
                />
              </div>

              <div>
                <Label htmlFor="descricao">Observações Técnicas</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Observações sobre o processo produtivo"
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Aba Outros */}
            <TabsContent value="outros" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="foto_url">URL da Foto</Label>
                <Input
                  id="foto_url"
                  type="url"
                  value={formData.foto_url}
                  onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending}>
              {salvarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {produtoEdit ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
