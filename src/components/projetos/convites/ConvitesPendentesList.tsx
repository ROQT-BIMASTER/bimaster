import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, X, Mail, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useProjetoConvites, ProjetoConvite } from "@/hooks/useProjetoConvites";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_BADGE: Record<ProjetoConvite["status"], { label: string; variant: any; icon: any }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  accepted: { label: "Aceito", variant: "default", icon: CheckCircle2 },
  declined: { label: "Recusado", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelado", variant: "outline", icon: X },
  expired: { label: "Expirado", variant: "outline", icon: Clock },
};

export function ConvitesPendentesList({ projetoId }: { projetoId: string }) {
  const { convites, isLoading, cancel } = useProjetoConvites(projetoId);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/projetos/convite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  if (isLoading) return <p className="text-xs text-muted-foreground p-3">Carregando…</p>;
  if (convites.length === 0)
    return (
      <p className="text-xs text-muted-foreground p-3 text-center">
        Nenhum convite enviado ainda.
      </p>
    );

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-2 pr-2">
        {convites.map((c) => {
          const s = STATUS_BADGE[c.status];
          const Icon = s.icon;
          return (
            <div
              key={c.id}
              className="flex items-center gap-2 p-2 border rounded-md bg-card"
            >
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{c.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.papel} ·{" "}
                  {formatDistanceToNow(new Date(c.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Badge variant={s.variant} className="text-[10px] gap-1">
                <Icon className="h-3 w-3" />
                {s.label}
              </Badge>
              {c.status === "pending" && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => copyLink(c.token)}
                    title="Copiar link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => cancel.mutate(c.id)}
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
