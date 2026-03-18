import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Pencil, Lock, Shield, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFieldVisibilityManagement } from "@/hooks/useFieldVisibility";
import { useAllDepartments } from "@/hooks/useUserDepartments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// China module screens and their configurable fields
const CHINA_SCREENS_FIELDS: Record<string, { label: string; fields: { codigo: string; label: string }[] }> = {
  china_dashboard: {
    label: "Dashboard Fábrica China",
    fields: [
      { codigo: "kpis_financeiros", label: "KPIs Financeiros" },
      { codigo: "grafico_producao", label: "Gráfico de Produção" },
      { codigo: "tabela_ordens", label: "Tabela de Ordens" },
      { codigo: "status_embarques", label: "Status de Embarques" },
    ],
  },
  china_submissoes: {
    label: "Submissões de Produtos",
    fields: [
      { codigo: "dados_fornecedor", label: "Dados do Fornecedor" },
      { codigo: "precos_custos", label: "Preços e Custos" },
      { codigo: "fotos_produto", label: "Fotos do Produto" },
      { codigo: "ficha_tecnica", label: "Ficha Técnica" },
      { codigo: "historico_revisoes", label: "Histórico de Revisões" },
      { codigo: "documentos_oficiais", label: "Documentos Oficiais" },
    ],
  },
  china_recebimentos: {
    label: "Recebimentos",
    fields: [
      { codigo: "valores_recebimento", label: "Valores do Recebimento" },
      { codigo: "notas_fiscais", label: "Notas Fiscais" },
      { codigo: "conferencia", label: "Conferência" },
    ],
  },
  china_ordens: {
    label: "Ordens de Compra",
    fields: [
      { codigo: "valor_total", label: "Valor Total" },
      { codigo: "condicoes_pagamento", label: "Condições de Pagamento" },
      { codigo: "dados_embarque", label: "Dados de Embarque" },
      { codigo: "aprovacoes", label: "Aprovações" },
    ],
  },
  china_fichas: {
    label: "Fichas de Produto",
    fields: [
      { codigo: "composicao", label: "Composição" },
      { codigo: "custos_producao", label: "Custos de Produção" },
      { codigo: "dados_regulatorios", label: "Dados Regulatórios" },
      { codigo: "checklist_brasil", label: "Checklist Brasil" },
    ],
  },
};

// Projetos module screens and their configurable fields
const PROJETOS_SCREENS_FIELDS: Record<string, { label: string; fields: { codigo: string; label: string }[] }> = {
  projetos_dashboard: {
    label: "Dashboard Projetos",
    fields: [
      { codigo: "metricas_gerais", label: "Métricas Gerais" },
      { codigo: "projetos_ativos", label: "Projetos Ativos" },
    ],
  },
  projetos_inbox: {
    label: "Inbox",
    fields: [
      { codigo: "notificacoes_internas", label: "Notificações Internas" },
    ],
  },
  projetos_aprovacoes: {
    label: "Aprovações de Cadastro",
    fields: [
      { codigo: "aprovacoes_pendentes", label: "Aprovações Pendentes" },
      { codigo: "historico_aprovacoes", label: "Histórico de Aprovações" },
    ],
  },
  projetos_produto_brasil: {
    label: "Produtos Brasil",
    fields: [
      { codigo: "dados_cadastro", label: "Dados de Cadastro" },
      { codigo: "grade_skus", label: "Grade/SKUs" },
      { codigo: "custos_brasil", label: "Custos Brasil" },
      { codigo: "regulatorio", label: "Regulatório" },
    ],
  },
};

const ALL_SCREENS = { ...CHINA_SCREENS_FIELDS, ...PROJETOS_SCREENS_FIELDS };

const PROJETOS_DEPT_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";
const CHINA_DEPT_ID = "79392f6b-4ab5-400b-88b5-7f0020ec4b77";

export default function DeptVisibilityControlPanel() {
  const { toast } = useToast();
  const [selectedAlvoDept, setSelectedAlvoDept] = useState(CHINA_DEPT_ID);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tela: string;
    campo: string;
    visivel: boolean;
    editavel: boolean;
    label: string;
  } | null>(null);

  const { data: departments = [] } = useAllDepartments();
  const { rules, isLoading, upsertRule } = useFieldVisibilityManagement(PROJETOS_DEPT_ID, selectedAlvoDept);

  // Get audit log
  const { data: auditLog = [] } = useQuery({
    queryKey: ["visibility-audit", selectedAlvoDept],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamento_visibilidade_audit")
        .select("*")
        .eq("departamento_alvo_id", selectedAlvoDept)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const getRuleForField = (telaCodigo: string, campoCodigo: string) => {
    return rules.find(r => r.tela_codigo === telaCodigo && r.campo_codigo === campoCodigo);
  };

  const handleToggleVisibility = (telaCodigo: string, campoCodigo: string, campoLabel: string) => {
    const currentRule = getRuleForField(telaCodigo, campoCodigo);
    const currentVisivel = currentRule?.visivel ?? true;

    // If making visible, just do it. If hiding, confirm.
    if (currentVisivel) {
      setConfirmDialog({
        open: true,
        tela: telaCodigo,
        campo: campoCodigo,
        visivel: false,
        editavel: false,
        label: campoLabel,
      });
    } else {
      executeUpdate(telaCodigo, campoCodigo, true, true);
    }
  };

  const handleToggleEditable = (telaCodigo: string, campoCodigo: string) => {
    const currentRule = getRuleForField(telaCodigo, campoCodigo);
    executeUpdate(telaCodigo, campoCodigo, currentRule?.visivel ?? true, !(currentRule?.editavel ?? true));
  };

  const executeUpdate = (tela: string, campo: string, visivel: boolean, editavel: boolean) => {
    upsertRule.mutate(
      { tela_codigo: tela, campo_codigo: campo, visivel, editavel },
      {
        onSuccess: () => {
          toast({
            title: "Permissão atualizada",
            description: `Campo "${campo}" ${visivel ? "visível" : "oculto"} para o departamento alvo.`,
          });
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const targetDeptName = useMemo(() => {
    return departments.find((d: any) => d.id === selectedAlvoDept)?.nome || "Selecione";
  }, [departments, selectedAlvoDept]);

  const availableTargetDepts = useMemo(() => {
    return departments.filter((d: any) => d.id !== PROJETOS_DEPT_ID && d.ativo !== false);
  }, [departments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Controle de Visibilidade por Departamento</CardTitle>
          </div>
          <CardDescription>
            A responsável do departamento Projetos controla quais telas e campos outros departamentos podem visualizar ou editar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Label className="whitespace-nowrap font-medium">Departamento Alvo:</Label>
            <Select value={selectedAlvoDept} onValueChange={setSelectedAlvoDept}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {availableTargetDepts.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              Controlado por: Projetos
            </Badge>
          </div>

          <div className="space-y-6">
            {Object.entries(ALL_SCREENS).map(([telaCodigo, screen]) => (
              <Card key={telaCodigo} className="border-border/50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium">{screen.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Campo</TableHead>
                        <TableHead className="w-[120px] text-center">Visível</TableHead>
                        <TableHead className="w-[120px] text-center">Editável</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {screen.fields.map((field) => {
                        const rule = getRuleForField(telaCodigo, field.codigo);
                        const isVisible = rule?.visivel ?? true;
                        const isEditable = rule?.editavel ?? true;

                        return (
                          <TableRow key={field.codigo}>
                            <TableCell className="font-medium">{field.label}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isVisible}
                                onCheckedChange={() => handleToggleVisibility(telaCodigo, field.codigo, field.label)}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isEditable}
                                disabled={!isVisible}
                                onCheckedChange={() => handleToggleEditable(telaCodigo, field.codigo)}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {!isVisible ? (
                                <Badge variant="destructive" className="gap-1">
                                  <EyeOff className="h-3 w-3" />
                                  Oculto
                                </Badge>
                              ) : !isEditable ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Lock className="h-3 w-3" />
                                  Somente Leitura
                                </Badge>
                              ) : (
                                <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                  <Eye className="h-3 w-3" />
                                  Total
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
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Histórico de Alterações de Visibilidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Novo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs">{log.tela_codigo}</TableCell>
                    <TableCell className="text-xs">{log.campo_codigo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.acao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.valor_anterior
                        ? `${(log.valor_anterior as any).visivel ? "Visível" : "Oculto"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(log.valor_novo as any)?.visivel ? "Visível" : "Oculto"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog?.open}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Ocultação de Campo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja ocultar o campo <strong>"{confirmDialog?.label}"</strong> para o departamento <strong>{targetDeptName}</strong>?
              <br /><br />
              Os membros deste departamento não poderão mais visualizar este campo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (confirmDialog) {
                  executeUpdate(
                    confirmDialog.tela,
                    confirmDialog.campo,
                    confirmDialog.visivel,
                    confirmDialog.editavel
                  );
                }
                setConfirmDialog(null);
              }}
            >
              Sim, Ocultar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
