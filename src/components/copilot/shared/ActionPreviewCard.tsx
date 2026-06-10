import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import type { CopilotActionPayload } from "@/types/copilot";

interface Props {
  action: CopilotActionPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionPreviewCard({ action, onConfirm, onCancel }: Props) {
  const isFinance = action.category === "finance:write";
  return (
    <Card className="border border-primary/40 p-3 space-y-2 bg-background">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{action.label}</div>
        <div className="flex items-center gap-1">
          {action.requiresStepUp && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <ShieldAlert className="mr-1 h-3 w-3" />
              {isFinance ? "TOTP/SSO" : "Verificação extra"}
            </Badge>
          )}
          {action.undoable ? (
            <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
              <Undo2 className="mr-1 h-3 w-3" />
              Reversível
            </Badge>
          ) : (
            <Badge variant="outline" className="border-destructive text-destructive">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {isFinance ? "Apenas contra-lançamento" : "Irreversível"}
            </Badge>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        {Object.entries(action.previewFields).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground font-mono break-words">{formatVal(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={onConfirm}>
          Confirmar
        </Button>
      </div>
    </Card>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
