import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjetoMembros, ProjetoMembro } from "@/hooks/useProjetoMembros";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DEV_PAPEIS } from "@/lib/productDocAudit";
import {
  Search, UserPlus, Trash2, Shield, User, Crown, Palette, Eye, Lock, BarChart3, Settings,
} from "lucide-react";

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

const PAPEL_LABEL: Record<string, string> = Object.fromEntries(DEV_PAPEIS.map(p => [p.value, p.label]));

interface ProjetoMembrosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  projetoTipo?: string;
}

interface ProjetoSecao {
  id: string;
  nome: string;
  ordem: number | null;
}

export function ProjetoMembrosDialog({ open, onOpenChange, projetoId, projetoTipo }: ProjetoMembrosDialogProps) {
  const { membros, isLoading, isCoordinator, addMembro, removeMembro, updateSecoes, updatePapel } = useProjetoMembros(projetoId);
  const [search, setSearch] = useState("");
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<string | null>(null);

  const isDevProduto = projetoTipo === "desenvolvimento_produto";

  const { data: secoes = [] } = useQuery({
    queryKey: ["projeto_secoes_list", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_secoes")
        .select("id, nome, ordem")
        .eq("projeto_id", projetoId)
        .order("ordem");
      if (error) throw error;
      return data as ProjetoSecao[];
    },
    enabled: open && !!projetoId,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["search_profiles", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, email")
        .or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });

  const membroUserIds = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);
  const filteredResults = searchResults.filter((p: any) => !membroUserIds.has(p.id));

  const filteredMembros = useMemo(() => {
    if (search.length < 2) return membros;
    const q = search.toLowerCase();
    return membros.filter(m =>
      m.profile?.nome?.toLowerCase().includes(q) ||
      m.profile?.email?.toLowerCase().includes(q)
    );
  }, [membros, search]);

  const handleToggleSecao = (membro: ProjetoMembro, secaoId: string) => {
    const currentIds = membro.secoes_ids || [];
    const newIds = currentIds.includes(secaoId)
      ? currentIds.filter((id) => id !== secaoId)
      : [...currentIds, secaoId];
    updateSecoes.mutate({ membroId: membro.id, secaoIds: newIds });
  };

  const handleSelectAllSecoes = (membro: ProjetoMembro) => {
    updateSecoes.mutate({ membroId: membro.id, secaoIds: secoes.map((s) => s.id) });
  };

  const handleDeselectAllSecoes = (membro: ProjetoMembro) => {
    updateSecoes.mutate({ membroId: membro.id, secaoIds: [] });
  };

  const papelOptions = isDevProduto
    ? DEV_PAPEIS
    : DEV_PAPEIS.filter(p => ["coordenador", "membro"].includes(p.value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Membros do Projeto
          </DialogTitle>
          <DialogDescription>
            Gerencie quem pode acessar o projeto{isDevProduto ? " e atribua papéis de desenvolvimento" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {isCoordinator && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário por nome ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-32 overflow-auto">
                  {filteredResults.map((profile: any) => (
                    <div key={profile.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{profile.nome?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{profile.nome}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          addMembro.mutate({ userId: profile.id, papel: isDevProduto ? "membro" : "membro" });
                          setSearch("");
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          <ScrollArea className="flex-1 h-[60vh]">
            <div className="space-y-3 pr-3">
              {filteredMembros.map((membro) => {
                const papel = membro.papel || "membro";
                const isManager = ["coordenador", "gestor_produto"].includes(papel);

                return (
                  <div key={membro.id} className="border rounded-md">
                    <div className="flex items-center gap-2 p-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{PAPEL_ICON_MAP[papel] || <User className="h-3.5 w-3.5" />}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{PAPEL_LABEL[papel] || papel}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Avatar className="h-7 w-7">
                        <AvatarImage src={membro.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {membro.profile?.nome?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{membro.profile?.nome || "Usuário"}</p>
                        <p className="text-xs text-muted-foreground truncate">{membro.profile?.email}</p>
                      </div>

                      {isCoordinator && isDevProduto ? (
                        <Select
                          value={papel}
                          onValueChange={(v) => updatePapel.mutate({ membroId: membro.id, papel: v })}
                        >
                          <SelectTrigger className="h-7 w-[130px] text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {papelOptions.map(p => (
                              <SelectItem key={p.value} value={p.value}>
                                <div className="flex items-center gap-1.5">
                                  {PAPEL_ICON_MAP[p.value]}
                                  <span className="text-xs">{p.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={isManager ? "default" : "secondary"} className="text-[10px]">
                          {PAPEL_LABEL[papel] || papel}
                        </Badge>
                      )}

                      {isCoordinator && !isManager && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setRemoveMemberConfirm(membro.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {!isManager && secoes.length > 0 && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Seções visíveis ({membro.secoes_ids?.length || 0}/{secoes.length})
                          </p>
                          {isCoordinator && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleSelectAllSecoes(membro)}>Todas</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleDeselectAllSecoes(membro)}>Nenhuma</Button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {secoes.map((secao) => (
                            <label key={secao.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-background cursor-pointer">
                              <Checkbox
                                checked={membro.secoes_ids?.includes(secao.id) || false}
                                onCheckedChange={() => handleToggleSecao(membro, secao.id)}
                                disabled={!isCoordinator}
                              />
                              <span className="truncate text-xs">{secao.nome}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {isManager && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          {papel === "gestor_produto" ? "Gestores" : "Coordenadores"} visualizam todas as seções automaticamente.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Remove member confirmation */}
        <AlertDialog open={!!removeMemberConfirm} onOpenChange={() => setRemoveMemberConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover membro?</AlertDialogTitle>
              <AlertDialogDescription>
                O membro perderá acesso ao projeto. Esta ação pode ser revertida adicionando-o novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (removeMemberConfirm) { removeMembro.mutate(removeMemberConfirm); setRemoveMemberConfirm(null); } }}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
