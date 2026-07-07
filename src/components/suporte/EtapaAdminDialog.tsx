import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Plus, UserPlus, Users, AlertTriangle, ChevronDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useEtapaPapeis,
  useAddEtapaPapel,
  useRemoveEtapaPapel,
  useSalvarParecerEtapa,
  useSalvarDescritivoAtividades,
  type PapelEtapa,
  type EtapaPapelRow,
} from "@/hooks/suporte/useEtapaPapeis";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  etapaId: string | null;
  etapaNome?: string;
  parecerAtual?: string | null;
}

function useProfilesSearch(q: string) {
  return useQuery({
    queryKey: ["profiles-search-etapa", q],
    enabled: q.length >= 1,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, nome, avatar_url")
        .ilike("nome", `%${q}%`)
        .limit(20);
      return (data ?? []) as { id: string; nome: string | null; avatar_url: string | null }[];
    },
  });
}

function iniciais(nome: string | null | undefined) {
  return (nome ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PapelSection({
  etapaId,
  papel,
  titulo,
  descricao,
  icon: Icon,
}: {
  etapaId: string;
  papel: PapelEtapa;
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { data: papeis = [] } = useEtapaPapeis(etapaId);
  const addP = useAddEtapaPapel();
  const remP = useRemoveEtapaPapel();
  const filtrados = useMemo(() => papeis.filter((p) => p.papel === papel), [papeis, papel]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: results = [] } = useProfilesSearch(q);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1">
          <Label className="text-sm font-medium">{titulo}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtrados.map((p) => (
          <Badge key={p.id} variant="secondary" className="gap-2 pl-1 pr-1.5 py-1 h-7">
            <Avatar className="h-5 w-5">
              <AvatarImage src={p.profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">{iniciais(p.profile?.nome)}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{p.profile?.nome ?? "—"}</span>
            <button
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remP.mutate({ id: p.id, etapa_id: etapaId })}
              aria-label="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Buscar usuário…" value={q} onValueChange={setQ} />
              <CommandList>
                <CommandEmpty>Digite para buscar.</CommandEmpty>
                <CommandGroup>
                  {results.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onSelect={() => {
                        addP.mutate(
                          { etapa_id: etapaId, user_id: r.id, papel },
                          {
                            onSuccess: () => {
                              setOpen(false);
                              setQ("");
                            },
                          },
                        );
                      }}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{iniciais(r.nome)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{r.nome ?? r.id.slice(0, 8)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function EtapaAdminDialog({ open, onOpenChange, etapaId, etapaNome, parecerAtual }: Props) {
  const [parecer, setParecer] = useState("");
  const salvarParecer = useSalvarParecerEtapa();

  useEffect(() => {
    if (open) setParecer(parecerAtual ?? "");
  }, [open, parecerAtual]);

  if (!etapaId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etapa: {etapaNome ?? "—"}</DialogTitle>
          <DialogDescription>
            Configuração administrativa da etapa. Estes ajustes são aplicados a novas execuções do processo.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="parecer" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="parecer">Parecer</TabsTrigger>
            <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
            <TabsTrigger value="seguidores">Seguidores</TabsTrigger>
            <TabsTrigger value="escalonados">Escalação</TabsTrigger>
          </TabsList>

          <TabsContent value="parecer" className="space-y-3 pt-4">
            <Label className="text-sm">Parecer administrativo</Label>
            <p className="text-xs text-muted-foreground">
              Descreva o objetivo, critérios de aceite e observações operacionais desta etapa.
            </p>
            <Textarea
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              placeholder="Ex.: Conferir DRE do dia, validar apuração e enviar ao Fiscal…"
              className="min-h-[200px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  salvarParecer.mutate({ etapa_id: etapaId, parecer_administrativo: parecer })
                }
                disabled={salvarParecer.isPending}
              >
                Salvar parecer
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="responsaveis" className="pt-4">
            <PapelSection
              etapaId={etapaId}
              papel="responsavel"
              titulo="Responsáveis padrão"
              descricao="Ao gerar uma execução, estes usuários já entram como responsáveis da tarefa em Projetos."
              icon={UserPlus}
            />
          </TabsContent>

          <TabsContent value="seguidores" className="pt-4">
            <PapelSection
              etapaId={etapaId}
              papel="seguidor"
              titulo="Seguidores padrão"
              descricao="Recebem notificações da tarefa gerada, sem serem responsáveis pela entrega."
              icon={Users}
            />
          </TabsContent>

          <TabsContent value="escalonados" className="pt-4">
            <PapelSection
              etapaId={etapaId}
              papel="escalonado"
              titulo="Escalação por SLA"
              descricao="Se o SLA da etapa for ultrapassado, estes usuários são adicionados como co-responsáveis e notificados."
              icon={AlertTriangle}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
