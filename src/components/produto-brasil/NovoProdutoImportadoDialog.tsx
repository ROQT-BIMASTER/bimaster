import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, PenLine, Sparkles, Bot, Save } from "lucide-react";
import { CadastroIAStep } from "@/components/fabrica/CadastroIAStep";
import { ChinaGradeEditor, type GradeItem } from "@/components/china/ChinaGradeEditor";
import { useCreateProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoProdutoImportadoDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const createProduto = useCreateProdutoBrasil();
  const [mode, setMode] = useState<"choose" | "ai" | "form">("choose");
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);

  const [formData, setFormData] = useState({
    // China identification
    china_nome: "",
    china_codigo: "",
    china_ean: "",
    china_categoria: "",
    china_descricao: "",
    // Brazil identification
    nome_brasil: "",
    nome_comercial: "",
    codigo_brasil: "",
    sku: "",
    ean_unitario: "",
    ean_display: "",
    ean_caixa_master: "",
    // Classification
    tipo_produto: "ACABADO",
    categoria_brasil: "",
    marca: "",
    linha: "",
    fabricante: "",
    ncm: "",
    // Description
    descricao_curta: "",
    descricao_completa: "",
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setMode("choose");
      setAiFilledFields(new Set());
      setGradeItems([]);
      setFormData({
        china_nome: "", china_codigo: "", china_ean: "", china_categoria: "", china_descricao: "",
        nome_brasil: "", nome_comercial: "", codigo_brasil: "", sku: "",
        ean_unitario: "", ean_display: "", ean_caixa_master: "",
        tipo_produto: "ACABADO", categoria_brasil: "", marca: "", linha: "", fabricante: "", ncm: "",
        descricao_curta: "", descricao_completa: "", observacoes: "",
      });
    }
  }, [open]);

  const handleAIDataExtracted = (data: Record<string, any>, method: "text" | "image") => {
    const filled = new Set<string>();
    const updates: any = {};

    const fieldMap: Record<string, string> = {
      codigo: "codigo_brasil",
      sku: "sku",
      codigo_barras_ean: "ean_unitario",
      nome: "nome_brasil",
      nome_comercial: "nome_comercial",
      descricao_curta: "descricao_curta",
      descricao_completa: "descricao_completa",
      categoria: "categoria_brasil",
      linha: "linha",
      marca: "marca",
      fabricante: "fabricante",
      ncm: "ncm",
    };

    for (const [aiKey, formKey] of Object.entries(fieldMap)) {
      const val = data[aiKey];
      if (val !== null && val !== undefined && val !== "") {
        updates[formKey] = String(val);
        filled.add(formKey);
      }
    }

    if (data.nome && !updates.china_nome) {
      updates.china_nome = String(data.nome);
    }
    if (data.codigo && !updates.china_codigo) {
      updates.china_codigo = String(data.codigo);
    }

    setFormData((prev) => ({ ...prev, ...updates }));
    setAiFilledFields(filled);
    setMode("form");
  };

  const handleSubmit = () => {
    if (!formData.china_nome && !formData.china_codigo && !formData.nome_brasil) {
      toast.error("Informe ao menos o nome ou código do produto.");
      return;
    }

    if (formData.tipo_produto === "DISPLAY" && gradeItems.length === 0) {
      toast.warning("Atenção: este Display não possui itens na grade.");
    }

    createProduto.mutate(
      {
        china_nome: formData.china_nome || formData.nome_brasil || null,
        china_codigo: formData.china_codigo || formData.codigo_brasil || "SEM-CODIGO",
        china_ean: formData.china_ean || undefined,
        china_categoria: formData.china_categoria || formData.categoria_brasil || undefined,
        china_descricao: formData.china_descricao || formData.descricao_curta || undefined,
      },
      {
        onSuccess: async (produto) => {
          // Update expanded fields
          await (supabase
            .from("produtos_brasil" as any)
            .update({
              nome_brasil: formData.nome_brasil || null,
              nome_comercial: formData.nome_comercial || null,
              codigo_brasil: formData.codigo_brasil || null,
              sku: formData.sku || null,
              ean_unitario: formData.ean_unitario || null,
              ean_display: formData.ean_display || null,
              ean_caixa_master: formData.ean_caixa_master || null,
              tipo_produto: formData.tipo_produto,
              categoria_brasil: formData.categoria_brasil || null,
              marca: formData.marca || null,
              linha: formData.linha || null,
              fabricante: formData.fabricante || null,
              ncm: formData.ncm || null,
              descricao_curta: formData.descricao_curta || null,
              descricao_completa: formData.descricao_completa || null,
              observacoes: formData.observacoes || null,
              itens_display: formData.tipo_produto === "DISPLAY" ? gradeItems.reduce((s, i) => s + (i.quantidade || 0), 0) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", produto.id) as any);

          // Save grade items as SKUs for DISPLAY products
          if (formData.tipo_produto === "DISPLAY" && gradeItems.length > 0) {
            const skuInserts = gradeItems.map((item, index) => ({
              produto_brasil_id: produto.id,
              cor: item.cor_nome || null,
              cor_hex: item.cor_hex || null,
              codigo_interno: item.codigo_produto || null,
              ean: item.codigo_barras_ean || null,
              quantidade_inicial: item.quantidade || 0,
              ordem: index,
            }));

            await (supabase
              .from("produto_brasil_skus" as any)
              .insert(skuInserts) as any);
          }

          toast.success("Produto importado criado com sucesso!");
          onOpenChange(false);
          navigate(`/dashboard/projetos/produto-brasil/${produto.id}`);
        },
      }
    );
  };

  const AiBadge = ({ field }: { field: string }) =>
    aiFilledFields.has(field) ? (
      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 gap-1 text-primary border-primary/30">
        <Bot className="h-3 w-3" /> IA
      </Badge>
    ) : null;

  const isDisplay = formData.tipo_produto === "DISPLAY";
  const tabCount = isDisplay ? 5 : 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[90vh] overflow-y-auto", mode === "choose" ? "max-w-lg" : "max-w-4xl")}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Novo Produto Importado — Pré-Cadastro</DialogTitle>
        </DialogHeader>

        {/* CHOOSE MODE */}
        {mode === "choose" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              Como deseja cadastrar o produto importado?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMode("form")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all group"
              >
                <PenLine className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Preencher Manualmente</p>
                  <p className="text-xs text-muted-foreground mt-1">Preencha todos os campos</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all group"
              >
                <Sparkles className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Cadastrar com IA</p>
                  <p className="text-xs text-muted-foreground mt-1">Cole texto ou envie print do ERP</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* AI MODE */}
        {mode === "ai" && (
          <CadastroIAStep
            onBack={() => setMode("choose")}
            onDataExtracted={handleAIDataExtracted}
          />
        )}

        {/* FORM MODE */}
        {mode === "form" && (
          <div className="space-y-4">
            <Tabs defaultValue="china" className="w-full">
              <TabsList className={cn("grid w-full", `grid-cols-${tabCount}`)}>
                <TabsTrigger value="china" className="text-xs">Dados China</TabsTrigger>
                <TabsTrigger value="identificacao" className="text-xs">Identificação BR</TabsTrigger>
                <TabsTrigger value="classificacao" className="text-xs">Classificação</TabsTrigger>
                {isDisplay && (
                  <TabsTrigger value="grade" className="text-xs">Grade</TabsTrigger>
                )}
                <TabsTrigger value="descricoes" className="text-xs">Descrições</TabsTrigger>
              </TabsList>

              {/* Aba Dados China */}
              <TabsContent value="china" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">Nome do Produto (China)<AiBadge field="china_nome" /></Label>
                    <Input
                      value={formData.china_nome}
                      onChange={(e) => setFormData({ ...formData, china_nome: e.target.value })}
                      placeholder="Nome original"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">Código (China)<AiBadge field="china_codigo" /></Label>
                    <Input
                      value={formData.china_codigo}
                      onChange={(e) => setFormData({ ...formData, china_codigo: e.target.value })}
                      placeholder="Código original"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">EAN (China)</Label>
                  <Input
                    value={formData.china_ean}
                    onChange={(e) => setFormData({ ...formData, china_ean: e.target.value })}
                    placeholder="Opcional"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Categoria (China)</Label>
                  <Input
                    value={formData.china_categoria}
                    onChange={(e) => setFormData({ ...formData, china_categoria: e.target.value })}
                    placeholder="Opcional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição (China)</Label>
                  <Textarea
                    value={formData.china_descricao}
                    onChange={(e) => setFormData({ ...formData, china_descricao: e.target.value })}
                    placeholder="Opcional"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </TabsContent>

              {/* Aba Identificação BR */}
              <TabsContent value="identificacao" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">Nome do Produto Brasil<AiBadge field="nome_brasil" /></Label>
                    <Input
                      value={formData.nome_brasil}
                      onChange={(e) => setFormData({ ...formData, nome_brasil: e.target.value })}
                      placeholder="Nome adaptado para o Brasil"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">Nome Comercial<AiBadge field="nome_comercial" /></Label>
                    <Input
                      value={formData.nome_comercial}
                      onChange={(e) => setFormData({ ...formData, nome_comercial: e.target.value })}
                      placeholder="Nome de vendas"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">Código Interno Brasil<AiBadge field="codigo_brasil" /></Label>
                    <Input
                      value={formData.codigo_brasil}
                      onChange={(e) => setFormData({ ...formData, codigo_brasil: e.target.value })}
                      placeholder="PROD-001"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">SKU<AiBadge field="sku" /></Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">EAN Unitário<AiBadge field="ean_unitario" /></Label>
                    <Input
                      value={formData.ean_unitario}
                      onChange={(e) => setFormData({ ...formData, ean_unitario: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">EAN Display</Label>
                    <Input
                      value={formData.ean_display}
                      onChange={(e) => setFormData({ ...formData, ean_display: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">EAN Caixa Master</Label>
                    <Input
                      value={formData.ean_caixa_master}
                      onChange={(e) => setFormData({ ...formData, ean_caixa_master: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tipo de Produto</Label>
                  <Select
                    value={formData.tipo_produto}
                    onValueChange={(v) => {
                      setFormData({ ...formData, tipo_produto: v });
                      if (v !== "DISPLAY") setGradeItems([]);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACABADO">Acabado (Unitário)</SelectItem>
                      <SelectItem value="DISPLAY">Display / Kit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Aba Classificação */}
              <TabsContent value="classificacao" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">Categoria Brasil<AiBadge field="categoria_brasil" /></Label>
                    <Input
                      value={formData.categoria_brasil}
                      onChange={(e) => setFormData({ ...formData, categoria_brasil: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">NCM<AiBadge field="ncm" /></Label>
                    <Input
                      value={formData.ncm}
                      onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                      placeholder="0000.00.00"
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="flex items-center text-xs">Marca<AiBadge field="marca" /></Label>
                    <Input
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">Linha<AiBadge field="linha" /></Label>
                    <Input
                      value={formData.linha}
                      onChange={(e) => setFormData({ ...formData, linha: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center text-xs">Fabricante<AiBadge field="fabricante" /></Label>
                    <Input
                      value={formData.fabricante}
                      onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Aba Grade - only for DISPLAY */}
              {isDisplay && (
                <TabsContent value="grade" className="space-y-4 mt-4">
                  <ChinaGradeEditor
                    items={gradeItems}
                    onChange={setGradeItems}
                  />
                  {gradeItems.length > 0 && (
                    <div className="text-xs text-muted-foreground text-center">
                      {gradeItems.length} cores · {gradeItems.reduce((s, i) => s + (i.quantidade || 0), 0).toLocaleString()} unidades no total
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Aba Descrições */}
              <TabsContent value="descricoes" className="space-y-4 mt-4">
                <div>
                  <Label className="flex items-center text-xs">Descrição Curta<AiBadge field="descricao_curta" /></Label>
                  <Textarea
                    value={formData.descricao_curta}
                    onChange={(e) => setFormData({ ...formData, descricao_curta: e.target.value })}
                    placeholder="Descrição resumida"
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center text-xs">Descrição Completa<AiBadge field="descricao_completa" /></Label>
                  <Textarea
                    value={formData.descricao_completa}
                    onChange={(e) => setFormData({ ...formData, descricao_completa: e.target.value })}
                    placeholder="Descrição detalhada"
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-muted-foreground">
              O produto será criado em <strong>Pré-Cadastro</strong>. A vinculação a um Projeto poderá ser feita depois.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createProduto.isPending}>
                {createProduto.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Criar Produto
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
