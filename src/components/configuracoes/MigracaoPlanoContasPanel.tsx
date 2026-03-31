import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ArrowRight, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface MappingRow {
  id: string;
  old_account_id: string;
  old_code: string;
  old_name: string;
  new_account_id: string;
  new_code: string;
  new_name: string;
  confianca: string;
  mapeado_por: string;
  confirmado: boolean;
}

interface NewAccount {
  id: string;
  code: string;
  name: string;
}

const confiancaColors: Record<string, string> = {
  alta: "bg-emerald-100 text-emerald-800 border-emerald-300",
  media: "bg-amber-100 text-amber-800 border-amber-300",
  baixa: "bg-red-100 text-red-800 border-red-300",
};

export function MigracaoPlanoContasPanel() {
  const queryClient = useQueryClient();
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [filterConfianca, setFilterConfianca] = useState<string>("all");

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["plano-contas-migracao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_contas_migracao")
        .select("*")
        .order("old_code");
      if (error) throw error;
      return data as MappingRow[];
    },
  });

  const { data: newAccounts } = useQuery({
    queryKey: ["new-accounts-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name")
        .eq("versao", "v2")
        .order("code");
      if (error) throw error;
      return data as NewAccount[];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, confirmado }: { id: string; confirmado: boolean }) => {
      const { error } = await supabase
        .from("plano_contas_migracao")
        .update({ confirmado, confirmado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plano-contas-migracao"] }),
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, new_account_id, new_code, new_name }: { id: string; new_account_id: string; new_code: string; new_name: string }) => {
      const { error } = await supabase
        .from("plano_contas_migracao")
        .update({ new_account_id, new_code, new_name, mapeado_por: "manual", confianca: "alta", confirmado: true, confirmado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-contas-migracao"] });
      toast.success("Mapeamento atualizado!");
    },
  });

  const confirmAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("plano_contas_migracao")
        .update({ confirmado: true, confirmado_em: new Date().toISOString() })
        .eq("confirmado", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-contas-migracao"] });
      toast.success("Todos os mapeamentos confirmados!");
    },
  });

  const executeMigrationMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Backup
      const { error: backupError } = await supabase.rpc("executar_migracao_plano_contas" as any);
      if (backupError) throw backupError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["plano-contas-migracao"] });
      toast.success("Migração executada com sucesso! Novo plano de contas ativado.");
      setShowExecuteDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Erro na migração: ${error.message}`);
    },
  });

  const filtered = mappings?.filter(m => 
    filterConfianca === "all" || m.confianca === filterConfianca
  ) || [];

  const stats = {
    total: mappings?.length || 0,
    confirmados: mappings?.filter(m => m.confirmado).length || 0,
    alta: mappings?.filter(m => m.confianca === "alta").length || 0,
    media: mappings?.filter(m => m.confianca === "media").length || 0,
    baixa: mappings?.filter(m => m.confianca === "baixa").length || 0,
  };

  const allConfirmed = stats.confirmados === stats.total && stats.total > 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Confirmados</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.confirmados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Alta Confiança</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.alta}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Média</p>
            <p className="text-2xl font-bold text-amber-600">{stats.media}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Baixa</p>
            <p className="text-2xl font-bold text-red-600">{stats.baixa}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Select value={filterConfianca} onValueChange={setFilterConfianca}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar confiança" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => confirmAllMutation.mutate()}
          disabled={confirmAllMutation.isPending || allConfirmed}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirmar Todos
        </Button>

        <div className="flex-1" />

        <Button
          onClick={() => setShowExecuteDialog(true)}
          disabled={!allConfirmed}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Executar Migração
        </Button>
      </div>

      {!allConfirmed && stats.total > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Confirme todos os {stats.total - stats.confirmados} mapeamentos pendentes antes de executar a migração.</span>
        </div>
      )}

      {/* Mapping Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Cód. Antigo</TableHead>
                <TableHead>Conta Antiga</TableHead>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[100px]">Cód. Novo</TableHead>
                <TableHead>Conta Nova</TableHead>
                <TableHead className="w-[90px]">Confiança</TableHead>
                <TableHead className="w-[80px]">Fonte</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum mapeamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id} className={m.confirmado ? "bg-emerald-50/50" : ""}>
                    <TableCell className="font-mono text-sm">{m.old_code}</TableCell>
                    <TableCell className="text-sm">{m.old_name}</TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.new_code}</TableCell>
                    <TableCell>
                      <Select
                        value={m.new_account_id}
                        onValueChange={(newId) => {
                          const acc = newAccounts?.find(a => a.id === newId);
                          if (acc) {
                            updateMappingMutation.mutate({
                              id: m.id,
                              new_account_id: newId,
                              new_code: acc.code,
                              new_name: acc.name,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue>{m.new_name}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {newAccounts?.filter(a => !a.code.match(/^\d$/)).map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="font-mono mr-2">{a.code}</span>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={confiancaColors[m.confianca] || ""}>
                        {m.confianca}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {m.mapeado_por === "ia" ? "IA" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.confirmado ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                          <Check className="h-3 w-3 mr-1" /> OK
                        </Badge>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-emerald-600"
                            onClick={() => confirmMutation.mutate({ id: m.id, confirmado: true })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Migration Dialog */}
      <AlertDialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Migração do Plano de Contas
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação irá:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Criar backup dos dados atuais de classificação</li>
                <li>Reclassificar todos os títulos de contas a pagar ({stats.total} mapeamentos)</li>
                <li>Ativar o novo plano de contas (v2)</li>
                <li>Desativar o plano antigo (v1)</li>
              </ul>
              <p className="font-medium text-amber-600 mt-3">
                Esta operação é irreversível em produção. Confirme que revisou todos os mapeamentos.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeMigrationMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={executeMigrationMutation.isPending}
            >
              {executeMigrationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Executar Migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
