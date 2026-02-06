import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Users,
  Trophy,
  ChevronDown,
  ChevronRight,
  MapPin,
  Eye,
  Target,
  Crown,
  Star,
  User,
  Loader2,
} from "lucide-react";
import type { MapTeamMember, MapTeamGroup } from "@/hooks/useMapTeamData";

interface MapTeamPanelProps {
  hierarchy: MapTeamGroup[];
  ranking: MapTeamMember[];
  selfProfile: MapTeamMember | null;
  hasFullVisibility: boolean;
  isLoading: boolean;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "admin": return <Crown className="h-3 w-3 text-amber-500" />;
    case "gerente": return <Star className="h-3 w-3 text-purple-500" />;
    case "supervisor": return <Users className="h-3 w-3 text-blue-500" />;
    case "vendedor": return <Target className="h-3 w-3 text-green-500" />;
    case "promotor": return <MapPin className="h-3 w-3 text-orange-500" />;
    default: return <User className="h-3 w-3 text-muted-foreground" />;
  }
};

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: "Admin",
    gerente: "Gerente",
    supervisor: "Supervisor",
    vendedor: "Vendedor",
    promotor: "Promotor",
  };
  return labels[role] || role;
};

const getRankBadge = (position: number) => {
  if (position === 1) return <span className="text-sm">🥇</span>;
  if (position === 2) return <span className="text-sm">🥈</span>;
  if (position === 3) return <span className="text-sm">🥉</span>;
  return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{position}</span>;
};

export function MapTeamPanel({
  hierarchy,
  ranking,
  selfProfile,
  hasFullVisibility,
  isLoading,
}: MapTeamPanelProps) {
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [showRanking, setShowRanking] = useState(true);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregando equipe...</span>
        </CardContent>
      </Card>
    );
  }

  const totalMembers = hierarchy.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="space-y-2">
      {/* Cabeçalho com visão */}
      <Card className="border-primary/20">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-primary" />
            {hasFullVisibility ? "Visão Total" : "Minha Equipe"}
            <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
              {totalMembers}
            </Badge>
          </CardTitle>
        </CardHeader>
        {selfProfile && (
          <CardContent className="p-3 pt-1">
            <div className="flex items-center gap-2 text-xs">
              {getRoleIcon(selfProfile.role)}
              <span className="font-medium truncate">{selfProfile.nome}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
                {getRoleLabel(selfProfile.role)}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Hierarquia */}
      <Card>
        <Collapsible open={showHierarchy} onOpenChange={setShowHierarchy}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="p-3 pb-1 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                Hierarquia
                {showHierarchy ? (
                  <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-2 pt-0">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {hierarchy.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum membro na equipe
                    </p>
                  )}
                  {hierarchy.map((group, idx) => (
                    <HierarchyGroup key={group.supervisor?.id || `group-${idx}`} group={group} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card>
          <Collapsible open={showRanking} onOpenChange={setShowRanking}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="p-3 pb-1 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  Ranking (90 dias)
                  {showRanking ? (
                    <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="max-h-[220px]">
                  <div className="space-y-1">
                    {ranking.map((member, idx) => (
                      <RankingRow key={member.id} member={member} position={idx + 1} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}

function HierarchyGroup({ group }: { group: MapTeamGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-1.5 px-1 py-1 rounded text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          {group.supervisor ? (
            <>
              <Users className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="truncate">Equipe {group.supervisor.nome.split(" ")[0]}</span>
            </>
          ) : (
            <>
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">Meus Diretos</span>
            </>
          )}
          <Badge variant="outline" className="ml-auto px-1 py-0 text-[9px]">
            {group.members.length}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 border-l border-muted pl-2 space-y-0.5">
          {group.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-1.5 py-0.5 text-xs"
            >
              {getRoleIcon(member.role)}
              <span className="truncate flex-1">{member.nome}</span>
              {member.total_visitas > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0" title="Visitas (90d)">
                  {member.total_visitas}v
                </span>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RankingRow({ member, position }: { member: MapTeamMember; position: number }) {
  const score = member.total_visitas * 3 + member.total_prospects * 2 + member.total_clientes_territorio;

  return (
    <div className="flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/30 transition-colors">
      <div className="w-5 flex justify-center shrink-0">
        {getRankBadge(position)}
      </div>
      {getRoleIcon(member.role)}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate block">{member.nome}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
        {member.total_visitas > 0 && (
          <span className="text-green-600" title="Visitas">
            {member.total_visitas}v
          </span>
        )}
        {member.total_prospects > 0 && (
          <span className="text-blue-600" title="Prospects">
            {member.total_prospects}p
          </span>
        )}
        {score === 0 && (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
