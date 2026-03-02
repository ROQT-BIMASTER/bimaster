import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface ItemSaida {
  descricao: string;
  produto_id?: string;
  quantidade: number;
  valor_unitario: number;
}

export function NFSaidaCadastro({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_nf: "",
    serie: "1",
    data_emissao: new Date().toISOString().slice(0, 10),
    cliente_nome: "",
    cliente_cnpj: "",
    observacoes: "",
  });
  const [itens, setItens] = useState<ItemSaida[]>([
    { descricao: "", quantidade: 1, valor_unitario: 0 },
  ]);

  const addItem = () =>
    setItens((prev) => [...prev, { descricao: "", quantidade: 1, valor_unitario: 0 }]);

  const removeItem = (idx: number) =>
    setItens((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof ItemSaida, value: string | number) =>
    setItens((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const valorTotal = itens.reduce(
    (sum, item) => sum + item.quantidade * item.valor_unitario,
    0
  );

  const handleSalvar = async () => {
    if (!form.numero_nf || !form.cliente_nome) {
      toast.error("Preencha número da NF e nome do cliente");
      return;
    }
    if (itens.length === 0 || itens.some((i) => !i.descricao)) {
      toast.error("Adicione ao menos um item com descrição");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: nota, error: errNota } = await (supabase
        .from("fabrica_notas_fiscais_saida") as any)
        .insert({
          numero_nf: form.numero_nf,
          serie: form.serie,
          data_emissao: form.data_emissao,
          cliente_nome: form.cliente_nome,
          cliente_cnpj: form.cliente_cnpj || null,
          valor_total: Math.round(valorTotal * 100) / 100,
          observacoes: form.observacoes || null,
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (errNota) throw errNota;

      const itensPayload = itens.map((item) => ({
        nota_saida_id: nota.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        produto_id: item.produto_id || null,
      }));

      const { error: errItens } = await (supabase
        .from("fabrica_itens_nf_saida") as any)
        .insert(itensPayload);

      if (errItens) throw errItens;

      toast.success("NF de saída registrada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["nf-saida"] });
      queryClient.invalidateQueries({ queryKey: ["iva-apuracao"] });

      // Reset
      setForm({
        numero_nf: "",
        serie: "1",
        data_emissao: new Date().toISOString().slice(0, 10),
        cliente_nome: "",
        cliente_cnpj: "",
        observacoes: "",
      });
      setItens([{ descricao: "", quantidade: 1, valor_unitario: 0 }]);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar NF de saída: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Registrar NF de Saída</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cabeçalho */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Número NF *</Label>
            <Input
              value={form.numero_nf}
              onChange={(e) => setForm({ ...form, numero_nf: e.target.value })}
              placeholder="001234"
            />
          </div>
          <div>
            <Label>Série</Label>
            <Input
              value={form.serie}
              onChange={(e) => setForm({ ...form, serie: e.target.value })}
            />
          </div>
          <div>
            <Label>Data Emissão</Label>
            <Input
              type="date"
              value={form.data_emissao}
              onChange={(e) => setForm({ ...form, data_emissao: e.target.value })}
            />
          </div>
          <div>
            <Label>CNPJ Cliente</Label>
            <Input
              value={form.cliente_cnpj}
              onChange={(e) => setForm({ ...form, cliente_cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
            />
          </div>
        </div>

        <div>
          <Label>Nome do Cliente *</Label>
          <Input
            value={form.cliente_nome}
            onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
            placeholder="Razão social ou nome fantasia"
          />
        </div>

        {/* Itens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Itens da NF</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Item
            </Button>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24">Qtd</TableHead>
                  <TableHead className="w-32">Vlr Unit.</TableHead>
                  <TableHead className="w-32 text-right">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={item.descricao}
                        onChange={(e) => updateItem(idx, "descricao", e.target.value)}
                        placeholder="Descrição do produto"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.quantidade}
                        onChange={(e) => updateItem(idx, "quantidade", parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.valor_unitario}
                        onChange={(e) => updateItem(idx, "valor_unitario", parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      R$ {fmt(item.quantidade * item.valor_unitario)}
                    </TableCell>
                    <TableCell>
                      {itens.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-right mt-2 text-sm font-semibold">
            Total: R$ {fmt(valorTotal)}
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            placeholder="Observações opcionais..."
            rows={2}
          />
        </div>

        <Button onClick={handleSalvar} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar NF de Saída
        </Button>
      </CardContent>
    </Card>
  );
}
