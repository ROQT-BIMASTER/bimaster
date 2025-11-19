import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Award } from "lucide-react";

interface LevelProgressCardProps {
  currentLevel: number;
  currentLevelName: string;
  currentPoints: number;
  nextLevelPoints: number | null;
}

export const LevelProgressCard = ({ 
  currentLevel, 
  currentLevelName, 
  currentPoints, 
  nextLevelPoints 
}: LevelProgressCardProps) => {
  const levels = [
    { number: 1, name: "Bronze", color: "bg-orange-500", icon: Trophy, minPoints: 0 },
    { number: 2, name: "Prata", color: "bg-gray-400", icon: Star, minPoints: 500 },
    { number: 3, name: "Ouro", color: "bg-yellow-500", icon: Award, minPoints: 1500 },
    { number: 4, name: "Platina", color: "bg-blue-400", icon: Trophy, minPoints: 3000 },
    { number: 5, name: "Elite", color: "bg-purple-500", icon: Star, minPoints: 5000 },
  ];

  const progressToNextLevel = nextLevelPoints 
    ? (currentPoints / nextLevelPoints) * 100 
    : 100;

  const CurrentLevelIcon = levels.find(l => l.number === currentLevel)?.icon || Trophy;
  const levelColor = levels.find(l => l.number === currentLevel)?.color || "bg-gray-500";

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CurrentLevelIcon className="h-6 w-6" />
            Progressão de Nível
          </span>
          <Badge className={levelColor}>
            {currentLevelName}
          </Badge>
        </CardTitle>
        <CardDescription>
          Continue ganhando pontos para alcançar o próximo nível
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Barra de Progresso */}
        {nextLevelPoints && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso para {levels.find(l => l.number === currentLevel + 1)?.name || 'Máximo'}</span>
              <span className="font-semibold">{currentPoints} / {nextLevelPoints}</span>
            </div>
            <Progress value={Math.min(progressToNextLevel, 100)} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              Faltam {Math.max(0, nextLevelPoints - currentPoints)} pontos para o próximo nível
            </p>
          </div>
        )}

        {/* Timeline de Níveis */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Todos os Níveis</h4>
          <div className="space-y-2">
            {levels.map((level) => {
              const isCompleted = currentLevel > level.number;
              const isCurrent = currentLevel === level.number;
              const LevelIcon = level.icon;

              return (
                <div
                  key={level.number}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-primary/10 border-primary'
                      : isCompleted
                      ? 'bg-secondary/50 border-secondary'
                      : 'bg-muted/20 border-muted'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${level.color} ${
                    !isCompleted && !isCurrent ? 'opacity-40' : ''
                  }`}>
                    <LevelIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isCurrent ? 'text-primary' : ''}`}>
                      Nível {level.number}: {level.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {level.minPoints}+ pontos
                    </p>
                  </div>
                  {isCompleted && (
                    <Badge variant="secondary" className="text-xs">
                      ✓ Completo
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Benefícios do Próximo Nível */}
        {currentLevel < 5 && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="font-semibold text-sm mb-2">
              Benefícios do {levels[currentLevel]?.name}:
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Acesso a desafios exclusivos</li>
              <li>• Multiplicador de pontos especial</li>
              <li>• Recompensas premium</li>
              <li>• Prioridade em aprovações</li>
            </ul>
          </div>
        )}

        {currentLevel === 5 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-purple-500" />
              Nível Elite Alcançado! 🎉
            </h4>
            <p className="text-xs text-muted-foreground">
              Você está no nível máximo! Continue acumulando pontos para manter sua posição no ranking.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
