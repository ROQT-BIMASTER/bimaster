import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "./utils";
import type { ChatMensagem, ChatProfile } from "@/hooks/chat/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mensagem: ChatMensagem;
  uid: string;
}

interface ParticipanteLeitura {
  user_id: string;
  profile: ChatProfile | null;
  lida_em: string | null;
}

/**
 * "Dados da mensagem" no estilo WhatsApp:
 * mostra horário de envio + para cada participante (exceto o remetente)
 * o horário em que a mensagem foi lida (ou "Aguardando" se ainda não foi).
 *
 * "Entregue" é inferido como o created_at da mensagem — não temos um
 * canal dedicado de delivery receipt; quando o servidor aceita o INSERT
 * a mensagem está disponível pra todos os participantes via Realtime.
 */
export function MessageInfoDialog({ open, onOpenChange, mensagem, uid }: Props) {
  const [loading, setLoading] = useState(false);
  const [participantes, setParticipantes] = useState<ParticipanteLeitura[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { data: parts } = await supabase
          .from("conversas_participantes")
          .select("usuario_id")
          .eq("conversa_id", mensagem.conversa_id)
          .is("saiu_em", null);
        const ids = (parts ?? [])
          .map((p) => p.usuario_id)
          .filter((id) => id !== mensagem.remetente_id);

        const [{ data: leituras }, { data: profs }] = await Promise.all([
          supabase
            .from("mensagens_leituras")
            .select("user_id, lida_em")
            .eq("mensagem_id", mensagem.id),
          ids.length
            ? supabase
                .from("chat_directory" as any)
                .select("id, nome, avatar_url")
                .in("id", ids)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const lMap = new Map<string, string>();
        (leituras ?? []).forEach((l: any) => lMap.set(l.user_id, l.lida_em));
        const pMap = new Map<string, ChatProfile>();
        (profs ?? []).forEach((p: any) => pMap.set(p.id, p));

        if (!alive) return;
        setParticipantes(
          ids.map((id) => ({
            user_id: id,
            profile: pMap.get(id) ?? null,
            lida_em: lMap.get(id) ?? null,
          })),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, mensagem.id, mensagem.conversa_id, mensagem.remetente_id]);

  const lidas = participantes.filter((p) => p.lida_em);
  const naoLidas = participantes.filter((p) => !p.lida_em);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-base">Dados da mensagem</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Conteúdo</p>
          <p className="text-sm line-clamp-3 break-words">
            {mensagem.conteudo || (mensagem.tipo === "imagem" ? "Foto" : "Anexo")}
          </p>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            <Section
              icon={<CheckCheck className="h-4 w-4 text-sky-500" />}
              titulo="Lida"
              participantes={lidas}
              campo="lida_em"
              vazio="Ninguém leu ainda"
            />
            <Separator />
            <Section
              icon={<Check className="h-4 w-4 text-muted-foreground" />}
              titulo="Entregue"
              participantes={naoLidas.length ? naoLidas : participantes}
              campo="entregue"
              created_at={mensagem.created_at}
              vazio="—"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon, titulo, participantes, campo, created_at, vazio,
}: {
  icon: React.ReactNode;
  titulo: string;
  participantes: ParticipanteLeitura[];
  campo: "lida_em" | "entregue";
  created_at?: string;
  vazio: string;
}) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        {icon}
        <span>{titulo}</span>
        <span className="text-xs text-muted-foreground font-normal">({participantes.length})</span>
      </div>
      {participantes.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-6">{vazio}</p>
      ) : (
        <ul className="space-y-1.5">
          {participantes.map((p) => {
            const ts = campo === "lida_em" ? p.lida_em : created_at;
            return (
              <li key={p.user_id} className="flex items-center gap-2 pl-1">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials(p.profile?.nome ?? null)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.profile?.nome ?? "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ts ? formatStatusDate(ts) : "Aguardando"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatStatusDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hoje = now.toDateString() === d.toDateString();
  const ontem = new Date(now); ontem.setDate(now.getDate() - 1);
  const ehOntem = ontem.toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (hoje) return `Hoje ${hora}`;
  if (ehOntem) return `Ontem ${hora}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + ` ${hora}`;
}
