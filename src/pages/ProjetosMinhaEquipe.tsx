import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Users, ChevronRight, FolderKanban, CheckCircle2, AlertTriangle, ClipboardList, Trophy, ArrowLeft, Camera, Loader2 } from "lucide-react";
import { useProjetosTeamData, ProjetoTeamMember } from "@/hooks/useProjetosTeamData";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useResolvedAvatarUrl } from "@/hooks/useResolvedAvatarUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  admin: {
    label: "Admin",
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
  },
  gerente: {
    label: "Gerente",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  supervisor: {
    label: "Supervisor",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  vendedor: {
    label: "Vendedor",
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  promotor: {
    label: "Promotor",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
  },
};

const getRoleStyle = (role: string) => {
  const config = ROLE_CONFIG[role];
  if (!config) return { label: role, className: "bg-muted text-muted-foreground border-border" };
  return { label: config.label, className: `${config.bg} ${config.text} ${config.border}` };
};

// --- Inline Avatar with Upload ---
function AvatarWithUpload({
  member,
  size = "md",
  canUpload,
}: {
  member: ProjetoTeamMember;
  size?: "sm" | "md";
  canUpload: boolean;
}) {
  const resolved = useResolvedAvatarUrl(member.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const sizeClass = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const avatarSrc = localUrl || resolved;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${member.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("Erro ao gerar URL");

      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", member.id);
      if (updErr) throw updErr;

      setLocalUrl(signed.signedUrl);
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["projetos-team"] });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar foto: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative inline-block group">
      <Avatar className={sizeClass}>
        <AvatarImage src={avatarSrc} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {member.nome?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {canUpload && (
        <>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {uploading ? (
              <Loader2 className={`${iconSize} text-white animate-spin`} />
            ) : (
              <Camera className={`${iconSize} text-white`} />
            )}
          </button>
        </>
      )}
    </div>
  );
}

// --- Main Page ---
export default function ProjetosMinhaEquipe() {
  const { data: team = [], isLoading } = useProjetosTeamData();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { isAdmin, isGerente, isSupervisor } = useUserRole();
  const canUpload = isAdmin || isGerente || isSupervisor;

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const flattenMembers = (members: ProjetoTeamMember[]): ProjetoTeamMember[] => {
    const result: ProjetoTeamMember[] = [];
    const traverse = (list: ProjetoTeamMember[]) => {
      list.forEach((m) => {
        result.push(m);
        if (m.subordinados) traverse(m.subordinados);
      });
    };
    traverse(members);
    return result;
  };

  const allMembers = flattenMembers(team);
  const topPerformers = [...allMembers].sort((a, b) => b.score - a.score).slice(0, 5);
  const totalTarefas = allMembers.reduce((s, m) => s + m.tarefas_atribuidas, 0);
  const totalConcluidas = allMembers.reduce((s, m) => s + m.tarefas_concluidas, 0);
  const totalAtrasadas = allMembers.reduce((s, m) => s + m.tarefas_atrasadas, 0);

  const renderMember = (member: ProjetoTeamMember, level = 0) => {
    const hasSubs = member.subordinados && member.subordinados.length > 0;
    const isExpanded = expandedNodes.has(member.id);
    const roleStyle = getRoleStyle(member.role);

    return (
      <div key={member.id}>
        <div
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
          style={{ marginLeft: `${level * 1.5}rem` }}
        >
          {hasSubs ? (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleNode(member.id)}>
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <AvatarWithUpload member={member} size="md" canUpload={canUpload} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{member.nome}</span>
              <Badge variant="outline" className={`text-xs font-semibold ${roleStyle.className}`}>
                {roleStyle.label}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground truncate block">{member.email}</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>{member.projetos_ativos}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>{member.tarefas_concluidas}/{member.tarefas_atribuidas}</span>
            </div>
            {member.tarefas_atrasadas > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{member.tarefas_atrasadas}</span>
              </div>
            )}
            <div className="w-16">
              <Progress value={member.taxa_conclusao} className="h-1.5" />
            </div>
            <span className="text-muted-foreground w-8 text-right">{member.taxa_conclusao}%</span>
          </div>
        </div>

        {hasSubs && isExpanded && member.subordinados!.map((sub) => renderMember(sub, level + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Minha Equipe — Projetos</h1>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando equipe...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/projetos")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha Equipe — Projetos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a produtividade da equipe em projetos e tarefas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-2xl font-bold">{allMembers.length}</p>
              <p className="text-xs text-muted-foreground">Membros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalTarefas}</p>
              <p className="text-xs text-muted-foreground">Tarefas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalConcluidas}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{totalAtrasadas}</p>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Hierarchy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Hierarquia da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
            {team.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum membro encontrado</p>
            ) : (
              team.map((m) => renderMember(m))
            )}
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Ranking de Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                </span>
                <AvatarWithUpload member={m} size="sm" canUpload={canUpload} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{m.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.tarefas_concluidas} concluídas · {m.projetos_ativos} projetos
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">{m.score} pts</Badge>
              </div>
            ))}
            {topPerformers.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
