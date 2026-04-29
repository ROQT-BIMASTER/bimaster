import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldQuestion, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tarefaId: string;
  trigger?: React.ReactNode;
}

interface DebugResult {
  tarefa: any;
  user: { id: string; nome: string; role_sistema: string };
  central: { visivel: boolean; motivos: string[]; bloqueios: string[] };
  projeto: {
    visivel: boolean; papel_no_projeto: string;
    motivos: string[]; bloqueios: string[]; secao_liberada: boolean;
  };
  regras_aplicadas: Array<{ regra: string; resultado: any }>;
}

export function VisibilidadeDebugDialog({ tarefaId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; nome: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, nome").order("nome").limit(200).then(({ data }) => {
      setUsers((data || []) as any);
    });
  }, [open]);

  const filtered = users.filter((u) =>
    !query || (u.nome || "").toLowerCase().includes(query.toLowerCase()),
  );

  const runDebug = async (userId: string) => {
    setSelectedUser(userId);
    setLoading(true);
    setResult(null);
    const { data, error } = await (supabase as any).rpc("debug_visibilidade_tarefa", {
      p_tarefa_id: tarefaId, p_user_id: userId,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao executar depuração", { description: error.message });
      return;
    }
    setResult(data as DebugResult);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ShieldQuestion className="h-4 w-4" /> Por que vejo isto?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Depurar visibilidade da tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Selecione o usuário para inspecionar</Label>
            <Input
              placeholder="Buscar por nome..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1"
            />
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
              {filtered.slice(0, 30).map((u) => (
                <button
                  key={u.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                    selectedUser === u.id ? "bg-primary/10" : ""
                  }`}
                  onClick={() => runDebug(u.id)}
                >
                  {u.nome}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nenhum usuário encontrado.
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando regras...
            </div>
          )}

          {result && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <div className="text-xs text-muted-foreground">Usuário</div>
                <div className="text-sm font-medium">
                  {result.user.nome} <Badge variant="outline" className="ml-1 text-[10px]">{result.user.role_sistema}</Badge>
                </div>
              </div>

              <ResultBlock
                titulo="Visibilidade na Central"
                visivel={result.central.visivel}
                motivos={result.central.motivos}
                bloqueios={result.central.bloqueios}
              />
              <ResultBlock
                titulo="Visibilidade no Projeto"
                visivel={result.projeto.visivel}
                motivos={result.projeto.motivos}
                bloqueios={result.projeto.bloqueios}
                extra={`Papel no projeto: ${result.projeto.papel_no_projeto} · Seção liberada: ${result.projeto.secao_liberada ? "sim" : "não"}`}
              />

              <div>
                <div className="text-xs font-semibold mb-1">Regras aplicadas</div>
                <div className="space-y-1">
                  {result.regras_aplicadas.map((r) => (
                    <div key={r.regra} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                      <span className="font-mono">{r.regra}</span>
                      <span className="font-mono">{String(r.resultado)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultBlock({
  titulo, visivel, motivos, bloqueios, extra,
}: { titulo: string; visivel: boolean; motivos: string[]; bloqueios: string[]; extra?: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center gap-2 mb-2">
        {visivel ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">{titulo}</span>
        <Badge variant={visivel ? "secondary" : "outline"} className="text-[10px]">
          {visivel ? "visível" : "oculta"}
        </Badge>
      </div>
      {extra && <div className="text-xs text-muted-foreground mb-1">{extra}</div>}
      {motivos.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Motivos: </span>
          {motivos.map((m) => <Badge key={m} variant="outline" className="text-[10px] mr-1">{m}</Badge>)}
        </div>
      )}
      {bloqueios.length > 0 && (
        <div className="text-xs mt-1">
          <span className="text-muted-foreground">Bloqueios: </span>
          {bloqueios.map((b) => <Badge key={b} variant="destructive" className="text-[10px] mr-1">{b}</Badge>)}
        </div>
      )}
    </div>
  );
}
