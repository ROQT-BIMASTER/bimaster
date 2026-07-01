import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, ShieldQuestion, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAccessRequests, useAtualizarSolicitacaoAcesso, type AccessRequestRow } from "@/hooks/useAccessRequests";

const STATUS_BADGE: Record<AccessRequestRow["status"], { label: string; cls: string }> = {
  aberto:      { label: "Aberto",      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  em_analise:  { label: "Em análise",  cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  aprovado:    { label: "Aprovado",    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  negado:      { label: "Negado",      cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export default function SolicitacoesAcesso() {
  const { data: rows = [], isLoading } = useAccessRequests("all");
  const atualizar = useAtualizarSolicitacaoAcesso();
  const [filter, setFilter] = useState<AccessRequestRow["status"] | "todos">("aberto");

  const filtered = rows.filter((r) => filter === "todos" || r.status === filter);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <ShieldQuestion className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Solicitações de acesso</h1>
          <p className="text-xs text-muted-foreground">
            Pedidos originados nos avisos de "sem permissão" espalhados pelo sistema.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["aberto", "em_analise", "aprovado", "negado", "todos"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFilter(s)}
          >
            {s === "todos" ? "Todos" : STATUS_BADGE[s].label}
          </Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação neste filtro.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((r) => (
                <li key={r.id} className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] h-4 border ${STATUS_BADGE[r.status].cls}`}>
                      {STATUS_BADGE[r.status].label}
                    </Badge>
                    <span className="text-xs font-medium truncate">
                      {r.resource_label || r.resource_kind}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {r.resource_kind}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap break-words">
                    {r.justification}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Pedido por: {r.requester_email ?? r.requester_id.slice(0, 8)}</span>
                    {r.route && <span>· Rota: <span className="font-mono">{r.route}</span></span>}
                  </div>

                  {r.status !== "aprovado" && r.status !== "negado" && (
                    <div className="flex gap-2 pt-1">
                      <ActionButton
                        icon={<PlayCircle className="h-3 w-3" />}
                        label="Em análise"
                        onSubmit={(note) => atualizar.mutateAsync({ id: r.id, status: "em_analise", note })}
                      />
                      <ActionButton
                        icon={<CheckCircle2 className="h-3 w-3" />}
                        label="Aprovar"
                        variant="default"
                        onSubmit={(note) => atualizar.mutateAsync({ id: r.id, status: "aprovado", note })}
                      />
                      <ActionButton
                        icon={<XCircle className="h-3 w-3" />}
                        label="Negar"
                        variant="destructive"
                        onSubmit={(note) => atualizar.mutateAsync({ id: r.id, status: "negado", note })}
                      />
                    </div>
                  )}

                  {r.handled_note && (
                    <p className="text-[11px] italic text-muted-foreground">
                      Nota do admin: {r.handled_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  variant = "outline",
  onSubmit,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "outline" | "destructive";
  onSubmit: (note: string) => Promise<unknown>;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant} className="h-7 text-[11px] gap-1">
          {icon} {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="min-h-[60px] text-xs"
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onSubmit(note);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Confirmar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
