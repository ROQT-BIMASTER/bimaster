import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { useUpdateProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

export function ColunaBrasil({ produto }: Props) {
  const updateProduto = useUpdateProdutoBrasil();
  const [form, setForm] = useState({
    nome_brasil: produto.nome_brasil || "",
    codigo_brasil: produto.codigo_brasil || "",
    categoria_brasil: produto.categoria_brasil || "",
    descricao_brasil: produto.descricao_brasil || "",
    observacoes: produto.observacoes || "",
  });

  useEffect(() => {
    setForm({
      nome_brasil: produto.nome_brasil || "",
      codigo_brasil: produto.codigo_brasil || "",
      categoria_brasil: produto.categoria_brasil || "",
      descricao_brasil: produto.descricao_brasil || "",
      observacoes: produto.observacoes || "",
    });
  }, [produto]);

  const handleCopyFromChina = () => {
    setForm({
      nome_brasil: produto.china_nome || "",
      codigo_brasil: produto.china_codigo || "",
      categoria_brasil: produto.china_categoria || "",
      descricao_brasil: produto.china_descricao || "",
      observacoes: form.observacoes,
    });
  };

  const handleSave = () => {
    updateProduto.mutate({
      id: produto.id,
      ...form,
      status: produto.status === "aguardando_precadastro" ? "precadastro_em_andamento" : produto.status,
    });
  };

  const isDiff = (field: "nome_brasil" | "codigo_brasil" | "categoria_brasil" | "descricao_brasil") => {
    const chinaMap: Record<string, string | null> = {
      nome_brasil: produto.china_nome,
      codigo_brasil: produto.china_codigo,
      categoria_brasil: produto.china_categoria,
      descricao_brasil: produto.china_descricao,
    };
    return form[field] && chinaMap[field] && form[field] !== chinaMap[field];
  };

  const fields: { key: "nome_brasil" | "codigo_brasil" | "categoria_brasil" | "descricao_brasil"; label: string; textarea?: boolean }[] = [
    { key: "nome_brasil", label: "Nome do Produto Brasil" },
    { key: "codigo_brasil", label: "Código Interno Brasil" },
    { key: "categoria_brasil", label: "Categoria Brasil" },
    { key: "descricao_brasil", label: "Descrição Brasil", textarea: true },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className="text-lg">🇧🇷</span>
            Cadastro Brasil
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleCopyFromChina}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar da China
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <div className={cn("mt-1 rounded-lg", isDiff(f.key) && "ring-2 ring-yellow-400/50")}>
              {f.textarea ? (
                <Textarea
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <Input
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
            rows={2}
            className="mt-1"
          />
        </div>
        <Button onClick={handleSave} disabled={updateProduto.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Rascunho
        </Button>
      </CardContent>
    </Card>
  );
}
