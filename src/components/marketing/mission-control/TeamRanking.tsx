import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, Medal, Crown, Flame, Star, 
  TrendingUp, Award, Zap, Target 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  points: number;
  level: number;
  streak: number;
  tasksCompleted: number;
  badges: string[];
}

const levelConfig: Record<number, { name: string; color: string; icon: React.ReactNode }> = {
  1: { name: "Novato", color: "text-gray-500", icon: <Star className="h-4 w-4" /> },
  2: { name: "Aprendiz", color: "text-blue-500", icon: <Target className="h-4 w-4" /> },
  3: { name: "Especialista", color: "text-purple-500", icon: <Zap className="h-4 w-4" /> },
  4: { name: "Mestre", color: "text-amber-500", icon: <Award className="h-4 w-4" /> },
  5: { name: "Lenda", color: "text-pink-500", icon: <Crown className="h-4 w-4" /> }
};

const positionIcons: Record<number, React.ReactNode> = {
  1: <Crown className="h-5 w-5 text-amber-500" />,
  2: <Medal className="h-5 w-5 text-gray-400" />,
  3: <Medal className="h-5 w-5 text-amber-700" />
};

function RankingCard({ member, position }: { member: TeamMember; position: number }) {
  const level = levelConfig[member.level] || levelConfig[1];
  const nextLevelPoints = member.level * 500;
  const progressToNext = Math.min((member.points / nextLevelPoints) * 100, 100);

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-all",
      position <= 3 && "bg-muted/50",
      position === 1 && "bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20"
    )}>
      {/* Position */}
      <div className="w-8 h-8 flex items-center justify-center">
        {positionIcons[position] || (
          <span className="text-sm font-bold text-muted-foreground">#{position}</span>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-10 w-10 border-2 border-background">
        <AvatarImage src={member.avatar} />
        <AvatarFallback className="text-xs font-medium">
          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{member.name}</span>
          {member.streak >= 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <Flame className="h-2.5 w-2.5 text-orange-500" />
              {member.streak}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-medium flex items-center gap-1", level.color)}>
            {level.icon}
            {level.name}
          </span>
          <Progress value={progressToNext} className="h-1 w-16" />
        </div>
      </div>

      {/* Points */}
      <div className="text-right">
        <span className="text-lg font-bold">{member.points.toLocaleString()}</span>
        <p className="text-[10px] text-muted-foreground">pontos</p>
      </div>
    </div>
  );
}

export function TeamRanking() {
  const { data: ranking, isLoading } = useQuery({
    queryKey: ['team-ranking'],
    queryFn: async () => {
      // Buscar stats de marketing
      const { data: stats } = await supabase
        .from('marketing_user_stats')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(10);

      if (!stats || stats.length === 0) {
        // Dados de demonstração se não houver dados reais
        return [
          { id: '1', name: 'Ana Silva', points: 1250, level: 3, streak: 7, tasksCompleted: 45, badges: ['speed_demon', 'creative_master'] },
          { id: '2', name: 'Carlos Santos', points: 980, level: 2, streak: 5, tasksCompleted: 38, badges: ['first_task', 'streak_7'] },
          { id: '3', name: 'Maria Oliveira', points: 875, level: 2, streak: 3, tasksCompleted: 32, badges: ['team_player'] },
          { id: '4', name: 'Pedro Costa', points: 650, level: 2, streak: 0, tasksCompleted: 25, badges: [] },
          { id: '5', name: 'Julia Lima', points: 420, level: 1, streak: 2, tasksCompleted: 18, badges: ['first_task'] }
        ] as TeamMember[];
      }

      // Buscar perfis dos usuários
      const userIds = stats.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', userIds);

      return stats.map(s => {
        const profile = profiles?.find(p => p.id === s.user_id);
        return {
          id: s.user_id,
          name: profile?.nome || 'Usuário',
          avatar: undefined,
          points: s.total_points || 0,
          level: s.level || 1,
          streak: s.current_streak || 0,
          tasksCompleted: s.tasks_completed || 0,
          badges: []
        } as TeamMember;
      });
    }
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Ranking da Equipe
          <Badge variant="outline" className="ml-auto text-[10px]">
            Este mês
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))
            ) : ranking?.map((member, i) => (
              <RankingCard key={member.id} member={member} position={i + 1} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
