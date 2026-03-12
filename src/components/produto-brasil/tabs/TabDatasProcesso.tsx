import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Calendar } from "lucide-react";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function TabDatasProcesso({ produto }: Props) {
  const updateProduto = useUpdateProdutoBrasil();
  const [form, setForm] = useState({
    data_inicio_processo: produto.data_inicio_processo?.split("T")[0] || "",
    data_previsao_chegada: produto.data_previsao_chegada?.split("T")[0] || "",
    data_cadastro_finalizado: produto.data_cadastro_finalizado?.split("T")[0] || "",
  });

  useEffect(() => {
    setForm({
      data_inicio_processo: produto.data_inicio_processo?.split("T")[0] || "",
      data_previsao_chegada: produto.data_previsao_chegada?.split("T")[0] || "",
      data_cadastro_finalizado: produto.data_cadastro_finalizado?.split("T")[0] || "",
    });
  }, [produto]);

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      data_inicio_processo: form.data_inicio_processo || null,
      data_previsao_chegada: form.data_previsao_chegada || null,
      data_cadastro_finalizado: form.data_cadastro_finalizado || null,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Datas e Processo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Data Início do Processo</Label>
            <Input type="date" value={form.data_inicio_processo} onChange={(e) => setForm({ ...form, data_inicio_processo: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Previsão de Chegada</Label>
            <Input type="date" value={form.data_previsao_chegada} onChange={(e) => setForm({ ...form, data_previsao_chegada: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Cadastro Finalizado em</Label>
            <Input type="date" value={form.data_cadastro_finalizado} onChange={(e) => setForm({ ...form, data_cadastro_finalizado: e.target.value })} className="mt-1" />
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <strong>Criado em:</strong> {new Date(produto.created_at).toLocaleDateString("pt-BR")} •{" "}
            <strong>Última atualização:</strong> {new Date(produto.updated_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <Button onClick={handleSave} disabled={updateProduto.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Datas
        </Button>
      </CardContent>
    </Card>
  );
}
