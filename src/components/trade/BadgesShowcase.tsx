import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Zap, Target, Award, Crown, Flame, TrendingUp } from "lucide-react";

interface BadgesShowcaseProps {
  badges: any;
  streakDays: number;
}

export const BadgesShowcase = ({ badges, streakDays }: BadgesShowcaseProps) => {
  const allBadges = [
    {
      id: 'first_visit',
      name: 'Primeira Visita',
      description: 'Complete sua primeira visita',
      icon: Target,
      color: 'text-blue-500',
      unlocked: badges?.first_visit || false,
    },
    {
      id: 'visit_streak_7',
      name: 'Sequência de 7 Dias',
      description: 'Faça visitas por 7 dias seguidos',
      icon: Flame,
      color: 'text-orange-500',
      unlocked: streakDays >= 7,
    },
    {
      id: 'visit_streak_30',
      name: 'Sequência de 30 Dias',
      description: 'Faça visitas por 30 dias seguidos',
      icon: Flame,
      color: 'text-red-500',
      unlocked: streakDays >= 30,
    },
    {
      id: 'perfect_audit',
      name: 'Auditoria Perfeita',
      description: 'Complete uma auditoria com 100% de compliance',
      icon: Star,
      color: 'text-yellow-500',
      unlocked: badges?.perfect_audit || false,
    },
    {
      id: 'photo_master',
      name: 'Mestre das Fotos',
      description: 'Envie 100 fotos',
      icon: Award,
      color: 'text-purple-500',
      unlocked: badges?.photo_master || false,
    },
    {
      id: 'speed_demon',
      name: 'Velocista',
      description: 'Complete 10 visitas em um dia',
      icon: Zap,
      color: 'text-green-500',
      unlocked: badges?.speed_demon || false,
    },
    {
      id: 'top_10',
      name: 'Top 10',
      description: 'Entre no top 10 do ranking mensal',
      icon: Trophy,
      color: 'text-amber-500',
      unlocked: badges?.top_10 || false,
    },
    {
      id: 'elite_level',
      name: 'Elite',
      description: 'Alcance o nível Elite',
      icon: Crown,
      color: 'text-pink-500',
      unlocked: badges?.elite_level || false,
    },
    {
      id: 'point_milestone_1000',
      name: '1.000 Pontos',
      description: 'Acumule 1.000 pontos',
      icon: TrendingUp,
      color: 'text-indigo-500',
      unlocked: badges?.point_milestone_1000 || false,
    },
  ];

  const unlockedCount = allBadges.filter(b => b.unlocked).length;
  const totalCount = allBadges.length;
  const progressPercentage = (unlockedCount / totalCount) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Conquistas & Badges
        </CardTitle>
        <CardDescription>
          {unlockedCount} de {totalCount} conquistas desbloqueadas ({Math.round(progressPercentage)}%)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allBadges.map((badge) => {
            const BadgeIcon = badge.icon;
            
            return (
              <div
                key={badge.id}
                className={`relative p-4 border rounded-lg text-center transition-all ${
                  badge.unlocked
                    ? 'bg-secondary/50 border-primary/50 hover:shadow-lg'
                    : 'bg-muted/20 border-muted opacity-50 grayscale'
                }`}
              >
                {badge.unlocked && (
                  <div className="absolute -top-2 -right-2">
                    <Badge variant="default" className="h-6 w-6 p-0 rounded-full flex items-center justify-center">
                      ✓
                    </Badge>
                  </div>
                )}
                
                <div className={`flex items-center justify-center mb-2 ${
                  badge.unlocked ? badge.color : 'text-muted-foreground'
                }`}>
                  <BadgeIcon className="h-8 w-8" />
                </div>
                
                <h4 className={`font-semibold text-sm mb-1 ${
                  badge.unlocked ? '' : 'text-muted-foreground'
                }`}>
                  {badge.name}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {badge.description}
                </p>
                
                {!badge.unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                    <Badge variant="secondary" className="text-xs">
                      Bloqueado
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around p-4 border rounded-lg bg-secondary/20">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{unlockedCount}</p>
            <p className="text-xs text-muted-foreground">Desbloqueadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted-foreground">{totalCount - unlockedCount}</p>
            <p className="text-xs text-muted-foreground">Bloqueadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{Math.round(progressPercentage)}%</p>
            <p className="text-xs text-muted-foreground">Completo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
