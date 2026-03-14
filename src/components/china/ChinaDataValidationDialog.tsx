import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BilingualLabel } from "./BilingualLabel";
import { AlertTriangle, Check, Plus, Trash2, Lock, Sparkles, Scale, Package, Box, Camera, Upload, X, Barcode, FolderOpen, Paperclip, FileText, Video, File } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCofreProdutoConfig, useCofreItensForSubmissao, CofreConfigItem } from "@/hooks/useCofreProdutoConfig";

interface ColorEntry {
  grupo: string;
  cor_nome: string;
  quantidade: number;
  cor_hex?: string;
  codigo_barras_ean?: string;
}

const TIPOS_MATERIAL_PLASTICO = [
  { value: "PP", label: "PP (Polipropileno)" },
  { value: "PE", label: "PE (Polietileno)" },
  { value: "PET", label: "PET (Politereftalato)" },
  { value: "ABS", label: "ABS" },
  { value: "Acrílico", label: "Acrílico" },
  { value: "Outro", label: "Outro" },
];

interface ValidationData {
  produto_codigo?: string;
  produto_nome?: string;
  formula_codigo?: string;
  numero_item?: string;
  numero_ordem?: string;
  qty_per_display?: number;
  qty_total?: number;
  ctn_total?: number;
  display_type?: string;
  total_groups?: number;
  cartons_per_group?: number;
  peso_bruto_g?: number;
  peso_liquido_g?: number;
  peso_aluminio_g?: number;
  peso_plastico_g?: number;
  tipo_material_plastico?: string;
  cores?: ColorEntry[];
  [key: string]: any;
}

interface ChinaDataValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ValidationData;
  onConfirm: (data: ValidationData, photos: Record<string, File[]>) => void;
  mode?: "new" | "edit";
  showPhotoUpload?: boolean;
}

const EDIT_PASSWORD = "bimaster2026";

export function ChinaDataValidationDialog({
  open,
  onOpenChange,
  initialData,
  onConfirm,
  mode = "new",
  showPhotoUpload = true,
}: ChinaDataValidationDialogProps) {
  const [data, setData] = useState<ValidationData>({ ...initialData });
  const [cores, setCores] = useState<ColorEntry[]>(initialData.cores?.length ? [...initialData.cores] : []);
  const [accepted, setAccepted] = useState(false);
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      setData({ ...initialData });
      setCores(initialData.cores?.length ? [...initialData.cores] : []);
      setAccepted(false);
      setPhotos({});
      setPhotoPreviews({});
    }
  }, [open, initialData]);

  const colorSum = useMemo(() => cores.reduce((s, c) => s + (c.quantidade || 0), 0), [cores]);
  const qtyPerDisplay = data.qty_per_display || 0;
  const hasMismatch = cores.length > 0 && colorSum !== qtyPerDisplay && qtyPerDisplay > 0;

  const updateField = (field: string, value: string | number | null) => {
    setData(d => ({ ...d, [field]: value }));
  };

  const updateColor = (index: number, field: keyof ColorEntry, value: string | number) => {
    setCores(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addColor = () => {
    setCores(prev => [...prev, { grupo: "G1", cor_nome: "", quantidade: 0, codigo_barras_ean: "" }]);
  };

  const removeColor = (index: number) => {
    setCores(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = (key: string, files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setPhotos(prev => ({ ...prev, [key]: [...(prev[key] || []), ...newFiles] }));
    // Create previews
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreviews(prev => ({ ...prev, [key]: [...(prev[key] || []), e.target?.result as string] }));
      };
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (key: string, index: number) => {
    setPhotos(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
    setPhotoPreviews(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
  };

  const [eanDuplicates, setEanDuplicates] = useState<Record<string, string>>({});
  const [checkingEan, setCheckingEan] = useState(false);

  // Validate EAN uniqueness against DB
  const checkEanUniqueness = useCallback(async () => {
    const eansToCheck: { ean: string; label: string }[] = [];
    if (data.ean_display?.trim()) eansToCheck.push({ ean: data.ean_display.trim(), label: "EAN Display" });
    if (data.ean_caixa_master?.trim()) eansToCheck.push({ ean: data.ean_caixa_master.trim(), label: "EAN Caixa Master" });
    cores.forEach((c, i) => {
      if (c.codigo_barras_ean?.trim()) {
        eansToCheck.push({ ean: c.codigo_barras_ean.trim(), label: `EAN SKU ${c.cor_nome || `#${i + 1}`}` });
      }
    });

    if (eansToCheck.length === 0) return true;

    setCheckingEan(true);
    const duplicates: Record<string, string> = {};

    try {
      const allEans = eansToCheck.map(e => e.ean);

      // Check in china_produto_submissoes (ean_display, ean_caixa_master)
      const { data: subMatches } = await supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, ean_display, ean_caixa_master")
        .or(`ean_display.in.(${allEans.join(",")}),ean_caixa_master.in.(${allEans.join(",")})`) as any;

      // Check in china_produto_cores (codigo_barras_ean)
      const { data: corMatches } = await supabase
        .from("china_produto_cores" as any)
        .select("submissao_id, cor_nome, codigo_barras_ean")
        .in("codigo_barras_ean", allEans) as any;

      for (const item of eansToCheck) {
        const subMatch = (subMatches || []).find(
          (s: any) => (s.ean_display === item.ean || s.ean_caixa_master === item.ean)
        );
        if (subMatch) {
          duplicates[item.ean] = `${item.label} já usado no produto ${subMatch.produto_codigo}`;
        }

        const corMatch = (corMatches || []).find((c: any) => c.codigo_barras_ean === item.ean);
        if (corMatch && !duplicates[item.ean]) {
          duplicates[item.ean] = `${item.label} já usado em outro SKU`;
        }
      }
    } catch (err) {
      console.error("Erro ao verificar EAN:", err);
    }

    setCheckingEan(false);
    setEanDuplicates(duplicates);
    return Object.keys(duplicates).length === 0;
  }, [data.ean_display, data.ean_caixa_master, cores]);

  const isMaterialPlasticoMissing = (data.peso_plastico_g != null && data.peso_plastico_g > 0) && !data.tipo_material_plastico;

  const handleConfirm = async () => {
    if (!accepted) return;

    if (isMaterialPlasticoMissing) {
      toast.error("Selecione o Tipo de Material Plástico antes de confirmar. 请在确认前选择塑料材料类型。");
      return;
    }

    // Check EAN uniqueness before confirming
    const isUnique = await checkEanUniqueness();
    if (!isUnique) {
      toast.error("EAN duplicado detectado! Corrija antes de confirmar. EAN重复！请在确认前更正。");
      return;
    }

    const finalData = { ...data, cores };
    onConfirm(finalData, photos);
    onOpenChange(false);
  };

  const groupSummary = useMemo(() => {
    const groups: Record<string, number> = {};
    cores.forEach(c => {
      groups[c.grupo] = (groups[c.grupo] || 0) + (c.quantidade || 0);
    });
    return groups;
  }, [cores]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <Label className="text-xs">Código (Item MUB) 编号</Label>
                <Input value={data.produto_codigo || ""} onChange={e => updateField("produto_codigo", e.target.value)} className="h-9" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-xs">Nome (Item Name) 名称</Label>
                <Input value={data.produto_nome || ""} onChange={e => updateField("produto_nome", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fórmula 配方</Label>
                <Input value={data.formula_codigo || ""} onChange={e => updateField("formula_codigo", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Nº Item (NUB) 项目号</Label>
                <Input value={data.numero_item || ""} onChange={e => updateField("numero_item", e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Nº Ordem 订单号</Label>
                <Input value={data.numero_ordem || ""} onChange={e => updateField("numero_ordem", e.target.value)} className="h-9" />
              </div>
            </div>
          </section>

          {/* EAN Codes */}
          <section className="space-y-3">
            <BilingualLabel pt="Códigos EAN (Código de Barras)" cn="EAN条形码" size="md" className="border-b border-border pb-1" />
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg border ${eanDuplicates[data.ean_display?.trim() || ""] ? "bg-destructive/10 border-destructive/40" : "bg-accent/5 border-accent/20"}`}>
                <Label className="text-xs font-semibold">EAN Display 展示EAN</Label>
                <Input
                  value={data.ean_display || ""}
                  onChange={e => { updateField("ean_display", e.target.value); setEanDuplicates(d => { const n = { ...d }; delete n[data.ean_display?.trim() || ""]; return n; }); }}
                  className="h-9 font-mono mt-1"
                  placeholder="7898..."
                  maxLength={20}
                />
                {eanDuplicates[data.ean_display?.trim() || ""] && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {eanDuplicates[data.ean_display?.trim() || ""]}
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-lg border ${eanDuplicates[data.ean_caixa_master?.trim() || ""] ? "bg-destructive/10 border-destructive/40" : "bg-warning/5 border-warning/20"}`}>
                <Label className="text-xs font-semibold">EAN Caixa Master 主箱EAN</Label>
                <Input
                  value={data.ean_caixa_master || ""}
                  onChange={e => { updateField("ean_caixa_master", e.target.value); setEanDuplicates(d => { const n = { ...d }; delete n[data.ean_caixa_master?.trim() || ""]; return n; }); }}
                  className="h-9 font-mono mt-1"
                  placeholder="7898..."
                  maxLength={20}
                />
                {eanDuplicates[data.ean_caixa_master?.trim() || ""] && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {eanDuplicates[data.ean_caixa_master?.trim() || ""]}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O EAN por cor/SKU pode ser preenchido na grade abaixo. 每个颜色/SKU的EAN可在下方颜色网格中填写。
            </p>
          </section>

          {/* Quantities & Display */}
          <section className="space-y-3">
            <BilingualLabel pt="Quantidades e Display" cn="数量和展示" size="md" className="border-b border-border pb-1" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Label className="text-xs font-semibold">QTY por Display</Label>
                <Input
                  type="number"
                  value={data.qty_per_display ?? ""}
                  onChange={e => updateField("qty_per_display", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 text-lg font-bold mt-1"
                  placeholder="432"
                />
                {data.qty_per_display && data.qty_per_display > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    = {(data.qty_per_display / 12).toFixed(data.qty_per_display % 12 === 0 ? 0 : 1)} dúzia{data.qty_per_display >= 24 ? 's' : data.qty_per_display === 12 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="p-3 bg-success/5 rounded-lg border border-success/20">
                <Label className="text-xs font-semibold">TOTAL QTY (pcs) 总数量</Label>
                <Input
                  type="number"
                  value={data.qty_total ?? ""}
                  onChange={e => updateField("qty_total", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 text-lg font-bold mt-1"
                  placeholder="777600"
                />
              </div>
              <div className="p-3 bg-warning/5 rounded-lg border border-warning/20">
                <Label className="text-xs font-semibold">CTN/件 (caixas)</Label>
                <Input
                  type="number"
                  value={data.ctn_total ?? ""}
                  onChange={e => updateField("ctn_total", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 text-lg font-bold mt-1"
                  placeholder="1800"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Display 展示</Label>
                <Input value={data.display_type || ""} onChange={e => updateField("display_type", e.target.value)} className="h-9" placeholder="36IN1" />
              </div>
              <div>
                <Label className="text-xs">Total Grupos 总组数</Label>
                <Input
                  type="number"
                  value={data.total_groups ?? ""}
                  onChange={e => updateField("total_groups", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9"
                  placeholder="3"
                />
              </div>
              <div>
                <Label className="text-xs">Cartons/Grupo 每组纸箱</Label>
                <Input
                  type="number"
                  value={data.cartons_per_group ?? ""}
                  onChange={e => updateField("cartons_per_group", e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9"
                  placeholder="600"
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
                         <TableHead className="w-36 text-xs">EAN (SKU)</TableHead>
                         <TableHead className="w-32 text-xs">Qtd (PCS) 数量</TableHead>
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
                               value={(c as any).codigo_barras_ean || ""}
                               onChange={e => updateColor(i, "codigo_barras_ean" as any, e.target.value)}
                               className="h-8 text-xs font-mono"
                               placeholder="EAN..."
                               maxLength={20}
                             />
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
                  <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Soma das cores ({colorSum.toLocaleString()}) difere da quantidade por caixa ({qtyPerDisplay.toLocaleString()}).
                      颜色总量与每箱数量不匹配。
                    </div>
                    <div className="text-xs text-destructive/80 pl-6">
                      Cálculo: {cores.map(c => `${c.cor_nome}: ${c.quantidade.toLocaleString()}`).join(' + ')} = {colorSum.toLocaleString()} · QTY/Caixa = {qtyPerDisplay.toLocaleString()}
                    </div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Material Net (g) 净重</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_liquido_g ?? ""}
                  onChange={e => updateField("peso_liquido_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                  placeholder="6.68"
                />
              </div>
              <div>
                <Label className="text-xs">Alumínio (g) 铝</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_aluminio_g ?? ""}
                  onChange={e => updateField("peso_aluminio_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Bruto Total (g) 毛重</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_bruto_g ?? ""}
                  onChange={e => updateField("peso_bruto_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                  placeholder="23.85"
                />
              </div>
            </div>
           </section>

          {/* Grouped: Embalagem Plástica */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-1">
              <Package className="h-4 w-4 text-primary" />
              <BilingualLabel pt="Embalagem Plástica" cn="塑料包装" size="md" />
              {isMaterialPlasticoMissing && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                  Obrigatório
                </Badge>
              )}
            </div>
            <div className={cn(
              "grid grid-cols-2 gap-3 p-3 rounded-lg border-2 transition-colors",
              isMaterialPlasticoMissing
                ? "border-destructive/50 bg-destructive/5"
                : "border-primary/20 bg-primary/5"
            )}>
              <div>
                <Label className="text-xs">Plástico (g) 塑料</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={data.peso_plastico_g ?? ""}
                  onChange={e => updateField("peso_plastico_g", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-9"
                  placeholder="17.17"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  Tipo de Material Plástico 塑料材料类型
                  <span className="text-destructive">*</span>
                </Label>
                <select
                  value={data.tipo_material_plastico || ""}
                  onChange={e => updateField("tipo_material_plastico", e.target.value || null)}
                  className={cn(
                    "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isMaterialPlasticoMissing
                      ? "border-destructive text-destructive"
                      : "border-input"
                  )}
                >
                  <option value="">Selecione... 请选择...</option>
                  {TIPOS_MATERIAL_PLASTICO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Document/Photo Uploads → Cofre do Produto (Dynamic) */}
          {showPhotoUpload && (
            <CofreDoProdutoSection
              photos={photos}
              photoPreviews={photoPreviews}
              onPhotoUpload={handlePhotoUpload}
              onRemovePhoto={removePhoto}
            />
          )}
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
            <Button onClick={handleConfirm} disabled={!accepted || checkingEan} className="gap-2">
              {checkingEan ? <Barcode className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
              {checkingEan ? "Verificando EAN..." : mode === "edit" ? "Salvar Alterações 保存更改" : "Confirmar Dados 确认数据"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cofre do Produto Section (Dynamic) ───
function CofreDoProdutoSection({
  photos,
  photoPreviews,
  onPhotoUpload,
  onRemovePhoto,
}: {
  photos: Record<string, File[]>;
  photoPreviews: Record<string, string[]>;
  onPhotoUpload: (key: string, files: FileList | null) => void;
  onRemovePhoto: (key: string, index: number) => void;
}) {
  const { configs, loading } = useCofreProdutoConfig();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [extraConfigIds, setExtraConfigIds] = useState<string[]>([]);

  // Show active configs + manually added extras
  const activeConfigs = configs.filter(c => c.status === "ativo" || extraConfigIds.includes(c.id));

  // Progress calculation
  const totalItems = activeConfigs.length;
  const filledItems = activeConfigs.filter(c => {
    const key = `cofre_${c.id}`;
    return (photos[key]?.length || 0) >= c.qtd_minima;
  }).length;
  const requiredItems = activeConfigs.filter(c => c.obrigatorio);
  const requiredFilled = requiredItems.filter(c => {
    const key = `cofre_${c.id}`;
    return (photos[key]?.length || 0) >= c.qtd_minima;
  }).length;
  const allRequiredFilled = requiredFilled === requiredItems.length;
  const progressPercent = totalItems > 0 ? (filledItems / totalItems) * 100 : 0;

  const getAcceptByType = (tipo: string) => {
    switch (tipo) {
      case "foto": return "image/*";
      case "video": return "video/*";
      case "documento": return "application/pdf,.doc,.docx,.xlsx,.xls,.csv";
      default: return "image/*,application/pdf,.doc,.docx,.xlsx,.xls,.csv,video/*";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "foto": return <Camera className="h-5 w-5 text-muted-foreground" />;
      case "video": return <Video className="h-5 w-5 text-muted-foreground" />;
      case "documento": return <FileText className="h-5 w-5 text-muted-foreground" />;
      default: return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <FolderOpen className="h-4 w-4 text-primary" />
        <BilingualLabel pt="Cofre do Produto" cn="产品保险库附件" size="md" />
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {filledItems}/{totalItems} itens preenchidos
            {!allRequiredFilled && (
              <span className="text-destructive ml-2">
                ({requiredItems.length - requiredFilled} obrigatório(s) pendente(s))
              </span>
            )}
          </span>
          <span className="font-medium">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" gradient />
      </div>

      <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[10px] text-muted-foreground">
          Fotos e documentos enviados aqui vão para o <strong className="text-foreground">Cofre do Produto</strong> com status <Badge variant="warning" className="text-[9px] px-1 py-0 inline">Pendente</Badge> para aprovação do Brasil.
          上传的照片和文件将进入<strong>产品保险库</strong>，等待巴西审批。
        </p>
      </div>

      {/* Dynamic grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {activeConfigs.map(config => {
          const key = `cofre_${config.id}`;
          const fieldFiles = photos[key] || [];
          const previews = photoPreviews[key] || [];
          const isFilled = fieldFiles.length >= config.qtd_minima;

          return (
            <div key={config.id} className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] leading-tight block flex-1">
                  {config.nome_pt}
                  {config.nome_zh && <span className="text-muted-foreground ml-1">{config.nome_zh}</span>}
                </Label>
                <Badge
                  variant={config.obrigatorio ? "destructive" : "secondary"}
                  className="text-[7px] px-1 py-0 shrink-0"
                >
                  {config.obrigatorio ? "🔴" : "⚪"}
                </Badge>
              </div>
              <div className={cn(
                "relative border-2 border-dashed rounded-lg p-2 hover:border-primary/50 transition-colors min-h-[60px] flex flex-col items-center justify-center gap-1",
                isFilled ? "border-success/50 bg-success/5" : config.obrigatorio && fieldFiles.length === 0 ? "border-destructive/30 bg-destructive/5" : "border-muted-foreground/30"
              )}>
                {fieldFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1 w-full">
                    {fieldFiles.map((file, i) => {
                      const isImage = file.type.startsWith("image/");
                      return (
                        <div key={i} className="relative">
                          {isImage && previews[i] ? (
                            <img src={previews[i]} alt="" className="w-12 h-12 object-cover rounded border" />
                          ) : (
                            <div className="w-12 h-12 rounded border bg-muted flex flex-col items-center justify-center">
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[6px] text-muted-foreground truncate max-w-[44px]">{file.name.split('.').pop()?.toUpperCase()}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemovePhoto(key, i)}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  getTipoIcon(config.tipo_anexo)
                )}
                <input
                  type="file"
                  accept={getAcceptByType(config.tipo_anexo)}
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={e => onPhotoUpload(key, e.target.files)}
                />
                {fieldFiles.length > 0 ? (
                  <Badge variant="secondary" className="text-[8px] px-1 py-0">{fieldFiles.length} arquivo{fieldFiles.length > 1 ? "s" : ""}</Badge>
                ) : (
                  <span className="text-[8px] text-muted-foreground">
                    + Anexar · Mín: {config.qtd_minima} {config.tipo_anexo !== "qualquer" ? config.tipo_anexo : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Item Button */}
        <div className="space-y-1">
          <Label className="text-[10px] leading-tight block text-transparent">.</Label>
          <button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            className="w-full border-2 border-dashed border-primary/30 rounded-lg p-2 min-h-[60px] flex flex-col items-center justify-center gap-1 hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-5 w-5 text-primary/60" />
            <span className="text-[9px] text-primary/60 font-medium">+ Adicionar Item</span>
          </button>
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Itens ao Cofre</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
            {configs.filter(c => c.status === "ativo").map(c => {
              const alreadyExists = activeConfigs.some(ac => ac.id === c.id);
              return (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer">
                  <Checkbox
                    checked={selectedToAdd.includes(c.id)}
                    onCheckedChange={v => {
                      setSelectedToAdd(prev =>
                        v ? [...prev, c.id] : prev.filter(id => id !== c.id)
                      );
                    }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.nome_pt}</p>
                    {c.nome_zh && <p className="text-xs text-muted-foreground">{c.nome_zh}</p>}
                  </div>
                  <Badge variant={c.obrigatorio ? "destructive" : "secondary"} className="text-[9px]">
                    {c.obrigatorio ? "Obrigatório" : "Opcional"}
                  </Badge>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                toast.success(`${selectedToAdd.length} item(ns) adicionado(s)`);
                setSelectedToAdd([]);
                setAddDialogOpen(false);
              }}
              disabled={selectedToAdd.length === 0}
            >
              Adicionar Selecionados ({selectedToAdd.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
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
