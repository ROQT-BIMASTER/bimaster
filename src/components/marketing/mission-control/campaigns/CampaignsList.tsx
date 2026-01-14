import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Megaphone, Plus, Calendar, Target, DollarSign, 
  TrendingUp, Search, MoreVertical, Play, Pause, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewCampaignDialog } from "./NewCampaignDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Campaign {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  orcamento: number | null;
  objetivo: string | null;
  kpis: Record<string, unknown> | null;
  progresso: number;
  responsavel: { nome: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-500', icon: Pause },
  ativa: { label: 'Ativa', color: 'bg-green-500', icon: Play },
  pausada: { label: 'Pausada', color: 'bg-amber-500', icon: Pause },
  concluida: { label: 'Concluída', color: 'bg-blue-500', icon: CheckCircle },
};

const tipoLabels: Record<string, string> = {
  lancamento: 'Lançamento',
  promocao: 'Promoção',
  branding: 'Branding',
  sazonal: 'Sazonal',
  institucional: 'Institucional',
};

export function CampaignsList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campanhas')
        .select(`
          *,
          responsavel:profiles!marketing_campanhas_responsavel_id_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Campaign[];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('marketing_campanhas')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast.success('Status atualizado!');
    }
  });

  const filteredCampaigns = campaigns?.filter(c => 
    c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const stats = {
    total: campaigns?.length || 0,
    ativas: campaigns?.filter(c => c.status === 'ativa').length || 0,
    orcamentoTotal: campaigns?.reduce((sum, c) => sum + (c.orcamento || 0), 0) || 0,
    progressoMedio: campaigns?.length ? 
      campaigns.reduce((sum, c) => sum + c.progresso, 0) / campaigns.length : 0
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Megaphone className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-500">{stats.ativas}</p>
              </div>
              <Play className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Orçamento</p>
                <p className="text-2xl font-bold">
                  {(stats.orcamentoTotal / 1000).toFixed(0)}k
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progresso Médio</p>
                <p className="text-2xl font-bold">{stats.progressoMedio.toFixed(0)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsNewDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
            <Button className="mt-4" onClick={() => setIsNewDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map(campaign => {
            const status = statusConfig[campaign.status] || statusConfig.rascunho;
            const StatusIcon = status.icon;
            
            return (
              <Card key={campaign.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{campaign.nome}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {campaign.descricao || 'Sem descrição'}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'ativa' })}>
                          <Play className="h-4 w-4 mr-2" />
                          Ativar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'pausada' })}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus.mutate({ id: campaign.id, status: 'concluida' })}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Concluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={cn("text-[10px]", status.color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {tipoLabels[campaign.tipo] || campaign.tipo}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {campaign.data_inicio ? format(new Date(campaign.data_inicio), "dd/MM", { locale: ptBR }) : '-'}
                      {' - '}
                      {campaign.data_fim ? format(new Date(campaign.data_fim), "dd/MM", { locale: ptBR }) : '-'}
                    </div>
                    {campaign.orcamento && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {campaign.orcamento.toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  {campaign.objetivo && (
                    <div className="flex items-center gap-2 text-xs">
                      <Target className="h-3 w-3 text-primary" />
                      <span className="truncate">{campaign.objetivo}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{campaign.progresso}%</span>
                    </div>
                    <Progress value={campaign.progresso} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewCampaignDialog 
        open={isNewDialogOpen} 
        onOpenChange={setIsNewDialogOpen}
      />
    </div>
  );
}
