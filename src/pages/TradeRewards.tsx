import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import { RewardDialog } from "@/components/trade/RewardDialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";

export default function TradeRewards() {
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: rewards, isLoading, refetch } = useSupabaseQuery(
    ["trade-rewards"],
    async () => {
      const { data, error } = await supabase
        .from("trade_rewards")
        .select("*")
        .order("min_points", { ascending: true });

      if (error) throw error;
      return data || [];
    }
  );

  const handleEdit = (reward: any) => {
    setSelectedReward(reward);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedReward(null);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    refetch();
    setDialogOpen(false);
    setSelectedReward(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb moduleName="Trade Marketing" moduleHref="/dashboard/trade" currentPage="Premiações" />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              Premiações
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie as premiações e banners do programa de pontos
            </p>
          </div>
          <Button onClick={handleCreate} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Nova Premiação
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Premiações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {rewards?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Premiações Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {rewards?.filter(r => r.is_active).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Com Banner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                {rewards?.filter(r => r.banner_url).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rewards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : rewards && rewards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <Card 
                key={reward.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleEdit(reward)}
              >
                {/* Banner */}
                <div className="relative h-48 bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
                  {reward.banner_url ? (
                    <img
                      src={reward.banner_url}
                      alt={reward.reward_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <Badge variant={reward.is_active ? "default" : "secondary"}>
                      {reward.is_active ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Ativa
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Inativa
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    {reward.reward_name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {reward.description || "Sem descrição"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Points Range */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pontos</span>
                    <span className="font-semibold">
                      {reward.min_points} - {reward.max_points || "∞"}
                    </span>
                  </div>

                  {/* Reward Type */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <Badge variant="outline">
                      {reward.reward_type === 'monetary' ? 'Monetário' : 
                       reward.reward_type === 'item' ? 'Item' : 'Experiência'}
                    </Badge>
                  </div>

                  {/* Value */}
                  {reward.reward_type === 'monetary' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-semibold text-primary">
                        {reward.points_value 
                          ? `${reward.points_value}%` 
                          : `R$ ${reward.fixed_amount?.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {/* Period */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Período</span>
                    <span className="font-medium">
                      {reward.period_type === 'monthly' ? 'Mensal' : 
                       reward.period_type === 'quarterly' ? 'Trimestral' : 
                       reward.period_type === 'yearly' ? 'Anual' : 'Vitalício'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                Nenhuma premiação cadastrada
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Comece criando sua primeira premiação com banner
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Premiação
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog */}
      <RewardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reward={selectedReward}
        onSuccess={handleSuccess}
      />
    </DashboardLayout>
  );
}
