import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Eye, 
  Edit, 
  CheckCircle, 
  Search,
  Users,
  Tag,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PriceTable {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
}

interface AccessRecord {
  id: string;
  user_id: string;
  tabela_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
  granted_at: string;
  notes: string | null;
  user?: UserProfile;
  tabela?: PriceTable;
}

export default function GerenciamentoAcessoPrecos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceTables, setPriceTables] = useState<PriceTable[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state for new access
  const [newAccess, setNewAccess] = useState({
    user_id: "",
    tabela_id: "",
    can_view: true,
    can_edit: false,
    can_approve: false,
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load price tables
      const { data: tablesData, error: tablesError } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, codigo, nome, status")
        .order("codigo");

      if (tablesError) throw tablesError;
      setPriceTables(tablesData || []);

      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load access records
      const { data: accessData, error: accessError } = await supabase
        .from("user_price_table_access")
        .select("*")
        .order("granted_at", { ascending: false });

      if (accessError) throw accessError;
      
      // Enrich with user and table info
      const enrichedAccess = (accessData || []).map(record => ({
        ...record,
        user: usersData?.find(u => u.id === record.user_id),
        tabela: tablesData?.find(t => t.id === record.tabela_id),
      }));
      
      setAccessRecords(enrichedAccess);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccess = async () => {
    if (!newAccess.user_id || !newAccess.tabela_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um usuário e uma tabela de preço",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_price_table_access")
        .upsert({
          user_id: newAccess.user_id,
          tabela_id: newAccess.tabela_id,
          can_view: newAccess.can_view,
          can_edit: newAccess.can_edit,
          can_approve: newAccess.can_approve,
          notes: newAccess.notes || null,
          granted_by: user?.id,
        }, {
          onConflict: "user_id,tabela_id",
        });

      if (error) throw error;

      toast({
        title: "Acesso configurado",
        description: "Permissões salvas com sucesso",
      });
      
      setDialogOpen(false);
      setNewAccess({
        user_id: "",
        tabela_id: "",
        can_view: true,
        can_edit: false,
        can_approve: false,
        notes: "",
      });
      loadData();
    } catch (error: any) {
      console.error("Error saving access:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (
    recordId: string, 
    field: 'can_view' | 'can_edit' | 'can_approve', 
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("user_price_table_access")
        .update({ [field]: value })
        .eq("id", recordId);

      if (error) throw error;

      setAccessRecords(prev => 
        prev.map(r => r.id === recordId ? { ...r, [field]: value } : r)
      );

      toast({
        title: "Permissão atualizada",
        description: "Alteração salva com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccess = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from("user_price_table_access")
        .delete()
        .eq("id", recordId);

      if (error) throw error;

      setAccessRecords(prev => prev.filter(r => r.id !== recordId));

      toast({
        title: "Acesso removido",
        description: "Permissão excluída com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredRecords = accessRecords.filter(record => {
    const matchesSearch = 
      record.user?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.tabela?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = selectedTable === "all" || record.tabela_id === selectedTable;
    
    return matchesSearch && matchesTable;
  });

  // Group records by table for summary view
  const tableStats = priceTables.map(table => ({
    ...table,
    usersWithAccess: accessRecords.filter(r => r.tabela_id === table.id).length,
    usersCanEdit: accessRecords.filter(r => r.tabela_id === table.id && r.can_edit).length,
    usersCanApprove: accessRecords.filter(r => r.tabela_id === table.id && r.can_approve).length,
  }));

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Controle de Acesso - Tabelas de Preço
          </h1>
          <p className="text-muted-foreground">
            Gerencie quem pode visualizar, editar e aprovar cada tabela de preço
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Acesso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Acesso</DialogTitle>
              <DialogDescription>
                Defina as permissões de um usuário para uma tabela de preço específica
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select 
                  value={newAccess.user_id} 
                  onValueChange={(v) => setNewAccess(prev => ({ ...prev, user_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tabela de Preço</Label>
                <Select 
                  value={newAccess.tabela_id} 
                  onValueChange={(v) => setNewAccess(prev => ({ ...prev, tabela_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tabela" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceTables.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.codigo} - {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-sm font-medium">Permissões</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Visualizar</span>
                  </div>
                  <Switch
                    checked={newAccess.can_view}
                    onCheckedChange={(v) => setNewAccess(prev => ({ ...prev, can_view: v }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Editar valores</span>
                  </div>
                  <Switch
                    checked={newAccess.can_edit}
                    onCheckedChange={(v) => setNewAccess(prev => ({ ...prev, can_edit: v }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Aprovar tabela</span>
                  </div>
                  <Switch
                    checked={newAccess.can_approve}
                    onCheckedChange={(v) => setNewAccess(prev => ({ ...prev, can_approve: v }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Ex: Responsável pela validação MUDE"
                  value={newAccess.notes}
                  onChange={(e) => setNewAccess(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddAccess} disabled={saving}>
                {saving ? "Salvando..." : "Salvar Acesso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {tableStats.map(table => (
          <Card 
            key={table.id} 
            className={`cursor-pointer transition-all ${
              selectedTable === table.id 
                ? "ring-2 ring-primary" 
                : "hover:shadow-md"
            }`}
            onClick={() => setSelectedTable(selectedTable === table.id ? "all" : table.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                {table.nome}
              </CardTitle>
              <CardDescription className="text-xs">
                Código: {table.codigo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs">
                <Users className="h-3 w-3" />
                <span>{table.usersWithAccess} usuários</span>
              </div>
              <div className="flex gap-2 mt-2">
                {table.usersCanEdit > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Edit className="h-3 w-3 mr-1" />
                    {table.usersCanEdit}
                  </Badge>
                )}
                {table.usersCanApprove > 0 && (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {table.usersCanApprove}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Como funciona o controle de acesso:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Visualizar:</strong> Pode ver os preços da tabela</li>
                <li><strong>Editar:</strong> Pode alterar valores na tabela (ex: pessoa da Fábrica)</li>
                <li><strong>Aprovar:</strong> Pode validar e aprovar a tabela (ex: gerente ou responsável MUDE)</li>
                <li>Administradores têm acesso total a todas as tabelas automaticamente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Permissões Configuradas</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário ou tabela..."
                  className="pl-9 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma permissão configurada</p>
              <p className="text-sm">Clique em "Adicionar Acesso" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tabela de Preço</TableHead>
                  <TableHead className="text-center">Visualizar</TableHead>
                  <TableHead className="text-center">Editar</TableHead>
                  <TableHead className="text-center">Aprovar</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.user?.nome || "—"}</p>
                        <p className="text-xs text-muted-foreground">{record.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.tabela?.codigo} - {record.tabela?.nome}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Switch
                              checked={record.can_view}
                              onCheckedChange={(v) => handleTogglePermission(record.id, 'can_view', v)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {record.can_view ? "Pode visualizar" : "Sem acesso de visualização"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Switch
                              checked={record.can_edit}
                              onCheckedChange={(v) => handleTogglePermission(record.id, 'can_edit', v)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {record.can_edit ? "Pode editar valores" : "Sem permissão de edição"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Switch
                              checked={record.can_approve}
                              onCheckedChange={(v) => handleTogglePermission(record.id, 'can_approve', v)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {record.can_approve ? "Pode aprovar tabela" : "Sem permissão de aprovação"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {record.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAccess(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
