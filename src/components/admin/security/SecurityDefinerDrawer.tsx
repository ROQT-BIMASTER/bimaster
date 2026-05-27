import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useSecurityDefinerOverride } from "@/hooks/admin/useSecurityDefinerOverride";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  type SecurityDefinerFunctionEnriched,
  type SecurityDefinerStatus,
} from "@/lib/security/securityDefinerStatus";
import { Copy, FileCode2 } from "lucide-react";
import { toast } from "sonner";
interface Props {
  fn: SecurityDefinerFunctionEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityDefinerDrawer({ fn, open, onOpenChange }: Props) {
  const mutation = useSecurityDefinerOverride();
  const [statusOverride, setStatusOverride] = useState<SecurityDefinerStatus | "auto">("auto");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (fn) {
      setStatusOverride((fn.override?.status_override as SecurityDefinerStatus) ?? "auto");
      setNota(fn.override?.nota ?? "");
    }
  }, [fn]);

  if (!fn) return null;

  const handleSave = () => {
    mutation.mutate({
      schema_name: fn.schema_name,
      function_name: fn.function_name,
      function_signature: fn.function_signature,
      status_override: statusOverride === "auto" ? null : statusOverride,
      nota: nota.trim() || null,
    });
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success("Copiado", { description: path });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm break-all">
            {fn.schema_name}.{fn.function_name}
          </SheetTitle>
          <SheetDescription>
            <Badge variant="outline" className={STATUS_BADGE_CLASS[fn.status_final]}>
              {STATUS_LABELS[fn.status_final]}
            </Badge>
            {fn.used_in_frontend && (
              <Badge variant="outline" className="ml-2">
                {fn.callers_count} chamador{fn.callers_count > 1 ? "es" : ""}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assinatura</h3>
            <pre className="text-xs bg-muted/40 border border-border/60 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
{fn.function_signature}{"\n"}→ {fn.return_type}
            </pre>
            <div className="text-xs text-muted-foreground mt-2">
              {fn.language} • {fn.volatility}
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Permissões EXECUTE</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <GrantBadge label="anon" granted={fn.granted_to_anon} />
              <GrantBadge label="authenticated" granted={fn.granted_to_authenticated} />
              <GrantBadge label="service_role" granted={fn.granted_to_service_role} />
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Chamadores no frontend ({fn.callers_count})
            </h3>
            {fn.callers.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Nenhuma chamada <code>.rpc('{fn.function_name}')</code> encontrada em <code>src/</code>.
              </div>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {fn.callers.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-mono group">
                    <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{c.file}:{c.line}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => copyPath(`${c.file}:${c.line}`)}
                      aria-label="Copiar caminho"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisão de governança</h3>
            <div className="space-y-2">
              <label className="text-xs font-medium">Status</label>
              <Select value={statusOverride} onValueChange={(v) => setStatusOverride(v as typeof statusOverride)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (inferido: {STATUS_LABELS[fn.status_inferred]})</SelectItem>
                  <SelectItem value="mantida">Mantida</SelectItem>
                  <SelectItem value="ajustada">Ajustada</SelectItem>
                  <SelectItem value="revogada">Revogada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Nota</label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Justificativa, decisão tomada, link para PR/migration..."
                rows={4}
              />
            </div>
            {fn.override && (
              <div className="text-[11px] text-muted-foreground">
                Última revisão: {new Date(fn.override.reviewed_at).toLocaleString("pt-BR")}
                {fn.override.reviewed_by && ` por ${fn.override.reviewed_by.slice(0, 8)}…`}
              </div>
            )}
            <Button onClick={handleSave} disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Salvando..." : "Salvar revisão"}
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GrantBadge({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div
      className={`px-2 py-1.5 rounded border text-center font-mono ${
        granted
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      }`}
    >
      {label}: {granted ? "EXECUTE" : "revogado"}
    </div>
  );
}
