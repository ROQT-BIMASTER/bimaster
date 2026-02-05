import { Users, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/hooks/useTradeSupervisorDashboard";

interface SupervisorTeamSelectorProps {
  team: TeamMember[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  isLoading?: boolean;
}

export function SupervisorTeamSelector({
  team,
  selectedMemberId,
  onSelectMember,
  isLoading,
}: SupervisorTeamSelectorProps) {
  const selectedMember = team.find((m) => m.id === selectedMemberId);

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
              <User className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{selectedMember.nome}</span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4" />
              <span>Toda Equipe</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {team.length}
              </Badge>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Minha Equipe
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSelectMember(null)}
          className={cn(
            "cursor-pointer flex items-center justify-between",
            !selectedMemberId && "bg-primary/10"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>Todos os membros</span>
          </div>
          {!selectedMemberId && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {team.map((member) => (
          <DropdownMenuItem
            key={member.id}
            onClick={() => onSelectMember(member.id)}
            className={cn(
              "cursor-pointer flex items-center justify-between",
              selectedMemberId === member.id && "bg-primary/10"
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium">{member.nome}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {member.email}
              </span>
            </div>
            {selectedMemberId === member.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {team.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum membro na equipe
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
