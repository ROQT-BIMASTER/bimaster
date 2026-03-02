import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { simularIVA, type ItemIVA, type ApuracaoIVA } from "@/lib/fabrica/fiscal-iva-service";

interface ItemForm {
  base: string;
  aliquota_cbs: string;
  aliquota_ibs: string;
  tipo_operacao: "ENTRADA" | "SAIDA";
  elegivel: boolean;
}

const emptyItem: ItemForm = {
  base: "",
  aliquota_cbs: "8.80",
  aliquota_ibs: "17.70",
  tipo_operacao: "SAIDA",
  elegivel: true,
};

export function IVASimulador() {
  const [itens, setItens] = useState<ItemForm[]>([{ ...emptyItem }]);
  const [resultado, setResultado] = useState<ApuracaoIVA | null>(null);

  const addItem = () => setItens([...itens, { ...emptyItem }]);

  const removeItem = (idx: number) => {
    setItens(itens.filter((_, i) => i !== idx));
    setResultado(null);
  };

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    const updated = [...itens];
    updated[idx] = { ...updated[idx], [field]: value };
    setItens(updated);
    setResultado(null);
  };

  const handleSimular = () => {
    try {
      const parsed: ItemIVA[] = itens.map((it) => ({
        base_cbs: parseFloat(it.base) || 0,
        base_ibs: parseFloat(it.base) || 0,
        aliquota_cbs: parseFloat(it.aliquota_cbs) || 0,
        aliquota_ibs: parseFloat(it.aliquota_ibs) || 0,
        tipo_operacao: it.tipo_operacao,
        elegivel_credito: it.elegivel,
      }));
      setResultado(simularIVA(parsed));
    } catch (err: any) {
      setResultado(null);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Simulador IVA Dual
          </CardTitle>
          <Button size="sm" variant="outline" onClick={addItem} className="gap-1">
            <Plus className="h-4 w-4" /> Adicionar Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((item, idx) => (
            <div key={idx} className="grid grid-cols-6 gap-3 items-end border rounded-lg p-3">
              <div>
                <Label className="text-xs">Base Cálculo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.base}
                  onChange={(e) => updateItem(idx, "base", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">CBS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.aliquota_cbs}
                  onChange={(e) => updateItem(idx, "aliquota_cbs", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">IBS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.aliquota_ibs}
                  onChange={(e) => updateItem(idx, "aliquota_ibs", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Operação</Label>
                <Select value={item.tipo_operacao} onValueChange={(v) => updateItem(idx, "tipo_operacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAIDA">Saída (débito)</SelectItem>
                    <SelectItem value="ENTRADA">Entrada (crédito)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.elegivel}
                  onCheckedChange={(v) => updateItem(idx, "elegivel", v)}
                  disabled={item.tipo_operacao === "SAIDA"}
                />
                <Label className="text-xs">Crédito</Label>
              </div>
              <div className="flex justify-end">
                {itens.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button onClick={handleSimular} className="w-full">
            <Calculator className="mr-2 h-4 w-4" /> Simular Cálculo IVA
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado da Simulação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Débitos CBS</p>
                <p className="text-lg font-bold">{fmt(resultado.total_debitos_cbs)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Créditos CBS</p>
                <p className="text-lg font-bold text-green-600">{fmt(resultado.total_creditos_cbs)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Débitos IBS</p>
                <p className="text-lg font-bold">{fmt(resultado.total_debitos_ibs)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Créditos IBS</p>
                <p className="text-lg font-bold text-green-600">{fmt(resultado.total_creditos_ibs)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">CBS a Recolher</p>
                <p className={`text-xl font-bold ${resultado.cbs_a_recolher > 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmt(resultado.cbs_a_recolher)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IBS a Recolher</p>
                <p className={`text-xl font-bold ${resultado.ibs_a_recolher > 0 ? "text-red-600" : "text-green-600"}`}>
                  {fmt(resultado.ibs_a_recolher)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Total IVA</p>
                <Badge variant={resultado.saldo_iva > 0 ? "destructive" : "default"} className="text-lg px-3 py-1">
                  {fmt(resultado.saldo_iva)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
