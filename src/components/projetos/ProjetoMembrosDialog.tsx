import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProjetoMembros, ProjetoMembro } from "@/hooks/useProjetoMembros";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Trash2, ChevronDown, ChevronRight, Shield, User } from "lucide-react";

interface ProjetoMembrosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
}

interface ProjetoSecao {
  id: string;
  nome: string;
  ordem: number | null;
}

export function ProjetoMembrosDialog({ open, onOpenChange, projetoId }: ProjetoMembrosDialogProps) {
  const { membros, isLoading, isCoordinator, addMembro, removeMembro, updateSecoes } = useProjetoMembros(projetoId);
  const [search, setSearch] = useState("");
  const [expandedMembro, setExpandedMembro] = useState<string | null>(null);

  // Fetch project sections
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

  // Search users to add
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

  const handleToggleSecao = (membro: ProjetoMembro, secaoId: string) => {
    const currentIds = membro.secoes_ids || [];
    const newIds = currentIds.includes(secaoId)
      ? currentIds.filter((id) => id !== secaoId)
      : [...currentIds, secaoId];
    updateSecoes.mutate({ membroId: membro.id, secaoIds: newIds });
  };

  const handleSelectAllSecoes = (membro: ProjetoMembro) => {
    const allIds = secoes.map((s) => s.id);
    updateSecoes.mutate({ membroId: membro.id, secaoIds: allIds });
  };

  const handleDeselectAllSecoes = (membro: ProjetoMembro) => {
    updateSecoes.mutate({ membroId: membro.id, secaoIds: [] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Membros do Projeto
          </DialogTitle>
          <DialogDescription>
            Gerencie quem pode acessar o projeto e quais seções cada membro visualiza.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Add members search */}
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
                          addMembro.mutate({ userId: profile.id });
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

          {/* Members list */}
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {membros.map((membro) => {
                const isExpanded = expandedMembro === membro.id;
                const isCoordenador = membro.papel === "coordenador";

                return (
                  <div key={membro.id} className="border rounded-md">
                    <div
                      className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedMembro(isExpanded ? null : membro.id)}
                    >
                      {!isCoordenador ? (
                        isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : <Shield className="h-4 w-4 text-primary" />}

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

                      <Badge variant={isCoordenador ? "default" : "secondary"} className="text-[10px]">
                        {isCoordenador ? "Coordenador" : "Membro"}
                      </Badge>

                      {!isCoordenador && (
                        <Badge variant="outline" className="text-[10px]">
                          {membro.secoes_ids?.length || 0}/{secoes.length} seções
                        </Badge>
                      )}

                      {isCoordinator && !isCoordenador && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMembro.mutate(membro.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Section checkboxes (only for non-coordinators) */}
                    {isExpanded && !isCoordenador && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Seções visíveis</p>
                          {isCoordinator && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleSelectAllSecoes(membro)}
                              >
                                Todas
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleDeselectAllSecoes(membro)}
                              >
                                Nenhuma
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {secoes.map((secao) => (
                            <label
                              key={secao.id}
                              className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-background cursor-pointer"
                            >
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

                    {/* Coordinator: show "all sections" info */}
                    {isExpanded && isCoordenador && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          Coordenadores visualizam todas as seções automaticamente.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
