import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowRight, RefreshCw, ShieldCheck, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Candidate = {
  id: string;
  profile_canonical_id: string;
  profile_duplicate_id: string;
  score: number;
  reason: string;
  status: string;
  detected_at: string;
  canonical?: { id: string; nome: string; email: string; status: string; aprovado: boolean };
  duplicate?: { id: string; nome: string; email: string; status: string; aprovado: boolean };
};

export default function DedupePerfis() {
  const { isAdmin, loading } = useUserRole();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const candidates = useQuery({
    queryKey: ["dedupe-candidates"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_dedupe_candidates")
        .select("*")
        .order("status", { ascending: true })
        .order("score", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).flatMap((c: any) => [c.profile_canonical_id, c.profile_duplicate_id])));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email, status, aprovado")
        .in("id", ids);
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((c: any) => ({
        ...c,
        canonical: map.get(c.profile_canonical_id),
        duplicate: map.get(c.profile_duplicate_id),
      })) as Candidate[];
    },
  });

  async function runDetect() {
    setRunning(true);
    try {
      const { error } = await supabase.rpc("detect_duplicate_profiles");
      if (error) throw error;
      toast.success("Detecção concluída");
      qc.invalidateQueries({ queryKey: ["dedupe-candidates"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha na detecção");
    } finally { setRunning(false); }
  }

  const merge = useMutation({
    mutationFn: async (vars: { canonicalId: string; duplicateId: string; candidateId: string }) => {
      const { data, error } = await supabase.rpc("consolidate_profiles", {
        p_canonical_id: vars.canonicalId,
        p_duplicate_id: vars.duplicateId,
        p_candidate_id: vars.candidateId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Perfis consolidados");
      qc.invalidateQueries({ queryKey: ["dedupe-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao consolidar"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profile_dedupe_candidates")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidato rejeitado");
      qc.invalidateQueries({ queryKey: ["dedupe-candidates"] });
    },
  });

  if (loading) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;
  if (!isAdmin) return <div className="p-6 text-muted-foreground">Acesso restrito a administradores.</div>;

  const pending = (candidates.data || []).filter((c) => c.status === "pending");
  const resolved = (candidates.data || []).filter((c) => c.status !== "pending");

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deduplicação de Perfis</h1>
          <p className="text-sm text-muted-foreground">Detecta e consolida perfis com e-mails ou nomes muito parecidos.</p>
        </div>
        <Button onClick={runDetect} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Rodar detecção agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendentes ({pending.length})</CardTitle>
          <CardDescription>Revise antes de consolidar — ação é irreversível.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            {pending.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Nenhum candidato pendente.</div>}
            <div className="space-y-3">
              {pending.map((c) => (
                <div key={c.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{c.reason}</Badge>
                    <Badge variant="secondary">score {Number(c.score).toFixed(1)}</Badge>
                    <span className="text-muted-foreground ml-auto">{format(new Date(c.detected_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    <ProfileCard label="Manter (canônico)" p={c.canonical} highlight />
                    <ArrowRight className="h-5 w-5 mx-auto text-muted-foreground" />
                    <ProfileCard label="Mesclar (duplicado)" p={c.duplicate} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => reject.mutate(c.id)} disabled={reject.isPending}>
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={merge.isPending}>
                          <ShieldCheck className="h-4 w-4 mr-1" /> Consolidar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar consolidação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todas as tarefas, seguidores, colaboradores e mapeamentos do perfil <b>{c.duplicate?.email}</b> serão movidos para <b>{c.canonical?.email}</b>. O perfil duplicado será marcado como inativo. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => merge.mutate({
                            canonicalId: c.profile_canonical_id,
                            duplicateId: c.profile_duplicate_id,
                            candidateId: c.id,
                          })}>Consolidar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico ({resolved.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Canônico</th>
                  <th className="text-left py-2 px-2">Duplicado</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                  <th className="text-left py-2 px-2">Detectado</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 px-2"><Badge variant={c.status === "merged" ? "default" : "outline"}>{c.status}</Badge></td>
                    <td className="py-2 px-2">{c.canonical?.email}</td>
                    <td className="py-2 px-2 text-muted-foreground">{c.duplicate?.email}</td>
                    <td className="py-2 px-2">{c.reason}</td>
                    <td className="py-2 px-2">{format(new Date(c.detected_at), "dd/MM HH:mm", { locale: ptBR })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileCard({ label, p, highlight }: { label: string; p?: any; highlight?: boolean }) {
  return (
    <div className={`border rounded-md p-3 ${highlight ? "border-primary/50 bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-medium">{p?.nome || "—"}</div>
      <div className="text-xs text-muted-foreground">{p?.email}</div>
      <div className="flex gap-1 mt-2">
        <Badge variant="outline" className="text-xs">{p?.status || "?"}</Badge>
        {p?.aprovado && <Badge variant="secondary" className="text-xs">aprovado</Badge>}
      </div>
    </div>
  );
}
