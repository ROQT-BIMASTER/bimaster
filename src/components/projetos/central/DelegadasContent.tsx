import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useMinhasDelegadas, type DelegadaTarefa } from "@/hooks/useMinhasDelegadas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Inbox } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

const Row = memo(function Row({ t, onOpen }: { t: DelegadaTarefa; onOpen: (t: DelegadaTarefa) => void }) {
  const prazoDate = parseLocalDate(t.data_prazo);
  const isOverdue = prazoDate && prazoDate < new Date() && t.status !== "concluida";
  const initials = (t.responsavel_nome || "?").split(" ").map((s) => s[0]).slice(0, 2).join("");
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir tarefa: ${t.titulo}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 focus:bg-muted/40 outline-none transition-colors cursor-pointer border-b border-border/20 last:border-b-0"
      onClick={() => onOpen(t)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t); } }}
    >
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.projeto_cor }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate text-foreground">{t.titulo}</div>
        <div className="text-xs text-muted-foreground truncate">
          {t.secao_nome ? `${t.secao_nome} · ` : ""}
          {t.projeto_nome}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {t.responsavel_id && (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              {t.responsavel_avatar_url && <AvatarImage src={t.responsavel_avatar_url} />}
              <AvatarFallback className="text-[9px]">{initials.toUpperCase() || "?"}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[140px]">
              {t.responsavel_nome || "Responsável"}
            </span>
          </div>
        )}
        {prazoDate && (
          <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {format(prazoDate, "d MMM", { locale: ptBR })}
          </span>
        )}
        {t.status === "concluida" && (
          <Badge variant="secondary" className="text-[10px] h-4">Concluída</Badge>
        )}
      </div>
    </div>
  );
});

export function DelegadasContent() {
  const { data: tarefas = [], isLoading } = useMinhasDelegadas();
  const navigate = useNavigate();

  const handleOpen = (t: DelegadaTarefa) => {
    navigate(`/dashboard/projetos/${t.projeto_id}?tarefa=${t.id}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (tarefas.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <div className="text-sm font-medium text-foreground">Nada delegado por enquanto</div>
          <div className="text-xs mt-1">
            Tarefas que você criar e atribuir a outras pessoas aparecem aqui.
          </div>
          <a
            href="/dashboard/ajuda/projetos-visibilidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Como funciona a visibilidade?
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tarefas que você delegou ({tarefas.length})
          </span>
        </div>
        {tarefas.map((t) => <Row key={t.id} t={t} onOpen={handleOpen} />)}
      </CardContent>
    </Card>
  );
}
