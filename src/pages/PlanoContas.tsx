import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronRight, ChevronDown, Edit, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { NovaContaDialog } from "@/components/configuracoes/NovaContaDialog";
import { EditarContaDialog } from "@/components/configuracoes/EditarContaDialog";
import { ClassificarContasEmLoteDialog } from "@/components/configuracoes/ClassificarContasEmLoteDialog";

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  nivel: number;
  natureza: string;
  is_group: boolean;
  permite_lancamento: boolean;
  parent_account_id: string | null;
  description: string | null;
  is_active: boolean;
  ordem: number;
  departamento_id?: string | null;
  categoria_dre?: string | null;
  children?: Account[];
}

const accountTypeLabels: Record<string, string> = {
  asset: "Ativo",
  liability: "Passivo",
  revenue: "Receita",
  expense: "Despesa",
  budget: "Verba",
  cost_center: "Centro de Custo",
};

const accountTypeColors: Record<string, string> = {
  asset: "bg-green-500/10 text-green-700 border-green-200",
  liability: "bg-red-500/10 text-red-700 border-red-200",
  revenue: "bg-blue-500/10 text-blue-700 border-blue-200",
  expense: "bg-orange-500/10 text-orange-700 border-orange-200",
  budget: "bg-purple-500/10 text-purple-700 border-purple-200",
  cost_center: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
};

const categoriaDreLabels: Record<string, string> = {
  receita_bruta: "Receita Bruta",
  deducoes: "Deduções e Abatimentos",
  custo_vendas: "Custo de Vendas",
  despesas_variaveis: "Custo Variável",
  despesas_fixas: "Despesas Fixas",
  impostos_lucro: "Impostos s/ Lucro",
};

const categoriaDreColors: Record<string, string> = {
  receita_bruta: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  deducoes: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  custo_vendas: "bg-red-500/20 text-red-700 border-red-500/30",
  despesas_variaveis: "bg-amber-500/20 text-amber-700 border-amber-500/30",
  despesas_fixas: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  impostos_lucro: "bg-purple-500/20 text-purple-700 border-purple-500/30",
};

export default function PlanoContas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["1", "2", "4", "5", "6", "7", "8"]));
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClassifyDialogOpen, setIsClassifyDialogOpen] = useState(false);

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name, account_type, nivel, natureza, is_group, permite_lancamento, parent_account_id, description, is_active, ordem, departamento_id, categoria_dre")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Account[];
    },
  });

  // Buscar departamentos para exibição
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    }
  });

  const buildHierarchy = (accounts: Account[]): Account[] => {
    const accountMap = new Map<string, Account>();
    const rootAccounts: Account[] = [];

    // First pass: create map
    accounts.forEach(acc => {
      accountMap.set(acc.id, { ...acc, children: [] });
    });

    // Second pass: build hierarchy
    accountMap.forEach(acc => {
      if (acc.parent_account_id) {
        const parent = accountMap.get(acc.parent_account_id);
        if (parent) {
          parent.children?.push(acc);
        }
      } else {
        rootAccounts.push(acc);
      }
    });

    return rootAccounts;
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const filterAccounts = (accounts: Account[], search: string): Account[] => {
    if (!search) return accounts;
    
    const searchLower = search.toLowerCase();
    return accounts.filter(acc => {
      const matches = 
        acc.code.toLowerCase().includes(searchLower) ||
        acc.name.toLowerCase().includes(searchLower);
      
      if (matches) return true;
      
      if (acc.children) {
        const childMatches = filterAccounts(acc.children, search);
        if (childMatches.length > 0) {
          acc.children = childMatches;
          return true;
        }
      }
      
      return false;
    });
  };

  const renderAccountRow = (account: Account, level: number = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedNodes.has(account.id);
    const paddingLeft = level * 24;

    return (
      <div key={account.id}>
        <div
          className={`flex items-center py-3 px-4 hover:bg-accent/50 border-b transition-colors ${
            account.is_group ? "font-semibold bg-muted/30" : ""
          }`}
          style={{ paddingLeft: `${paddingLeft + 16}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleNode(account.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {!hasChildren && <div className="w-6" />}
            
            <span className="font-mono text-sm min-w-[100px]">{account.code}</span>
            <span className="flex-1">{account.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {account.categoria_dre && (
              <Badge 
                variant="outline" 
                className={categoriaDreColors[account.categoria_dre] || "bg-muted text-muted-foreground"}
              >
                {categoriaDreLabels[account.categoria_dre] || account.categoria_dre}
              </Badge>
            )}
            <Badge variant="outline" className={accountTypeColors[account.account_type]}>
              {accountTypeLabels[account.account_type]}
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {account.natureza}
            </Badge>
            {!account.permite_lancamento && (
              <Badge variant="outline" className="text-muted-foreground">
                Grupo
              </Badge>
            )}
            {!account.is_active && (
              <Badge variant="destructive">Inativo</Badge>
            )}
            
            {account.departamento_id && departamentos && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                {departamentos.find((d: any) => d.id === account.departamento_id)?.nome || 'Dept.'}
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              title="Editar conta"
              onClick={() => {
                setSelectedAccount(account);
                setIsEditDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {account.children!.map(child => renderAccountRow(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const hierarchy = accounts ? buildHierarchy(accounts) : [];
  const filteredHierarchy = searchTerm ? filterAccounts([...hierarchy], searchTerm) : hierarchy;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plano de Contas</h1>
            <p className="text-muted-foreground mt-1">
              Estrutura contábil hierárquica CPC/IFRS
            </p>
          </div>
          <div>
            <Button onClick={() => setIsNewDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
            <Button 
              onClick={() => setIsClassifyDialogOpen(true)} 
              variant="outline"
              className="ml-2"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Classificar com IA
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total de Contas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contas Sintéticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts?.filter(a => a.is_group).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contas Analíticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts?.filter(a => a.permite_lancamento).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Centros de Custo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts?.filter(a => a.account_type === "cost_center").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="border-t">
                {filteredHierarchy.map(account => renderAccountRow(account))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NovaContaDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSuccess={() => {
          refetch();
          toast.success("Conta criada com sucesso!");
        }}
        parentAccounts={accounts || []}
      />

      {selectedAccount && (
        <EditarContaDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          account={selectedAccount}
          onSuccess={() => {
            refetch();
            toast.success("Conta atualizada com sucesso!");
          }}
          parentAccounts={accounts?.filter(a => a.id !== selectedAccount.id) || []}
        />
      )}

      <ClassificarContasEmLoteDialog
        open={isClassifyDialogOpen}
        onOpenChange={setIsClassifyDialogOpen}
        onSuccess={() => {
          refetch();
        }}
        accounts={accounts || []}
      />
    </DashboardLayout>
  );
}
