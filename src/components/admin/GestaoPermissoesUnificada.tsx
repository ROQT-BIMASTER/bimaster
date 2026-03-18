import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAllDepartments } from "@/hooks/useUserDepartments";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Shield, Users, Building2, Zap, Eye, EyeOff, Lock, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

// All screens and their components/actions
const SCREENS_COMPONENTS: Record<string, { label: string; components: { codigo: string; label: string; tipo: string }[] }> = {
  china_submissoes: {
    label: "Submissões China",
    components: [
      { codigo: "botao_criar", label: "Botão Criar Submissão", tipo: "botao" },
      { codigo: "botao_editar", label: "Botão Editar", tipo: "botao" },
      { codigo: "botao_excluir", label: "Botão Excluir", tipo: "botao" },
      { codigo: "botao_exportar", label: "Botão Exportar", tipo: "botao" },
      { codigo: "aba_documentos", label: "Aba Documentos", tipo: "secao" },
      { codigo: "aba_chat", label: "Aba Chat", tipo: "secao" },
      { codigo: "precos_custos", label: "Preços e Custos", tipo: "campo" },
    ],
  },
  china_ordens: {
    label: "Ordens de Compra",
    components: [
      { codigo: "botao_criar_oc", label: "Botão Criar OC", tipo: "botao" },
      { codigo: "botao_aprovar", label: "Botão Aprovar", tipo: "botao" },
      { codigo: "botao_exportar", label: "Botão Exportar", tipo: "botao" },
      { codigo: "valor_total", label: "Valor Total", tipo: "campo" },
      { codigo: "condicoes_pagamento", label: "Condições de Pagamento", tipo: "campo" },
    ],
  },
  china_fichas: {
    label: "Fichas de Produto",
    components: [
      { codigo: "botao_editar", label: "Botão Editar Ficha", tipo: "botao" },
      { codigo: "custos_producao", label: "Custos de Produção", tipo: "campo" },
      { codigo: "dados_regulatorios", label: "Dados Regulatórios", tipo: "campo" },
    ],
  },
  projetos_produto_brasil: {
    label: "Produtos Brasil",
    components: [
      { codigo: "botao_editar", label: "Botão Editar", tipo: "botao" },
      { codigo: "botao_excluir", label: "Botão Excluir", tipo: "botao" },
      { codigo: "tab_custos", label: "Aba Custos", tipo: "secao" },
      { codigo: "tab_formulacao", label: "Aba Formulação", tipo: "secao" },
      { codigo: "tab_regulatorio", label: "Aba Regulatório", tipo: "secao" },
    ],
  },
  dashboard_comercial: {
    label: "Dashboard Comercial",
    components: [
      { codigo: "botao_exportar", label: "Botão Exportar", tipo: "botao" },
      { codigo: "kpis_financeiros", label: "KPIs Financeiros", tipo: "campo" },
      { codigo: "grafico_vendas", label: "Gráfico de Vendas", tipo: "secao" },
    ],
  },
  clientes: {
    label: "Clientes",
    components: [
      { codigo: "botao_criar", label: "Botão Criar Cliente", tipo: "botao" },
      { codigo: "botao_editar", label: "Botão Editar", tipo: "botao" },
      { codigo: "botao_excluir", label: "Botão Excluir", tipo: "botao" },
      { codigo: "dados_financeiros", label: "Dados Financeiros", tipo: "campo" },
    ],
  },
};

const ROLES = ["admin", "gerente", "supervisor", "vendedor", "promotor", "cliente"];

export default function GestaoPermissoesUnificada() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gestão Unificada de Permissões</CardTitle>
          </div>
          <CardDescription>
            Controle granular de módulos, telas, campos, componentes e ações por perfil e departamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="por-role" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="por-role" className="gap-1 text-xs">
                <Users className="h-3.5 w-3.5" />
                Por Perfil
              </TabsTrigger>
              <TabsTrigger value="por-departamento" className="gap-1 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                Por Departamento
              </TabsTrigger>
              <TabsTrigger value="matriz-acoes" className="gap-1 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Matriz de Ações
              </TabsTrigger>
              <TabsTrigger value="feature-flags" className="gap-1 text-xs">
                <Zap className="h-3.5 w-3.5" />
                Feature Flags
              </TabsTrigger>
            </TabsList>

            <TabsContent value="por-role" className="mt-4">
              <TabPorRole userId={user?.id} />
            </TabsContent>

            <TabsContent value="por-departamento" className="mt-4">
              <TabPorDepartamento userId={user?.id} />
            </TabsContent>

            <TabsContent value="matriz-acoes" className="mt-4">
              <TabMatrizAcoes userId={user?.id} />
            </TabsContent>

            <TabsContent value="feature-flags" className="mt-4">
              <TabFeatureFlags />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== Tab: Por Role =====================

function TabPorRole({ userId }: { userId?: string }) {
  const [selectedRole, setSelectedRole] = useState("vendedor");
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions-by-role", selectedRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .eq("role", selectedRole)
        .is("departamento_id", null);
      if (error) throw error;
      return data || [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (params: { tela: string; componente: string; visivel: boolean; editavel: boolean }) => {
      const existing = rules.find(
        (r: any) => r.tela_codigo === params.tela && r.componente_codigo === params.componente
      );

      // Audit
      await supabase.from("ui_permissions_audit").insert({
        ui_permission_id: existing?.id || null,
        tela_codigo: params.tela,
        componente_codigo: params.componente,
        acao: existing ? "update" : "create",
        valor_anterior: existing ? { visivel: existing.visivel, editavel: existing.editavel } : null,
        valor_novo: { visivel: params.visivel, editavel: params.editavel },
        alterado_por: userId,
      });

      if (existing) {
        const { error } = await supabase
          .from("ui_permissions")
          .update({ visivel: params.visivel, editavel: params.editavel, configurado_por: userId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ui_permissions")
          .insert({
            role: selectedRole,
            departamento_id: null,
            tela_codigo: params.tela,
            componente_codigo: params.componente,
            visivel: params.visivel,
            editavel: params.editavel,
            configurado_por: userId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-permissions-by-role", selectedRole] });
      toast.success("Permissão atualizada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Perfil:</Label>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <PermissionsGrid
          rules={rules}
          onToggle={(tela, comp, visivel, editavel) => upsert.mutate({ tela, componente: comp, visivel, editavel })}
        />
      )}
    </div>
  );
}

// ===================== Tab: Por Departamento =====================

function TabPorDepartamento({ userId }: { userId?: string }) {
  const { data: departments = [] } = useAllDepartments();
  const [selectedDept, setSelectedDept] = useState("");
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions-by-dept", selectedDept],
    queryFn: async () => {
      if (!selectedDept) return [];
      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .eq("departamento_id", selectedDept)
        .is("role", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDept,
  });

  const upsert = useMutation({
    mutationFn: async (params: { tela: string; componente: string; visivel: boolean; editavel: boolean }) => {
      const existing = rules.find(
        (r: any) => r.tela_codigo === params.tela && r.componente_codigo === params.componente
      );

      await supabase.from("ui_permissions_audit").insert({
        ui_permission_id: existing?.id || null,
        tela_codigo: params.tela,
        componente_codigo: params.componente,
        acao: existing ? "update" : "create",
        valor_anterior: existing ? { visivel: existing.visivel, editavel: existing.editavel } : null,
        valor_novo: { visivel: params.visivel, editavel: params.editavel },
        alterado_por: userId,
      });

      if (existing) {
        const { error } = await supabase
          .from("ui_permissions")
          .update({ visivel: params.visivel, editavel: params.editavel, configurado_por: userId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ui_permissions")
          .insert({
            role: null,
            departamento_id: selectedDept,
            tela_codigo: params.tela,
            componente_codigo: params.componente,
            visivel: params.visivel,
            editavel: params.editavel,
            configurado_por: userId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-permissions-by-dept", selectedDept] });
      toast.success("Permissão atualizada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Departamento:</Label>
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedDept ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Selecione um departamento para configurar.</p>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <PermissionsGrid
          rules={rules}
          onToggle={(tela, comp, visivel, editavel) => upsert.mutate({ tela, componente: comp, visivel, editavel })}
        />
      )}
    </div>
  );
}

// ===================== Tab: Matriz de Ações =====================

function TabMatrizAcoes({ userId }: { userId?: string }) {
  const { data: allRules = [], isLoading } = useQuery({
    queryKey: ["ui-permissions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ui_permissions")
        .select("*")
        .order("tela_codigo")
        .order("componente_codigo");
      if (error) throw error;
      return data || [];
    },
  });

  const getRuleStatus = (tela: string, comp: string, role: string) => {
    const rule = allRules.find(
      (r: any) => r.tela_codigo === tela && r.componente_codigo === comp && r.role === role
    );
    if (!rule) return { visivel: true, editavel: true };
    return { visivel: rule.visivel, editavel: rule.editavel };
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 overflow-x-auto">
      {Object.entries(SCREENS_COMPONENTS).map(([telaCodigo, screen]) => {
        const actionComponents = screen.components.filter((c) => c.tipo === "botao");
        if (actionComponents.length === 0) return null;

        return (
          <Card key={telaCodigo} className="border-border/50">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">{screen.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Ação</TableHead>
                    {ROLES.map((r) => (
                      <TableHead key={r} className="text-center text-xs w-[90px]">
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionComponents.map((comp) => (
                    <TableRow key={comp.codigo}>
                      <TableCell className="font-medium text-sm">{comp.label}</TableCell>
                      {ROLES.map((role) => {
                        const status = getRuleStatus(telaCodigo, comp.codigo, role);
                        return (
                          <TableCell key={role} className="text-center">
                            {!status.visivel ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5">
                                <EyeOff className="h-3 w-3" />
                              </Badge>
                            ) : !status.editavel ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5">
                                <Lock className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                <Eye className="h-3 w-3" />
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ===================== Tab: Feature Flags =====================

function TabFeatureFlags() {
  const queryClient = useQueryClient();
  const { data: flags = [], isLoading } = useAllFeatureFlags();

  const toggleFlag = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("feature_flags")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-feature-flags"] });
      toast.success("Feature flag atualizada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Roles Permitidos</TableHead>
            <TableHead className="text-center">Ativo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.map((flag: any) => (
            <TableRow key={flag.id}>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">{flag.codigo}</Badge>
              </TableCell>
              <TableCell className="font-medium">{flag.nome}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{flag.descricao || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(flag.roles_permitidos || []).map((r: string) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={flag.ativo}
                  onCheckedChange={(checked) => toggleFlag.mutate({ id: flag.id, ativo: checked })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ===================== Shared: PermissionsGrid =====================

function PermissionsGrid({
  rules,
  onToggle,
}: {
  rules: any[];
  onToggle: (tela: string, componente: string, visivel: boolean, editavel: boolean) => void;
}) {
  const getRuleForComponent = (tela: string, componente: string) => {
    return rules.find((r: any) => r.tela_codigo === tela && r.componente_codigo === componente);
  };

  return (
    <div className="space-y-4">
      {Object.entries(SCREENS_COMPONENTS).map(([telaCodigo, screen]) => (
        <Card key={telaCodigo} className="border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">{screen.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Componente</TableHead>
                  <TableHead className="w-[80px] text-center">Tipo</TableHead>
                  <TableHead className="w-[100px] text-center">Visível</TableHead>
                  <TableHead className="w-[100px] text-center">Editável</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.components.map((comp) => {
                  const rule = getRuleForComponent(telaCodigo, comp.codigo);
                  const isVisible = rule?.visivel ?? true;
                  const isEditable = rule?.editavel ?? true;

                  return (
                    <TableRow key={comp.codigo}>
                      <TableCell className="font-medium text-sm">{comp.label}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px]">{comp.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(v) => onToggle(telaCodigo, comp.codigo, v, v ? isEditable : false)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isEditable}
                          disabled={!isVisible}
                          onCheckedChange={(e) => onToggle(telaCodigo, comp.codigo, isVisible, e)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {!isVisible ? (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <EyeOff className="h-3 w-3" /> Oculto
                          </Badge>
                        ) : !isEditable ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Lock className="h-3 w-3" /> Leitura
                          </Badge>
                        ) : (
                          <Badge className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                            <Eye className="h-3 w-3" /> Total
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
