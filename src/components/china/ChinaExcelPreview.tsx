import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaDataValidationDialog, usePasswordProtectedEdit } from "./ChinaDataValidationDialog";
import { Package, Palette, FlaskConical, Scale, Lock } from "lucide-react";

interface ExcelData {
  produto_codigo?: string;
  produto_nome?: string;
  numero_item?: string;
  numero_ordem?: string;
  formula_codigo?: string;
  qty_total?: number;
  peso_bruto_g?: number;
  peso_liquido_g?: number;
  cores?: { grupo: string; cor_nome: string; quantidade: number; cor_hex?: string }[];
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

  const handleEditConfirm = (updatedData: ExcelData) => {
    onUpdate?.(updatedData);
    setEditDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Product Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard
          icon={<Package className="h-5 w-5 text-primary" />}
          labelPt="Código" labelCn="编号"
          value={data.produto_codigo || "—"}
        />
        <InfoCard
          icon={<FlaskConical className="h-5 w-5 text-accent" />}
          labelPt="Fórmula" labelCn="配方"
          value={data.formula_codigo || "—"}
        />
        <InfoCard
          icon={<Scale className="h-5 w-5 text-success" />}
          labelPt="Quantidade" labelCn="数量"
          value={data.qty_total?.toString() || "—"}
        />
        <InfoCard
          icon={<Package className="h-5 w-5 text-warning" />}
          labelPt="Item" labelCn="项目"
          value={data.numero_item || "—"}
        />
      </div>

      {/* Product Name */}
      {data.produto_nome && (
        <div className="text-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-lg font-bold text-foreground">{data.produto_nome}</span>
        </div>
      )}

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
      {(data.peso_bruto_g || data.peso_liquido_g) && (
        <div className="flex gap-3">
          {data.peso_liquido_g && (
            <Badge variant="secondary" className="gap-1">
              <Scale className="h-3 w-3" />
              Líquido 净重: {data.peso_liquido_g}g
            </Badge>
          )}
          {data.peso_bruto_g && (
            <Badge variant="secondary" className="gap-1">
              <Scale className="h-3 w-3" />
              Bruto 毛重: {data.peso_bruto_g}g
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, labelPt, labelCn, value }: { icon: React.ReactNode; labelPt: string; labelCn: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm">
      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <BilingualLabel pt={labelPt} cn={labelCn} size="sm" />
        <p className="text-sm font-bold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
