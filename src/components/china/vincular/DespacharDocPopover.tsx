import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Folder, ListChecks, User, Layers, AlertTriangle, Search } from "lucide-react";
import { useDespacharDoc } from "@/hooks/useDespacharGranular";
import { useSugerirPrazoDespacho, avisoPrazoVsTarefa } from "@/hooks/useSugerirPrazoDespacho";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";
import { useModulosDespacho } from "@/hooks/useModulosDespacho";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DespachoDestino } from "@/lib/validations/despachoDocumento";

interface Props {
  submissaoId: string;
  documentoId: string;
  documentoNome?: string;
  tipoDocumento?: string;
  trigger: React.ReactNode;
}

function useResponsaveis(search: string) {
  return useQuery({
    queryKey: ["responsaveis-despacho", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, nome, email").order("nome").limit(20);
      if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);
      const { data } = await q;
      return data || [];
    },
  });
}

export function DespacharDocPopover({ submissaoId, documentoId, documentoNome, tipoDocumento, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"projeto_tarefa" | "responsavel" | "modulo">("projeto_tarefa");

  // Projeto/Tarefa
  const [projeto, setProjeto] = useState<{ id: string; nome: string } | null>(null);
  const [tarefa, setTarefa] = useState<{ id: string; titulo: string; secao_id: string | null } | null>(null);
  const [searchProj, setSearchProj] = useState("");
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(projeto?.id ?? null);

  // Responsavel
  const [respSearch, setRespSearch] = useState("");
  const [responsavel, setResponsavel] = useState<{ id: string; nome: string } | null>(null);
  const { data: responsaveis = [] } = useResponsaveis(respSearch);

  // Módulo
  const { data: modulos = [] } = useModulosDespacho();
  const [moduloDestino, setModuloDestino] = useState<string>("");

  // Prazo / prioridade
  const { data: sugestao } = useSugerirPrazoDespacho({ tipo_documento: tipoDocumento, tarefa_id: tarefa?.id });
  const [prazo, setPrazo] = useState<string>("");
  const [prioridade, setPrioridade] = useState<"normal" | "alta" | "critica">("normal");
  const [obs, setObs] = useState("");
  const [origemPrazo, setOrigemPrazo] = useState<"tarefa" | "tipo_doc" | "manual" | "default">("default");

  // sincroniza prazo com sugestão quando muda contexto
  useMemo(() => {
    if (sugestao && !prazo) {
      setPrazo(sugestao.prazoIso);
      setOrigemPrazo(sugestao.origem);
    }
  }, [sugestao, prazo]);

  // tarefa prazo (para aviso)
  const { data: tarefaInfo } = useQuery({
    queryKey: ["tarefa-prazo-info", tarefa?.id],
    queryFn: async () => {
      if (!tarefa?.id) return null;
      const { data } = await supabase.from("projeto_tarefas").select("data_prazo").eq("id", tarefa.id).maybeSingle();
      return data;
    },
    enabled: !!tarefa?.id,
  });
  const aviso = avisoPrazoVsTarefa(prazo, tarefaInfo?.data_prazo);

  const despachar = useDespacharDoc();

  const filteredProjetos = useMemo(() => {
    const q = searchProj.trim().toLowerCase();
    if (!q) return projetos;
    return (projetos as any[]).filter((p) => (p.nome ?? "").toLowerCase().includes(q));
  }, [projetos, searchProj]);

  const tarefas = (secoesData?.tarefas ?? []) as any[];

  const reset = () => {
    setProjeto(null); setTarefa(null); setResponsavel(null); setModuloDestino("");
    setPrazo(""); setPrioridade("normal"); setObs(""); setSearchProj(""); setRespSearch("");
    setOrigemPrazo("default");
  };

  const close = () => { reset(); setOpen(false); };

  const podeEnviar = () => {
    if (!prazo) return false;
    if (tab === "projeto_tarefa") return !!projeto;
    if (tab === "responsavel") return !!responsavel;
    if (tab === "modulo") return !!moduloDestino;
    return false;
  };

  const handleEnviar = async () => {
    let destino: DespachoDestino | null = null;
    if (tab === "projeto_tarefa" && projeto) {
      destino = {
        tipo: "projeto_tarefa",
        projeto_id: projeto.id,
        projeto_nome: projeto.nome,
        tarefa_id: tarefa?.id ?? null,
        tarefa_titulo: tarefa?.titulo ?? null,
        secao_id: tarefa?.secao_id ?? null,
      };
    } else if (tab === "responsavel" && responsavel) {
      destino = {
        tipo: "responsavel",
        responsavel_id: responsavel.id,
        responsavel_nome: responsavel.nome,
      };
    } else if (tab === "modulo" && moduloDestino) {
      destino = { tipo: "modulo", modulo_destino: moduloDestino };
    }
    if (!destino) return;

    await despachar.mutateAsync({
      submissao_id: submissaoId,
      documento_id: documentoId,
      documento_nome: documentoNome,
      destinos: [destino],
      prazo_sla: prazo,
      prazo_origem: origemPrazo,
      sla_horas_uteis: sugestao?.horas_uteis ?? null,
      prioridade,
      observacao: obs.trim() || undefined,
    });
    close();
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[420px] p-3" align="end">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Despachar documento
        </p>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="h-8 w-full grid grid-cols-3">
            <TabsTrigger value="projeto_tarefa" className="text-[11px] gap-1"><Folder className="h-3 w-3" />Projeto</TabsTrigger>
            <TabsTrigger value="responsavel" className="text-[11px] gap-1"><User className="h-3 w-3" />Pessoa</TabsTrigger>
            <TabsTrigger value="modulo" className="text-[11px] gap-1"><Layers className="h-3 w-3" />Módulo</TabsTrigger>
          </TabsList>

          <TabsContent value="projeto_tarefa" className="mt-2 space-y-2">
            {!projeto ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchProj}
                    onChange={(e) => setSearchProj(e.target.value)}
                    placeholder="Buscar projeto"
                    className="h-7 pl-7 text-xs"
                  />
                </div>
                <ScrollArea className="h-40 rounded border border-border">
                  <ul className="divide-y divide-border/40">
                    {(filteredProjetos as any[]).map((p) => (
                      <li
                        key={p.id}
                        onClick={() => setProjeto({ id: p.id, nome: p.nome })}
                        className="cursor-pointer px-2 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2"
                      >
                        <Folder className="h-3.5 w-3.5" style={{ color: p.cor || undefined }} />
                        <span className="truncate flex-1">{p.nome}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1">
                  <span className="text-xs font-medium truncate">{projeto.nome}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setProjeto(null); setTarefa(null); }}>
                    Trocar
                  </Button>
                </div>
                <ScrollArea className="h-32 rounded border border-border">
                  <ul className="divide-y divide-border/40">
                    <li
                      onClick={() => setTarefa(null)}
                      className={`cursor-pointer px-2 py-1.5 text-xs hover:bg-muted/50 ${!tarefa ? "bg-primary/10" : ""}`}
                    >
                      <span className="italic text-muted-foreground">Sem tarefa específica</span>
                    </li>
                    {tarefas.map((t) => (
                      <li
                        key={t.id}
                        onClick={() => setTarefa({ id: t.id, titulo: t.titulo, secao_id: t.secao_id })}
                        className={`cursor-pointer px-2 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2 ${tarefa?.id === t.id ? "bg-primary/10" : ""}`}
                      >
                        <ListChecks className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate flex-1">{t.titulo}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="responsavel" className="mt-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={respSearch}
                onChange={(e) => setRespSearch(e.target.value)}
                placeholder="Buscar pessoa"
                className="h-7 pl-7 text-xs"
              />
            </div>
            <ScrollArea className="h-40 rounded border border-border">
              <ul className="divide-y divide-border/40">
                {(responsaveis as any[]).map((r) => (
                  <li
                    key={r.id}
                    onClick={() => setResponsavel({ id: r.id, nome: r.nome || r.email })}
                    className={`cursor-pointer px-2 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2 ${responsavel?.id === r.id ? "bg-primary/10" : ""}`}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate flex-1">{r.nome || r.email}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="modulo" className="mt-2 space-y-2">
            <Select value={moduloDestino} onValueChange={setModuloDestino}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar módulo" /></SelectTrigger>
              <SelectContent>
                {(modulos as any[]).map((m: any) => (
                  <SelectItem key={m.id || m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">Prazo</Label>
            <Input
              type="date"
              value={prazo}
              onChange={(e) => { setPrazo(e.target.value); setOrigemPrazo("manual"); }}
              className="h-7 text-xs"
            />
            {sugestao && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Sugerido por {origemPrazo === "tarefa" ? "tarefa" : origemPrazo === "tipo_doc" ? "tipo do doc" : origemPrazo === "manual" ? "edição manual" : "padrão"}
              </p>
            )}
          </div>
          <div>
            <Label className="text-[11px]">Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {aviso && (
          <div className="mt-2 flex items-start gap-1.5 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{aviso}</span>
          </div>
        )}

        <div className="mt-2">
          <Label className="text-[11px]">Observação</Label>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="mt-0.5 min-h-[48px] text-xs"
            placeholder="Contexto ou instruções"
            maxLength={500}
          />
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>Cancelar</Button>
          <Button size="sm" className="gap-1.5" disabled={!podeEnviar() || despachar.isPending} onClick={handleEnviar}>
            <Send className="h-3 w-3" />
            {despachar.isPending ? "Despachando..." : "Despachar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
