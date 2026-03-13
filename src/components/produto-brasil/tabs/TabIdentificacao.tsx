import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Copy } from "lucide-react";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function TabIdentificacao({ produto }: Props) {
  const updateProduto = useUpdateProdutoBrasil();
  const [form, setForm] = useState({
    nome_brasil: produto.nome_brasil || "",
    nome_comercial: produto.nome_comercial || "",
    codigo_brasil: produto.codigo_brasil || "",
    sku: produto.sku || "",
    ean_unitario: produto.ean_unitario || "",
    ean_display: produto.ean_display || "",
    ean_caixa_master: produto.ean_caixa_master || "",
    tipo_produto: produto.tipo_produto || "ACABADO",
    itens_display: produto.itens_display?.toString() || "",
    qty_per_display: produto.qty_per_display?.toString() || "",
    descricao_curta: produto.descricao_curta || "",
    descricao_completa: produto.descricao_completa || "",
    observacoes: produto.observacoes || "",
  });

  useEffect(() => {
    setForm({
      nome_brasil: produto.nome_brasil || "",
      nome_comercial: produto.nome_comercial || "",
      codigo_brasil: produto.codigo_brasil || "",
      sku: produto.sku || "",
      ean_unitario: produto.ean_unitario || "",
      ean_display: produto.ean_display || "",
      ean_caixa_master: produto.ean_caixa_master || "",
      tipo_produto: produto.tipo_produto || "ACABADO",
      itens_display: produto.itens_display?.toString() || "",
      qty_per_display: produto.qty_per_display?.toString() || "",
      descricao_curta: produto.descricao_curta || "",
      descricao_completa: produto.descricao_completa || "",
      observacoes: produto.observacoes || "",
    });
  }, [produto]);

  const handleCopyFromChina = () => {
    setForm((prev) => ({
      ...prev,
      nome_brasil: produto.china_nome || prev.nome_brasil,
      codigo_brasil: produto.china_codigo || prev.codigo_brasil,
      ean_unitario: produto.china_ean || prev.ean_unitario,
      descricao_curta: produto.china_descricao || prev.descricao_curta,
    }));
  };

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      nome_brasil: form.nome_brasil || null,
      nome_comercial: form.nome_comercial || null,
      codigo_brasil: form.codigo_brasil || null,
      sku: form.sku || null,
      ean_unitario: form.ean_unitario || null,
      ean_display: form.ean_display || null,
      ean_caixa_master: form.ean_caixa_master || null,
      tipo_produto: form.tipo_produto,
      itens_display: form.itens_display ? parseInt(form.itens_display) : null,
      qty_per_display: form.qty_per_display ? parseInt(form.qty_per_display) : null,
      descricao_curta: form.descricao_curta || null,
      descricao_completa: form.descricao_completa || null,
      observacoes: form.observacoes || null,
      status: produto.status === "aguardando_precadastro" ? "precadastro_em_andamento" : produto.status,
    } as any);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">🇧🇷 Identificação do Produto</CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopyFromChina}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar da China
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Nome do Produto Brasil</Label>
            <Input value={form.nome_brasil} onChange={(e) => setForm({ ...form, nome_brasil: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Nome Comercial</Label>
            <Input value={form.nome_comercial} onChange={(e) => setForm({ ...form, nome_comercial: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Código Interno Brasil</Label>
            <Input value={form.codigo_brasil} onChange={(e) => setForm({ ...form, codigo_brasil: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">EAN Unitário</Label>
            <Input value={form.ean_unitario} onChange={(e) => setForm({ ...form, ean_unitario: e.target.value })} className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">EAN Display</Label>
            <Input value={form.ean_display} onChange={(e) => setForm({ ...form, ean_display: e.target.value })} className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">EAN Caixa Master</Label>
            <Input value={form.ean_caixa_master} onChange={(e) => setForm({ ...form, ean_caixa_master: e.target.value })} className="mt-1 font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Tipo de Produto</Label>
            <Select value={form.tipo_produto} onValueChange={(v) => setForm({ ...form, tipo_produto: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACABADO">Acabado (Unitário)</SelectItem>
                <SelectItem value="DISPLAY">Display / Kit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo_produto === "DISPLAY" && (
            <div>
              <Label className="text-xs">Itens no Display</Label>
              <Input type="number" min={1} value={form.itens_display} onChange={(e) => setForm({ ...form, itens_display: e.target.value })} className="mt-1" />
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs">Descrição Curta</Label>
          <Input value={form.descricao_curta} onChange={(e) => setForm({ ...form, descricao_curta: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Descrição Completa</Label>
          <Textarea value={form.descricao_completa} onChange={(e) => setForm({ ...form, descricao_completa: e.target.value })} rows={3} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="mt-1" />
        </div>

        <Button onClick={handleSave} disabled={updateProduto.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Identificação
        </Button>
      </CardContent>
    </Card>
  );
}
