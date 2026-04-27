import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const QUICK_REASONS: { pt: string; cn: string }[] = [
  { pt: "Foto borrada / sem nitidez", cn: "照片模糊 / 不清晰" },
  { pt: "Falta informação no documento", cn: "缺少信息" },
  { pt: "Especificação errada", cn: "规格错误" },
  { pt: "Cor / tom divergente do aprovado", cn: "颜色与批准不符" },
  { pt: "Quantidade ou medida incorreta", cn: "数量或尺寸错误" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (motivo: string) => void;
  loading?: boolean;
}

/**
 * Bottom-sheet bilíngue para pedir ajuste em 1-2 cliques.
 * Mais rápido que digitar no WhatsApp.
 */
export function ChinaQuickReject({ open, onOpenChange, onConfirm, loading }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [extra, setExtra] = useState("");

  const finalText = selected
    ? extra.trim()
      ? `${selected} — ${extra.trim()}`
      : selected
    : extra.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Pedir ajuste / 请求修正
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Escolha um motivo / 选择原因
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_REASONS.map((r) => {
              const value = `${r.pt} / ${r.cn}`;
              const active = selected === value;
              return (
                <button
                  key={r.pt}
                  type="button"
                  onClick={() => setSelected(value)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border text-sm transition-colors",
                    active
                      ? "border-destructive bg-destructive/10 text-destructive font-medium"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <div>{r.pt}</div>
                  <div className="text-xs text-muted-foreground">{r.cn}</div>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-1">
              Detalhe opcional / 可选详情
            </p>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              placeholder="Ex.: Reenviar foto frontal com luz natural"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar / 取消
          </Button>
          <Button
            variant="destructive"
            disabled={!finalText || loading}
            onClick={() => {
              onConfirm(finalText);
              setSelected(null);
              setExtra("");
            }}
          >
            Enviar pedido / 发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
