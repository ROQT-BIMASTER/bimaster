import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Activity, Lock, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  meta: {
    generated_at: string;
    total: number;
    used_in_frontend: number;
    no_public_grant: number;
  };
  reviewedCount: number;
}

export function SecurityDefinerHeader({ meta, reviewedCount }: Props) {
  const generated = (() => {
    try {
      return format(new Date(meta.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return meta.generated_at;
    }
  })();

  const cards = [
    { icon: ShieldCheck, label: "Total de funções", value: meta.total, hint: `Snapshot de ${generated}` },
    { icon: Activity, label: "Usadas pelo frontend", value: meta.used_in_frontend, hint: `${Math.round((meta.used_in_frontend / meta.total) * 100)}% do total` },
    { icon: Lock, label: "Sem grant público", value: meta.no_public_grant, hint: "EXECUTE revogado para anon e authenticated" },
    { icon: ClipboardCheck, label: "Revisadas", value: reviewedCount, hint: "Com override de status registrado" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">
          Auditoria — Funções SECURITY DEFINER
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lista todas as funções SECURITY DEFINER do banco com indicação de uso pelo frontend, status de governança e revisões manuais.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-start gap-3">
              <c.icon className="h-5 w-5 text-primary mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-semibold leading-tight">{c.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.hint}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
