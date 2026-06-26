import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSwitch } from "@/components/navigation/v2/SidebarSwitch";
import { AppHeaderBar } from "@/components/dashboard/AppHeaderBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldQuestion, Loader2 } from "lucide-react";

export default function VisibilidadeTarefas() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [tarefaQuery, setTarefaQuery] = useState("");
  const [tarefas, setTarefas] = useState<Array<{ id: string; titulo: string; codigo: string | null }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; nome: string }>>([]);
  const [selTarefa, setSelTarefa] = useState<string | null>(null);
  const [selUser, setSelUser] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("id, nome").order("nome").limit(300).then(({ data }) => {
      setUsers((data || []) as any);
    });
  }, []);

  useEffect(() => {
    const q = tarefaQuery.trim();
    if (q.length < 2) { setTarefas([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo")
        .or(`titulo.ilike.%${q}%,codigo.ilike.%${q}%`)
        .is("excluida_em", null)
        .limit(20);
      setTarefas((data || []) as any);
    }, 300);
    return () => clearTimeout(t);
  }, [tarefaQuery]);

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const run = async () => {
    if (!selTarefa || !selUser) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("debug_visibilidade_tarefa", {
      p_tarefa_id: selTarefa, p_user_id: selUser,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setResult(data);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarSwitch />
        <main className="flex-1 overflow-auto">
          <AppHeaderBar />
          <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Depuração de visibilidade de tarefas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Selecione uma tarefa e um usuário para ver exatamente quais regras se aplicam.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Tarefa</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Buscar por título ou código..." value={tarefaQuery} onChange={(e) => setTarefaQuery(e.target.value)} />
                <div className="max-h-60 overflow-y-auto border rounded divide-y">
                  {tarefas.map((t) => (
                    <button key={t.id} onClick={() => setSelTarefa(t.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selTarefa === t.id ? "bg-primary/10" : ""}`}>
                      <div className="font-medium truncate">{t.titulo}</div>
                      {t.codigo && <div className="text-xs text-muted-foreground">{t.codigo}</div>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Usuário</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto border rounded divide-y">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => setSelUser(u.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selUser === u.id ? "bg-primary/10" : ""}`}>
                      {u.nome}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={run} disabled={!selTarefa || !selUser || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Calcular visibilidade
          </Button>

          {result && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Resultado</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-[500px]">
{JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
