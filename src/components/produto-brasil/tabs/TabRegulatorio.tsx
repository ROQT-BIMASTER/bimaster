import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Shield } from "lucide-react";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function TabRegulatorio({ produto }: Props) {
  const updateProduto = useUpdateProdutoBrasil();
  const [form, setForm] = useState({
    processo_anvisa: produto.processo_anvisa || "",
    numero_registro: produto.numero_registro || "",
    status_anvisa: produto.status_anvisa || "",
    categoria_regulatoria: produto.categoria_regulatoria || "",
    responsavel_tecnico: produto.responsavel_tecnico || "",
    data_aprovacao_regulatorio: produto.data_aprovacao_regulatorio || "",
  });

  useEffect(() => {
    setForm({
      processo_anvisa: produto.processo_anvisa || "",
      numero_registro: produto.numero_registro || "",
      status_anvisa: produto.status_anvisa || "",
      categoria_regulatoria: produto.categoria_regulatoria || "",
      responsavel_tecnico: produto.responsavel_tecnico || "",
      data_aprovacao_regulatorio: produto.data_aprovacao_regulatorio || "",
    });
  }, [produto]);

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      processo_anvisa: form.processo_anvisa || null,
      numero_registro: form.numero_registro || null,
      status_anvisa: form.status_anvisa || null,
      categoria_regulatoria: form.categoria_regulatoria || null,
      responsavel_tecnico: form.responsavel_tecnico || null,
      data_aprovacao_regulatorio: form.data_aprovacao_regulatorio || null,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Dados Regulatórios e ANVISA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Processo ANVISA</Label>
            <Input value={form.processo_anvisa} onChange={(e) => setForm({ ...form, processo_anvisa: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Nº Registro</Label>
            <Input value={form.numero_registro} onChange={(e) => setForm({ ...form, numero_registro: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Status ANVISA</Label>
            <Input value={form.status_anvisa} onChange={(e) => setForm({ ...form, status_anvisa: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Categoria Regulatória</Label>
            <Input value={form.categoria_regulatoria} onChange={(e) => setForm({ ...form, categoria_regulatoria: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Responsável Técnico</Label>
            <Input value={form.responsavel_tecnico} onChange={(e) => setForm({ ...form, responsavel_tecnico: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Data Aprovação Regulatório</Label>
            <Input type="date" value={form.data_aprovacao_regulatorio} onChange={(e) => setForm({ ...form, data_aprovacao_regulatorio: e.target.value })} className="mt-1" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateProduto.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Dados Regulatórios
        </Button>
      </CardContent>
    </Card>
  );
}
