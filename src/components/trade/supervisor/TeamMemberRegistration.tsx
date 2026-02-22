import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Search, Download, Edit, CheckCircle2, AlertCircle, Users, Crown, Star, UserCheck, Target, User, ChevronDown, ChevronRight } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { exportArrayToExcel } from "@/lib/excel-utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TeamMemberFormDialog } from "./TeamMemberFormDialog";
import {
  useTeamMemberDetails,
  type TeamMemberWithProfile,
} from "@/hooks/useTeamMemberDetails";
import type { TeamMemberFormData } from "@/lib/validations/teamMember";
import { cn } from "@/lib/utils";

const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  gerente: 1,
  supervisor: 2,
  coordenador: 3,
  vendedor: 4,
  promotor: 5,
};

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: "Administrador", icon: <Crown className="h-4 w-4" />, color: "text-amber-500" },
  gerente: { label: "Gerente", icon: <Star className="h-4 w-4" />, color: "text-purple-500" },
  supervisor: { label: "Supervisor", icon: <UserCheck className="h-4 w-4" />, color: "text-blue-500" },
  coordenador: { label: "Coordenador", icon: <Users className="h-4 w-4" />, color: "text-cyan-500" },
  vendedor: { label: "Vendedor", icon: <Target className="h-4 w-4" />, color: "text-green-500" },
  promotor: { label: "Promotor", icon: <User className="h-4 w-4" />, color: "text-orange-500" },
};

interface TeamMemberRegistrationProps {
  teamMemberIds: string[];
  isLoadingTeam: boolean;
}

function maskCPF(cpf: string): string {
  const formatted = formatCPF(cpf);
  return formatted.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.***.***-$4");
}

// ── Hierarchy types ──
interface SupervisorGroup {
  supervisor: TeamMemberWithProfile;
  vendedores: TeamMemberWithProfile[];
}

interface ManagerTree {
  manager: TeamMemberWithProfile;
  supervisorGroups: SupervisorGroup[];
  directMembers: TeamMemberWithProfile[]; // members without a supervisor match
}

/**
 * Match a vendedor's `supervisor_nome` to a supervisor profile.
 * Handles partial names like "Juliana", "Juliana Moura", "Nathalia", "Naty", "Cris", "Cristiana", etc.
 */
function matchSupervisor(supervisorNome: string | null | undefined, supervisors: TeamMemberWithProfile[]): TeamMemberWithProfile | null {
  if (!supervisorNome) return null;
  const term = supervisorNome.trim().toLowerCase();
  if (!term) return null;

  // Exact full name match first
  const exactMatch = supervisors.find(
    s => (s.details?.nome_completo || s.profile_nome).toLowerCase() === term
  );
  if (exactMatch) return exactMatch;

  // First name match
  const firstNameMatch = supervisors.find(s => {
    const nome = (s.details?.nome_completo || s.profile_nome).toLowerCase();
    const firstName = nome.split(" ")[0];
    return firstName === term || nome.startsWith(term);
  });
  if (firstNameMatch) return firstNameMatch;

  // Partial/nickname match
  const partialMatch = supervisors.find(s => {
    const nome = (s.details?.nome_completo || s.profile_nome).toLowerCase();
    return nome.includes(term) || term.includes(nome.split(" ")[0]);
  });
  return partialMatch || null;
}

// ── Member Row Component ──
function MemberRow({
  member,
  indent = 0,
  onEdit,
}: {
  member: TeamMemberWithProfile;
  indent?: number;
  onEdit: (m: TeamMemberWithProfile) => void;
}) {
  const roleConfig = ROLE_CONFIG[member.profile_role || "vendedor"] || ROLE_CONFIG.vendedor;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell>
        <div className="flex items-center gap-3" style={{ paddingLeft: `${indent * 16 + 8}px` }}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={member.profile_avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {(member.details?.nome_completo || member.profile_nome || "?")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm flex items-center gap-2">
              {member.details?.nome_completo || member.profile_nome}
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", roleConfig.color)}>
                {roleConfig.label}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              {member.details?.email_pessoal || member.profile_email || "—"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm">
        {member.details?.equipe_comercial || "—"}
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm font-mono">
        {member.details?.cpf ? maskCPF(member.details.cpf) : "—"}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm">
        {member.details?.whatsapp ? formatPhone(member.details.whatsapp) : "—"}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm">
        {member.details?.tamanho_camiseta || "—"}
      </TableCell>
      <TableCell>
        {member.cadastro_completo ? (
          <Badge variant="default" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completo
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(member)}
          title="Editar cadastro"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Collapsible Supervisor Group ──
function SupervisorGroupSection({
  group,
  onEdit,
}: {
  group: SupervisorGroup;
  onEdit: (m: TeamMemberWithProfile) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const supConfig = ROLE_CONFIG.supervisor;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/30 cursor-pointer">
          <TableCell colSpan={7} className="py-2">
            <div className="flex items-center gap-2 pl-6">
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className={supConfig.color}>{supConfig.icon}</span>
              <span className="font-semibold text-sm">{group.supervisor.details?.nome_completo || group.supervisor.profile_nome}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600">
                Supervisor
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {group.vendedores.length} membro{group.vendedores.length !== 1 ? "s" : ""}
              </Badge>
              {group.supervisor.details?.equipe_comercial && (
                <span className="text-xs text-muted-foreground ml-2">
                  • {group.supervisor.details.equipe_comercial}
                </span>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Supervisor's own row */}
        <MemberRow member={group.supervisor} indent={2} onEdit={onEdit} />
        {/* Vendedores */}
        {group.vendedores.map((v) => (
          <MemberRow key={v.user_id} member={v} indent={3} onEdit={onEdit} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TeamMemberRegistration({
  teamMemberIds,
  isLoadingTeam,
}: TeamMemberRegistrationProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingMember, setEditingMember] = useState<TeamMemberWithProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { members, isLoading, upsertMember, isUpserting, refetch } =
    useTeamMemberDetails(teamMemberIds);

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;
    const term = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.profile_nome.toLowerCase().includes(term) ||
        (m.details?.nome_completo || "").toLowerCase().includes(term) ||
        m.details?.equipe_comercial?.toLowerCase().includes(term) ||
        m.details?.supervisor_nome?.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  // Build hierarchical tree: Gerente → Supervisor → Vendedor
  const { managerTrees, unassigned } = useMemo(() => {
    const gerentes = filteredMembers.filter(m => m.profile_role === "gerente");
    const supervisores = filteredMembers.filter(m => m.profile_role === "supervisor");
    const vendedores = filteredMembers.filter(m => m.profile_role === "vendedor" || m.profile_role === "promotor");
    const admins = filteredMembers.filter(m => m.profile_role === "admin");
    const others = filteredMembers.filter(m => !["gerente", "supervisor", "vendedor", "promotor", "admin"].includes(m.profile_role || ""));

    // Match vendedores to supervisors (by profile_supervisor_id first, then fallback to supervisor_nome)
    const supervisorMap = new Map<string, SupervisorGroup>();
    const assignedVendedorIds = new Set<string>();

    for (const sup of supervisores) {
      supervisorMap.set(sup.user_id, { supervisor: sup, vendedores: [] });
    }

    for (const vend of vendedores) {
      // Priority 1: profile_supervisor_id points directly to a supervisor
      if (vend.profile_supervisor_id && supervisorMap.has(vend.profile_supervisor_id)) {
        supervisorMap.get(vend.profile_supervisor_id)!.vendedores.push(vend);
        assignedVendedorIds.add(vend.user_id);
        continue;
      }
      // Priority 2: fallback to supervisor_nome matching
      const supNome = vend.details?.supervisor_nome;
      const matchedSup = matchSupervisor(supNome, supervisores);
      if (matchedSup && supervisorMap.has(matchedSup.user_id)) {
        supervisorMap.get(matchedSup.user_id)!.vendedores.push(vend);
        assignedVendedorIds.add(vend.user_id);
      }
    }

    // Sort vendedores inside each supervisor group
    for (const group of supervisorMap.values()) {
      group.vendedores.sort((a, b) =>
        (a.details?.nome_completo || a.profile_nome).localeCompare(b.details?.nome_completo || b.profile_nome)
      );
    }

    // Build manager trees using real supervisor_id links
    const trees: ManagerTree[] = [];
    const assignedSupervisorIds = new Set<string>();

    for (const mgr of gerentes) {
      const mgrSupervisors: SupervisorGroup[] = [];

      // Find supervisors whose profile_supervisor_id points to this manager
      for (const [supId, group] of supervisorMap.entries()) {
        if (group.supervisor.profile_supervisor_id === mgr.user_id) {
          mgrSupervisors.push(group);
          assignedSupervisorIds.add(supId);
        }
      }

      // Direct members (vendedores whose supervisor_id points to this manager, not already assigned)
      const directVends = vendedores.filter(v =>
        v.profile_supervisor_id === mgr.user_id && !assignedVendedorIds.has(v.user_id)
      );

      trees.push({
        manager: mgr,
        supervisorGroups: mgrSupervisors,
        directMembers: directVends,
      });
    }

    // Unassigned supervisors (no supervisor_id pointing to any manager) go into a fallback tree
    const unassignedSups: SupervisorGroup[] = [];
    for (const [supId, group] of supervisorMap.entries()) {
      if (!assignedSupervisorIds.has(supId)) {
        unassignedSups.push(group);
      }
    }
    if (unassignedSups.length > 0) {
      // Create a placeholder tree for unassigned supervisors
      trees.push({
        manager: { user_id: "__unassigned__", profile_nome: "Sem equipe definida", profile_email: "", profile_role: "gerente", profile_avatar_url: null, profile_supervisor_id: null, details: null, cadastro_completo: false },
        supervisorGroups: unassignedSups,
        directMembers: [],
      });
    }

    // Unassigned vendedores (no supervisor match)
    const unassignedVendedores = vendedores.filter(v => !assignedVendedorIds.has(v.user_id));

    return {
      managerTrees: trees,
      unassigned: [...admins, ...unassignedVendedores, ...others],
    };
  }, [filteredMembers]);

  const totalCompletos = members.filter((m) => m.cadastro_completo).length;
  const totalPendentes = members.length - totalCompletos;

  const handleEdit = (member: TeamMemberWithProfile) => {
    setEditingMember(member);
    setDialogOpen(true);
  };

  const handleSave = (userId: string, data: TeamMemberFormData) => {
    upsertMember(
      { userId, data },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setEditingMember(null);
          refetch();
        },
      }
    );
  };

  const handleExport = async () => {
    const exportData = members.map((m) => ({
      Nome: m.details?.nome_completo || m.profile_nome,
      Cargo: ROLE_CONFIG[m.profile_role || ""]?.label || m.profile_role || "",
      "Equipe Comercial": m.details?.equipe_comercial || "",
      Supervisor: m.details?.supervisor_nome || "",
      CPF: m.details?.cpf ? formatCPF(m.details.cpf) : "",
      RG: m.details?.rg || "",
      "Data Nascimento": m.details?.data_nascimento
        ? format(new Date(m.details.data_nascimento), "dd/MM/yyyy")
        : "",
      "E-mail": m.details?.email_pessoal || m.profile_email,
      WhatsApp: m.details?.whatsapp ? formatPhone(m.details.whatsapp) : "",
      "Tamanho Camiseta": m.details?.tamanho_camiseta || "",
      Observações: m.details?.observacoes || "",
      Status: m.cadastro_completo ? "Completo" : "Pendente",
    }));

    await exportArrayToExcel(
      exportData,
      "Equipe Comercial",
      `cadastro-equipe-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
  };

  if (isLoadingTeam || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalSupervisors = managerTrees.reduce((s, t) => s + t.supervisorGroups.length, 0);
  const totalVendedores = managerTrees.reduce((s, t) => s + t.supervisorGroups.reduce((ss, g) => ss + g.vendedores.length, 0), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Cadastro da Equipe Comercial
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {members.length} membros •{" "}
                {managerTrees.length > 0 && (
                  <>
                    <span className="text-purple-500">{managerTrees.length} gerente{managerTrees.length !== 1 ? "s" : ""}</span> •{" "}
                    <span className="text-blue-500">{totalSupervisors} supervisor{totalSupervisors !== 1 ? "es" : ""}</span> •{" "}
                    <span className="text-green-500">{totalVendedores} vendedor{totalVendedores !== 1 ? "es" : ""}</span> •{" "}
                  </>
                )}
                <span className="text-primary">{totalCompletos} completos</span> •{" "}
                <span className="text-destructive">{totalPendentes} pendentes</span>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={members.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, equipe ou supervisor..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Hierarchical Table */}
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum membro encontrado para esta busca." : "Nenhum membro na equipe."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead className="hidden md:table-cell">Equipe</TableHead>
                    <TableHead className="hidden md:table-cell">CPF</TableHead>
                    <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                    <TableHead className="hidden lg:table-cell">Camiseta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managerTrees.map((tree) => (
                    <ManagerTreeSection key={tree.manager.user_id} tree={tree} onEdit={handleEdit} />
                  ))}

                  {/* Unassigned members */}
                  {unassigned.length > 0 && (
                    <>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="py-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm text-muted-foreground">Sem equipe definida</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {unassigned.length}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      {unassigned.map((m) => (
                        <MemberRow key={m.user_id} member={m} indent={1} onEdit={handleEdit} />
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamMemberFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMember(null);
        }}
        member={editingMember}
        onSave={handleSave}
        isSaving={isUpserting}
      />
    </>
  );
}

// ── Manager Tree Section (collapsible) ──
function ManagerTreeSection({
  tree,
  onEdit,
}: {
  tree: ManagerTree;
  onEdit: (m: TeamMemberWithProfile) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const mgrConfig = ROLE_CONFIG.gerente;
  const totalMembers = tree.supervisorGroups.reduce((s, g) => s + 1 + g.vendedores.length, 0) + tree.directMembers.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50/80 dark:hover:bg-purple-950/30 cursor-pointer">
          <TableCell colSpan={7} className="py-3">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className={mgrConfig.color}>{mgrConfig.icon}</span>
              <span className="font-bold text-sm">{tree.manager.details?.nome_completo || tree.manager.profile_nome}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-300">
                Gerente
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {tree.supervisorGroups.length} supervisor{tree.supervisorGroups.length !== 1 ? "es" : ""} • {totalMembers} membro{totalMembers !== 1 ? "s" : ""}
              </Badge>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Manager's own row */}
        <MemberRow member={tree.manager} indent={1} onEdit={onEdit} />

        {/* Supervisor groups */}
        {tree.supervisorGroups.map((group) => (
          <SupervisorGroupSection key={group.supervisor.user_id} group={group} onEdit={onEdit} />
        ))}

        {/* Direct members without supervisor */}
        {tree.directMembers.map((m) => (
          <MemberRow key={m.user_id} member={m} indent={2} onEdit={onEdit} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
