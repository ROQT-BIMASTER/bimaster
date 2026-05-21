import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useBriefingMembros } from "@/hooks/useBriefingMembros";
import { DEV_PAPEIS } from "@/lib/productDocAudit";
import { Search, UserPlus, Trash2, Shield, User, Crown, Palette, Eye, Lock, BarChart3, Settings, Loader2 } from "lucide-react";

const PAPEL_ICON_MAP: Record<string, React.ReactNode> = {
  gestor_produto: <Crown className="h-3.5 w-3.5 text-amber-500" />,
  regulatorio: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  design: <Palette className="h-3.5 w-3.5 text-purple-500" />,
  controle_arte: <Eye className="h-3.5 w-3.5 text-orange-500" />,
  admin_cofre: <Lock className="h-3.5 w-3.5 text-emerald-500" />,
  diretoria: <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />,
  coordenador: <Settings className="h-3.5 w-3.5 text-primary" />,
  membro: <User className="h-3.5 w-3.5 text-muted-foreground" />,
};
const PAPEL_LABEL: Record<string, string> = Object.fromEntries(DEV_PAPEIS.map((p) => [p.value, p.label]));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  briefingId: string;
}

export function BriefingMembrosDialog({ open, onOpenChange, briefingId }: Props) {
  const { user } = useAuth();
  const { membros, isLoading, isCoordinator, addMembro, removeMembro, updatePapel } = useBriefingMembros(briefingId);
  const [search, setSearch] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const { data: subordinados = [] } = useQuery({
    queryKey: ["subordinados_equipe", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc("get_subordinados", { _user_id: user.id });
      if (error) throw error;
      const ids = (data || []).map((s: any) => s.subordinado_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, email")
        .in("id", ids);
      return profiles || [];
    },
    enabled: open && !!user?.id,
  });

  const candidatos = useMemo(() => {
    const ids = new Set(membros.map((m) => m.user_id));
    return (subordinados as any[]).filter((p) => !ids.has(p.id));
  }, [subordinados, membros]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["search_profiles_briefing", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const { data, error } = await supabase
        .from("chat_directory" as any)
        .select("id, nome, avatar_url")
        .ilike("nome", `%${search.trim()}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: open && isCoordinator && search.trim().length >= 2,
  });

  const membroIds = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);
  const filteredResults = useMemo(
    () => (searchResults as any[]).filter((p) => !membroIds.has(p.id)),
    [searchResults, membroIds],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return membros;
    return membros.filter((m) =>
      (m.profile?.nome || "").toLowerCase().includes(s) || m.user_id.toLowerCase().includes(s),
    );
  }, [membros, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Membros do Briefing
          </DialogTitle>
          <DialogDescription>
            Controle quem pode visualizar e editar este briefing. Se o briefing estiver vinculado a um projeto,
            os membros do projeto também terão acesso automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            {isCoordinator && (
              <Select
                onValueChange={(userId) => addMembro.mutate({ userId, papel: "membro" })}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={(
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5" /> Adicionar da equipe
                    </span>
                  ) as any} />
                </SelectTrigger>
                <SelectContent>
                  {candidatos.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Nenhum subordinado disponível
                    </div>
                  ) : (
                    candidatos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome || p.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {isCoordinator && search.trim().length >= 2 && (
            filteredResults.length > 0 ? (
              <div className="border rounded-md divide-y max-h-40 overflow-auto">
                {filteredResults.map((profile: any) => (
                  <div key={profile.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{profile.nome?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium leading-none">{profile.nome}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        addMembro.mutate({ userId: profile.id, papel: "membro" });
                        setSearch("");
                      }}
                      disabled={addMembro.isPending}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-md p-3 text-xs text-muted-foreground text-center">
                Nenhum usuário encontrado para "{search.trim()}".
              </div>
            )
          )}
        </div>

        <ScrollArea className="max-h-[420px] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {(m.profile?.nome || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.profile?.nome || m.user_id.slice(0, 8)}
                      {m.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2 text-[10px]">Você</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {PAPEL_ICON_MAP[m.papel]}
                      {PAPEL_LABEL[m.papel] || m.papel}
                    </div>
                  </div>

                  {isCoordinator && (
                    <>
                      <Select
                        value={m.papel}
                        onValueChange={(v) => updatePapel.mutate({ membroId: m.id, papel: v })}
                        disabled={m.user_id === user?.id}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEV_PAPEIS.map((p) => (
                            <SelectItem key={p.value} value={p.value} className="text-xs">
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRemoveConfirm(m.id)}
                        disabled={m.user_id === user?.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={!!removeConfirm} onOpenChange={(o) => !o && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário perderá acesso a este briefing imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeConfirm) removeMembro.mutate(removeConfirm);
                setRemoveConfirm(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
