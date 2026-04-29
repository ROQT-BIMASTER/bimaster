import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaDataValidationDialog, usePasswordProtectedEdit } from "./ChinaDataValidationDialog";
import { Package, Palette, FlaskConical, Scale, Lock, Box, Layers, Tag } from "lucide-react";
import { validateLinhaProduto } from "@/lib/validations/china-submissao";

interface ExcelData {
  produto_codigo?: string;
  produto_nome?: string;
  numero_item?: string;
  numero_ordem?: string;
  formula_codigo?: string;
  linha_produto?: string;
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
  ean_display?: string;
  ean_unidade?: string;
  ean_caixa_master?: string;
  cores?: { grupo: string; cor_nome: string; quantidade: number; cor_hex?: string; codigo_barras_ean?: string }[];
}

interface ChinaExcelPreviewProps {
  data: ExcelData;
  editable?: boolean;
  onUpdate?: (data: ExcelData) => void;
}

export function ChinaExcelPreview({ data, editable = false, onUpdate }: ChinaExcelPreviewProps) {
  const { showPasswordPrompt, setShowPasswordPrompt, password, setPassword, requestEdit, validatePassword } = usePasswordProtectedEdit();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handlePasswordSuccess = () => {
    setEditDialogOpen(true);
  };

  const handleEditConfirm = (updatedData: ExcelData, _photos: Record<string, File[]>) => {
    onUpdate?.(updatedData);
    setEditDialogOpen(false);
  };

  return (
    <>
    <div className="space-y-4">
      {/* Product Info */}
      {/* Card "Código (Projeto)" = numero_ordem (PROJETO da planilha).
          NUNCA usar produto_codigo aqui — produto_codigo é o Item MUB,
          exibido em outros locais. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <InfoCard
          icon={<Package className="h-5 w-5 text-primary" />}
          labelPt="Código (Projeto)" labelCn="项目编号"
          value={data.numero_ordem || "—"}
        />
        <InfoCard
          icon={<FlaskConical className="h-5 w-5 text-accent" />}
          labelPt="Fórmula" labelCn="配方"
          value={data.formula_codigo || "—"}
        />
        <InfoCard
          icon={<Package className="h-5 w-5 text-warning" />}
          labelPt="Item (NUB)" labelCn="项目号"
          value={data.numero_item || "—"}
        />
        <InfoCard
          icon={<Layers className="h-5 w-5 text-info" />}
          labelPt="Display" labelCn="展示"
          value={data.display_type || "—"}
        />
        <InfoCard
          icon={<Tag className="h-5 w-5 text-primary" />}
          labelPt="Linha do Produto" labelCn="产品线"
          value={data.linha_produto || ""}
          required
          editable
          placeholder="Ex.: Lip, Eye, Face"
          errorMessage={validateLinhaProduto(data.linha_produto) || undefined}
          onChange={(v) => onUpdate?.({ ...data, linha_produto: v })}
        />
      </div>

      {/* Product Name */}
      {data.produto_nome && (
        <div className="text-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-lg font-bold text-foreground">{data.produto_nome}</span>
        </div>
      )}

      {/* EAN Codes */}
      {(data.ean_display || data.ean_caixa_master) && (
        <div className="flex flex-wrap gap-2">
          {data.ean_display && (
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              EAN Display: {data.ean_display}
            </Badge>
          )}
          {data.ean_caixa_master && (
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              EAN Master: {data.ean_caixa_master}
            </Badge>
          )}
        </div>
      )}

      {/* Quantities Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard
          icon={<Scale className="h-5 w-5 text-success" />}
          labelPt="QTY/Display" labelCn="每展示数量"
          value={data.qty_per_display ? `${data.qty_per_display.toLocaleString()} (${(data.qty_per_display / 12).toFixed(data.qty_per_display % 12 === 0 ? 0 : 1)} dz)` : "—"}
        />
        <InfoCard
          icon={<Package className="h-5 w-5 text-primary" />}
          labelPt="Total QTY" labelCn="总数量"
          value={data.qty_total?.toLocaleString() || "—"}
        />
        <InfoCard
          icon={<Box className="h-5 w-5 text-warning" />}
          labelPt="CTN (caixas)" labelCn="纸箱"
          value={data.ctn_total?.toLocaleString() || "—"}
        />
        <InfoCard
          icon={<Layers className="h-5 w-5 text-accent" />}
          labelPt="Grupos" labelCn="组数"
          value={data.total_groups ? `${data.total_groups} (${data.cartons_per_group || "—"} CTN/grupo)` : "—"}
        />
      </div>

      {/* Colors Grid */}
      {data.cores && data.cores.length > 0 && (
        <div className="space-y-2">
          <BilingualLabel pt="Grade de Cores" cn="颜色网格" size="md" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.cores.map((c, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-card rounded-lg border">
                {c.cor_hex ? (
                  <div className="h-4 w-4 rounded-full border border-border shrink-0" style={{ backgroundColor: c.cor_hex }} />
                ) : (
                  <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground block truncate">{c.cor_nome}</span>
                  <span className="text-[10px] text-muted-foreground">{c.grupo} · {c.quantidade} pcs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weights */}
      {(data.peso_bruto_g || data.peso_liquido_g || data.peso_aluminio_g || data.peso_plastico_g) && (
        <div className="flex flex-wrap gap-2">
          {data.peso_liquido_g != null && (
            <Badge variant="secondary" className="gap-1">
              <Scale className="h-3 w-3" />
              Net 净重: {data.peso_liquido_g}g
            </Badge>
          )}
          {data.peso_aluminio_g != null && (
            <Badge variant="secondary" className="gap-1">
              Alumínio 铝: {data.peso_aluminio_g}g
            </Badge>
          )}
          {data.peso_plastico_g != null && (
            <Badge variant="secondary" className="gap-1">
              Plástico 塑料: {data.peso_plastico_g}g
              {(data as any).tipo_material_plastico && (
                <span className="font-semibold text-primary">({(data as any).tipo_material_plastico})</span>
              )}
            </Badge>
          )}
          {data.peso_bruto_g != null && (
            <Badge variant="secondary" className="gap-1">
              <Scale className="h-3 w-3" />
              Bruto 毛重: {data.peso_bruto_g}g
            </Badge>
          )}
        </div>
      )}

      {/* Edit button */}
      {editable && (
        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={requestEdit} className="gap-2">
            <Lock className="h-3 w-3" /> Editar (Senha) 编辑（密码）
          </Button>
        </div>
      )}
    </div>

    {/* Password prompt dialog */}
    <Dialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Senha de Edição 编辑密码</DialogTitle>
        </DialogHeader>
        <Input
          type="password"
          placeholder="Digite a senha 输入密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && validatePassword(handlePasswordSuccess)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPasswordPrompt(false)}>Cancelar</Button>
          <Button onClick={() => validatePassword(handlePasswordSuccess)}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit validation dialog */}
    <ChinaDataValidationDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      initialData={data}
      onConfirm={handleEditConfirm}
      mode="edit"
    />
    </>
  );
}

function InfoCard({
  icon, labelPt, labelCn, value, editable, required, placeholder, errorMessage, onChange,
}: {
  icon: React.ReactNode;
  labelPt: string;
  labelCn: string;
  value: string;
  editable?: boolean;
  required?: boolean;
  placeholder?: string;
  errorMessage?: string;
  onChange?: (v: string) => void;
}) {
  const isEmpty = !value || value === "—";
  const showError = (!!required && isEmpty) || (!!editable && !!errorMessage && !isEmpty);
  return (
    <div
      className={
        "flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm " +
        (showError ? "border-destructive/60 bg-destructive/5" : "")
      }
    >
      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <BilingualLabel pt={labelPt} cn={labelCn} size="sm" />
          {required && <span className="text-destructive text-xs">*</span>}
        </div>
        {editable ? (
          <>
            <Input
              value={value || ""}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder}
              className="h-7 px-2 text-sm font-bold mt-0.5"
            />
            {showError && errorMessage && (
              <p className="text-[10px] text-destructive mt-1 leading-tight">{errorMessage}</p>
            )}
          </>
        ) : (
          <p className="text-sm font-bold text-foreground truncate">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}
