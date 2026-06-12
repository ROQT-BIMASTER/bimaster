import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Briefing {
  id: string;
  titulo: string;
  tipo: string | null;
  status: string;
  completude: number | null;
}

interface Props {
  tarefaId: string;
}

export function TarefaBriefingsSection({ tarefaId }: Props) {
  const [items, setItems] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!tarefaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("briefings")
        .select("id, titulo, tipo, status, completude")
        .eq("tarefa_id", tarefaId)
        .order("updated_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as Briefing[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tarefaId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Carregando briefings…
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Briefings vinculados
        </span>
        <span className="text-[10px] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((b) => (
          <button
            key={b.id}
            onClick={() => navigate(`/dashboard/briefings/${b.id}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-muted/40 border border-border/50"
          >
            <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{b.titulo}</div>
              <div className="text-[10px] text-muted-foreground">
                {b.tipo ?? "briefing"}
                {typeof b.completude === "number" && ` · ${b.completude}% completo`}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {b.status}
            </Badge>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
