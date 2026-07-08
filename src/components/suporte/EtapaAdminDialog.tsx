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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Plus, UserPlus, Users, AlertTriangle, ChevronDown, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
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

/**
 * Descobre o projeto vinculado à etapa (via rotina_fixa → projeto_id_espelho).
 * Assim o picker de responsáveis lista TODOS os colaboradores do projeto,
 * independente do papel do usuário logado (antes só admins conseguiam ver a
 * lista completa porque a busca em profiles é limitada por RLS).
 */
function useProjetoDaEtapa(etapaId: string | null) {
  return useQuery({
    queryKey: ["projeto-da-etapa", etapaId],
    enabled: !!etapaId,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data: etapa } = await (supabase as any)
        .from("processo_etapas")
        .select("rotina_fixa_id")
        .eq("id", etapaId!)
        .maybeSingle();
      const rotinaId = etapa?.rotina_fixa_id;
      if (!rotinaId) return null;
      const { data: rotina } = await (supabase as any)
        .from("suporte_rotinas_fixas")
        .select("projeto_id_espelho")
        .eq("id", rotinaId)
        .maybeSingle();
      return (rotina?.projeto_id_espelho as string | null) ?? null;
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

      <div className="space-y-2">
        {filtrados.map((p) => (
          <CollaboratorRow
            key={p.id}
            row={p}
            onRemove={() => remP.mutate({ id: p.id, etapa_id: etapaId })}
          />
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Adicionar colaborador
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

function CollaboratorRow({ row, onRemove }: { row: EtapaPapelRow; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [descritivo, setDescritivo] = useState(row.descritivo_atividades ?? "");
  const salvar = useSalvarDescritivoAtividades();

  useEffect(() => {
    setDescritivo(row.descritivo_atividades ?? "");
  }, [row.descritivo_atividades]);

  const hasDescritivo = !!(row.descritivo_atividades && row.descritivo_atividades.trim().length > 0);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="border rounded-md bg-muted/30">
      <div className="flex items-center gap-2 p-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={row.profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{iniciais(row.profile?.nome)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{row.profile?.nome ?? "—"}</div>
          {hasDescritivo && !expanded && (
            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{row.descritivo_atividades}</span>
            </div>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <FileText className="h-3 w-3" />
            {hasDescritivo ? "Editar" : "Descritivo"}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remover"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CollapsibleContent className="px-2 pb-2 space-y-2">
        <Label className="text-xs text-muted-foreground">
          Descritivo das atividades desse colaborador nesta etapa
        </Label>
        <Textarea
          value={descritivo}
          onChange={(e) => setDescritivo(e.target.value)}
          placeholder="Ex.: Conferir DRE do dia, validar apuração e enviar ao Fiscal…"
          className="min-h-[110px] text-sm bg-background"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDescritivo(row.descritivo_atividades ?? "")}
            disabled={salvar.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              salvar.mutate({
                id: row.id,
                etapa_id: row.etapa_id,
                descritivo_atividades: descritivo,
              })
            }
            disabled={salvar.isPending}
          >
            {salvar.isPending ? "Salvando…" : "Salvar descritivo"}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
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
