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
import { Search, Download, Edit, CheckCircle2, AlertCircle, Users, Crown, Star, UserCheck, Target, User } from "lucide-react";
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

type RoleGroup = {
  role: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  members: TeamMemberWithProfile[];
};

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
        m.details?.equipe_comercial?.toLowerCase().includes(term) ||
        m.details?.nome_completo?.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  const roleGroups = useMemo(() => {
    const groups = new Map<string, TeamMemberWithProfile[]>();
    filteredMembers.forEach((m) => {
      const role = m.profile_role || "vendedor";
      if (!groups.has(role)) groups.set(role, []);
      groups.get(role)!.push(m);
    });

    const result: RoleGroup[] = [];
    const sortedRoles = Array.from(groups.keys()).sort(
      (a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99)
    );

    for (const role of sortedRoles) {
      const config = ROLE_CONFIG[role] || { label: role, icon: <User className="h-4 w-4" />, color: "text-muted-foreground" };
      result.push({
        role,
        label: config.label,
        icon: config.icon,
        color: config.color,
        members: groups.get(role)!.sort((a, b) => a.profile_nome.localeCompare(b.profile_nome)),
      });
    }
    return result;
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
              placeholder="Buscar por nome ou equipe..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Table grouped by role */}
          {roleGroups.length === 0 ? (
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
                  {roleGroups.map((group) => (
                    <>
                      {/* Role group header */}
                      <TableRow key={`header-${group.role}`} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="py-2">
                          <div className="flex items-center gap-2">
                            <span className={group.color}>{group.icon}</span>
                            <span className="font-semibold text-sm">{group.label}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {group.members.length}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Members in this group */}
                      {group.members.map((member) => (
                        <TableRow key={member.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3 pl-4">
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
                                <p className="font-medium text-sm">
                                  {member.details?.nome_completo || member.profile_nome}
                                </p>
                                <p className="text-xs text-muted-foreground hidden sm:block">
                                  {member.profile_email}
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
                              onClick={() => handleEdit(member)}
                              title="Editar cadastro"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
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
