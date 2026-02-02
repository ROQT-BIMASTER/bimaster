import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Settings, Loader2, Pencil, DollarSign, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { ApproverManagementDialog } from "@/components/trade/ApproverManagementDialog";

interface ApprovalLevel {
  id: string;
  level_number: number;
  role_name: string;
  max_approval_amount: number;
  description: string | null;
  is_active: boolean;
}

export default function TradeAdminApprovalLevels() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ApprovalLevel | null>(null);
  const [approverDialogLevel, setApproverDialogLevel] = useState<ApprovalLevel | null>(null);
  const [formData, setFormData] = useState({
    level_number: 1,
    role_name: "",
    max_approval_amount: 0,
    description: "",
    is_active: true,
  });

  const { data: levels, isLoading } = useQuery({
    queryKey: ["trade-approval-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_approval_levels")
        .select("*")
        .order("level_number");
      
      if (error) throw error;
      return data as ApprovalLevel[];
    },
  });

  // Fetch approver counts per level
  const { data: approverCounts } = useQuery({
    queryKey: ["trade-approver-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_user_approval_levels")
        .select("level_id")
        .eq("is_active", true);
      
      if (error) throw error;
      
      const counts = new Map<string, number>();
      data?.forEach((a) => {
        counts.set(a.level_id, (counts.get(a.level_id) || 0) + 1);
      });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingLevel) {
        const { error } = await supabase
          .from("trade_approval_levels")
          .update({
            level_number: data.level_number,
            role_name: data.role_name,
            max_approval_amount: data.max_approval_amount,
            description: data.description || null,
            is_active: data.is_active,
          })
          .eq("id", editingLevel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trade_approval_levels")
          .insert({
            level_number: data.level_number,
            role_name: data.role_name,
            max_approval_amount: data.max_approval_amount,
            description: data.description || null,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade-approval-levels"] });
      toast.success(editingLevel ? "Nível atualizado com sucesso!" : "Nível criado com sucesso!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLevel(null);
    setFormData({
      level_number: (levels?.length || 0) + 1,
      role_name: "",
      max_approval_amount: 0,
      description: "",
      is_active: true,
    });
  };

  const handleEdit = (level: ApprovalLevel) => {
    setEditingLevel(level);
    setFormData({
      level_number: level.level_number,
      role_name: level.role_name,
      max_approval_amount: level.max_approval_amount,
      description: level.description || "",
      is_active: level.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role_name) {
      toast.error("Nome do cargo é obrigatório");
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/trade/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                Níveis de Aprovação
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure os níveis de alçada para aprovações de campanhas
              </p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => {
                setEditingLevel(null);
                setFormData({
                  level_number: (levels?.length || 0) + 1,
                  role_name: "",
                  max_approval_amount: 0,
                  description: "",
                  is_active: true,
                });
              }}>
                <Plus className="h-4 w-4" />
                Novo Nível
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLevel ? "Editar Nível de Aprovação" : "Novo Nível de Aprovação"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nível</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.level_number}
                      onChange={(e) => setFormData({ ...formData, level_number: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Máximo (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.max_approval_amount}
                      onChange={(e) => setFormData({ ...formData, max_approval_amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Cargo/Função</Label>
                  <Input
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                    placeholder="Ex: Supervisor Regional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingLevel ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Levels Table */}
        <Card>
          <CardHeader>
            <CardTitle>Níveis Configurados</CardTitle>
            <CardDescription>
              Defina os valores máximos de aprovação por cargo/função e gerencie os aprovadores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Nível</TableHead>
                    <TableHead>Cargo/Função</TableHead>
                    <TableHead>Valor Máximo</TableHead>
                    <TableHead>Aprovadores</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels?.map((level) => {
                    const count = approverCounts?.get(level.id) || 0;
                    return (
                      <TableRow key={level.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {level.level_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{level.role_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {formatCurrency(level.max_approval_amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => setApproverDialogLevel(level)}
                          >
                            <Users className="h-4 w-4" />
                            <Badge variant={count > 0 ? "default" : "secondary"}>
                              {count}
                            </Badge>
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {level.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={level.is_active ? "default" : "secondary"}>
                            {level.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(level)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!levels || levels.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum nível de aprovação configurado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Como funciona</p>
                <p className="text-sm text-muted-foreground">
                  Os níveis de aprovação definem a alçada de cada cargo. Quando uma campanha 
                  é criada, o sistema identifica automaticamente qual nível de aprovação é 
                  necessário com base no valor estimado. Clique em "Aprovadores" para gerenciar 
                  quem pode aprovar em cada nível.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approver Management Dialog */}
      {approverDialogLevel && (
        <ApproverManagementDialog
          open={!!approverDialogLevel}
          onOpenChange={(open) => {
            if (!open) {
              setApproverDialogLevel(null);
              queryClient.invalidateQueries({ queryKey: ["trade-approver-counts"] });
            }
          }}
          levelId={approverDialogLevel.id}
          levelName={approverDialogLevel.role_name}
        />
      )}
    </DashboardLayout>
  );
}
