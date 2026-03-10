import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BilingualLabel } from "./BilingualLabel";
import { AlertTriangle, Check, Plus, Trash2, Lock, Sparkles, Scale } from "lucide-react";
import { toast } from "sonner";

interface ColorEntry {
  grupo: string;
  cor_nome: string;
  quantidade: number;
  cor_hex?: string;
}

interface ValidationData {
  produto_codigo?: string;
  produto_nome?: string;
  formula_codigo?: string;
  numero_item?: string;
  numero_ordem?: string;
  qty_total?: number;
  peso_bruto_g?: number;
  peso_liquido_g?: number;
  cores?: ColorEntry[];
  [key: string]: any;
}

interface ChinaDataValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ValidationData;
  onConfirm: (data: ValidationData) => void;
  mode?: "new" | "edit";
}

const EDIT_PASSWORD = "bimaster2026";

export function ChinaDataValidationDialog({
  open,
  onOpenChange,
  initialData,
  onConfirm,
  mode = "new",
}: ChinaDataValidationDialogProps) {
  const [data, setData] = useState<ValidationData>({ ...initialData });
  const [cores, setCores] = useState<ColorEntry[]>(initialData.cores?.length ? [...initialData.cores] : []);
  const [accepted, setAccepted] = useState(false);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open) {
      setData({ ...initialData });
      setCores(initialData.cores?.length ? [...initialData.cores] : []);
      setAccepted(false);
    }
  }, [open, initialData]);

  const colorSum = useMemo(() => cores.reduce((s, c) => s + (c.quantidade || 0), 0), [cores]);
  const qtyTotal = data.qty_total || 0;
  const hasMismatch = cores.length > 0 && colorSum !== qtyTotal && qtyTotal > 0;

  const updateField = (field: string, value: string | number | null) => {
    setData(d => ({ ...d, [field]: value }));
  };

  const updateColor = (index: number, field: keyof ColorEntry, value: string | number) => {
    setCores(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addColor = () => {
    setCores(prev => [...prev, { grupo: "A", cor_nome: "", quantidade: 0 }]);
  };

  const removeColor = (index: number) => {
    setCores(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (!accepted) return;
    const finalData = { ...data, cores, qty_total: data.qty_total };
    onConfirm(finalData);
    onOpenChange(false);
  };

  // Group summary
  const groupSummary = useMemo(() => {
    const groups: Record<string, number> = {};
    cores.forEach(c => {
      groups[c.grupo] = (groups[c.grupo] || 0) + (c.quantidade || 0);
    });
    return groups;
  }, [cores]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "edit" ? <Lock className="h-5 w-5 text-warning" /> : <Sparkles className="h-5 w-5 text-primary" />}
            <BilingualLabel pt={mode === "edit" ? "Editar Dados (Protegido)" : "Validação dos Dados Extraídos"} cn={mode === "edit" ? "编辑数据（受保护）" : "验证提取的数据"} size="md" />
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Modo de edição protegido por senha. 密码保护的编辑模式。"
              : "Revise e ajuste os dados extraídos pela IA antes de confirmar. 确认前请检查并调整AI提取的数据。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* General Data */}
          <section className="space-y-3">
            <BilingualLabel pt="Dados Gerais" cn="基本数据" size="md" className="border-b border-border pb-1" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Código 编号</Label>
                <Input value={data.produto_codigo || ""} onChange={e => updateField("produto_codigo", e.target.value)} className="h-9" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-xs">Nome 名称</Label>
                <Input value={data.produto_nome || ""} onChange={e => updateField("produto_nome", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fórmula 配方</Label>
                <Input value={data.formula_codigo || ""} onChange={e => updateField("formula_codigo", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Nº Item 项目号</Label>
                <Input value={data.numero_item || ""} onChange={e => updateField("numero_item", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Nº Ordem 订单号</Label>
                <Input value={data.numero_ordem || ""} onChange={e => updateField("numero_ordem", e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Scale className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <Label className="text-xs">Quantidade Total (pcs) 总数量</Label>
                <Input
                  type="number"
                  value={data.qty_total ?? ""}
                  onChange={e => updateField("qty_total", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 text-lg font-bold"
                />
              </div>
            </div>
          </section>

          {/* Color Grid */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
              <Button type="button" variant="outline" size="sm" onClick={addColor} className="gap-1 h-7">
                <Plus className="h-3 w-3" /> Cor 颜色
              </Button>
            </div>

            {cores.length > 0 ? (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20 text-xs">Grupo 组</TableHead>
                        <TableHead className="text-xs">Cor 颜色</TableHead>
                        <TableHead className="w-32 text-xs">Qtd 数量</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cores.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-1.5">
                            <Input value={c.grupo} onChange={e => updateColor(i, "grupo", e.target.value)} className="h-8 text-xs" />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Input value={c.cor_nome} onChange={e => updateColor(i, "cor_nome", e.target.value)} className="h-8 text-xs" />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Input
                              type="number"
                              value={c.quantidade}
                              onChange={e => updateColor(i, "quantidade", parseInt(e.target.value) || 0)}
                              className="h-8 text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeColor(i)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Group summary */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(groupSummary).map(([g, qty]) => (
                    <Badge key={g} variant="secondary" className="text-xs gap-1">
                      {g}: {qty.toLocaleString()} pcs
                    </Badge>
                  ))}
                  <Badge variant={hasMismatch ? "destructive" : "default"} className="text-xs gap-1 font-bold">
                    Total: {colorSum.toLocaleString()} pcs
                  </Badge>
                </div>

                {hasMismatch && (
                  <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Soma das cores ({colorSum.toLocaleString()}) difere da quantidade total ({qtyTotal.toLocaleString()}).
                    颜色总量与总数量不匹配。
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma cor extraída. Adicione manualmente se necessário. 未提取颜色。如需要请手动添加。
              </p>
            )}
          </section>

          {/* Weights */}
          <section className="space-y-3">
            <BilingualLabel pt="Pesos" cn="重量" size="md" className="border-b border-border pb-1" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Peso Bruto (g) 毛重</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_bruto_g ?? ""}
                  onChange={e => updateField("peso_bruto_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Peso Líquido (g) 净重</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_liquido_g ?? ""}
                  onChange={e => updateField("peso_liquido_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
          <div className="flex items-center gap-2 flex-1">
            <Checkbox id="accept-check" checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} />
            <label htmlFor="accept-check" className="text-sm cursor-pointer select-none">
              Confirmo que revisei todos os dados 我确认已审核所有数据
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar 取消</Button>
            <Button onClick={handleConfirm} disabled={!accepted} className="gap-2">
              <Check className="h-4 w-4" />
              {mode === "edit" ? "Salvar Alterações 保存更改" : "Confirmar Dados 确认数据"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Password prompt for edit mode
export function usePasswordProtectedEdit() {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");

  const requestEdit = () => {
    setPassword("");
    setShowPasswordPrompt(true);
  };

  const validatePassword = (onSuccess: () => void) => {
    if (password === EDIT_PASSWORD) {
      setShowPasswordPrompt(false);
      setPassword("");
      onSuccess();
    } else {
      toast.error("Senha incorreta 密码错误");
    }
  };

  return { showPasswordPrompt, setShowPasswordPrompt, password, setPassword, requestEdit, validatePassword };
}
