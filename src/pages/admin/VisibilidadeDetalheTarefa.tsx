import { useEffect, useMemo, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSwitch } from "@/components/navigation/v2/SidebarSwitch";
import { AppHeaderBar } from "@/components/dashboard/AppHeaderBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Loader2, ShieldAlert } from "lucide-react";
import {
  TAREFA_DETALHE_TELA,
  TAREFA_DETALHE_CATALOGO,
} from "@/config/tarefa-detalhe-componentes";

/**
 * Sentinel: regras com role='__all__' valem para TODOS os usuários
 * não-administradores. Admin sempre vê tudo (bypass no hook useUIPermissions).
 */
const GLOBAL_ROLE = "__all__";

interface UIRule {
  id: string;
  role: string | null;
  departamento_id: string | null;
  tela_codigo: string;
  componente_codigo: string;
  visivel: boolean;
  editavel: boolean;
}

export default function VisibilidadeDetalheTarefa() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const qc = useQueryClient();
  const [pending, setPending] = useState<Record<string, { visivel: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions-admin", TAREFA_DETALHE_TELA, GLOBAL_ROLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .eq("tela_codigo", TAREFA_DETALHE_TELA)
        .eq("role", GLOBAL_ROLE)
        .is("departamento_id", null);
      if (error) throw error;
      return (data || []) as UIRule[];
    },
  });

  useEffect(() => {
    const map: Record<string, { visivel: boolean }> = {};
    for (const r of rules) {
      map[r.componente_codigo] = { visivel: r.visivel };
    }
    setPending(map);
  }, [rules]);

  const ruleByCode = useMemo(() => {
    const m = new Map<string, UIRule>();
    for (const r of rules) m.set(r.componente_codigo, r);
    return m;
  }, [rules]);

  const getVisible = (codigo: string): boolean => {
    if (codigo in pending) return pending[codigo].visivel;
    return true;
  };

  const setVisible = (codigo: string, visivel: boolean) => {
    setPending((p) => ({ ...p, [codigo]: { visivel } }));
  };

  const hasChanges = useMemo(() => {
    for (const grupo of TAREFA_DETALHE_CATALOGO) {
      for (const item of grupo.itens) {
        const current = getVisible(item.codigo);
        const dbRule = ruleByCode.get(item.codigo);
        const dbVisible = dbRule ? dbRule.visivel : true;
        if (current !== dbVisible) return true;
      }
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, ruleByCode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts: any[] = [];
      const deletes: string[] = [];
      for (const grupo of TAREFA_DETALHE_CATALOGO) {
        for (const item of grupo.itens) {
          const current = getVisible(item.codigo);
          const dbRule = ruleByCode.get(item.codigo);
          if (current === true && !dbRule) continue;
          if (current === true && dbRule) {
            deletes.push(dbRule.id);
            continue;
          }
          upserts.push({
            role: GLOBAL_ROLE,
            departamento_id: null,
            tela_codigo: TAREFA_DETALHE_TELA,
            componente_codigo: item.codigo,
            visivel: false,
            editavel: dbRule?.editavel ?? true,
          });
        }
      }

      if (deletes.length) {
        const { error } = await supabase
          .from("ui_permissions")
          .delete()
          .in("id", deletes);
        if (error) throw error;
      }
      if (upserts.length) {
        const { error } = await supabase
          .from("ui_permissions")
          .upsert(upserts, {
            onConflict: "role,departamento_id,tela_codigo,componente_codigo",
          });
        if (error) throw error;
      }
      toast.success("Configuração salva. Usuários verão a mudança em até 60s.");
      qc.invalidateQueries({ queryKey: ["ui-permissions-admin"] });
      qc.invalidateQueries({ queryKey: ["ui-permissions"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SidebarSwitch />
        <main className="flex-1">
          <AppHeaderBar />
          <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Visibilidade — Detalhe de Tarefa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure quais campos, ações e seções aparecem no painel de detalhe da tarefa.
              Itens desativados ficam ocultos para <strong>todos os usuários</strong>. O
              administrador continua vendo tudo, para que possa testar features em
              desenvolvimento antes de liberar.
            </p>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Escopo global</p>
                <p className="text-muted-foreground">
                  Esta tela aplica uma única configuração para todos os perfis (vendedor,
                  supervisor, gerente, marketing, etc.). Apenas o administrador é
                  automaticamente isento.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Componentes</CardTitle>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                size="sm"
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                TAREFA_DETALHE_CATALOGO.map((grupo) => (
                  <div key={grupo.titulo} className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{grupo.titulo}</h3>
                    <div className="divide-y divide-border/60 rounded-md border border-border/60">
                      {grupo.itens.map((item) => {
                        const visivel = getVisible(item.codigo);
                        const hasRule = ruleByCode.has(item.codigo);
                        return (
                          <div
                            key={item.codigo}
                            className="flex items-center justify-between px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{item.label}</span>
                                {!hasRule && (
                                  <Badge variant="outline" className="text-[10px]">
                                    padrão (visível)
                                  </Badge>
                                )}
                                {hasRule && !visivel && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    oculto para todos
                                  </Badge>
                                )}
                              </div>
                              <code className="text-[10px] text-muted-foreground">{item.codigo}</code>
                            </div>
                            <div className="flex items-center gap-2">
                              {visivel ? (
                                <Eye className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <Switch
                                checked={visivel}
                                onCheckedChange={(v) => setVisible(item.codigo, v)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </SidebarProvider>
  );
}
