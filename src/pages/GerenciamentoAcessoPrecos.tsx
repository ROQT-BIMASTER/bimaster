import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Info,
  Package,
  Layers
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
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";

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

interface ProdutoSimples {
  id: string;
  nome: string;
  codigo: string | null;
  linha: string | null;
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
  linha: string | null;
  produto_id: string | null;
  user?: UserProfile;
  tabela?: PriceTable;
  produto?: ProdutoSimples;
}

type ScopeType = "tabela" | "linha" | "produto";

export default function GerenciamentoAcessoPrecos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceTables, setPriceTables] = useState<PriceTable[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [produtos, setProdutos] = useState<ProdutoSimples[]>([]);
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
    scope: "tabela" as ScopeType,
  });

  // Multi-select state
  const [selectedLinhas, setSelectedLinhas] = useState<string[]>([]);
  const [selectedProdutoIds, setSelectedProdutoIds] = useState<string[]>([]);
  const [buscaLinha, setBuscaLinha] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");

  // Available lines from products
  const [linhasDisponiveis, setLinhasDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tablesRes, usersRes, accessRes, produtosRes] = await Promise.all([
        supabase.from("fabrica_tabelas_preco").select("id, codigo, nome, status").order("codigo"),
        supabase.from("profiles").select("id, nome, email").order("nome"),
        supabase.from("user_price_table_access").select("*").order("granted_at", { ascending: false }),
        supabase.from("fabrica_produtos").select("id, nome, codigo, linha").eq("tipo", "ACABADO").eq("ativo", true).order("nome"),
      ]);

      if (tablesRes.error) throw tablesRes.error;
      if (usersRes.error) throw usersRes.error;
      if (accessRes.error) throw accessRes.error;
      if (produtosRes.error) throw produtosRes.error;

      setPriceTables(tablesRes.data || []);
      setUsers(usersRes.data || []);
      setProdutos(produtosRes.data || []);

      // Extract unique lines
      const linhas = [...new Set((produtosRes.data || []).map(p => p.linha).filter(Boolean) as string[])].sort();
      setLinhasDisponiveis(linhas);

      // Enrich access records
      const enrichedAccess = (accessRes.data || []).map(record => ({
        ...record,
        user: usersRes.data?.find(u => u.id === record.user_id),
        tabela: tablesRes.data?.find(t => t.id === record.tabela_id),
        produto: record.produto_id ? produtosRes.data?.find(p => p.id === record.produto_id) : undefined,
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

  const resetForm = () => {
    setNewAccess({
      user_id: "",
      tabela_id: "",
      can_view: true,
      can_edit: false,
      can_approve: false,
      notes: "",
      scope: "tabela",
    });
    setSelectedLinhas([]);
    setSelectedProdutoIds([]);
    setBuscaLinha("");
    setBuscaProduto("");
  };

  const handleAddAccess = async () => {
    if (!newAccess.user_id || !newAccess.tabela_id) {
      toast({ title: "Campos obrigatórios", description: "Selecione um usuário e uma tabela de preço", variant: "destructive" });
      return;
    }

    if (newAccess.scope === "linha" && selectedLinhas.length === 0) {
      toast({ title: "Campo obrigatório", description: "Selecione pelo menos uma linha de produto", variant: "destructive" });
      return;
    }

    if (newAccess.scope === "produto" && selectedProdutoIds.length === 0) {
      toast({ title: "Campo obrigatório", description: "Selecione pelo menos um produto", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const baseData = {
        user_id: newAccess.user_id,
        tabela_id: newAccess.tabela_id,
        can_view: newAccess.can_view,
        can_edit: newAccess.can_edit,
        can_approve: newAccess.can_approve,
        notes: newAccess.notes || null,
        granted_by: user?.id,
      };

      let insertRows: any[] = [];

      if (newAccess.scope === "tabela") {
        insertRows = [{ ...baseData, linha: null, produto_id: null }];
      } else if (newAccess.scope === "linha") {
        insertRows = selectedLinhas.map(linha => ({ ...baseData, linha, produto_id: null }));
      } else {
        insertRows = selectedProdutoIds.map(produto_id => ({ ...baseData, linha: null, produto_id }));
      }

      const { error } = await supabase
        .from("user_price_table_access")
        .insert(insertRows);

      if (error) throw error;

      const count = insertRows.length;
      toast({ title: "Acesso configurado", description: `${count} regra${count > 1 ? 's' : ''} salva${count > 1 ? 's' : ''} com sucesso` });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving access:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
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

      toast({ title: "Permissão atualizada", description: "Alteração salva com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
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
      toast({ title: "Acesso removido", description: "Permissão excluída com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const filteredRecords = accessRecords.filter(record => {
    const matchesSearch = 
      record.user?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.tabela?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.linha?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.produto?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = selectedTable === "all" || record.tabela_id === selectedTable;
    
    return matchesSearch && matchesTable;
  });

  const tableStats = priceTables.map(table => ({
    ...table,
    usersWithAccess: accessRecords.filter(r => r.tabela_id === table.id).length,
    usersCanEdit: accessRecords.filter(r => r.tabela_id === table.id && r.can_edit).length,
    usersCanApprove: accessRecords.filter(r => r.tabela_id === table.id && r.can_approve).length,
  }));

  const getScopeBadge = (record: AccessRecord) => {
    if (record.produto_id && record.produto) {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          <Package className="h-3 w-3 mr-1" />
          {record.produto.nome}
        </Badge>
      );
    }
    if (record.linha) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Layers className="h-3 w-3 mr-1" />
          {record.linha}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Tabela Inteira
      </Badge>
    );
  };

  const produtosFiltradosBusca = produtos.filter(p => {
    if (!buscaProduto) return true;
    return p.nome.toLowerCase().includes(buscaProduto.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(buscaProduto.toLowerCase());
  }).slice(0, 50);

  const linhasFiltradas = linhasDisponiveis.filter(l => {
    if (!buscaLinha) return true;
    return l.toLowerCase().includes(buscaLinha.toLowerCase());
  });

  const toggleLinha = (linha: string) => {
    setSelectedLinhas(prev => 
      prev.includes(linha) ? prev.filter(l => l !== linha) : [...prev, linha]
    );
  };

  const toggleProduto = (id: string) => {
    setSelectedProdutoIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <ModuleBreadcrumb
        moduleName="Tabelas de Preços"
        moduleHref="/dashboard/precos"
        currentPage="Controle de Acesso"
      />

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
        
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Acesso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar Acesso</DialogTitle>
              <DialogDescription>
                Defina as permissões de um usuário para uma tabela de preço
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

              {/* Scope Selection */}
              <div className="space-y-2">
                <Label>Escopo do Acesso</Label>
                <Select
                  value={newAccess.scope}
                  onValueChange={(v: ScopeType) => { setNewAccess(prev => ({ ...prev, scope: v })); setSelectedLinhas([]); setSelectedProdutoIds([]); setBuscaLinha(""); setBuscaProduto(""); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tabela">
                      <span className="flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Tabela Inteira
                      </span>
                    </SelectItem>
                    <SelectItem value="linha">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" /> Por Linha
                      </span>
                    </SelectItem>
                    <SelectItem value="produto">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Por Produto
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Line multi-selector */}
              {newAccess.scope === "linha" && (
                <div className="space-y-2">
                  <Label>Linhas de Produto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar linha..."
                      value={buscaLinha}
                      onChange={(e) => setBuscaLinha(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="border rounded-md max-h-48 overflow-y-auto bg-background">
                    {linhasFiltradas.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">Nenhuma linha encontrada</p>
                    ) : (
                      linhasFiltradas.map(l => (
                        <label
                          key={l}
                          className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 text-sm border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedLinhas.includes(l)}
                            onCheckedChange={() => toggleLinha(l)}
                          />
                          <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>{l}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedLinhas.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedLinhas.length} linha{selectedLinhas.length > 1 ? 's' : ''} selecionada{selectedLinhas.length > 1 ? 's' : ''}: <strong>{selectedLinhas.join(', ')}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Product multi-selector */}
              {newAccess.scope === "produto" && (
                <div className="space-y-2">
                  <Label>Produtos</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto por nome ou código..."
                      value={buscaProduto}
                      onChange={(e) => setBuscaProduto(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="border rounded-md max-h-48 overflow-y-auto bg-background">
                    {produtosFiltradosBusca.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">Nenhum produto encontrado</p>
                    ) : (
                      produtosFiltradosBusca.map(p => (
                        <label
                          key={p.id}
                          className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 text-sm border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedProdutoIds.includes(p.id)}
                            onCheckedChange={() => toggleProduto(p.id)}
                          />
                          <Package className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          <span className="flex-1">{p.nome}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{p.linha || "—"}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedProdutoIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedProdutoIds.length} produto{selectedProdutoIds.length > 1 ? 's' : ''} selecionado{selectedProdutoIds.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
              
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
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
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
              selectedTable === table.id ? "ring-2 ring-primary" : "hover:shadow-md"
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
                <span>{table.usersWithAccess} regras</span>
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
                <li><strong>Tabela Inteira:</strong> Acesso a todos os produtos da tabela</li>
                <li><strong>Por Linha:</strong> Acesso apenas aos produtos de uma linha específica (ex: Banana, MELU)</li>
                <li><strong>Por Produto:</strong> Acesso a um produto individual dentro da tabela</li>
                <li>Regras mais específicas (produto) têm prioridade sobre regras gerais (linha/tabela)</li>
                <li>Administradores e supervisores têm acesso total automaticamente</li>
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
                  placeholder="Buscar por usuário, tabela, linha..."
                  className="pl-9 w-72"
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
                  <TableHead>Escopo</TableHead>
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
                    <TableCell>
                      {getScopeBadge(record)}
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
