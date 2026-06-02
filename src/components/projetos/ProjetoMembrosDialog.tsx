import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ProjetoProdutosVinculados } from "./ProjetoProdutosVinculados";
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
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { DEV_PAPEIS } from "@/lib/productDocAudit";
import {
  Search, UserPlus, Trash2, Shield, User, Crown, Palette, Eye, Lock, BarChart3, Settings, Users, Loader2, Mail, History, CheckCircle2, UserMinus, X, AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConvidarMembroPanel } from "@/components/projetos/convites/ConvidarMembroPanel";
import { ConvitesPendentesList } from "@/components/projetos/convites/ConvitesPendentesList";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { RemoverMembroWizard } from "@/components/projetos/membros/RemoverMembroWizard";
import { ExMembrosTab } from "@/components/projetos/membros/ExMembrosTab";

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
  const { user } = useAuth();
  const { enabled: offboardingEnabled } = useFeatureFlag("ff_offboarding_membros_v1");
  const [search, setSearch] = useState("");
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<{ id: string; nome: string } | null>(null);
  const [removingMembro, setRemovingMembro] = useState<{ id: string; nome: string } | null>(null);
  const [wizardMembro, setWizardMembro] = useState<ProjetoMembro | null>(null);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);
  const [recentlyRemoved, setRecentlyRemoved] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{
    message: string;
    code?: string;
    hint?: string;
    status?: number;
    attempt: number;
  } | null>(null);
  const [removeAttempt, setRemoveAttempt] = useState(0);
  const [liveMessage, setLiveMessage] = useState<string>("");
  const removingOverlayRef = useRef<HTMLDivElement | null>(null);

  // Focus trap: ao iniciar remoção, joga o foco para o overlay (que está
  // dentro do DialogContent, então o focus-trap do Radix garante que Tab/Shift+Tab
  // não vazem para fora — todo o restante do conteúdo está com `inert`).
  useEffect(() => {
    if (removingMembro && removingOverlayRef.current) {
      removingOverlayRef.current.focus();
    }
  }, [removingMembro]);

  // Defensive: reset body pointer-events if Radix leaves it locked after close.
  useEffect(() => {
    if (open) return;
    const id = requestAnimationFrame(() => {
      if (typeof document !== "undefined" && document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open]);



  const isDevProduto = projetoTipo === "desenvolvimento_produto";

  // "Adicionar Membros" agora lê o diretório corporativo inteiro
  // (get_chat_directory, SECURITY DEFINER) em vez de get_subordinados —
  // qualquer usuário ativo pode ser adicionado ao projeto. A hierarquia
  // (get_subordinados) segue sendo a fonte de verdade em Trade/mapa/stores,
  // onde só faz sentido enxergar a equipe direta.
  const { data: allUsers = [], isLoading: loadingAllUsers } = useQuery({
    queryKey: ["chat_directory_all", showTeamDialog],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_chat_directory");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string | null; avatar_url: string | null }[];
    },
    enabled: showTeamDialog,
  });

  // availableUsers is computed after membroUserIds below

  const toggleTeamUser = useCallback((id: string) => {
    setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleAddTeam = useCallback(async () => {
    if (selectedTeamIds.length === 0) return;
    setAddingTeam(true);
    const addedNames: string[] = [];
    try {
      for (const userId of selectedTeamIds) {
        const profile = allUsers.find((u) => u.id === userId);
        await addMembro.mutateAsync({
          userId,
          papel: "membro",
          profile: profile ? { nome: profile.nome, avatar_url: profile.avatar_url } : undefined,
        });
        if (profile?.nome) addedNames.push(profile.nome);
      }
      setSelectedTeamIds([]);
      setTeamSearch("");
      if (addedNames.length > 0) {
        setRecentlyAdded(addedNames);
        setLiveMessage(
          addedNames.length === 1
            ? `${addedNames[0]} foi adicionado(a) ao projeto.`
            : `${addedNames.length} membros adicionados ao projeto: ${addedNames.join(", ")}.`,
        );
        window.setTimeout(() => setRecentlyAdded([]), 6000);
      }
      // Mantém o sub-diálogo aberto: o usuário fecha manualmente via X ou "Cancelar".
    } finally {
      setAddingTeam(false);
    }
  }, [selectedTeamIds, addMembro, allUsers]);

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
      // get_chat_directory devolve a empresa toda já ordenada por nome.
      // Filtro/limite em JS para não depender de filtros encadeados sobre
      // função RETURNS TABLE. Sem email/PII.
      const { data, error } = await (supabase.rpc as any)("get_chat_directory");
      if (error) throw error;
      const q = search.toLowerCase();
      return ((data ?? []) as any[])
        .filter((u) => (u.nome ?? "").toLowerCase().includes(q))
        .slice(0, 10);
    },
    enabled: search.length >= 2,
  });

  const membroUserIds = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);
  const filteredResults = searchResults.filter((p: any) => !membroUserIds.has(p.id));

  const availableUsers = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (u.id === user?.id) return false;
      if (membroUserIds.has(u.id)) return false;
      if (q && !(u.nome ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allUsers, membroUserIds, teamSearch, user?.id]);

  const filteredMembros = useMemo(() => {
    if (search.length < 2) return membros;
    const q = search.toLowerCase();
    return membros.filter(m =>
      m.profile?.nome?.toLowerCase().includes(q)
      // email não vem do diretório; busca apenas por nome.
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent
        className="max-w-3xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (removingMembro) e.preventDefault(); }}
      >
        {/* Live region acessível: anuncia início/sucesso/erro da remoção.
            O `key` muda a cada tentativa para forçar re-anúncio mesmo
            quando o texto é idêntico (ex.: dois erros consecutivos). */}
        <div
          key={`live-${removeAttempt}-${removingMembro ? "loading" : removeError ? "err" : "idle"}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="membros-live-region"
          data-attempt={removeAttempt}
          className="sr-only"
        >
          {liveMessage}
        </div>
        {removingMembro && (
          <div
            ref={removingOverlayRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-testid="removing-overlay"
            className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[1px] outline-none"
            onKeyDown={(e) => {
              // Prende o foco: Tab/Shift+Tab/Esc/Enter/Space não saem do overlay.
              if (["Tab", "Escape"].includes(e.key)) e.preventDefault();
            }}
          >
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-md text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
              <span>Removendo <strong>{removingMembro.nome}</strong>…</span>
            </div>
          </div>
        )}
        <fieldset
          disabled={!!removingMembro}
          className="contents disabled:opacity-60"
          // @ts-expect-error inert é booleano nativo válido em HTML
          inert={removingMembro ? "" : undefined}
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Membros do Projeto
          </DialogTitle>
          <DialogDescription>
            Gerencie quem pode acessar o projeto{isDevProduto ? " e atribua papéis de desenvolvimento" : ""}.{" "}
            <a
              href="/dashboard/ajuda/projetos-visibilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Como funciona a visibilidade?
            </a>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="membros" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="membros" className="gap-1.5">
              <User className="h-3.5 w-3.5" /> Membros
            </TabsTrigger>
            {isCoordinator && (
              <TabsTrigger value="convites" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Convites
              </TabsTrigger>
            )}
            {isCoordinator && offboardingEnabled && (
              <TabsTrigger value="ex_membros" className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Ex-membros
              </TabsTrigger>
            )}
          </TabsList>

          {isCoordinator && offboardingEnabled && (
            <TabsContent value="ex_membros" className="flex-1 overflow-auto mt-3">
              <ExMembrosTab projetoId={projetoId} canRestaurar={isCoordinator} />
            </TabsContent>
          )}

          {isCoordinator && (
            <TabsContent value="convites" className="flex-1 overflow-auto space-y-4 mt-3">
              <ConvidarMembroPanel projetoId={projetoId} isDevProduto={isDevProduto} />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Convites enviados
                </h4>
                <ConvitesPendentesList projetoId={projetoId} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="membros" className="flex-1 overflow-hidden flex flex-col gap-4 mt-3">
          {recentlyAdded.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {recentlyAdded.length === 1 ? "Membro adicionado" : `${recentlyAdded.length} membros adicionados`}
                </p>
                <p className="text-muted-foreground truncate">{recentlyAdded.join(", ")}</p>
              </div>
              <button
                onClick={() => setRecentlyAdded([])}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {recentlyRemoved && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs">
              <UserMinus className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{recentlyRemoved} foi removido(a) do projeto.</p>
              </div>
              <button
                onClick={() => setRecentlyRemoved(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {isCoordinator && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário por nome ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setShowTeamDialog(true)}
                >
                  <Users className="h-4 w-4" />
                  Adicionar Membros
                </Button>
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
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          addMembro.mutate({
                            userId: profile.id,
                            papel: "membro",
                            profile: { nome: profile.nome, avatar_url: profile.avatar_url },
                          });
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

          <ScrollArea className="flex-1 max-h-[55vh] overflow-auto">
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
                        {membro.profile?.email && (
                          <p className="text-xs text-muted-foreground truncate">{membro.profile.email}</p>
                        )}
                      </div>

                      {isCoordinator && membro.user_id !== user?.id ? (
                        <Select
                          value={papel}
                          onValueChange={(v) => updatePapel.mutate({ membroId: membro.id, papel: v })}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-[10px]">
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

                      {isCoordinator && membro.user_id !== user?.id && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => offboardingEnabled ? setWizardMembro(membro) : setRemoveMemberConfirm({ id: membro.id, nome: membro.profile?.nome || "membro" })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Remover do projeto</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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

          {/* Produtos Vinculados — oculto em projetos genéricos */}
          {projetoTipo !== "generico" && (
            <ProjetoProdutosVinculados projetoId={projetoId} isCoordinator={isCoordinator} />
          )}
          </TabsContent>
        </Tabs>
        </fieldset>
      </DialogContent>
    </Dialog>

    {/* Remove member confirmation */}
    <AlertDialog
      open={!!removeMemberConfirm}
      onOpenChange={(v) => {
        // Bloqueia fechamento durante a remoção; só permite cancelar.
        if (removingMembro) return;
        if (!v) {
          setRemoveMemberConfirm(null);
          setRemoveError(null);
        }
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(e) => { if (removingMembro) e.preventDefault(); }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {removingMembro ? `Removendo ${removingMembro.nome}…` : "Remover membro?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {removingMembro
              ? "Aguarde — revogando acesso e atualizando a equipe do projeto."
              : `${removeMemberConfirm?.nome || "O membro"} perderá acesso ao projeto. Esta ação pode ser revertida adicionando-o novamente.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {removingMembro && (
          <div
            role="status"
            aria-live="polite"
            data-testid="alert-removing-status"
            className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
            <span>Processando remoção. Não feche esta janela.</span>
          </div>
        )}
        {removeError && !removingMembro && (
          <div
            role="alert"
            data-testid="remove-error"
            data-attempt={removeError.attempt}
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-foreground">
                Não foi possível remover {removeMemberConfirm?.nome || "o membro"}.
              </p>
              <p className="text-muted-foreground">{removeError.message}</p>
              {(removeError.code || removeError.status) && (
                <p className="text-[10px] text-muted-foreground/80 font-mono">
                  {removeError.status ? `HTTP ${removeError.status}` : null}
                  {removeError.status && removeError.code ? " · " : null}
                  {removeError.code ? `code: ${removeError.code}` : null}
                </p>
              )}
              {removeError.hint && (
                <p className="text-[10px] text-muted-foreground/80">Dica: {removeError.hint}</p>
              )}
              {removeError.attempt > 1 && (
                <p className="text-[10px] text-muted-foreground/80">
                  Tentativa {removeError.attempt}. Verifique sua conexão ou contate o administrador se o erro persistir.
                </p>
              )}
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={!!removingMembro}
            onClick={() => { setRemoveError(null); setRemoveAttempt(0); }}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!!removingMembro}
            onClick={async (e) => {
              e.preventDefault();
              if (!removeMemberConfirm) return;
              const target = removeMemberConfirm;
              const attempt = removeAttempt + 1;
              setRemoveAttempt(attempt);
              setRemoveError(null);
              setRemovingMembro(target);
              // Sufixo invisível garante string única por tentativa — screen readers
              // re-anunciam mesmo quando a mensagem semântica é igual.
              setLiveMessage(`Removendo ${target.nome}… \u200B`.repeat(1) + `(tentativa ${attempt})`);
              try {
                await removeMembro.mutateAsync(target.id);
                setRecentlyRemoved(target.nome);
                setLiveMessage(`${target.nome} foi removido(a) do projeto com sucesso.`);
                window.setTimeout(() => setRecentlyRemoved(null), 5000);
                setRemovingMembro(null);
                setRemoveMemberConfirm(null);
                setRemoveAttempt(0);
              } catch (err) {
                const anyErr = err as any;
                const message =
                  anyErr?.message ||
                  (typeof err === "string" ? err : "Erro desconhecido. Tente novamente.");
                const code = anyErr?.code ?? anyErr?.error?.code;
                const hint = anyErr?.hint ?? anyErr?.details;
                const status = anyErr?.status ?? anyErr?.statusCode;
                setRemovingMembro(null);
                setRemoveError({ message, code, hint, status, attempt });
                setLiveMessage(
                  `Falha ao remover ${target.nome} (tentativa ${attempt}): ${message}. Você pode tentar novamente.`,
                );
                // mantém o AlertDialog aberto para nova tentativa
              }
            }}
          
          >
            {removingMembro ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Removendo…</>
            ) : removeError ? (
              "Tentar novamente"
            ) : (
              "Remover"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Sub-dialog: Adicionar Membros (empresa toda) */}
    <Dialog
      open={showTeamDialog}
      onOpenChange={(v) => {
        setShowTeamDialog(v);
        if (!v) {
          setSelectedTeamIds([]);
          setTeamSearch("");
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Adicionar Membros
          </DialogTitle>
          <DialogDescription>
            Selecione pessoas da empresa para adicionar ao projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[300px]">
          {loadingAllUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {teamSearch.trim()
                ? `Nenhuma pessoa encontrada para "${teamSearch.trim()}".`
                : "Todos os usuários já estão no projeto."}
            </p>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((sub) => (
                <label
                  key={sub.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedTeamIds.includes(sub.id)}
                    onCheckedChange={() => toggleTeamUser(sub.id)}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={sub.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {sub.nome?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sub.nome ?? "Sem nome"}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowTeamDialog(false);
              setSelectedTeamIds([]);
              setTeamSearch("");
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddTeam}
            disabled={selectedTeamIds.length === 0 || addingTeam}
          >
            {addingTeam && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar {selectedTeamIds.length > 0 ? `(${selectedTeamIds.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {offboardingEnabled && (
      <RemoverMembroWizard
        open={!!wizardMembro}
        onOpenChange={(v) => !v && setWizardMembro(null)}
        projetoId={projetoId}
        membro={wizardMembro}
        outrosMembros={membros}
      />
    )}
    </>
  );
}

