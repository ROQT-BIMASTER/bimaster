import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function TabClassificacao({ produto }: Props) {
  const updateProduto = useUpdateProdutoBrasil();
  const [form, setForm] = useState({
    categoria_brasil: produto.categoria_brasil || "",
    marca: produto.marca || "",
    linha: produto.linha || "",
    ncm: produto.ncm || "",
    fabricante: produto.fabricante || "",
    peso_bruto: produto.peso_bruto?.toString() || "",
    peso_liquido: produto.peso_liquido?.toString() || "",
    custo_unitario_china: produto.custo_unitario_china?.toString() || "",
  });

  useEffect(() => {
    setForm({
      categoria_brasil: produto.categoria_brasil || "",
      marca: produto.marca || "",
      linha: produto.linha || "",
      ncm: produto.ncm || "",
      fabricante: produto.fabricante || "",
      peso_bruto: produto.peso_bruto?.toString() || "",
      peso_liquido: produto.peso_liquido?.toString() || "",
      custo_unitario_china: produto.custo_unitario_china?.toString() || "",
    });
  }, [produto]);

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      categoria_brasil: form.categoria_brasil || null,
      marca: form.marca || null,
      linha: form.linha || null,
      ncm: form.ncm || null,
      fabricante: form.fabricante || null,
      peso_bruto: form.peso_bruto ? parseFloat(form.peso_bruto) : null,
      peso_liquido: form.peso_liquido ? parseFloat(form.peso_liquido) : null,
      custo_unitario_china: form.custo_unitario_china ? parseFloat(form.custo_unitario_china) : null,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">📋 Classificação e Dados Comerciais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Categoria Brasil</Label>
            <Input value={form.categoria_brasil} onChange={(e) => setForm({ ...form, categoria_brasil: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">NCM</Label>
            <Input value={form.ncm} onChange={(e) => setForm({ ...form, ncm: e.target.value })} className="mt-1 font-mono" placeholder="0000.00.00" />
          </div>
          <div>
            <Label className="text-xs">Marca</Label>
            <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Linha</Label>
            <Input value={form.linha} onChange={(e) => setForm({ ...form, linha: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Fabricante</Label>
            <Input value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Custo Unitário China (USD)</Label>
            <Input type="number" step="0.01" value={form.custo_unitario_china} onChange={(e) => setForm({ ...form, custo_unitario_china: e.target.value })} className="mt-1 font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Peso Bruto (g)</Label>
            <Input type="number" step="0.01" value={form.peso_bruto} onChange={(e) => setForm({ ...form, peso_bruto: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Peso Líquido (g)</Label>
            <Input type="number" step="0.01" value={form.peso_liquido} onChange={(e) => setForm({ ...form, peso_liquido: e.target.value })} className="mt-1" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateProduto.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Classificação
        </Button>
      </CardContent>
    </Card>
  );
}
