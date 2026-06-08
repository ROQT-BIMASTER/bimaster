import { useEffect, useMemo, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Loader2 } from "lucide-react";
import {
  TAREFA_DETALHE_TELA,
  TAREFA_DETALHE_CATALOGO,
} from "@/config/tarefa-detalhe-componentes";

const ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "gerente", label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
  { value: "promotor", label: "Promotor" },
  { value: "promotora", label: "Promotora" },
  { value: "consultor", label: "Consultor" },
  { value: "marketing", label: "Marketing" },
  { value: "suporte", label: "Suporte" },
  { value: "cliente", label: "Cliente" },
];

type Scope =
  | { kind: "role"; role: string }
  | { kind: "departamento"; departamento_id: string };

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
  const [tab, setTab] = useState<"role" | "departamento">("role");
  const [selectedRole, setSelectedRole] = useState<string>("vendedor");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [pending, setPending] = useState<Record<string, { visivel: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const scope: Scope | null =
    tab === "role"
      ? { kind: "role", role: selectedRole }
      : selectedDept
      ? { kind: "departamento", departamento_id: selectedDept }
      : null;

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departamentos")
        .select("id, nome")
        .order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions-admin", TAREFA_DETALHE_TELA, scope],
    enabled: !!scope,
    queryFn: async () => {
      if (!scope) return [];
      let q = supabase
        .from("ui_permissions")
        .select("*")
        .eq("tela_codigo", TAREFA_DETALHE_TELA);
      if (scope.kind === "role") {
        q = q.eq("role", scope.role).is("departamento_id", null);
      } else {
        q = q.eq("departamento_id", scope.departamento_id).is("role", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as UIRule[];
    },
  });

  // Sync pending state when rules load/change
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
    return true; // default visible
  };

  const setVisible = (codigo: string, visivel: boolean) => {
    setPending((p) => ({ ...p, [codigo]: { visivel } }));
  };

  const hasChanges = useMemo(() => {
    // a change exists if any componente differs from its DB value (or DB has no row & user toggled off)
    for (const grupo of TAREFA_DETALHE_CATALOGO) {
      for (const item of grupo.itens) {
        const current = getVisible(item.codigo);
        const dbRule = ruleByCode.get(item.codigo);
        const dbVisible = dbRule ? dbRule.visivel : true;
        if (current !== dbVisible) return true;
      }
    }
    return false;
  }, [pending, ruleByCode]);

  const handleSave = async () => {
    if (!scope) return;
    setSaving(true);
    try {
      const upserts: any[] = [];
      const deletes: string[] = [];
      for (const grupo of TAREFA_DETALHE_CATALOGO) {
        for (const item of grupo.itens) {
          const current = getVisible(item.codigo);
          const dbRule = ruleByCode.get(item.codigo);
          // If we want visivel=true and there's no DB rule, skip (default is visible).
          if (current === true && !dbRule) continue;
          // If we want visivel=true and there IS a DB rule, delete it (return to default).
          if (current === true && dbRule) {
            deletes.push(dbRule.id);
            continue;
          }
          // current === false: upsert
          upserts.push({
            role: scope.kind === "role" ? scope.role : null,
            departamento_id:
              scope.kind === "departamento" ? scope.departamento_id : null,
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
      toast.success("Configuração salva");
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
        <AppSidebar />
        <main className="flex-1 p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Visibilidade — Detalhe de Tarefa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure quais campos e ações aparecem no painel de detalhe da tarefa para cada
              perfil ou departamento. Itens em desenvolvimento podem ser ocultados de usuários
              comuns enquanto o time interno continua testando.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escopo</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="role">Por perfil</TabsTrigger>
                  <TabsTrigger value="departamento">Por departamento</TabsTrigger>
                </TabsList>
                <TabsContent value="role" className="mt-4">
                  <div className="max-w-xs">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                <TabsContent value="departamento" className="mt-4">
                  <div className="max-w-md">
                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departamentos.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Regras por departamento têm prioridade sobre regras por perfil.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Componentes</CardTitle>
              <Button
                onClick={handleSave}
                disabled={!scope || !hasChanges || saving}
                size="sm"
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {!scope ? (
                <p className="text-sm text-muted-foreground">Selecione um escopo acima.</p>
              ) : isLoading ? (
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
