import { Users, User, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamMember, TeamHierarchy } from "@/hooks/useTradeSupervisorDashboard";

interface SupervisorTeamSelectorProps {
  team: TeamMember[];
  teamHierarchy?: TeamHierarchy[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  isLoading?: boolean;
}

const getRoleIcon = (role?: string) => {
  switch (role) {
    case 'admin': return '👑';
    case 'gerente': return '🏆';
    case 'supervisor': return '👨‍💼';
    case 'vendedor': return '💼';
    case 'promotor': return '🎯';
    default: return '👤';
  }
};

const getRoleLabel = (role?: string) => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    gerente: 'Gerente',
    supervisor: 'Supervisor',
    vendedor: 'Vendedor',
    promotor: 'Promotor',
  };
  return labels[role || ''] || role || '';
};

export function SupervisorTeamSelector({
  team,
  teamHierarchy = [],
  selectedMemberId,
  onSelectMember,
  isLoading,
}: SupervisorTeamSelectorProps) {
  const selectedMember = team.find((m) => m.id === selectedMemberId);
  const hasHierarchy = teamHierarchy.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isLoading || team.length === 0}
        >
          {selectedMember ? (
            <>
              <span>{getRoleIcon(selectedMember.role)}</span>
              <span className="max-w-[120px] truncate">{selectedMember.nome}</span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              <span>Minha Equipe</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {team.length}
              </Badge>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[450px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Minha Equipe
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Opção "Todos" */}
        <DropdownMenuItem
          onClick={() => onSelectMember(null)}
          className={cn(
            "cursor-pointer flex items-center justify-between",
            !selectedMemberId && "bg-primary/10"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">Toda a equipe</span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {team.length}
            </Badge>
          </div>
          {!selectedMemberId && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />

        {hasHierarchy ? (
          teamHierarchy.map((group, groupIdx) => (
            <DropdownMenuGroup key={group.supervisor?.id || `direct-${groupIdx}`}>
              {/* Cabeçalho do grupo */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/50">
                {group.supervisor ? (
                  <>
                    <span>{getRoleIcon('supervisor')}</span>
                    <span>Equipe {group.supervisor.nome.split(' ')[0]}</span>
                    <Badge variant="outline" className="ml-auto px-1 py-0 text-[10px]">
                      {group.members.length}
                    </Badge>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    <span>Meus Diretos</span>
                    <Badge variant="outline" className="ml-auto px-1 py-0 text-[10px]">
                      {group.members.length}
                    </Badge>
                  </>
                )}
              </div>
              
              {/* Membros do grupo */}
              {group.members.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onClick={() => onSelectMember(member.id)}
                  className={cn(
                    "cursor-pointer flex items-center justify-between pl-4",
                    selectedMemberId === member.id && "bg-primary/10"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">{getRoleIcon(member.role)}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate text-sm">{member.nome}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {getRoleLabel(member.role)}
                    </Badge>
                    {selectedMemberId === member.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              
              {groupIdx < teamHierarchy.length - 1 && <DropdownMenuSeparator />}
            </DropdownMenuGroup>
          ))
        ) : (
          // Fallback: lista flat
          team.map((member) => (
            <DropdownMenuItem
              key={member.id}
              onClick={() => onSelectMember(member.id)}
              className={cn(
                "cursor-pointer flex items-center justify-between",
                selectedMemberId === member.id && "bg-primary/10"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{getRoleIcon(member.role)}</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{member.nome}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </span>
                </div>
              </div>
              {selectedMemberId === member.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          ))
        )}
        
        {team.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum membro na equipe
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
