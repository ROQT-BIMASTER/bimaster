import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Users, LogOut, Crown, Star, BellOff, Bell, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversaInfo } from "@/hooks/chat/useMensagens";
import { useConversas } from "@/hooks/chat/useConversas";
import { useChatActions } from "@/hooks/chat/useChatActions";
import { useGlobalPresence } from "@/hooks/chat/useChatPresence";
import { useAuth } from "@/contexts/AuthContext";
import { initials, nomeConversa } from "./utils";
import { ConversaMediaGallery } from "./ConversaMediaGallery";

interface Props {
  conversaId: string;
  onClose: () => void;
  className?: string;
}

export function ConversaInfoPanel({ conversaId, onClose, className }: Props) {
  const { user } = useAuth();
  const uid = user?.id;
  const { data: info } = useConversaInfo(conversaId);
  const { data: conversas = [] } = useConversas();
  const conv = conversas.find((c) => c.id === conversaId);
  const actions = useChatActions();
  const { online } = useGlobalPresence();

  if (!conv) return null;
  const isGrupo = conv.tipo === "group" || conv.tipo === "grupo";
  const minhaPerm = conv.papel;

  return (
    <aside className={cn("flex flex-col h-full bg-card border-l border-border", className)}>
      <header className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">Informações</h3>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 flex flex-col items-center text-center border-b border-border">
          <Avatar className="h-20 w-20 mb-3">
            <AvatarImage src={conv.avatar_url ?? conv.outroUsuario?.avatar_url ?? undefined} />
            <AvatarFallback className={cn("text-xl", isGrupo && "bg-primary/15 text-primary")}>
              {isGrupo ? <Users className="h-7 w-7" /> : initials(conv.outroUsuario?.nome, conv.outroUsuario?.email)}
            </AvatarFallback>
          </Avatar>
          <h4 className="font-semibold">{nomeConversa(conv)}</h4>
          {!isGrupo && conv.outroUsuario?.email && (
            <p className="text-xs text-muted-foreground mt-0.5">{conv.outroUsuario.email}</p>
          )}
          {isGrupo && info?.conversa?.descricao && (
            <p className="text-xs text-muted-foreground mt-2 italic">{info.conversa.descricao}</p>
          )}
        </div>

        <div className="p-2 grid grid-cols-3 gap-1 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto py-2 gap-1"
            onClick={() => actions.setParticipanteFlag.mutate({ conversaId, patch: { favorita: !conv.favorita } })}
          >
            <Star className={cn("h-4 w-4", conv.favorita && "fill-amber-400 text-amber-400")} />
            <span className="text-[10px]">Favorito</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto py-2 gap-1"
            onClick={() => {
              const ate = conv.silenciada_ate ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
              actions.setParticipanteFlag.mutate({ conversaId, patch: { silenciada_ate: ate } });
            }}
          >
            {conv.silenciada_ate ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="text-[10px]">{conv.silenciada_ate ? "Reativar" : "Silenciar"}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto py-2 gap-1"
            onClick={() => actions.setParticipanteFlag.mutate({ conversaId, patch: { arquivada: !conv.arquivada } })}
          >
            <Archive className="h-4 w-4" />
            <span className="text-[10px]">{conv.arquivada ? "Desarq." : "Arquivar"}</span>
          </Button>
        </div>

        {isGrupo && (
          <div className="p-3">
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              {info?.participantes?.length ?? 0} Participantes
            </h5>
            <ul className="space-y-1">
              {info?.participantes?.map((p: any) => {
                const ehAdm = p.papel === "admin";
                const ehMine = p.usuario_id === uid;
                const eu_admin = minhaPerm === "admin";
                return (
                  <li key={p.usuario_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(p.profile?.nome, p.profile?.email)}</AvatarFallback>
                      </Avatar>
                      {online.has(p.usuario_id) && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate flex items-center gap-1">
                        {p.profile?.nome ?? "Sem nome"} {ehMine && <span className="text-xs text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{p.profile?.email}</p>
                    </div>
                    {ehAdm && <Badge variant="secondary" className="text-[10px] gap-1"><Crown className="h-2.5 w-2.5" /> Admin</Badge>}
                    {eu_admin && !ehMine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-destructive h-7"
                        onClick={() => actions.removerParticipante.mutate({ conversaId, user: p.usuario_id })}
                      >Remover</Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-destructive hover:text-destructive"
              onClick={() => actions.sairGrupo.mutate(conversaId)}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair do grupo
            </Button>
          </div>
        )}

        <ConversaMediaGallery conversaId={conversaId} />
      </ScrollArea>
    </aside>
  );
}
