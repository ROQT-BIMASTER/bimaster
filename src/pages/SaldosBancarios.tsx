import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, ChevronRight, Building2, Wallet, 
  TrendingUp, TrendingDown, Save, Plus, Calendar,
  AlertCircle, CheckCircle
} from "lucide-react";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SmartValue, ValueLegend } from "@/components/ui/smart-value";
import { formatCurrencyCompact } from "@/lib/formatters";

interface BankAccount {
  id: string;
  account_number: string;
  bank_name: string;
  account_type: string;
  store_id: string;
}

interface DailyBalance {
  id: string;
  bank_account_id: string;
  balance_date: string;
  opening_balance: number;
  total_credits: number;
  total_debits: number;
  closing_balance: number;
  notes: string | null;
}

export default function SaldosBancarios() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingBalances, setEditingBalances] = useState<Record<string, Partial<DailyBalance>>>({});
  const queryClient = useQueryClient();

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const previousDateStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');

  // Fetch bank accounts
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('bank_name');
      if (error) throw error;
      return data as BankAccount[];
    }
  });

  // Fetch balances for current date and previous date
  const { data: balances, isLoading: isLoadingBalances } = useQuery({
    queryKey: ['daily-balances', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_bank_daily_balances')
        .select('*')
        .eq('balance_date', dateStr);
      if (error) throw error;
      return data as DailyBalance[];
    }
  });

  const { data: previousBalances } = useQuery({
    queryKey: ['daily-balances', previousDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_bank_daily_balances')
        .select('*')
        .eq('balance_date', previousDateStr);
      if (error) throw error;
      return data as DailyBalance[];
    }
  });

  // Fetch month data for summary
  const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
  
  const { data: monthBalances } = useQuery({
    queryKey: ['month-balances', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_bank_daily_balances')
        .select('*')
        .gte('balance_date', monthStart)
        .lte('balance_date', monthEnd)
        .order('balance_date');
      if (error) throw error;
      return data as DailyBalance[];
    }
  });

  // Map balances by account
  const balancesByAccount = useMemo(() => {
    const map = new Map<string, DailyBalance>();
    (balances || []).forEach(b => map.set(b.bank_account_id, b));
    return map;
  }, [balances]);

  const previousBalancesByAccount = useMemo(() => {
    const map = new Map<string, DailyBalance>();
    (previousBalances || []).forEach(b => map.set(b.bank_account_id, b));
    return map;
  }, [previousBalances]);

  // Calculate totals
  const totals = useMemo(() => {
    let openingTotal = 0;
    let closingTotal = 0;
    let creditsTotal = 0;
    let debitsTotal = 0;
    let previousTotal = 0;

    (accounts || []).forEach(account => {
      const balance = balancesByAccount.get(account.id);
      const prevBalance = previousBalancesByAccount.get(account.id);
      const editing = editingBalances[account.id];

      if (balance) {
        openingTotal += editing?.opening_balance ?? balance.opening_balance;
        closingTotal += editing?.closing_balance ?? balance.closing_balance;
        creditsTotal += editing?.total_credits ?? balance.total_credits;
        debitsTotal += editing?.total_debits ?? balance.total_debits;
      } else if (editing) {
        openingTotal += editing.opening_balance || 0;
        closingTotal += editing.closing_balance || 0;
        creditsTotal += editing.total_credits || 0;
        debitsTotal += editing.total_debits || 0;
      }

      if (prevBalance) {
        previousTotal += prevBalance.closing_balance;
      }
    });

    const variation = previousTotal > 0 ? ((closingTotal - previousTotal) / previousTotal) * 100 : 0;

    return { openingTotal, closingTotal, creditsTotal, debitsTotal, previousTotal, variation };
  }, [accounts, balancesByAccount, previousBalancesByAccount, editingBalances]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ accountId, data }: { accountId: string; data: Partial<DailyBalance> }) => {
      const existingBalance = balancesByAccount.get(accountId);

      if (existingBalance) {
        const { error } = await supabase
          .from('trade_bank_daily_balances')
          .update({
            opening_balance: data.opening_balance,
            total_credits: data.total_credits,
            total_debits: data.total_debits,
            closing_balance: data.closing_balance,
            notes: data.notes
          })
          .eq('id', existingBalance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('trade_bank_daily_balances')
          .insert({
            bank_account_id: accountId,
            balance_date: dateStr,
            opening_balance: data.opening_balance || 0,
            total_credits: data.total_credits || 0,
            total_debits: data.total_debits || 0,
            closing_balance: data.closing_balance || 0,
            notes: data.notes
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balances'] });
      queryClient.invalidateQueries({ queryKey: ['month-balances'] });
      toast.success('Saldo salvo com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar saldo: ' + (error as Error).message);
    }
  });

  const handleBalanceChange = (accountId: string, field: keyof DailyBalance, value: number | string) => {
    const existing = balancesByAccount.get(accountId);
    const current = editingBalances[accountId] || {
      opening_balance: existing?.opening_balance || 0,
      total_credits: existing?.total_credits || 0,
      total_debits: existing?.total_debits || 0,
      closing_balance: existing?.closing_balance || 0,
      notes: existing?.notes || ''
    };

    const updated = { ...current, [field]: typeof value === 'string' ? value : Number(value) };

    // Auto-calculate closing balance
    if (field === 'opening_balance' || field === 'total_credits' || field === 'total_debits') {
      const opening = field === 'opening_balance' ? Number(value) : (updated.opening_balance || 0);
      const credits = field === 'total_credits' ? Number(value) : (updated.total_credits || 0);
      const debits = field === 'total_debits' ? Number(value) : (updated.total_debits || 0);
      updated.closing_balance = opening + credits - debits;
    }

    setEditingBalances(prev => ({ ...prev, [accountId]: updated }));
  };

  const handleSave = (accountId: string) => {
    const data = editingBalances[accountId];
    if (data) {
      saveMutation.mutate({ accountId, data });
      setEditingBalances(prev => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
    }
  };

  const handleUsePreviousBalance = (accountId: string) => {
    const prevBalance = previousBalancesByAccount.get(accountId);
    if (prevBalance) {
      handleBalanceChange(accountId, 'opening_balance', prevBalance.closing_balance);
    }
  };

  const getValue = (accountId: string, field: keyof DailyBalance): number => {
    const editing = editingBalances[accountId];
    const existing = balancesByAccount.get(accountId);
    
    if (editing && field in editing) {
      return editing[field] as number;
    }
    if (existing) {
      return existing[field] as number;
    }
    return 0;
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoadingAccounts) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Saldos Bancários Diários
          </h1>
          <p className="text-muted-foreground">
            Registre e acompanhe os saldos de cada conta bancária
          </p>
        </div>
        <ValueLegend />
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => subDays(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-[200px] justify-center">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-xl font-semibold">
            {format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          {isToday(currentDate) && (
            <Badge variant="default" className="ml-2">Hoje</Badge>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday(currentDate) && (
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
            Ir para Hoje
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Saldo Inicial</span>
            </div>
            <SmartValue value={totals.openingTotal} className="text-2xl font-bold" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Recebimentos</span>
            </div>
            <SmartValue value={totals.creditsTotal} className="text-2xl font-bold text-emerald-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              <span className="text-xs text-muted-foreground">Pagamentos</span>
            </div>
            <SmartValue value={totals.debitsTotal} className="text-2xl font-bold text-rose-600" />
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Saldo Final</span>
              </div>
              {totals.variation !== 0 && (
                <Badge variant={totals.variation >= 0 ? "default" : "destructive"} className="text-xs">
                  {totals.variation >= 0 ? '+' : ''}{totals.variation.toFixed(1)}%
                </Badge>
              )}
            </div>
            <SmartValue 
              value={totals.closingTotal} 
              className={cn(
                "text-2xl font-bold",
                totals.closingTotal >= 0 ? "text-emerald-600" : "text-rose-600"
              )} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              vs ontem: {formatCurrencyCompact(totals.previousTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldos por Conta Bancária</CardTitle>
          <CardDescription>
            Preencha os saldos de cada conta. O saldo final é calculado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!accounts || accounts.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conta bancária cadastrada.</p>
              <p className="text-sm">Cadastre contas bancárias para começar a registrar saldos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map(account => {
                const existing = balancesByAccount.get(account.id);
                const prevBalance = previousBalancesByAccount.get(account.id);
                const hasChanges = !!editingBalances[account.id];

                return (
                  <div 
                    key={account.id} 
                    className={cn(
                      "p-4 rounded-lg border transition-colors",
                      hasChanges ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-semibold">{account.bank_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Conta: {account.account_number} | {account.account_type}
                          </p>
                        </div>
                        {existing && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {prevBalance && !existing && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleUsePreviousBalance(account.id)}
                          >
                            Usar saldo anterior ({formatCurrencyCompact(prevBalance.closing_balance)})
                          </Button>
                        )}
                        {hasChanges && (
                          <Button 
                            size="sm" 
                            onClick={() => handleSave(account.id)}
                            disabled={saveMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salvar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs">Saldo Inicial</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getValue(account.id, 'opening_balance')}
                          onChange={(e) => handleBalanceChange(account.id, 'opening_balance', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-emerald-600">Recebimentos (+)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getValue(account.id, 'total_credits')}
                          onChange={(e) => handleBalanceChange(account.id, 'total_credits', e.target.value)}
                          className="mt-1 border-emerald-200 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-rose-600">Pagamentos (-)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getValue(account.id, 'total_debits')}
                          onChange={(e) => handleBalanceChange(account.id, 'total_debits', e.target.value)}
                          className="mt-1 border-rose-200 focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Saldo Final</Label>
                        <div className={cn(
                          "mt-1 h-10 rounded-md border flex items-center px-3 font-bold",
                          getValue(account.id, 'closing_balance') >= 0 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                            : "bg-rose-50 border-rose-200 text-rose-700"
                        )}>
                          {formatCurrency(getValue(account.id, 'closing_balance'))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
